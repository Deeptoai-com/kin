---
title: "设计篇 03：上下文工程 —— 渐进压缩、卸载到磁盘、摘要与预算"
slug: d3-context-engineering
date: 2026-06-07
series: oxygenie-agent-harness
series_track: design
series_index: 22
keywords: [上下文工程, context engineering, 压缩, compaction, 卸载, offload, 预算]
prev: d2-long-term-memory
next: d4-evaluation
---

# 设计篇 03：上下文工程 —— 渐进压缩、卸载到磁盘、摘要与预算

> HarWork 第 04 篇用整整一篇讲"5 层渐进压缩"。oxygenie 把这件事**整个交给了 SDK**——这是省事，也是一个该被显式管起来的缺口。按 HarWork 04 + baby-agent 第五章倒推 oxygenie 该有的上下文工程。

> 📐 **设计篇**：现状有据，设计为"该有的"，未实现。

## 问题陈述

长会话、大工具输出（一次 grep 命中上万行、一个文件 50KB）会迅速吃满上下文窗口。要在有限窗口里既不丢关键信息、又不让噪音挤掉正事——同时不能让"压缩本身"把预算撑爆。

## oxygenie 现状

- **整个委托给 SDK**：压缩/缓存由 Claude Agent SDK 内部处理（prompt caching），`ws-query-worker.mjs` 的 `query()` 调用**不控制** compaction。
- 好处是省事；代价是 oxygenie **没有自己的上下文策略**——大工具输出怎么卸载、检索结果怎么窗口化、引用怎么保留，全凭 SDK 默认。
- `message_attachment` 表**已存在**（第 12 篇），是天然的"卸载落点"，但没被用于上下文卸载。

## 朴素方案为什么不行

- **单阈值截断**：一到上限就砍最旧的——会把"早期但关键"的信息一刀切掉。
- **全靠 SDK autocompact**：SDK 不知道 oxygenie 的业务语义（哪些是检索结果、哪些该留引用、哪些能卸载到 attachment），只能做通用压缩。
- **把大输出全摘要**：摘要要调 LLM、要花 token，且有损。

## 核心方案：渐进压缩 + 卸载优先

- **预算前置**：在调 `query()` **之前**估算 token 预算并决定是否压缩——避免"压缩本身撑爆窗口"的悖论（HarWork 04 的核心）。
- **卸载 > 摘要**：大工具输出先写进 `message_attachment`（表已就位），上下文里只留"前 N 字 + attachment_id 指针"，需要时再取——**最便宜的压缩是把东西挪走、留个指针**，而不是花 token 去摘要。
- **分层渐进**：轻量（去重/截断尾部）→ 中量（卸载大块）→ 重量（LLM 摘要旧轮次，用 haiku 档），按阈值瀑布逐级触发，而非单阈值。
- **与 RAG/记忆协同**：检索结果（设计篇 01）按需加载、多轮检索结果摘要压缩、检索历史进记忆（设计篇 02）避免重复检索。

## 反直觉结论

> [!IMPORTANT]
> **最好的上下文压缩不是"摘要"，是"卸载 + 指针"。** 摘要有损、费 token；把大输出挪到 `message_attachment`、上下文只留指针，无损且几乎免费。oxygenie 的幸运是这张卸载表早就在（第 12 篇），缺的只是把它接进上下文管线。更深一层：**把压缩完全交给 SDK，等于放弃了用业务语义做更聪明压缩的机会**——SDK 不知道哪段是检索结果、哪段该留引用，只有 harness 知道。

## 三个生产坑

> [!WARNING]
> **坑一**：压缩必须在 LLM 调用**之前**判断，否则"压缩调用"自己就把窗口顶爆。
> **坑二**：`yield`/流式期间持有大 buffer（如未卸载的 grep 结果）会卡住内存——先落盘 attachment 再进上下文。
> **坑三**：和 SDK 自带 autocompact 并存时要划清边界，否则两套压缩互相打架、行为不可预测。

## 配图

1. ![渐进压缩瀑布：去重→卸载→摘要](../assets/img/d3-progressive-compaction.svg)
2. ![卸载到 message_attachment + 指针](../assets/img/d3-offload-pointer.svg)

## 下一篇

→ [设计篇 04：评测](./d4-evaluation.md)

---

📌 [reading-map.md](../reading-map.md) · 📐 设计篇，未实现。
