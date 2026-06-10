---
title: "第 04 篇：流式协议 —— seq 编号的 NDJSON 帧、stdin/stdout 双工与背压"
slug: 04-streaming-protocol
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 4
keywords: [WebSocket, NDJSON, 背压, backpressure, seq, 流式]
prev: 03-per-message-worker-model
next: 05-execution-runtime
---

# 第 04 篇：流式协议 —— seq 编号的 NDJSON 帧、stdin/stdout 双工与背压

> worker 的 stdout，怎么一路变成浏览器里逐字蹦出来的字？这一篇拆这条链：`SDK 事件 → NDJSON 帧 → worker stdout → ws-server → WebSocket → 浏览器 store`。重点是三件事：为什么用 NDJSON 而不是 gRPC、`seq` 编号解决了什么、"快流 + 慢客户端"怎么用 `bufferedAmount` 阈值挡住内存爆炸。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案ndjson--seq--背压) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

第 03 篇定下了执行模型：每条消息一个一次性子进程，worker 里那行 `for await (const ev of query(...))` 就是整个 Agent Loop。但 Loop 只解决了"事件从哪来"，没解决"事件怎么到浏览器"。`query()` token-by-token 地吐事件——一个回合可能吐出几千帧，从 `system.init` 到一连串 `text_delta`，再到带 usage 的 `result`。这些帧诞生在子进程的 V8 堆里，终点却是公网另一端某个用户的浏览器 store。这条链要同时满足四个约束：

1. **零积压转发**：模型边想边吐，前端就要边收边渲染。不能等整段 `result` 到齐再一次性推——那样"流式"就只是个名字，用户盯着空白等十几秒。
2. **乱序可纠正**：从 worker stdout 到浏览器，中间隔着 stdout 管道、readline 解析、ws-server 转发、WebSocket、公网。任何一段都可能让帧的**到达顺序**偏离**产生顺序**。前端如果按到达顺序拼接，文本就会错位。
3. **慢客户端不爆内存**：LLM 出字的速度（尤其在内网 ARK 网关上）经常远快于用户的家庭宽带。快流撞上慢客户端，谁来扛住中间堆积的数据？这是整条链里唯一会**无上限增长**的东西。
4. **断网能续**：用户切 4G、电梯里断 30 秒、刷新页面——连接断了，重连后不能从头再来。

四件事里，前两件是"协议形态"问题，后两件是"流量控制"问题。OxyGenie 的答案把它们压进了一个极简的帧协议：带 `seq` 的 NDJSON，加上一条直接借用操作系统管道的背压链。

## 朴素方案为什么不行

**方案一：gRPC / protobuf 流。** 工业级流式传输的标准答案，强类型、二进制紧凑。但放到这条链上是杀鸡用牛刀：它要额外的 `.proto` 定义、代码生成、构建步骤，而我们要跨的第一段是"worker 子进程 ↔ ws-server"的**本地 stdout 管道**——一个进程写、父进程读，根本不过网。在本地管道上套二进制编解码，换来的是没法 `tail -f` 肉眼调试、出问题先得反序列化才能看。**它在"调试成本"这一关就死了**：流式链路最常见的故障是"某一帧格式不对/没来"，而你最需要的恰恰是直接读出每一帧的能力。

**方案二：靠到达顺序隐式排序。** 既然 worker 按顺序写，前端按收到的顺序拼不就行了？问题在于"按顺序写"不等于"按顺序到"。stdout 是字节流不是消息流，加上 ws-server 转发、WebSocket 分片、公网重排，每一段都可能打乱顺序。**它死在"分布式系统里顺序不是免费的"**：某两帧一错位，`text_delta` 就拼成乱码，而且是概率性 bug——本地测不出、线上偶发，最难排查。

**方案三：fire-and-forget 往 WebSocket 灌。** 读到一帧就 `ws.send()`，不管对端收没收，代码最短、吞吐最高——直到遇到慢客户端。WebSocket 的 `send()` 不阻塞：对端来不及收，数据就堆在服务端 send buffer 里。LLM 每秒吐几十帧、用户带宽只够每秒几帧，差额**全部驻留在 ws-server 内存**。**它死在"没有反压就没有上限"**：一个慢客户端配一个快回合，send buffer 能涨到几十上百 MB，几个并发就把第 03 篇守住的 16GB 预算冲垮，而且 OOM 的是主进程，所有人一起断线。

三个方案的共同教训：**流式协议的难点从来不在"把字推出去"，在"推不动的时候怎么办"。** gRPC 制造了真实的调试问题；隐式排序假装顺序免费；fire-and-forget 假装内存无限。真正要的是一个**人可读、自带顺序、推不动时会自己停下来**的协议。

## 核心方案：NDJSON + seq + 背压

OxyGenie 的流式协议可以一句话概括：

> **换行分隔的 JSON 帧（NDJSON），每帧盖一个单调递增的 `seq`；worker 用 `process.stdout.write()` 的返回值做背压，ws-server 用 `bufferedAmount` 阈值把背压一路反推回 worker——中间不设任何应用层缓冲队列。**

```
worker (子进程)                    ws-server (主进程)              浏览器 store
  │                                  │                              │
  query() 吐 SDK 事件                 │                              │
  │  writeFrame({...ev, seq:n++})    │                              │
  ▼                                  │                              │
  process.stdout.write(frame+'\n')   │                              │
  │   ├─ 返回 true → 继续写下一帧      │                              │
  │   └─ 返回 false → await 'drain'   │                              │
  ▼  （OS 管道满了，写就停在这里）      │                              │
  ─── stdout 管道 ──▶ readline 按 \n 切帧 ──▶ ws.send(frame)         │
                                     │   每帧后检查 ws.bufferedAmount │
                                     │   > 128KB → worker.stdout.pause()  ← 暂停读
                                     │   < 32KB  → worker.stdout.resume() ← 恢复读
                                     │                              │
                                     └──── WebSocket ──────▶ 按 seq 合并（非到达顺序）
                                                                    ▼
                                                              逐字蹦出来
```

逐件看它怎么把四个约束各个击破：

**① 帧格式：NDJSON——人可读、Node 原生、零依赖。** 每帧是一行 JSON，用 `\n` 分隔，帧类型只有四种：`event`（透传 SDK 事件）、`approval_request`（HITL 审批，见第 09 篇）、`done`、`error`。选 NDJSON 不因为它最快，而因为它在这条以本地管道开头的链上**调试成本最低**：worker stdout 出问题，`tail` 一下就能逐行读出每一帧，不需要编解码工具、不需要构建步骤。流式链路的故障九成是"哪一帧不对"，能直接读帧就是最大的生产力。

**② seq 编号：用 4 字节把"分布式排序"降级成"前端排序"。** worker 在 `writeFrame` 时给每帧盖一个单调递增的 `seq`，ws-server **原样转发不重排**，浏览器 store 按 `seq`（而非到达顺序）合并。精妙在于：顺序信息在**产生的那一刻**就被钉死在帧里，之后无论中间经过多少段重排，前端按 `seq` 排一次序就能还原。一个分布式系统里最棘手的"全局顺序"问题，被一个进程内的自增计数器解决了。

**③ 背压链：最好的缓冲是不缓冲。** 这是整套设计的重心。慢客户端的数据要堆在某处，OxyGenie 的选择是**不让它堆在应用内存里，而是堆在操作系统的管道缓冲区里**，并让管道的"满"一路反推回 LLM。链条是这样接起来的：ws-server 每转发一帧就检查这条连接的 `ws.bufferedAmount`，**超过 128KB 就 `worker.stdout.pause()`**，停止从子进程读 stdout；worker 这边 `process.stdout.write()` 一旦发现 OS 管道写满（返回 `false`）就 `await` 它的 `'drain'`，**那行 `for await` 自然卡住**，连带 SDK 不再向 LLM 要下一批 token；等客户端把积压发出去、`bufferedAmount` **跌回 32KB 以下就 `resume()`**，流水线重新流动。压力从慢客户端一路传回 LLM，全程没有一个应用层队列在中间无上限地涨。128KB/32KB 这对高低水位线（而非单一阈值）是为了避免在临界点反复 pause/resume 抖动。

**④ 节流：text 攒批，非 text 直发。** LLM 的 `text_delta` 可能每秒来上百帧，但浏览器没必要每秒重渲染上百次。worker 把 text 增量按 **100ms** 攒批（把 ~100 次/秒的渲染压到 ~10 次/秒），而 `tool_progress`、`result` 这类非 text 事件**立即转发**——它们承载状态变化，延迟 100ms 会让"工具开始执行"的反馈变迟钝。这是刻意的不对称：可读性敏感的文本可以攒，状态敏感的事件不能等。

四件事拼起来，就是一条"诞生即定序、推不动就回压、文本攒批"的流。它没有任何花哨的中间件，所有的"控制"都来自两个 Node 原生原语：`write()` 的返回值和 `bufferedAmount`。

## 关键实现要点

整条链落在四个文件里，worker 侧负责"盖 seq + 写帧 + 等 drain"，ws-server 侧负责"切帧 + 转发 + 背压闸门"，前端 adapter 侧负责"重连 + 按 seq 合并 + 100ms 节流"。下表是逐段的落点：

| 文件 | 行号 | 机制 |
|------|------|------|
| `ws-query-worker.mjs` | L630–780 | `query()` 流循环 + `writeFrame()` 盖 seq |
| `ws-server.mjs` | L1170–1287 | readline 解析 worker stdout → 转发；背压 apply/clear |
| `src/claude/adapters/ws-adapter.ts` | L362–367 | WS 单例 + 重连（`MAX_RECONNECT_ATTEMPTS=5`，1s 退避） |
| `ws-adapter.ts` | L759–1577 | `ClaudeAgentWSAdapter.run()` async generator + 100ms 节流 |
| `ws-adapter.ts` | L576–595 | `onMessage` 路由：`session_init`/`messages_loaded`/`approval_request` |

最值得盯住的是 `ws-server.mjs` L1170–1287：它既是"切帧 + 转发"的地方，也是背压闸门所在。readline 按 `\n` 把 worker stdout 切成一行行 JSON，每转发一帧就回头看一眼这条 WebSocket 的 `bufferedAmount`，越过 128KB 就 `pause()` 上游的 worker.stdout，跌回 32KB 就 `resume()`。背压的全部逻辑就这几行——没有队列、没有计数器、没有定时轮询，纯靠 Node 流的 pause/resume 与 OS 管道的天然反压。worker 侧（L630–780）与之配对的同样朴素：

```javascript
// ws-query-worker.mjs ~L630（机制示意，非逐字源码）
let __frameSeq = 0
const writeFrame = (obj) =>
  process.stdout.write(JSON.stringify({ ...obj, seq: __frameSeq++ }) + '\n')

for await (const ev of query(/* 见第 03 篇 */)) {
  writeFrame({ type: 'event', event: ev })   // 盖 seq、零中间缓冲
  // write() 返回 false 时，下一次写会卡在 OS 管道的 drain 上——
  // 那行 for await 随之停住，SDK 不再向 LLM 要下一批 token
}
```

前端这头，`ws-adapter.ts` 维护一个 WebSocket 单例（L362–367），断线后最多重连 5 次、1s 退避；`run()`（L759–1577）把收到的帧按 `seq` 合并进 store，并在渲染侧做 100ms 节流。SDK 事件类型由 worker 原样透传：`system.init`（含 sdk session_id / model / skills / mcp_servers）、`assistant`/`user`、`tool_progress`、`text_delta`/`text_complete`、`result`（usage + cost + num_turns）——前端只认 `seq` 和这几种 `type`，不关心它们走了多少跳。

## 反直觉结论

> [!IMPORTANT]
> **流式的难点不是"把字推出去"，是"快流遇上慢客户端时不爆内存"。答案不在应用层加队列，而是借操作系统的管道反压——最好的缓冲是不缓冲。**
>
> 直觉会让你想加一个"发送队列"来削峰填谷，但任何应用层队列都只是把"无上限增长"从 send buffer 挪到队列里，问题没解决只是换了地方。OxyGenie 反其道而行：一个字节都不主动缓冲，让 `bufferedAmount` 一高就 `pause()` worker stdout，OS 管道填满后 `write()` 返回 false，压力顺着 `for await` 一路传回 LLM 网关。**整条链上唯一的"缓冲区"是操作系统早就为你准备好的管道缓冲，而它自带上限。**

再点破一层：**seq 是这套协议里性价比最高的 4 字节。** 网络乱序通常要靠重传、确认、滑动窗口一整套机制；OxyGenie 没碰这些，只是在帧诞生那一刻盖个自增编号，把"保证顺序"这个传输层责任下放成前端的一次 `sort`。一个进程内的 `n++`，换掉一整套分布式定序协议。这和背压是同一种思路：**不要在应用层重建操作系统/前端已经能廉价提供的能力**——这正是"工程是 SDK 外面那一圈"的题中之义，连流式协议都要克制，能借就不造。

## 三个生产坑

> [!WARNING]
> **坑一 —— resume 时旧 worker 的在途帧被丢弃，无重放。**
> 用户切会话、刷新页面时，旧 worker 还在跑、stdout 里还有没读完的在途帧。当前实现直接丢弃这些帧、不做重放——所以"切会话那一瞬间正在生成的最后几帧"会丢，前端看到的是被截断的回答。根因是协议里没有"帧确认 + 重放缓冲"：seq 能让前端**发现**缺帧（编号不连续），但服务端没保留已发帧、补不回来。短期靠"切走前等回合结束"规避，根治要给 worker 加一个有界的已发帧环形缓冲，重连时按 last-seq 重放。

> [!WARNING]
> **坑二 —— seq 32 位回绕 + 单帧超大撑爆 readline。**
> 两个边界都罕见但真实。其一，`seq` 是 32 位自增，理论上 2³² 帧后回绕——单 worker 要连跑数周才可能触及，但一旦回绕，前端按序合并会把新帧排到旧帧前面。其二，ws-server 的 readline 按 `\n` 切帧，如果某一帧（比如模型一口气吐出的巨大 JSON）超过 64KB 还没遇到换行，整行会**驻留内存**——一个超大单帧能撑高 ws-server 内存，且绕过 128KB 背压闸门（背压管的是连接 send buffer，不是单帧解析）。两者都该有显式上限：seq 用 64 位或回合内重置，单帧加最大长度截断。

> [!WARNING]
> **坑三 —— worker stderr 只进控制台，不转发给客户端。**
> worker 的 stdout 是协议通道（NDJSON 帧），stderr 是另一路——SDK 告警、未捕获异常栈、工具 stderr 都走它，而它**只打到服务器控制台，不进 NDJSON 流、不转发给浏览器**。好处是噪声不污染协议、也不把内部错误泄给前端；代价是线上排查"为什么这回合卡住/吐了半截"，浏览器里什么都看不到，必须 SSH 上机器翻日志。这是有意的取舍，但要记住：**前端的"沉默"不等于"没事"**，真相在服务器的 stderr 里。

这三个坑的共同根源是：**这套协议把"可靠交付"换成了"简单 + 可读 + 自带顺序"**。NDJSON 好调试但没帧确认（坑一）；seq 廉价但是 32 位、且 readline 信任换行（坑二）；stdout/stderr 分流让协议干净但把错误藏进日志（坑三）。每个坑都是同一笔交易的找零——拿走了极简和可读，就得自己补上重放、上限和可观测性。好在它们都不在关键路径上：日常 99% 的回合，一条没有应用层缓冲的 NDJSON 流，恰恰是最不容易出错的那条。

## 配图

1. ![事件流五段映射：SDK→帧→stdout→WS→store](../assets/img/04-event-pipeline.svg)
2. ![背压：bufferedAmount 128KB/32KB 阈值与 worker stdout 暂停](../assets/img/04-backpressure.svg)

## 下一篇

→ [第 05 篇：ExecutionRuntime 双后端](./05-execution-runtime.md)

帧能稳稳地流到浏览器了，但帧里那些"跑 Python、跑 Bash"的工具调用，到底落在哪个沙箱里执行？下一篇拆 `ExecutionRuntime` 抽象：一个接口、两个可换后端（本地进程 / per-session Docker），以及那条比抽象本身更重要的铁律——沙箱没就位时**默认拒绝执行，绝不裸跑**。

---

📌 [reading-map.md](../reading-map.md)
