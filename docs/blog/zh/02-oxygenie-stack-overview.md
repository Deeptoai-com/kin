---
title: "第 02 篇：OxyGenie 技术栈全景 —— 双进程拓扑、SDK 0.2.112、ARK 与 TanStack Start"
slug: 02-oxygenie-stack-overview
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 2
keywords: [OxyGenie 架构, TanStack Start, Claude Agent SDK, ws-server, 双进程]
prev: 01-what-is-agent-harness
next: 03-per-message-worker-model
---

# 第 02 篇：OxyGenie 技术栈全景 —— 双进程拓扑、SDK 0.2.112、ARK 与 TanStack Start

> 第 01 篇画了 15 层的"逻辑栈"。这一篇换成"物理拓扑"：这 15 层真实地跑在**几个进程、用了哪些框架、版本钉在哪**。一句话先抛结论——OxyGenie 不是一个 Next.js 大单体，而是**一个 Web 进程 + 一个常驻 ws-server + N 个一次性 worker + 一个 preview sidecar** 的四角拓扑。本文回答：当你决定"站在官方 SDK 上"造 Web Agent，这个栈应该长什么样，以及为什么有些版本必须用钉子钉死。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案四角进程拓扑) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

第 01 篇说清了"要造哪 15 层"，但那是逻辑视角。真正落到键盘上，第一个绕不开的问题是：**这 15 层应该被切成几个进程、用什么框架、哪些版本能动哪些不能动？**

具体要回答三组问题。其一，**进程怎么切**：渲染前端、调度会话、执行 `query()`、跑预览容器——这四件事是塞进一个进程，还是各自成进程？切多了运维变重，切少了互相拖垮。其二，**框架哪些白给、哪些自建**：SSR、路由、静态资源这些框架能力不该重写，但"会话调度 + 进程生命周期 + worker 流转发"这些没有任何框架替你做，必须自建——边界划在哪？其三，**版本为什么要钉死**：一个自托管产品要长期可重建，但偏偏有一两个依赖升一个小版本就会让整个系统卡死。哪些必须用 `^` 跟着升、哪些必须用钉子焊死、为什么？

这三组问题的答案，合起来就是 OxyGenie 的技术栈全景。

## 朴素方案为什么不行

**方案一：一个 Next.js 大单体，前后端同堆。** 这是当下最主流的起手式——一个 Next.js 进程同时管 SSR 渲染和 `query()` 调用，看起来最省心。但它一上多用户就破产：一旦 `query()` 在 web 进程里跑，**SSR 渲染和 agent 执行抢同一个 V8 堆**。某个用户让模型生成一大坨 HTML、另一个用户的 grep 命中十万行，几个并发就把 web 进程顶到 heap limit——而 web 进程一崩，所有人连页面都打不开了。渲染和执行是两种负载特征完全相反的活（一个要低延迟高并发，一个要长耗时吃内存），把它们焊在一个堆里，是这个朴素方案的原罪。这也正是第 03 篇要专门拆的隔离问题。

**方案二：用框架重新实现框架已有的能力。** 另一个常见错误是反过来——既然要自建调度层，干脆连静态资源服务、SSR、路由处理都自己写一遍包进去。这是纯浪费：TanStack Start 底层的 Nitro 已经把 `/assets/**` 静态托管、SSR、中间件全做好了，重写一遍只是给自己增加维护面，还跟框架升级对着干。自建的边界应该**只划在框架真的没有的地方**（会话调度、进程生命周期、worker 流转发），不该越界。

**方案三：依赖全用 `^` 让它自动跟着升。** 自托管产品最自然的卫生习惯是"依赖保持最新"，于是所有包都用 `^` 范围。对绝大多数依赖这没问题，但对 Claude Agent SDK 这一个会**直接炸**：`0.2.113+` 改用了原生二进制（native binary），与 OxyGenie 走的 ARK 网关不兼容，升上去会卡死。"全部跟着升"这条懒规则，会在某次 `pnpm update` 之后让整个 agent 链路静默挂掉，而且极难定位。

三个朴素方案的共同教训：**"用官方 SDK" 这个决定，会反过来对进程拓扑和版本策略提出硬约束。** 你不能再用"一个单体、框架全包、依赖全升"这套舒服的默认值——把 Loop 交给 SDK，恰恰意味着你必须在 SDK 之外把进程切开、把边界划清、把关键版本钉死。

## 核心方案：四角进程拓扑

OxyGenie 把这 15 层落成**四个各司其职的进程**，外加一圈有状态后端：

```
                ┌─────────────────────────────┐
  浏览器 ──HTTP─▶│ Nitro / TanStack Start :5000 │  SSR + API + 静态资源
                └──────────────┬──────────────┘
  浏览器 ──WS───▶┌─────────────────────────────┐
                │ ws-server.mjs   :3001 (常驻)  │  会话调度 / spawn / 限流 / 转发
                └──────────────┬──────────────┘
                   spawn ↓ (每条消息)        ↓ Docker socket（仅它）
        ┌──────────────────────────┐  ┌──────────────────────────┐
        │ ws-query-worker.mjs (一次性)│  │ preview controller (sidecar)│
        │  跑 Claude Agent SDK query()│  │  per-session 预览容器       │
        └──────────────────────────┘  └──────────────────────────┘
                       └──────────── Postgres / Redis / MinIO / Meili ───────┘
```

四个角各自对应一种负载特征，谁也不踩谁：

- **Nitro / TanStack Start（:5000，常驻）**——纯渲染与 API。SSR、路由、静态资源、Server Functions 都在这里，它要的是**低延迟、高并发、轻量**。这个进程从不亲自跑 `query()`，所以再多 agent 在烧 CPU，页面也照常秒开。`start-production.mjs` 在同一容器里把它和 ws-server 作为兄弟进程一起拉起。
- **ws-server.mjs（:3001，常驻）**——会话调度中枢。它持有每个浏览器标签页的长连 WebSocket，负责会话管理（`workspaceSessionId ↔ sdkSessionId` 映射）、按需 `spawn` worker、限流、把 worker 吐的流转发回浏览器。**它自己也不跑 `query()`**——它只调度。
- **ws-query-worker.mjs（一次性）**——真正跑 SDK `query()` 的地方。由 ws-server 在**每条消息**到达时 `spawn` 出来、跑完即死（这是整个系列的核心模型，第 03 篇专讲）。它要的是**独立堆、可被一刀 kill、跑完干净**，所以它必须是独立子进程，而不是 ws-server 里的一段 `await`。
- **preview controller（sidecar）**——独立的预览编排进程，**唯一持有 Docker socket** 的组件。它管 per-session 的预览容器（第 15 篇专讲）。把"能起容器"这个高危能力收敛到一个 sidecar 里，ws-server 和 worker 都碰不到 Docker socket。

底下那条 `Postgres / Redis / MinIO / Meili`，是这四个无状态/半无状态进程共享的有状态层——会话索引、缓存与队列、对象存储、全文检索。把状态全部下沉到这一层，上面的执行单元（尤其是 worker）才能做到"用完即弃"。

**这张拓扑图就是"用 SDK"这个决定的直接物理后果。** 因为不自己写 Loop、把 `query()` 当成一次重活外包出去，你才必须把它隔离进一次性子进程；因为执行被隔离了，调度就得有个常驻的 ws-server；因为渲染不能被执行拖垮，web 进程就得独立；因为预览要起容器，Docker socket 就得收进 sidecar。四个角，环环相扣，没有一个是随意切的。

## 关键实现要点

下面这张表是四角拓扑背后的具体选型与版本。每一行都不是随手填的默认值，重点看后两行带 **加粗** 的"为什么钉死"：

| 维度 | 选型 / 版本 | 说明 |
|------|------------|------|
| 运行时 | Node ≥ 22.12 | worker / ws-server / Nitro |
| 前端框架 | **TanStack Start** ^1.132 + React 19 + Vite 7 | SSR（不是 Next.js） |
| Agent 内核 | **Claude Agent SDK 0.2.112（钉死）** | 0.2.113+ 改用 native binary，与 ARK 网关不兼容（→ 第 14 篇） |
| 多模型 | **ARK 网关**（GLM/Doubao/DeepSeek/Kimi/MiniMax） | `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`（Bearer） |
| ORM / DB | Drizzle ^0.44 / PostgreSQL | 13 张领域表（→ 第 12 篇） |
| 鉴权 | Better Auth ^1.3（含 org 插件） | 组织级权限上限（→ 第 09 篇） |
| 实时 | `ws` ^8.18 | 长连 + worker stdout 转发 |
| 沙箱 | `@anthropic-ai/sandbox-runtime` ^0.0.52 | srt / bubblewrap（→ 第 10 篇） |
| MCP | `@modelcontextprotocol/sdk` ^1.25 | 7 个内置 MCP（→ 第 07 篇） |
| 队列 / 缓存 | BullMQ ^5.8 / ioredis ^5.4 | 后台任务 / 缓存 |
| 核心进程 | `ws-server.mjs`(2173 行) + `ws-query-worker.mjs`(851 行) | 调度 vs 执行 |

几行值得展开：

**前端选 TanStack Start，不是 Next.js。** 这不是品味问题，是拓扑问题。OxyGenie 需要的是一个**纯粹做渲染与 API、绝不掺执行**的 web 层，TanStack Start + Nitro 正好提供了 SSR、路由、Server Functions 这套现代全栈能力，又不会诱导你把后端重活塞进 web 进程。把它当渲染层用，执行另起一摊，边界天然清晰。

**Agent SDK 钉死在 0.2.112，且必须用精确版本、不能带 `^` 或 `~`。** 这是整张表里最硬的一条约束。`0.2.113+` 改成了原生二进制，与 ARK 网关不兼容，升上去会卡死整条 agent 链路。所以它不是"建议不升"，而是"任何把它纳入 `^` 范围的写法都是埋雷"。一个看似无害的依赖升级，能让整个产品在下一次构建后静默挂掉——这正是上一节"朴素方案三"会踩的坑，这里用钉子钉死它。

**ARK 网关用 `ANTHROPIC_AUTH_TOKEN`（Bearer），绝不设 `ANTHROPIC_API_KEY`。** OxyGenie 默认跑在火山 ARK 多模型网关上（GLM / Doubao / DeepSeek / Kimi / MiniMax），鉴权走 Bearer。这里有个反直觉的陷阱：如果你顺手设了 `ANTHROPIC_API_KEY`，SDK 会改走 `x-api-key` 而非 Bearer，ARK 直接拒掉。所以"少设一个变量"在这里反而是正确做法——多模型路由的完整逻辑见第 14 篇。

**两个核心进程加起来三千来行，但它们是整个 Harness 的心脏。** `ws-server.mjs`（2173 行）是调度，`ws-query-worker.mjs`（851 行）是执行——一个常驻一个一次性，一个管名额一个跑 `query()`。后面整整一个系列拆的，基本都是这两个文件里的工程。

## 反直觉结论

> [!IMPORTANT]
> **"用官方 SDK" 不等于 "一个进程搞定"。** 恰恰因为把 Loop 交给了 SDK，你更要在**进程拓扑**上下功夫：渲染、调度、执行、预览必须各自成进程，否则 SDK 的一次重活就会拖垮整个 web 服务。OxyGenie 的四角拓扑，是"用 SDK"这个决定的直接后果。

很多人对"用官方 SDK"的预期是**简化**——内核外包了，架构应该更轻才对。现实正相反：因为 `query()` 是一次不可控时长、可能吃满内存、还会真的去执行用户代码的"重活"，把它外包给 SDK 反而**抬高**了对你架构的要求。你不再能假装它是一次普通的函数调用 `await` 一下就完事，你必须给它一个独立进程、一道限流闸门、一层沙箱、一套回收逻辑。**SDK 越是把内核做得省心，你越要把外圈的进程边界划得清楚**——这就是 01 篇"难度从内核挪到外圈"这句话，在物理拓扑上的具体兑现。

## 三个生产坑

> [!WARNING]
> **坑一 —— 把 `query()` 留在 web 进程里"先跑通再说"。** 这是 demo 阶段最自然的捷径：TanStack Start 的 Server Function 里直接 `await query()`，一次就通，省掉了起 ws-server 的麻烦。但它把渲染和执行焊回了同一个堆——上线后只要有人触发一段吃内存的执行，web 进程被顶崩，**全站连页面都打不开**。修复方向：从第一天就把执行切到独立的 ws-query-worker，web 进程永远不碰 `query()`。这正是四角拓扑存在的全部理由。

> [!WARNING]
> **坑二 —— 给 Claude Agent SDK 写 `^0.2.112`。** 出于"依赖保持最新"的好习惯，顺手加个 `^`，于是某次 `pnpm update` 把它升到了 `0.2.113+`。它改用原生二进制、与 ARK 网关不兼容——agent 链路开始卡死，而 `package.json` 看起来一切正常，排查能耗掉你半天。修复：用**精确版本** `0.2.112`，禁用 `^`/`~`，并在注释里写明原因，避免下一个人"好心"放开它。

> [!WARNING]
> **坑三 —— ARK 环境下同时设了 `ANTHROPIC_API_KEY`。** 两个鉴权变量都配上"图个保险"，结果适得其反：只要 `ANTHROPIC_API_KEY` 在，ws-server 会注入它，SDK 就改走 `x-api-key` 而不是 Bearer，ARK 网关一律拒绝。表现是"鉴权失败"，但你明明 token 是对的，方向极容易找偏。修复：ARK 场景下**只设 `ANTHROPIC_AUTH_TOKEN`**，把 `ANTHROPIC_API_KEY` 留给原生 Anthropic 场景，两者互斥。

三个坑的共同根源是同一件事：**"用官方 SDK"会引入一批反直觉的硬约束，而它们恰好和工程师的几个好习惯（先跑通、跟着升、配齐保险）正面冲突。** 进程不能图省事合并、版本不能图新跟着升、变量不能图保险全配上——这三条"反习惯"的纪律，是站在 SDK 之上造产品必须先交的学费。

## 配图

1. ![四角进程拓扑（Nitro / ws-server / worker / preview）](../assets/img/02-process-topology.svg)
2. ![依赖与版本钉死关系（SDK 0.2.112 ↔ ARK）](../assets/img/02-deps-pinning.svg)

## 下一篇

→ [第 03 篇：Per-Message Worker 模型](./03-per-message-worker-model.md) 🌟

四角拓扑里最关键、也最反直觉的一角是 worker：为什么每来一条消息就 `spawn` 一个全新子进程把 `query()` 跑完、跑完即死，而不是给每个会话留一个常驻 worker、更不是在主进程里直接 `await`？下一篇把这个"一次性子进程"模型彻底拆开——它是整座塔的地基。

---

📌 [reading-map.md](../reading-map.md)
