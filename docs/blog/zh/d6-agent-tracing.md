---
title: "设计篇 06：Agent / RAG 可观测 —— 把 seq 事件流导成 span，追到每一步、每一次检索"
slug: d6-agent-tracing
date: 2026-06-07
series: oxygenie-agent-harness
series_track: design
series_index: 25
keywords: [可观测, tracing, span, Langfuse, OTel, RAG 指标, 链路追踪]
prev: d5-guardrails
next: null
---

# 设计篇 06：Agent / RAG 可观测 —— 把 seq 事件流导成 span，追到每一步、每一次检索

> 第 17 篇有 PostHog（行为）+ Sentry（错误）+ audit_log（安全）——那是**应用级**观测。baby-agent 把 Trace/Metrics/Log 列为必备，指的是**Agent 级**：一次 run 里每一步推理、每一次工具/检索调用的链路。oxygenie 这一层**只有 console.error**。好消息是：它其实已经有一条现成的 trace，只是没导出去。

> 📐 **设计篇**：现状有据，设计为"该有的"，未实现。

## 问题陈述

一次 Agent run 慢了/错了/答歪了，要能回答"卡在哪一步、哪个工具、哪次检索召回了什么、各花多少 token/时间"。没有 step 级链路，线上问题只能靠猜。

## oxygenie 现状

- **应用级有，Agent 级无**：`src/lib/observability/` 是 PostHog/Sentry（第 17 篇），看的是"页面/错误/用量"。
- **Agent 内部只有 console.error**（`ws-query-worker.mjs`），不可查询、不能回放。
- **无 step/span 级 trace**，无 RAG 检索指标（召回了什么、recall、延迟），无 LangSmith/Langfuse/OTel。
- 但：worker 已经在吐**带 `seq` 的 NDJSON 事件流**（第 04 篇）——**这本身就是一条 trace**，只是被原样转发给了前端、没被导成可观测的 span。

## 朴素方案为什么不行

- **console 日志**：不可查询、不可聚合、SSH 上机器捞日志（第 04 篇坑三）。
- **只有应用指标**：知道"今天 401 多了"，但定位不到是哪个 session 的哪一步、哪次检索出的问题。
- **只测端到端延迟**：一次 run 5 秒，到底是 LLM 慢、工具慢、还是检索慢，分不出来。

## 核心方案：复用 seq 事件流，导成 span

- **事件流即 trace**：worker 的 seq 事件（第 04 篇）天然是按序的步骤记录——给每个 turn/工具调用/检索调用包一个 span（用 `seq` 当 span 顺序），导出到 Langfuse/OTel。
- **step 级 token/成本**：把 `usage_record`（第 17 篇）从 run 级细化到 step 级——每次工具/检索/LLM 调用各记 token 与耗时。
- **RAG 检索指标**：每次 `kb_search`（设计篇 01）记 query、召回的 chunk、混合/rerank 前后排名、延迟——线上才能算 recall、调 top-K。
- **落点**：在 worker 事件出口加一个 exporter（把 seq 事件转 span），复用第 04 篇的流、第 17 篇的用量表，不另起一套埋点。

## 反直觉结论

> [!IMPORTANT]
> **oxygenie 不缺一条 trace，缺的是"把已有的事件流导出去"。** 第 04 篇为了前端流式渲染，已经给每个事件盖了 `seq`、按序吐出——这恰好就是一条带时间线的执行轨迹。可观测不需要从零埋点，只要在事件出口加一个 exporter，把"给 UI 看的流"同时"给 trace 看一份"。**最好的 trace 往往不是新加的，是把你为别的目的已经产生的有序事件，换个出口导出来。** 这和设计篇 03"卸载而非摘要"、设计篇 01"检索是工具"一样——都是认出"零件已经在了，只差接线"。

## 三个生产坑

> [!WARNING]
> **坑一**：trace 里别带敏感内容原文（prompt/检索文档），按第 17 篇脱敏后再导，否则可观测自己成泄漏点。
> **坑二**：span 导出要异步、要采样——同步全量导会把 worker 的流式热路径拖慢。
> **坑三**：`seq` 是 32 位会回绕（第 04 篇坑二），当 span 排序键时长 run 要处理回绕，别让时间线错乱。

## 配图

1. ![seq 事件流 → span 导出（一份给 UI，一份给 trace）](../assets/img/d6-seq-to-span.svg)
2. ![step 级 token/延迟 + RAG 检索指标](../assets/img/d6-step-metrics.svg)

## 结语：设计篇到此

设计篇 6 篇（RAG / 记忆 / 上下文 / 评测 / Guardrails / 可观测）补的都是 oxygenie **该有、却还没有**的能力。它们有个共同模式：**该有的零件大多已经躺在代码里**——RAG 的向量列、记忆/Skills 的 FS 模式、上下文的 attachment 表、可观测的 seq 流——**缺的不是设计，是接线**。这与正传 19 篇的"现状"互为镜像：正传写"我们怎么把 SDK 包成产品"，设计篇写"要成为完整的 harness，还差哪几根线"。

---

📌 系列阅读地图：[reading-map.md](../reading-map.md)
🔗 蓝本：[baby-agent](https://github.com/baby-llm/baby-agent)（第六/七/八章）· [building-an-agent-harness](https://github.com/sky54laozhu/building-an-agent-harness)
