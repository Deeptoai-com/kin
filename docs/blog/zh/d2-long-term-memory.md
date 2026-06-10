---
title: "设计篇 02：长期记忆 —— 两层记忆、LLM 驱动更新、注入 system prompt"
slug: d2-long-term-memory
date: 2026-06-07
series: oxygenie-agent-harness
series_track: design
series_index: 21
keywords: [长期记忆, memory, 两层记忆, LLM 记忆更新, system prompt 注入]
prev: d1-advanced-rag
next: d3-context-engineering
---

# 设计篇 02：长期记忆 —— 两层记忆、LLM 驱动更新、注入 system prompt

> RAG（设计篇 01）解决"查外部资料"，长期记忆解决"记住你"。按 baby-agent 第六章 + HarWork 第 06 篇倒推：oxygenie **该有、却没有**一套跨会话的记忆——会话一重启，Agent 就"失忆"。

> 📐 **设计篇**：现状有据，设计为"该有的"，未实现。

## 问题陈述

用户希望 Agent 记住偏好、项目背景、上次结论，跨会话保持连贯，而不是每次从零自我介绍。难点：记忆既不能把全部历史塞回 prompt（撑爆上下文），也不能靠 SDK 的会话 resume（那只恢复单条 transcript，不跨会话蒸馏）。

## oxygenie 现状

- **无 auto-memory**：grep `memory` 仅得会话持久化（第 12 篇），**没有**按用户的记忆表/文件。
- `knowledge_base` 是**共享文档库**，不是"用户记忆"——它存资料，不存"关于这个用户的事实"。
- CLAUDE.md 提到 `settingSources:['project']` 会加载 `.claude/`，但**没有自动写记忆**的环节。
- 结论：记忆 = SDK transcript 的单会话恢复，**跨会话归零**。

## 朴素方案为什么不行

- **把全部历史塞回 prompt**：上下文秒爆，且大部分是噪音。
- **只靠 SDK resume**：只恢复"这一条会话"，不会把"用户是谁、在做什么项目"蒸馏成可复用的记忆。
- **让用户手填记忆**：没人会维护，且与对话脱节。

## 核心方案：两层记忆 + LLM 蒸馏 + 注入

- **两层**：**全局/用户层**（跨所有会话的稳定事实：身份、偏好、长期项目）+ **工作区/会话层**（当前任务的近期上下文）。读时合并，写时分层。
- **LLM 驱动更新**：用便宜的 haiku 档模型（`doubao-seed-2.0-lite`，第 14 篇）在**后台 BullMQ job** 里从对话里抽取"值得记的事实"，增量更新记忆，不阻塞主对话。
- **注入 system prompt**：每次 `query()` 把记忆作为 system prompt 前缀注入——复用 `ws-query-worker.mjs` 注入 skill context 的同一个口子（第 08 篇）。
- **落点（复用已有 FS-as-truth 模式）**：记忆存进 per-user `~/.claude/`（与 MCP/Skills 的 FS 启用同构，第 07/08 篇），或新增一张 `user_memory` 表；更新走 BullMQ。

## 反直觉结论

> [!IMPORTANT]
> **记忆是个"写"的问题，不是"读"的问题。** 注入很简单（拼进 system prompt），难的是**决定写什么**——从一长段对话里蒸馏出"这条值得跨会话记住"。所以记忆系统的核心不是存储，是那个在后台默默判断"什么该记、什么该忘"的 LLM 更新器。这和设计篇 01 的 RAG 同源：**真正的工程在离线那条链上**（RAG 在 embed，记忆在蒸馏）。

## 三个生产坑

> [!WARNING]
> **坑一**：记忆更新若同步跑会拖慢对话——必须后台 job，最终一致即可。
> **坑二**：两层记忆的优先级要定清楚——会话层与用户层冲突时谁覆盖谁，否则 Agent 行为漂移。
> **坑三**：记忆是 PII 重灾区，写入/注入都要过脱敏与隔离（呼应设计篇 05 Guardrails、第 17 篇审计）。

## 配图

1. ![两层记忆：全局/用户 + 工作区/会话](../assets/img/d2-two-layer-memory.svg)
2. ![后台 LLM 蒸馏 → 注入 system prompt](../assets/img/d2-memory-update.svg)

## 下一篇

→ [设计篇 03：上下文工程](./d3-context-engineering.md)

---

📌 [reading-map.md](../reading-map.md) · 📐 设计篇，未实现。
