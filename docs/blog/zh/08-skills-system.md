---
title: "第 08 篇：Skills 系统 —— copy-on-enable、LLM 生成表单 schema 与 disabled veto"
slug: 08-skills-system
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 8
keywords: [Skills, SKILL.md, copy-on-enable, schema generator, settingSources]
prev: 07-mcp-capability-center
next: 09-ask-act-hitl
---

# 第 08 篇：Skills 系统 —— copy-on-enable、LLM 生成表单 schema 与 disabled veto

> Skill 是带 YAML frontmatter 的 Markdown，启用后把提示词/上下文注入 agent。OxyGenie 的 Skill 启用是**把目录拷进 `~/.claude/skills/<slug>/`**（不是软链、不是纯 DB），并能用 LLM 给 SKILL.md **自动生成一份表单 schema** 喂给 Composer UI。这一篇讲这套文件系统流程，和它最反直觉的一个设计：用户的"禁用清单"是个 veto。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案copy-on-enable--disabled-veto--懒生成-schema) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

Skill 是一份带 YAML frontmatter 的 Markdown（`SKILL.md`），启用后它的提示词会注入 agent，让模型多一种"懂某件事怎么做"的本领。要让它在 OxyGenie 里跑起来，得同时满足三件事：

1. **用户能一键开关**：在能力中心点一下就启用/禁用某个 Skill，立即对下次会话生效。
2. **SDK 能按目录发现它**：SDK 用 `settingSources:['project']` 扫磁盘来发现 Skill，所以启用的 Skill 必须以**目录**形式出现在它扫得到的地方。
3. **平台能给新用户铺精选**：组织选了一批"默认该有"的 Skill，希望批量同步给所有人，新用户开箱就有。

第 3 条和第 1 条天然打架：平台想批量给，用户想自主关。如果"全局同步"每次都把精选 Skill 铺一遍，那用户刚手动关掉的 Skill 下次会话又被打开——这是 UX 灾难。所以核心问题是：**怎么让"平台默认"和"用户意志"在同一套文件系统流程里共存，而且当两者冲突时，让用户赢？**

## 朴素方案为什么不行

**方案一：纯 DB 存 Skill。** 跟 MCP 那篇（第 07 篇）一模一样的陷阱：SDK 用 `settingSources:['project']` **扫磁盘**发现 Skill，纯 DB 最终还得在运行时把 Skill 物化到磁盘上——读 DB → 写目录 → SDK 扫目录。绕了一圈，DB 只是中转。Skill 的真相必须在文件系统里，因为读它的是目录扫描，不是 SQL。

**方案二：软链而非拷贝。** 想用软链把全局 store 里的 Skill 链进用户的 `~/.claude/skills/`，省磁盘。但软链意味着所有用户共享同一份源——一旦某用户的会话在工作区里改了 Skill、或者 store 更新，所有人的链接同时变，隔离就破了。而且软链在容器/卷迁移时极脆。Skill 要的是"每个用户一份可独立增删的副本"，软链给不了这个独立性。

**方案三：全局每次会话强制同步。** 让每次会话启动都把平台精选 Skill 全量铺一遍，保证"该有的都有"。但这正好踩中那个冲突：用户刚关掉的 Skill，下次会话又被全局配置打开。用户会觉得"我明明关了它怎么又回来了"，反复关反复回——平台意志碾压个人意志，UX 直接抓狂。

三个方案的共同教训：**Skill 的真相得在文件系统（消费方是目录扫描），每个用户得有独立副本（软链共享会破隔离），而"批量给"不能压过"用户关"。** 前两条决定了"copy"，第三条决定了必须有一个让用户意志优先的仲裁机制。

## 核心方案：copy-on-enable + disabled veto + 懒生成 schema

OxyGenie 用四个动作把这套需求接住：

- **copy-on-enable**：`enableSkill()` 把 `src/skills-store/<slug>/` **整目录拷进** `~/.claude/skills/<slug>/`（先删旧版再拷 = 顺带自动更新到最新）。拷完 SDK 按目录扫描即生效——每个用户一份独立副本，谁改谁的，互不影响。
- **disabled veto**：`disableSkill()` 做两件事——删掉用户目录下那个 Skill，**再把它的 slug 写进 `~/.claude/.disabled-skills.json`**。这张清单是个"否决票"：**全局同步遇到 veto 清单里的 slug 就跳过**。于是平台还能批量铺，但用户说过"不要"的，永远不会被铺回来。
- **运行时注入**：`loadSkillContext()` 在会话里读 `SKILL.md`，把内容作为 system prompt 后缀注入（形如 `[Explicit Skill Selected: ...]`），让模型这一轮"带着这门本事"工作。
- **懒生成 schema**：当用户点"生成表单"时，**单独**发一次 SDK Structured Outputs 调用，从 SKILL.md 里抽出 ≤6 个表单字段，写成 `.schema.json` sidecar（带 `needsReview` 标记）。关键是**不在主 query 里做**——否则每一轮对话都要扛一次结构化抽取的延迟。schema 生成是一次性的离线动作，不污染对话主路径。

`disabled veto` 是这套设计的灵魂。它把"平台默认"和"用户意志"的优先级关系，编码成了一句话：**默认是可以批量给的（白名单式铺设），但禁用是用户一票否决的（黑名单式拦截）。** 平台的"给"作用于"还没被否决的"，用户的"不要"则一锤定音、跨会话长效。两种意志不在同一个维度上较劲——一个管"默认铺什么"，一个管"绝不铺什么"，veto 清单就是它们的交接面。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/claude/skills/manager.ts` | L126–180 | `enableSkill`（删旧→拷新→移出 veto）/ `disableSkill`（删→入 veto） |
| `src/claude/skills/store-seeder.ts` | — | 启动时把内置 Skill 拷进 `SKILLS_STORE_DIR` |
| `src/claude/skills/schema-generator.ts` | — | LLM 抽表单字段（≤6），写 `.schema.json` + `.schema.meta.json` |
| `src/claude/skills/github-installer.ts` | — | 从 GitHub 下载 ZIP 安装 |
| `ws-query-worker.mjs` | L100–124 | `loadSkillContext()` 注入 SKILL.md |

`manager.ts` 的 `enableSkill`/`disableSkill` 是这套仲裁的实现核心：`enableSkill` 的顺序是"删旧 → 拷新 → 把 slug 从 veto 清单里移出"——注意第三步，启用一个 Skill 的同时撤销它之前的否决票，用户改主意了，veto 也跟着撤。`disableSkill` 反过来，删目录 + 写进 veto。`store-seeder.ts` 在启动时把内置 Skill 铺进 store 目录，是"平台默认"的源头；`loadSkillContext()`（worker 里 L100–124）是运行时把 SKILL.md 注入对话的那一下。`schema-generator.ts` 和 `github-installer.ts` 是两条旁路：前者把 SKILL.md 抽成表单字段写两个 sidecar 文件（`.schema.json` + `.schema.meta.json`），后者支持从 GitHub ZIP 装新 Skill——都不在对话主路径上。

## 反直觉结论

> [!IMPORTANT]
> **当消费方是"按目录扫描的 SDK"，Skill 的真相就该在文件系统里，DB 只是目录。** 这跟第 07 篇 MCP 是同一条原则。而"全局同步 vs 用户禁用"的冲突，OxyGenie 用一个 **veto 清单**（`.disabled-skills.json`）解决：**默认可以批量给，但用户的"不要"永远优先。** 这是多租户里"平台意志"与"个人意志"最朴素的仲裁法。
>
> 值得停下来体会这个仲裁为什么是"否决"而不是"开关"。如果用一个布尔开关记录每个 Skill 的启用态，你就得回答"平台同步时该不该覆盖这个开关"——怎么答都别扭。而 veto 把问题降了一维：平台只管"默认铺哪些"，用户只管"绝不要哪些"，两者作用在不同的集合上，根本不需要互相覆盖。**好的仲裁机制不是仲裁双方的胜负，而是让双方根本不在同一个赛道上。** 一张否决清单，就把一个看似要协调的冲突，变成了两个互不干涉的操作。

## 三个生产坑

> [!WARNING]
> **坑一 —— copy-on-enable 是文件复制，规模化吃磁盘。**
> 启用即拷贝，意味着同一个 Skill 被 100 个用户启用，磁盘上就是 **100 份独立副本**（1 个 Skill × 100 用户 = 100 份拷贝）。在"组织内多用户"的规模下这通常还扛得住，但 Skill 一多、用户一多，这是个线性增长的磁盘占用，迟早成为成本项。这是为了"每用户独立副本、谁改谁的"付的隔离税——软链能省磁盘却破隔离，拷贝保隔离却费磁盘，当前选了后者。待优化方向是改成 DB 存目录 + 懒加载缓存：DB 记"谁启用了什么"，运行时再按需物化，把 N 份拷贝压回 1 份源 + N 条引用。在那之前，磁盘占用得监控。

> [!WARNING]
> **坑二 —— LLM 生成 schema 输出不稳，靠十几条归一化兜底。**
> 懒生成 schema 是让 LLM 从 SKILL.md 里抽表单字段，但 LLM 的结构化输出**并不稳定**：同一份 SKILL.md，它可能这次给标准 JSON Schema、下次给个嵌套变体、再下次字段名换个写法。为了让 Composer UI 拿到的永远是一份可用的 schema，作者侧写了 **~15 条归一化分支**来兜底各种变体输出——把模型五花八门的产物收敛成统一形状。这是所有"用 LLM 生成结构化数据"的功能都逃不掉的现实：生成那一步很性感，但生成之后的归一化、校验、兜底，才是真正的工作量，而且会随模型版本变化持续维护。`.schema.json` 上那个 `needsReview` 标记就是这种不确定性的诚实体现——它在说"这是机器抽的，人最好看一眼"。

> [!WARNING]
> **坑三 —— 无 Skill 版本管理，store 更新了用户拷贝不会跟。**
> copy-on-enable 的"先删旧再拷新 = 自动更新"只在**启用那一刻**成立。一旦用户启用了某个 Skill，store 里之后再更新 `SKILL.md`，用户手里那份旧拷贝**不会自动跟进**——它就是当初拷下来的那个版本，冻在那儿。要拿到新版，用户得**重新启用**一次（触发删旧拷新）。后果是组织更新了一个 Skill 的提示词、修了个 bug，已启用的老用户却还在用旧逻辑，且毫不知情。根因是当前没有任何版本号/哈希来比对"用户副本"和"store 源"是否一致，也就没有"有更新"的提示。这和坑一是同一枚硬币的两面：拷贝带来了独立性，也带来了"副本会过时却没人知道"的同步债。

三个坑的共同根源是：**copy-on-enable 用"复制"换来了独立和隔离，但复制天生会制造重复与漂移——磁盘上 N 份拷贝、生成物需要归一化、副本会悄悄过时。** 把真相放进文件系统、给每个用户一份副本，是顺着 SDK 天性走的正确选择；但"副本"这个词本身就意味着，你得为它们的数量、形状和新鲜度持续负责。

## 配图

1. ![Skill 启用流：store → copy → ~/.claude/skills → SDK 扫描](../assets/img/08-skill-enable.svg)
2. ![disabled veto 与全局同步的仲裁](../assets/img/08-disabled-veto.svg)

## 下一篇

→ [第 09 篇：Ask/Act 两模式 + HITL](./09-ask-act-hitl.md)

Skill 把本事注入了模型，但模型真要动手——写文件、跑命令——之前，得有人拍板。下一篇讲 Ask/Act 两种权限模式怎么映射到 SDK 的 `permissionMode`、`canUseTool` 这个 HITL 钩子如何走 worker 的 stdin 把审批请求送到浏览器再等结果回灌，以及"等审批"这件事为什么是 per-message worker 模型里最容易把名额耗光的地方。

---

📌 [reading-map.md](../reading-map.md)
