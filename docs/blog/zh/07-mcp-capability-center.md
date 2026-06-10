---
title: "第 07 篇：MCP 能力中心 —— 7 个内置 MCP、按用户 FS 启用、凭据与覆写"
slug: 07-mcp-capability-center
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 7
keywords: [MCP, Model Context Protocol, 能力中心, 按用户启用, 凭据管理]
prev: 06-tool-system
next: 08-skills-system
---

# 第 07 篇：MCP 能力中心 —— 7 个内置 MCP、按用户 FS 启用、凭据与覆写

> MCP 让外部工具能即插即用。OxyGenie 内置 7 个 MCP（GLM-Image、Python、MarkItDown、Zhipu 的 search/vision/reader/zread），并让每个用户**自己决定开哪些**。这一篇讲：为什么用户启用状态存在**文件系统 JSON** 而不是数据库、凭据和工具覆写怎么管、为什么连接交给 SDK 而不是自己写连接管理。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案fs-启用--sdk-托管连接--可选覆写) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

OxyGenie 是组织内多用户的工作台。同一套内置 MCP（7 个）摆在那儿，但每个用户的需求不一样：有人要 Zhipu 的搜索和阅读，有人只用 Python 和图像生成；每个人的 API key 不同；进阶用户甚至想只放行某个 MCP 的部分工具、屏蔽掉危险操作。

于是要管的状态有三类：**谁开了哪些 MCP**（启用列表）、**每个 MCP 用什么 key**（凭据）、**允许调哪些工具**（覆写）。再加一个运行时问题：这些 MCP 的连接——连上、断开、重连、状态上报——由谁负责？

把这两件事摆一起，很容易顺手做成一个"MCP 管理服务"：建几张表，写一套连接池。但在动手之前值得先问一句：**这些状态，本质上是什么？连接，又真的需要我们自己管吗？**

## 朴素方案为什么不行

**方案一：启用状态全塞数据库。** 直觉做法——建张 `user_mcp_enabled` 表，启用就插一行，查询就 `SELECT`。问题在于 SDK 不读数据库。Claude Agent SDK 是**按磁盘 `settingSources` 扫描**来发现配置的：它扫的是 per-session 的 `.claude/` 目录，不是你的 Postgres。所以哪怕状态在 DB 里，运行时你**还得把它物化回磁盘**——读 DB → 写 JSON → SDK 扫 JSON。绕了一圈，DB 只是个中转站，真正起作用的还是那个文件。建表 + 查询 + 物化，三步做了一步的事。

**方案二：自己写 MCP 连接的生命周期管理。** 想给每个 MCP 写连接池、健康检查、断线重连、状态轮询。但 SDK 0.2.112 **已经自带**了 `toggleMcpServer()` / `reconnectMcpServer()` / `mcpServerStatus()`——连、断、重连、状态查询全有了。再写一遍是纯重复劳动，而且你自己那套连接状态和 SDK 内部那套迟早会不一致。

**方案三：凭据和启用混在一个大 config 里，整体覆盖。** 把启用列表、凭据、工具覆写塞进一个 JSON 整体读写。看似简单，实则每改一个 key 都要重写整份配置，并发写容易互相覆盖，凭据和偏好的生命周期还不一样（凭据要保密、启用要随会话生效）。三类状态职责不同，揉成一坨是给自己埋雷。

三个方案的共同教训：**MCP 启用本质是"用户偏好文件"，而它的消费者是"按目录扫描的 SDK"。** 当数据的下游是文件系统扫描，硬要在中间塞一层数据库，只会让你多写一遍"从 DB 物化回磁盘"的代码。连接管理同理——SDK 已经做了，自己写就是和它打架。

## 核心方案：FS 启用 + SDK 托管连接 + 可选覆写

OxyGenie 把这三类状态各自落成 per-user `.claude/` 下的一个 JSON，连接整个交给 SDK：

- **按用户 FS 启用**：`~/.claude/mcp/enabled.json`（启用列表）、`credentials.json`（凭据）、`overrides.json`（`allowedTools` 部分放行）。三个文件、三种职责，互不干扰。轻量、好备份，还**随 per-session 的 `.claude/` 软链天然生效**——启用即写文件，会话一起就被 SDK 扫到，零额外查询。
- **7 个内置 MCP**：glm-image、python、markitdown-mcp、zhipu-search、zhipu-vision、zhipu-reader、zhipu-zread（源在 `src/mcp-store/`）。这是团队精选集，不是公开市场——符合"能力是给团队自己用的精选"的定位。
- **连接交给 SDK**：我们只负责"配置"，SDK 负责"连/断/重连/状态"。`system.init` 事件会回报每个 MCP 的连接状态 + 工具数，前端据此画能力中心面板。
- **工具覆写可选**：默认放行一个 MCP 的全部工具，进阶用户可在 `overrides.json` 里按 MCP 过滤（屏蔽危险操作）。

这套设计的优雅之处在于它和 SDK 的工作方式**严丝合缝**：SDK 要扫磁盘，我们就把真相放在磁盘上；SDK 能管连接，我们就只配不连。整个"能力中心"在后端几乎没有运行时逻辑——它就是几个 JSON 文件的增删查，加上把文件内容翻译成 SDK 的 `mcpServers` 配置。复杂度被推给了 SDK 和文件系统，而这两者都是为这件事生的。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/claude/mcp/manager.js` | L45–55 | `getUserClaudeHome()` 解析用户 `.claude` 根 |
| `src/claude/mcp/manager.js` | read/write enabled | `enabled.json` 增删查 |
| `src/claude/mcp/manager.js` | L85–194 | `getMcpCredentials` / `setMcpCredentials` / `*AllowedToolsOverride` |
| `src/mcp-store/*` | 7 目录 | 内置 MCP 源（glm-image / python / markitdown / zhipu ×4） |

读这张表的关键是 `getUserClaudeHome()`：它先把"当前用户的 `.claude` 根"解析出来，后面所有读写——启用列表、凭据、覆写——都锚在这个根下。这就是"按用户"隔离的全部秘密：不靠 WHERE user_id，靠每个用户一个独立目录。`enabled.json` 的增删查是纯文件操作；凭据和覆写走 `getMcpCredentials` / `setMcpCredentials` / `*AllowedToolsOverride` 那组方法，各管各的文件。`src/mcp-store/` 下的 7 个目录是内置 MCP 的源，启用某个 MCP 时，manager 把它翻译成 SDK 能认的 `mcpServers` 条目交出去——连接它的事，从这里开始就不归我们管了。

## 反直觉结论

> [!IMPORTANT]
> **"用户开了哪些 MCP"是偏好，不是关系数据——所以它属于文件系统，不属于数据库。** OxyGenie 把 MCP 启用做成 per-user 的 `.claude/` 下几个 JSON，正好搭上 SDK"按磁盘 `settingSources` 扫描"的机制：启用 = 写文件 + 软链生效，零额外查询。**当一个状态的消费者是"按目录扫描的 SDK"时，把它存成文件，比存进 DB 再物化回磁盘要诚实得多。**
>
> "诚实"是关键词。把偏好塞进数据库不会让它更可靠，只会多一层"DB → 磁盘"的翻译，而那层翻译纯属为了迁就一个根本不读 DB 的消费者。判断一个状态该进 DB 还是进 FS，标准不是"它重不重要"，而是"谁来读它"——读它的是 SQL 查询，就进 DB；读它的是目录扫描，就进 FS。MCP 启用、Skill 启用（第 08 篇）都属于后者。这不是偷懒，是顺着消费方的天性走。

## 三个生产坑

> [!WARNING]
> **坑一 —— MCP 连接不预热，首次会话要逐个初始化。**
> 连接交给 SDK 省了我们写连接管理，但也意味着连接是**会话启动时**才发生的——MCP 不预热。一个开了多个 MCP 的用户，首次会话要逐个初始化（7 个内置 × ~5s 超时上限，虽然多数 fail-fast、连不上的很快放弃）。后果是首条消息前会有一段可感知的"暖机"延迟，尤其当某个 MCP 的远端慢或不可达时，要等它走完超时才继续。这是"只配不连、把连接全交给 SDK"的代价：连接时机你说了不算。缓解方向是预热常用 MCP 或把超时调短，但当前是裸跑 SDK 的默认行为。

> [!WARNING]
> **坑二 —— 凭据当前明文存文件系统。**
> `credentials.json` 里的 API key 现在是**明文**落在 `~/.claude/mcp/` 下。在"半可信同事 + 共享宿主"的威胁模型里这是个真实的暴露面：谁能读到 `/data/users` 目录，谁就能拿到别人配的 MCP 凭据。这是 FS-as-truth 这个选择的阴影面——把偏好放文件系统很顺手，但凭据不是普通偏好，它需要保密。当前它和启用列表混在同一套文件机制里，享受了同样的便利，也继承了同样的暴露。待迁移方向是把凭据挪进 DB 加密存储，与纯偏好的启用列表分家。

> [!WARNING]
> **坑三 —— `overrides.json` 的 `allowedTools` 在 0.2.112 不被运行时强制。**
> 工具覆写让进阶用户能屏蔽某个 MCP 的危险工具，但有个版本陷阱：`overrides.json` 里的 `allowedTools` 部分放行，在 SDK 0.2.112 上**不被运行时强制**——它需要 0.2.120+ 才真正生效，而我们为了 ARK 网关兼容性把版本钉死在 0.2.112（第 14 篇）。所以当前覆写更多是"UI 上的意图声明"，运行时模型仍可能调到被你以为屏蔽了的工具。雪上加霜的是：MCP 是 stdio 子进程，会**继承 worker 的 env（含密钥）**——这意味着 MCP 自身的代码必须可信、不能外泄环境变量。覆写挡不住一个恶意 MCP，它只在 MCP 本身可信的前提下，帮你收窄模型的调用面。在精选集（团队自己策展）语境下这个假设成立，但不能当成对抗不可信 MCP 的安全边界。

三个坑的共同根源是：**把状态交给文件系统、把连接交给 SDK，省下了大量代码，但也把"连接时机、凭据保密、覆写强制"这三件事的控制权一并让了出去。** 顺着消费方的天性走很省力，可一旦你需要的语义（预热、加密、运行时强制）超出了文件系统和当前 SDK 版本能给的，缺口就得自己补——而在补上之前，这些都是真实的边界。

## 配图

1. ![MCP 能力中心：7 内置 + per-user FS 启用 + SDK 托管连接](../assets/img/07-mcp-center.svg)

## 下一篇

→ [第 08 篇：Skills 系统](./08-skills-system.md)

MCP 启用走文件系统，Skill 启用也一样——但 Skill 多了一道难题：平台想给所有人批量铺一套精选 Skill，用户又想保留"我就是不要这个"的权利。下一篇讲 copy-on-enable、LLM 给 SKILL.md 自动生成表单 schema，以及那个最朴素也最关键的仲裁——`.disabled-skills.json` 这张"否决清单"。

---

📌 [reading-map.md](../reading-map.md)
