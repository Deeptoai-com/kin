---
title: "第 12 篇：会话持久化 —— SDK transcript 为真相、DB 13 表为索引，与那个 resume 坑"
slug: 12-session-persistence
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 12
keywords: [会话持久化, SDK transcript, Drizzle, resume, agent_session]
prev: 11-multi-tenant-isolation
next: 13-single-host-concurrency
---

# 第 12 篇：会话持久化 —— SDK transcript 为真相、DB 13 表为索引，与那个 resume 坑

> worker 跑完即死（第 03 篇），那会话内容存哪？OxyGenie 的选择和 HarWork 相反：**不是 DB 存全部消息，而是让 SDK 的 transcript JSONL 当真相、DB 只当索引。** 这一篇讲这个"双源"设计、13 张表怎么分、以及一个真实踩过的 resume bug——相对路径 + 双 cwd 让历史归零。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案transcript-为真相--db-为索引) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

第 03 篇定下了 per-message worker：worker 无状态、用完即弃，跑完连同它 fork 出的 Python/Bash 一起被操作系统回收。这是隔离和可中断的红利，但它把一个问题甩到了持久化层：**worker 死了，这一轮对话的内容存哪？**

具体要同时满足三件事：

1. **刷新不丢历史**：用户关掉浏览器、第二天重新打开，整段对话——包括模型的思考、调过的工具、产出的文件——要原样还在。
2. **能 resume 续聊**：点开一个旧会话再发一句，模型要带着完整的上下文继续，而不是从零开始。
3. **UI 能快速列会话**：左侧会话列表要秒开，按"最后活跃时间"排序，每条显示标题——这意味着列表查询不能去扫一堆 JSONL 文件。

而约束 5（第 03 篇）依旧在头顶悬着：**不自己重写 SDK 已经做好的事。** 偏偏"把对话落盘、管理线程、记 token 账"正是 SDK 已经在做的。于是真正的问题不是"怎么存"，而是"**内容的真相该放哪——DB 还是 SDK？**"

## 朴素方案为什么不行

**方案一：DB 存全部消息（LangGraph / 自研 engine 式）。** 最符合直觉：每条 user / assistant / tool 消息落一行表，线程、token 记账都自己建表维护。HarWork 走的就是这条——它自研 engine、自己掌控 Loop，消息当然由它落库。但 OxyGenie 站在 SDK 上，这条路立刻撞墙：SDK 的 `query()` 已经把对话写成了 transcript JSONL，状态、线程、token 全在里面。你再写一套消息摄取，等于**把 SDK 已经落好的东西重新解析一遍、再存一遍**——纯重复劳动，而且 SDK 一改 transcript 格式，你的摄取层就得跟着改。

**方案二：DB 不存任何会话级信息，每次扫磁盘。** 那就别建表了，列会话时去 `workspace` 目录里扫所有 JSONL、读出标题和时间排序。问题是这个目录随用户和会话线性膨胀，列一次表要 stat + 读首行几百个文件，左侧列表从"秒开"变成"转圈"。**索引不存进 DB，每次查询就要为不存在的索引付全表扫描的代价。**

**方案三：DB 存全部消息 + transcript 也留着（双写真相）。** 既然两边都有用，干脆都当真相、双向同步。但"两个真相"是分布式系统里最贵的东西——SDK 在 worker 子进程里写 JSONL，DB 在 ws-server 主进程里写表，两个进程、两套写入时机，一旦不一致你根本不知道该信谁。同步逻辑的复杂度会把"省下来的重写工作量"加倍还回来。

三个方案的共同教训：**真相只能有一个，而那个真相 SDK 已经替你落好了。** DB 存全部消息是重写 SDK 的活；不存 DB 是把列表查询拖垮；双写是给自己造一致性地狱。中间那个甜点是——**让 SDK 的 transcript 当唯一真相，DB 退化成一张只回答"有哪些会话、resume ID 是什么"的索引表。**

## 核心方案：transcript 为真相 + DB 为索引

OxyGenie 的持久化模型可以一句话概括：

> **SDK 的 transcript JSONL 是内容真相，DB 是指向真相的索引。** 对话的每一个字都在 `workspace/.../.claude/projects/{hash}/{sdkSessionId}.jsonl` 里，由 SDK 写、由 SDK 读；DB 只存"这个用户有哪些会话、每个会话的 resume ID 和落盘路径是什么"——足够 UI 列表和 resume 用，仅此而已。

```
┌─ SDK transcript（真相） ──────────────────────────┐
│ workspace/.../.claude/projects/{hash}/            │
│        {sdkSessionId}.jsonl                       │
│   ├─ 每条 user / assistant / tool 消息            │
│   ├─ 线程、上下文、token 记账                      │
│   └─ resume 时 SDK 自己读它续上                    │
└───────────────────────────────────────────────────┘
              ▲ resume 按路径 + realSdkSessionId 找回它
              │
┌─ DB（索引/UI） ───────────────────────────────────┐
│ agent_session                                     │
│   sdkSessionId      ← 我们的 workspace 会话 ID     │
│   realSdkSessionId  ← SDK 的 resume ID            │
│   claudeHomePath    ← 绝对路径（指向上面那个目录） │
│   title / lastMessageAt ← UI 列表用               │
└───────────────────────────────────────────────────┘
```

逐项拆开为什么这个分工成立：

- **SDK transcript = 真相。** SDK 在 worker 的 cwd（per-session workspace，第 11 篇）下把整段对话写成 JSONL，状态机、线程关系、token 用量都封装在里面。我们不碰它的内部结构，只在需要 resume 时把路径和 ID 喂回去，让 SDK 自己读自己写的东西续上。这正是约束 5 的兑现：**会话存储是 SDK 已经做完的事，白拿。**

- **DB = 索引/UI。** `agent_session` 表存的全是"指针"和"门面"：`sdkSessionId` 是我们这边的 workspace 会话 ID，`realSdkSessionId` 是 SDK 那边的 resume ID（两者刻意分开——见实现要点），`claudeHomePath` 是指向 transcript 目录的**绝对路径**，再加 `title`、`lastMessageAt` 给列表用。列会话就是一条 `WHERE userId = ? ORDER BY lastMessageAt`，秒开，不碰任何 JSONL。

- **13 张领域表，按域分。** 除了会话本身，OxyGenie 的领域数据分成五个域（计费/审计相关详见第 17 篇），外加 Better Auth 自带的 user / session / organization / member / subscription：

| 域 | 表 |
|----|----|
| 会话 | `agent_session` |
| 文档/文件 | `document`、`session_document`、`message_attachment` |
| 知识库 | `knowledge_base`、`kb_document` |
| 用量/审计 | `usage_record`、`audit_log`（第 17 篇） |
| 计费 | `plans`、`subscriptions`、`credit_balances`、`credit_ledger`、`invoices`（第 17 篇） |

注意：这 13 张表里**没有一张是"消息表"**。消息不在 DB——那是 transcript 的活。DB 管的是会话的元数据、文件的关联、用量的记账，全是 transcript 不负责的"周边"。

- **未来翻转：DB 为真相、transcript 为缓存。** 这套设计的便宜，建立在"把别人的缓存当自己的真相"上，而它埋着一颗雷（见反直觉结论与坑二）。所以 Skills/MCP 阶段之后，计划把真相迁回 DB（加一张 `message` 表落消息），transcript 降级成缓存——换来健壮性和离线历史。当下这版是"最省的起点"，不是"最终形态"。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/db/schema/agent-session.schema.ts` | L16–55 | 会话表；`sdkSessionId` vs `realSdkSessionId`；unique(userId, sdkSessionId) |
| `src/db/schema/usage-record.schema.ts` | L24–67 | 每模型一行（第 17 篇） |
| `src/db/schema/audit-log.schema.ts` | L17–46 | append-only 审计（第 17 篇） |

`agent_session` 里最该讲清的是**两个 session ID 为什么要分开**。`sdkSessionId` 是 OxyGenie 这边稳定的 workspace 会话标识——它从会话创建那一刻起就不变，是 DB 主键级别的身份，`unique(userId, sdkSessionId)` 保证同一用户下不重复。而 `realSdkSessionId` 是 **SDK 在一次具体 `query()` 里生成、resume 时要回喂给 SDK 的那个 ID**——它属于 SDK 的内部世界。把两者分开，是因为"我们怎么标识一个会话"和"SDK 怎么 resume 它的 transcript"是两件事：前者要对 UI 稳定，后者要对 SDK 准确。混成一个字段，迟早会在某次 resume 流程里把两种语义搅在一起。

`claudeHomePath` 存**绝对路径**这件事看着不起眼，却是坑一的全部根因——下面专门讲。

## 反直觉结论

> [!IMPORTANT]
> **当官方 SDK 已经把对话落成 transcript，最省的持久化策略是"让它当真相，DB 只做索引"。**
>
> 你不必重写消息存储——SDK 的 JSONL 就是真相，DB 只回答"这个用户有哪些会话、resume ID 是多少"。这跟第 03 篇是同一个哲学的两面：进程用完即弃（无状态执行单元），状态留在磁盘上（transcript + DB 索引）。代价是：UI 历史依赖 SDK resume，**resume 一旦失败，UI 就空了**——因为真相根本不在你手里，在 SDK 落的那个 JSONL 里。这也是为什么后续要把真相迁回 DB：*把别人的缓存当自己的真相，迟早要还*。便宜的起点不等于稳的终点，而"省下来的重写工作量"，会在某个 resume 失败的清晨连本带利地讨回去。

## 三个生产坑

> [!WARNING]
> **坑一（已修，2026-06-02）—— 相对路径 + 双 cwd，让历史归零。**
> 旧版 `claudeHomePath` 存的是相对路径。但 worker 的 cwd 是 per-session workspace，跟 ws-server 主进程的 cwd 根本不是同一个目录（第 03 篇坑二讲的就是这个）。同一个相对路径，在 worker 里解析出 transcript A、在 ws-server 写 DB 时解析出 transcript B——resume 时按 DB 里的路径去找，自然找不到那个 JSONL，**整段历史归零、UI 直接空白**。它和第 03 篇 trap 2（`CLAUDE_SESSIONS_ROOT` 必须绝对路径）是同一个根：**两个进程、两个 cwd，任何相对路径都是定时炸弹**。修复：DB 一律存绝对路径；2026-06-02 之前留下的旧会话首次 resume 可能找不到 transcript，回退成一段新对话。

> [!WARNING]
> **坑二 —— 当前没有 DB 消息历史，UI 全靠 SDK resume。**
> 这正是"把缓存当真相"那颗雷的引信。DB 里没有任何一条消息——列会话靠 `agent_session` 索引，但**会话内容**完全依赖 SDK 去读 transcript 再 resume 出来。只要 resume 这一步失败（路径错、JSONL 损坏、SDK 行为变化），UI 拿不到任何回退数据，用户看到的就是一个空对话。这不是 bug，是这版架构的固有脆弱性。补救方向已定：加一张 `message` 表把消息也落进 DB，让真相迁回我们自己手里——也就是上面说的"未来翻转"。

> [!WARNING]
> **坑三 —— `costUsd` 不是真实花费，别拿它扣费。**
> `usage_record` 里会有一个 `costUsd` 字段，但它是按 token 估出来的近似值，不是网关回传的真实账单（第 17 篇详述）。非 Claude 模型经 ARK 走时，连 token 计数都拿不全（第 14 篇坑三），这个数只能当"量级参考"。任何真要扣钱的逻辑——配额、credit、发票——都不能拿它做依据，否则会在跨模型混用时算错账。

三个坑的共同根源是同一句话：**真相不在你手里，你就要为"找回真相"的每一个环节兜底。** 路径要绝对（坑一）、resume 失败要有回退（坑二）、估算值不能当真账（坑三）——这些都是"借 SDK 的 transcript 当真相"必须付的税。等真相迁回 DB，这张税单才会真正变薄。

## 配图

1. ![双源：transcript 为真相 + DB 13 表为索引](../assets/img/12-dual-source.svg)
2. ![resume 链路与那个相对路径坑](../assets/img/12-resume-bug.svg)

## 下一篇

→ [第 13 篇：单机 50 并发](./13-single-host-concurrency.md)

会话存哪解决了，那"几十个用户同时发消息、每条都 spawn 一个 worker"怎么不把 16GB 机器 OOM？下一篇拆这道账：为什么"50 并发"靠的不是更大的机器，而是一个区分——并发会话数 ≠ 并发执行数，以及一个 8 容量的 FIFO 信号量 + 1.5GB 堆顶是怎么把"在线规模"和"执行规模"解耦的。

---

📌 [reading-map.md](../reading-map.md)
