---
title: "设计篇 04：评测 —— 黄金集、检索/生成指标、离线 + 在线、回归门禁"
slug: d4-evaluation
date: 2026-06-07
series: oxygenie-agent-harness
series_track: design
series_index: 23
keywords: [评测, evaluation, RAGAS, 黄金集, MRR, NDCG, 回归门禁]
prev: d3-context-engineering
next: d5-guardrails
---

# 设计篇 04：评测 —— 黄金集、检索/生成指标、离线 + 在线、回归门禁

> baby-agent 把"LLM 评测"列为完整 Agent 的必备一章。oxygenie **完全没有**——没有 `eval/`、没有黄金集、没有 RAGAS。前面每一篇设计（RAG、记忆、上下文）改完都会问"更好了吗？"，没有评测就只能靠拍脑袋。评测是所有其他设计篇的前置。

> 📐 **设计篇**：现状有据，设计为"该有的"，未实现。

## 问题陈述

改了切分策略、换了 embedding、调了 rerank、动了 system prompt——**怎么知道是变好还是变坏？** 没有可重复的度量，每次"优化"都是赌博，且无法防回归。

## oxygenie 现状

- **零评测基建**：grep `eval/golden/ragas` 无果；无黄金数据集、无评测脚本、无基准套件。
- CI（第 18 篇）有 lint/typecheck/unit test 硬闸，但**没有 Agent/RAG 质量评测**这一关。
- 唯一的"在线信号"是 `usage_record`/`audit_log`（第 17 篇），但没被用来算质量。

## 朴素方案为什么不行

- **肉眼测**：人工试几条 case——抓不住回归，改 A 修好、悄悄弄坏 B 看不见。
- **只看在线指标**：等真实用户反馈太慢，且无法在上线前拦截。
- **只测最终回答**：RAG 出错可能在召回、在精排、在生成任一环，只测端到端定位不了是哪段坏了。

## 核心方案：离线黄金集 + 分层指标 + CI 门禁

- **黄金集**：按知识库维护 Q→相关 chunk / 期望回答 的标注集（可由团队策展，呼应北极星"精选而非公开市场"）。
- **分层指标**：检索层（Recall@K / MRR / NDCG / context-relevance）+ 生成层（faithfulness 忠实度 / answer-relevance / 是否带正确引用）——**分层才能定位是召回坏了还是生成坏了**。
- **离线 + 在线**：离线黄金集进 **CI**（第 18 篇）做回归门禁，关键指标跌破阈值就拦合并；在线从 `usage_record`/反馈（第 17 篇）采质量信号补充长尾。
- **落点**：新增 `eval/` 目录 + 黄金集；评测脚本可在 CI 跑；在线信号复用既有审计/用量表。

## 反直觉结论

> [!IMPORTANT]
> **评测不是"做完功能后的验收"，是"做功能的前提"。** 没有可重复的度量，设计篇 01-03 的每一次"优化"都无法证伪——你不知道换 embedding 是真的更好还是只是手感更好。把评测放到最前面、进 CI 门禁，才让后面所有改动**可证伪、可回归防护**。这也是为什么它排在设计篇靠前：**它是其他设计篇"是否更好"这个问题的唯一答案来源。**

## 三个生产坑

> [!WARNING]
> **坑一**：黄金集会过时——知识库一更新，旧标注就失真，要有维护节奏。
> **坑二**：LLM-as-judge（用模型打分 faithfulness）本身有方差，要固定评测模型 + 多次取均值，否则指标自己在抖。
> **坑三**：只测端到端会掩盖分层问题——必须能分别报"召回坏了"还是"生成坏了"。

## 配图

1. ![分层评测：检索指标 + 生成指标](../assets/img/d4-layered-eval.svg)
2. ![离线黄金集进 CI 门禁 + 在线信号](../assets/img/d4-eval-pipeline.svg)

## 下一篇

→ [设计篇 05：Guardrails](./d5-guardrails.md)

---

📌 [reading-map.md](../reading-map.md) · 📐 设计篇，未实现。
