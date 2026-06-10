---
title: "第 14 篇：多模型路由 —— ARK 网关、模型别名，与为什么钉死 SDK 0.2.112"
slug: 14-multi-model-routing
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 14
keywords: [多模型, ARK, GLM, Doubao, ANTHROPIC_AUTH_TOKEN, SDK 版本钉死]
prev: 13-single-host-concurrency
next: 15-real-preview
---

# 第 14 篇：多模型路由 —— ARK 网关、模型别名，与为什么钉死 SDK 0.2.112

> OxyGenie 不只跑 Claude，还跑 GLM、Doubao、DeepSeek、Kimi、MiniMax——全走字节的 **ARK 网关**。秘密是：Claude Agent SDK 本身就用 Anthropic 协议，只要把 `ANTHROPIC_BASE_URL` 指向 ARK、用 Bearer token，SDK 就以为自己在跟 Claude 说话。但这也带来一个硬约束：**SDK 必须钉死在 0.2.112**，再新就崩。本篇讲这套"借壳多模型"和它的版本枷锁。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案借-anthropic-协议走-ark--env-别名--钉版) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

OxyGenie 必须跑在团队选用的模型/网关上——这是北极星里写死的前提：默认走 ARK（火山）多模型网关。而团队真实的诉求是混用多个厂商的模型：用便宜的（如 Doubao lite 档）跑后台杂活省钱，用强的跑硬活。

把这个诉求摊开，工程上要同时满足：

1. **一个 Harness 混跑多家模型**：同一套 ws-server / worker / SDK 调用，能在 GLM、Doubao、DeepSeek、Kimi、MiniMax 之间切，不能为每家厂商开一条独立技术栈。
2. **不为每家写一套 SDK 适配**：各家模型的原生 API 各不相同，如果每接一家就维护一套 SDK 差异，接入成本随厂商数线性膨胀。
3. **不破坏前面所有层**：per-message worker（第 03 篇）、并发预算（第 13 篇）、会话持久化（第 12 篇）都是围绕"SDK 的 `query()`"建的。换模型不能换掉这个核心，否则前面的工程全要重来。

约束 5（不自己重写 SDK 已做好的事，第 03 篇）在这里有个微妙的延伸：**我们连"模型适配"都不想自己写**。Loop 是 SDK 的，会话存储是 SDK 的——理想情况下，多模型也该是几乎免费的。问题是：**怎么让一个只会说 Anthropic 协议的 SDK，去驱动一堆根本不是 Anthropic 的模型？**

## 朴素方案为什么不行

**方案一：Anthropic SDK + 各家 SDK 自己拼 + fallback 链。** 直觉做法：保留 Anthropic SDK 跑 Claude，再为 GLM、Doubao 各接它们的原生 SDK，自己在上层写一个路由 + fallback 链。问题是这条路要么把你锁死在 Anthropic 一家（只用它的 SDK），要么逼你维护多套 SDK 的差异——每家的流式格式、工具调用约定、错误码都不一样，N 家模型就是 N 套适配 + 一个脆弱的胶水层。更要命的是，OxyGenie 整个 Harness 是围绕 Claude Agent SDK 的 `query()` 建的（worker、HITL、tools preset 全依赖它），再塞进别家 SDK，等于在核心里养第二套 Agent 运行时——而项目规则明确禁止引入第二套 Agent SDK。

**方案二：运行时模型选择 API。** 想做得"灵活"：开一个内部 API，每次 query 时由前端/调度层动态指定用哪个模型。但这要跨 ws-server ↔ worker 的进程边界多走一条 RPC——worker 是 per-message spawn 出来的子进程（第 03 篇），它要知道用哪个模型，要么 spawn 时就告诉它，要么跑起来再问主进程。后者给**每一次 query 都加一跳进程间通信的延迟**，纯属为了一个"运行时才决定"的伪需求付实时成本。模型选择是个低频配置，不该走高频热路径。

两个方案的共同教训：**模型适配的复杂度，要么压在多套 SDK 上，要么压在跨进程 RPC 上——但这两个负担本可以不存在。** 关键洞察是：各家模型的差异其实已经被 ARK 网关在它后面抹平了。如果 ARK 收的就是 Anthropic 协议，那 SDK 根本不需要知道后面是谁——它说它的 Anthropic 协议，ARK 负责翻译路由。适配层不在我们这，在网关那。

## 核心方案：借 Anthropic 协议走 ARK + env 别名 + 钉版

OxyGenie 的多模型可以一句话概括：

> **不靠多 SDK，靠协议复用。Claude Agent SDK 说 Anthropic 协议，ARK 网关也收 Anthropic 协议——于是"把 `ANTHROPIC_BASE_URL` 指向 ARK、用 Bearer token 鉴权"就够了，SDK 以为自己在跟 Claude 说话，请求其实被 ARK 路由到了 GLM/Doubao。** 模型选择退化成一组 env 别名；代价是 SDK 必须钉死在 0.2.112。

```
worker 里的 query()  ──发 Anthropic 协议请求──▶  ANTHROPIC_BASE_URL
（以为在跟 Claude 说话）   Bearer: ANTHROPIC_AUTH_TOKEN        │
                                                              ▼
                                          ARK 网关 /api/coding
                                          按 model 别名路由：
                                          ├─ glm-5.1        (GLM ×3)
                                          ├─ doubao-…       (Doubao ×3)
                                          ├─ deepseek-…     (DeepSeek ×2)
                                          ├─ kimi-…
                                          └─ minimax-…
```

逐项拆开：

- **ARK 网关 = 借壳的壳。** `ANTHROPIC_BASE_URL` 指向 ARK 的 `/api/coding`，鉴权用 **`ANTHROPIC_AUTH_TOKEN`（Bearer）而非 `ANTHROPIC_API_KEY`**——这个区别是死活线（见坑一）。SDK 照常发它的 Anthropic 格式请求，ARK 在后面按 model 字段把请求翻译、路由到真正的 GLM/Doubao。整个适配层在网关里，我们这边一行适配代码都没写。

- **env 模型别名 = 把"努力等级"映射到具体模型。** SDK 内部有"主模型 / sonnet 档 / opus 档 / haiku 档 / subagent"这套努力等级的概念，我们用一组环境变量把它们各自映射到 ARK 上的具体模型：`ANTHROPIC_MODEL`（主模型，如 `glm-5.1`）、`ANTHROPIC_DEFAULT_SONNET/OPUS/HAIKU_MODEL`、`CLAUDE_CODE_SUBAGENT_MODEL`。最典型的是 **haiku → `doubao-seed-2.0-lite`**：SDK 想用"廉价快档"时，落到的是 Doubao 的 lite 模型，省钱诉求就这么兑现，不需要任何运行时 API。

- **配置经进程边界注入。** 模型选择是低频配置，所以在 spawn 时就定死，不走热路径：ws-server 启动读 config（base URL / token / model），`spawn` worker 时把这些写进 worker 的 env；worker 起来读 env 直接传给 `query()`。一次注入，整条消息生命周期用同一个模型——没有方案二那条每 query 的 RPC。

- **钉死 0.2.112 = 这套借壳的命门。** `@anthropic-ai/claude-agent-sdk` 在 0.2.113+ 改用 native binary，它与 ARK 的传统 API 不兼容——每次模型调用会陷入 `api_retry` 反复重试、最终卡死。所以 `package.json` 里必须是**精确的 `"0.2.112"`，绝不能用 `^` 或 `~`**，否则一次 `pnpm install` 重装就可能漂到 0.2.113+，整套借壳当场断裂。这不是洁癖，是 ARK 兼容窗的硬边界。

整套方案的精髓：**多模型的复杂度被一个共享协议吸收了。** 我们没写适配器、没养第二套 SDK、没加运行时 RPC——只是认出了"SDK 和 ARK 恰好说同一种话"，然后指了个 base URL。这正是约束 5 的极致兑现：连模型适配都白拿。但白拿是有账单的，账单写在版本号上。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `ws-server.mjs` | L106–111 | 读 `ANTHROPIC_API_KEY`/`BASE_URL`/`MODEL` |
| `ws-server.mjs` | L1058–1070 | 注入 worker env（含 `ANTHROPIC_API_URL` 别名） |
| `ws-query-worker.mjs` | L23–26 | 读 env → 传给 SDK `query()` |
| `package.json` | — | `@anthropic-ai/claude-agent-sdk: "0.2.112"`（精确钉死） |

这张表把"配置怎么穿过进程边界"讲清了：**ws-server（主进程）读配置 → spawn 时注入 worker env → worker（子进程）读 env 传给 `query()`**。三步全是单向、一次性的，没有反向 RPC。L1058–1070 注入时还会带上 `ANTHROPIC_API_URL` 别名，兼容 SDK 内部对 base URL 的不同读法。worker 那侧（L23–26）就是简单地把 env 里的 model / base URL / token 取出来塞进 `query()` 的 options——它根本不知道自己跑的是不是 Claude，这正是借壳的本意。

经 ARK 可路由的模型：**GLM ×3、Doubao ×3、DeepSeek ×2、Kimi、MiniMax 等**——全部通过同一套 env 别名 + 同一个 `query()` 调用切换，零额外适配代码。

## 反直觉结论

> [!IMPORTANT]
> **多模型不需要多 SDK——只要协议一致，换 base URL 就是换模型。**
>
> OxyGenie 的多模型几乎是免费的：Claude Agent SDK 说 Anthropic 协议，ARK 网关也收 Anthropic 协议，于是"指个 base URL + 换个 token"就跑通了 GLM/Doubao。你以为接多家模型要写多家适配，其实复杂度早被网关那层共享协议吸收了。**但代价是把命运绑在了一个 SDK 版本上**——0.2.113 的 native binary 一来，这套借壳就断。便宜的多模型，买单的是版本自由：这是每一个"借官方 SDK 造产品"的团队迟早要面对的账。你站在别人的 SDK 上省下了重写的工，就得接受它的每一次升级都可能是你的故障——所谓"版本自由税"，不交在今天，就交在某次身不由己的升级里。

## 三个生产坑

> [!WARNING]
> **坑一 —— ARK 要 Bearer，错填成 `ANTHROPIC_API_KEY` 就每次 401。**
> ARK 的 coding 网关用 Bearer 鉴权，必须设 `ANTHROPIC_AUTH_TOKEN`，**不能设 `ANTHROPIC_API_KEY`**。这俩长得像，但 SDK 的行为完全不同：一旦 `ANTHROPIC_API_KEY` 存在，SDK 会改走 `x-api-key` 头而不是 `Bearer`，ARK 收到非预期鉴权方式直接拒——每一次模型调用都 401。更阴的是 ws-server 若检测到这个 key 还会主动注入它，于是"设了反而坏"。生产环境一律只设 `ANTHROPIC_AUTH_TOKEN`，把 `ANTHROPIC_API_KEY` 留给原生 Anthropic 场景。

> [!WARNING]
> **坑二 —— `^0.2.112` 一次重装就漂到 0.2.113+ 而崩。**
> 这是版本枷锁最容易触发的形态。`package.json` 里只要写成 `^0.2.112` 或 `~0.2.112`，下一次 `pnpm install`（换机器、删 lockfile、CI 重建）就可能解析到 0.2.113 或更新——而那是改用了 native binary、与 ARK 不兼容的版本，结果是每次模型调用陷入 `api_retry` 死循环，表象是"模型不回话"，极难一眼定位到是版本漂移。**必须精确钉 `"0.2.112"`**，并守住 lockfile。这条规则在 CLAUDE.md 里被反复强调，不是过度谨慎，是踩过的痛。

> [!WARNING]
> **坑三 —— 没有模型 fallback，非 Claude 模型拿不到 token 计数。**
> 两件事。其一：当前**没有模型 fallback 链**——主模型（或 ARK 后面某个具体模型）挂了，这次 query 直接失败，不会自动切到备用模型。要高可用得自己在更上层补重试/切换，借壳这层不管。其二：经 ARK 走的非 Claude 模型，**拿不全 token 计数**——SDK 的 usage 字段是按 Anthropic 模型的计量来的，套到 GLM/Doubao 上对不齐，于是成本只能事后从 usage 事件粗估（第 17 篇），这也是为什么 `costUsd` 不能当真账（第 12 篇坑三）。便宜的多模型，连"算清花了多少钱"都打了折。

三个坑的共同根源是同一句话：**你借的是别人协议的"主干兼容"，没借到它的"全部保证"。** 鉴权方式的细微差别（坑一）、版本边界的脆弱（坑二）、计量与高可用的缺失（坑三）——都是"协议看起来一样、细节其实有缝"的地方漏进来的。借壳让多模型几乎免费，但每一道缝都要你自己拿胶布贴上。这就是站在别人 SDK 上造产品的真实质感：省了大头，欠着尾款。

## 配图

1. ![借 Anthropic 协议走 ARK 的请求路径](../assets/img/14-ark-routing.svg)
2. ![版本枷锁：0.2.112 ↔ ARK 兼容窗](../assets/img/14-version-lock.svg)

## 下一篇

→ [第 15 篇：真预览](./15-real-preview.md) 🌟

模型能跑了、能省钱了，那 AI 生成的不是一段文字、而是一整个多文件 Vite/React 工程时，怎么让它在浏览器里**真的跑起来**？下一篇是系列的重头戏：怎么在"单机 16GB、50 并发"的预算里，给每个会话一个真实的运行环境——per-session Docker、Traefik 子域反代、bootstrap JWT 鉴权、idle 回收——还不被它吃垮、不让它越权。

---

📌 [reading-map.md](../reading-map.md)
