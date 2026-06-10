---
title: "第 03 篇：Per-Message Worker 模型 —— 为什么每条消息都 spawn 一个子进程，而不是常驻一个 Loop"
slug: 03-per-message-worker-model
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 3
keywords: [Agent Harness, Claude Agent SDK, child_process, per-message worker, 多租户 Agent, WebSocket]
prev: 02-oxygenie-stack-overview
next: 04-streaming-protocol
---

# 第 03 篇：Per-Message Worker 模型 —— 为什么每条消息都 spawn 一个子进程，而不是常驻一个 Loop

> 蓝本 HarWork 的第 03 篇讲"为什么 Agent Loop 必须是 async generator"。但 OxyGenie **没有自己写 Loop**——Loop 在 Claude Agent SDK 的 `query()` 里。OxyGenie 真正做的决策是另一个：**每来一条用户消息，就 `spawn` 一个全新的 Node 子进程把 `query()` 跑完，跑完即死。** 本文回答：为什么是"一次性子进程"，而不是"每个会话一个常驻 worker"，也不是"主进程里直接 `await query()`"？

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案per-message-worker) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

OxyGenie 是一个**多租户、自托管**的 Web Agent 平台：几十个用户同时开着浏览器，每个人都可能随时发一条消息，触发一段会调工具、跑 Python、写文件、可能跑 5 分钟的 agent 执行。后端要同时满足五个约束：

1. **隔离**：用户 A 的一段失控 Python（吃满内存、`while True`、段错误）不能拖垮用户 B 的会话，更不能把整个 Node 进程带走。
2. **可中断**：用户随时可能点"停止"、关浏览器、断网。停下来时不能留半截子进程、半写文件。
3. **流式**：`query()` 是边想边吐 token 的，必须**边收边转发**到浏览器，不能等整段。
4. **有上限**：16GB / 8 核单机要扛 ~50 并发会话。不能让一次内存峰值把机器 OOM 掉。
5. **不自己重写 Loop**：官方 SDK 已经把"调 LLM → 解析 tool_use → 执行工具 → 回灌 → 再调"这套循环、上下文管理、token 记账都做好了。重写一遍既是重复劳动，也会让我们跟不上 SDK 的更新。

约束 5 是 OxyGenie 和 HarWork 最大的分野：**HarWork 选择自研 engine、自己掌控 Loop；OxyGenie 选择站在官方 SDK 上，把工程全部花在"SDK 之外的那一圈"。** 而一旦决定用 SDK 的 `query()`，约束 1～4 就把"`query()` 该跑在哪里"这个问题推到了台前。

## 朴素方案为什么不行

**方案一：主进程里直接 `for await (const ev of query(...))`。** 最简单——WebSocket 收到消息，就在 ws-server 进程里把 SDK 的 async generator 消费掉。问题立刻来：SDK 会在**同一个 V8 堆**里执行工具。用户的 Python 子进程是 SDK 管的没错，但 SDK 本身的解析、buffer、还有我们注册的自定义 MCP 工具（`createSdkMcpServer`）全在主进程堆里。一个用户让模型生成 50MB 的 HTML、另一个用户的 grep 命中 10 万行，几个并发就把 ws-server 主进程顶到 heap limit——**主进程一崩，所有人的 WebSocket 全断**。隔离（约束 1）直接挂掉。

**方案二：每个会话一个常驻 worker（warm pool）。** 给每个活跃会话留一个长期子进程，消息来了复用它，省掉冷启动。听起来高效，但多租户场景下账算不过来：50 个会话 = 50 个常驻进程，**哪怕 90% 在发呆**，每个进程的 SDK 初始化 + MCP 连接 + 常驻堆也要占 150～300MB，光发呆就吃掉十几 GB。而且常驻就意味着**有状态**——上一条消息留下的全局变量、没清的定时器、MCP 的半连接，都会污染下一条。你还得自己写"进程健康检查 / 重启 / 状态复位"，复杂度往上翻一倍。warm pool 是 100+ 真并发时才值得的优化，不是 50 并发的起点。

**方案三：worker 线程（worker_threads）而不是子进程。** 比子进程轻。但 worker 线程**共享同一个进程的地址空间和资源限额**——一个线程把内存吃爆，整个进程一起 OOM；想用 `prlimit` 给单个任务设内存/进程数硬上限也做不到（那是进程级的）。隔离强度不够。

**方案四：Serverless / 容器每次冷起。** 隔离最强，但每条消息冷启一个容器，几百毫秒到几秒的启动延迟叠在每一轮对话上，交互体验崩；而且 OxyGenie 的目标是"单机 VPS 自托管"，不是"按调用计费的云函数"。

四个方案的共同教训：**隔离强度、内存上限、启动延迟、状态干净** 这四件事在多租户里互相拉扯。`query()` 跑在主进程=没隔离；常驻 worker=状态脏且费内存；线程=隔离不够；每次起容器=太慢。中间那个甜点，正好是 Node 的 `child_process.spawn`。

## 核心方案：Per-Message Worker

OxyGenie 的执行模型可以一句话概括：

> **一个长连的 WebSocket（每个浏览器标签页一条）＋ 一条消息一个一次性子进程。** 主进程 `ws-server.mjs` 只做"调度 + 转发 + 限流"，从不亲自跑 `query()`；真正跑 SDK 的是 `ws-query-worker.mjs`，它被 `spawn` 出来、把这一条消息跑完、`result` 事件一到就退出。

```
浏览器 ──WebSocket──▶ ws-server.mjs（主进程，常驻）
                         │  ① semaphore.acquire()  ← 限流，最多 8 个在跑
                         │  ② child_process.spawn('node', ['ws-query-worker.mjs'])
                         │     └─ env 注入 model / ARK token（密钥已剥离危险项）
                         │     └─ --max-old-space-size=1536  ← 单 worker 堆硬顶
                         ▼
                  ws-query-worker.mjs（子进程，一次性）
                         │  stdin  ← 收到这一条 run 请求（含 prompt / sessionId / 权限模式）
                         │  query({ tools:{preset:'claude_code'}, mcpServers:[python, glm-image, bash?] })
                         │  for await (ev of query) { writeFrame({type:'event', event:ev, seq:n++}) }
                         │  stdout ─（NDJSON 帧，带 seq）─▶ 回 ws-server ─▶ 浏览器
                         ▼
                  result 事件 → 写 usage/audit → process.exit()
                         │
            ws-server 监听到 'close' → semaphore.release()  ← 名额还回去
```

为什么这个形态正好抗住了四个约束？

- **隔离天然**：每条消息一个**独立 V8 堆 + 独立 PID**。用户的失控代码最多把自己这个 worker 撑爆，`ws-server` 主进程毫发无损，别人的会话继续跑。worker 还能在 Linux 上套 `--max-old-space-size` + `prlimit`，给单次执行设内存/进程数/文件大小的**硬上限**（这是线程做不到的）。
- **可中断天然**：要停？`worker.kill()` 一刀切，子进程连同它 fork 出的 Python/Bash 一起被操作系统回收，主进程不需要小心翼翼地"撤销半截状态"。
- **状态干净天然**：worker 跑完就死，**没有跨消息的脏状态**。下一条消息是一张白纸。不用写健康检查、不用复位全局变量。
- **有上限天然**：`spawn` 之前先过 semaphore，**最多 8 个 worker 同时在跑**（`MAX_CONCURRENT_WORKERS`）；第 9 条消息在队列里 FIFO 等名额。8 × 1.5GB 堆顶 ≈ 12GB，留足 16GB 机器的余量。这就是"50 并发会话"能在单机成立的关键——**并发会话数 ≠ 并发执行数**，大多数会话在发呆，真正在烧 CPU/内存的永远 ≤ 8 个。

而约束 5（不自己写 Loop）在这个模型里是**免费**的：worker 里那一行 `for await (const ev of query(...))` 就是整个 Agent Loop，它是 SDK 的 async generator——HarWork 第 03 篇辛苦论证的"为什么必须 async generator"，在 OxyGenie 这里是 SDK 已经替我们做完的事。OxyGenie 的工程量不在 Loop 里面，**在 Loop 外面那一圈**：spawn、限流、流转发、沙箱、持久化。

## 关键实现要点

**1. 主进程：spawn + 名额（`ws-server.mjs` L1113–1145）**

worker 的生命周期由一对 `acquire / release` 夹住。名额在 `spawn` 之前拿、在 `'close'` 事件里还：

```javascript
// ws-server.mjs ~L1125
await workerSemaphore.acquire()            // 满了就在这里 await，FIFO 排队
const worker = spawn('node', [
  `--max-old-space-size=${WORKER_MAX_OLD_SPACE_MB}`,   // 默认 1536，单 worker 堆硬顶
  workerScriptPath,
], { env: buildWorkerEnv(config), stdio: ['pipe','pipe','pipe'] })

worker.on('close', () => {
  workerSemaphore.release()               // 无论正常退出还是崩，名额都还回去
})
```

> 名额必须在 `'close'` 里还，不能在"收到 result 帧"时还——否则 worker 崩在 result 之前，名额就永久泄漏，跑满 8 次之后整个系统卡死。这是 per-message 模型最容易踩的资源泄漏点。

**2. 限流闸门是个 FIFO 信号量（`src/server/concurrency/semaphore.js` L11–60）**

`Semaphore(max)` 只做一件事：`acquire()` 返回一个 Promise，没名额就进 `_waiters` 队列；`release()` 时 `shift()` 出最早的等待者唤醒它。FIFO 保证不饿死。**注意它限的是"同时在跑的 worker 数"，不是外部任务队列**——第 9 条消息不是被拒绝，而是在信号量内部排队等名额。

**3. 子进程：stdin 收请求 → `query()` → stdout 吐帧（`ws-query-worker.mjs` L238–380 启动、L630–780 流循环）**

worker 不是用命令行参数收任务，而是**保持 stdin 打开**，按行读 JSON：第 1 行是 run 请求，之后的行是 HITL 审批回灌（详见第 09 篇）。核心就是把 SDK 的 async generator 逐帧转成带 `seq` 的 NDJSON：

```javascript
// ws-query-worker.mjs ~L630
let __frameSeq = 0
const writeFrame = (obj) => process.stdout.write(JSON.stringify({ ...obj, seq: __frameSeq++ }) + '\n')

for await (const ev of query({
  prompt,
  options: {
    model: process.env.ANTHROPIC_MODEL,                 // ARK 别名，见第 14 篇
    cwd: sessionWorkspace,                               // per-session 工作区，见第 11 篇
    permissionMode,                                      // ask→default / act→acceptEdits，见第 09 篇
    canUseTool,                                          // HITL 钩子
    tools: { type: 'preset', preset: 'claude_code' },    // SDK 内置工具
    mcpServers: [pythonMcp, glmImageMcp, ...(sandboxReady ? [bashMcp] : []), ...userMcp],
  },
})) {
  writeFrame({ type: 'event', event: ev })               // 每一帧立即吐，零中间缓冲
  if (ev.type === 'result') { await persistUsageAndAudit(ev); break }
}
process.exit(0)
```

**4. env 注入与密钥剥离（`ws-server.mjs` L1058–1070 + `execution/sandbox.js` `buildSafeEnv`）**

worker 继承父进程 env，但**给工具子进程执行命令时**会经过 `buildSafeEnv()` 把 `ANTHROPIC_API_KEY` 等敏感变量剥掉，只放行 PATH/HOME/LANG 等白名单（详见第 10 篇）。model、ARK base URL、auth token 这些 worker 自身需要的，在 spawn 时显式注入。

**5. 配置即上限（`ws-server.mjs` L45–72）**

| 参数 | 默认 | 作用 |
|------|------|------|
| `MAX_CONCURRENT_WORKERS` | 8 | 同时在跑的 worker 上限（semaphore 容量） |
| `WORKER_MAX_OLD_SPACE_MB` | 1536 | 单个 worker 的 V8 堆硬顶（0=不限） |
| 流式节流 | 100ms | text 增量按 100ms 攒批，非 text 立即转发（第 04 篇） |
| 背压阈值 | 128KB / 32KB | 客户端 send buffer 高于 128KB 暂停 worker stdout，低于 32KB 恢复（第 04 篇） |

## 反直觉结论

> [!IMPORTANT]
> **OxyGenie 最核心的工程决策，不是"怎么写 Agent Loop"，而是"决定不写 Agent Loop"。**
>
> 一旦把 Loop 交给官方 SDK，真正的难题就从"循环怎么转"变成了"**这个 SDK 调用该跑在哪个进程里、怎么限流、怎么隔离、跑完怎么清干净**"。答案是 per-message 子进程：用操作系统的进程边界，换来隔离、可中断、状态干净三件事，代价只是每条消息一次冷启动。

换个角度：**进程边界就是 OxyGenie 的隔离原语。** HarWork 用 Per-User 持久 Docker 做隔离（重，但状态持久）；OxyGenie 用"一次性子进程"做隔离（轻，但无状态）。两者都对——区别只在于：HarWork 把"状态留在容器里"，OxyGenie 把"状态留在磁盘上"（SDK transcript + DB，详见第 12 篇），进程本身用完即弃。**当执行单元是无状态的，扩容、限流、容错就都变简单了**——这是 per-message 模型真正的红利，也是它为什么能让"50 并发会话"在一台 16GB 机器上成立。

## 三个生产坑

> [!WARNING]
> **坑一 —— 名额必须在 `'close'` 里还，不是在 result 里还。**
> 如果你在收到 `result` 帧时就 `release()`，而 worker 在 result 之后、exit 之前崩了，或者根本没走到 result（OOM 被 kill），名额永久泄漏。跑满 `MAX_CONCURRENT_WORKERS` 次后，semaphore 再也拿不到名额，整个系统静默卡死。**修复**：只在 `worker.on('close')` 里 release，它对正常退出和崩溃都触发。

> [!WARNING]
> **坑二 —— `CLAUDE_SESSIONS_ROOT` 必须是绝对路径。**
> worker 的 cwd 是 per-session workspace，跟 ws-server 的 cwd 不一样。如果会话根目录配成相对路径，worker 解析出来的 transcript 路径就跟 ws-server 写进 DB 的对不上，**resume 时找不到 transcript，历史归零**。这正是 2026-06-02 之前的那个 resume bug（详见第 12 篇）。修复：DB 里一律存绝对路径。

> [!WARNING]
> **坑三 —— Ask 模式下，审批没回来 worker 会永远挂着。**
> HITL 走的是 worker stdin：`canUseTool` 发出 `approval_request` 帧后 `await` 一个 pending Promise，等浏览器把 `approval_response` 写回 stdin（第 09 篇）。但 pending map **没有超时**——浏览器崩了、审批帧丢了、用户切走再没回来，worker 就一直占着一个 semaphore 名额傻等。修复方向：给审批加可配置超时 + 自动 deny（已在 ask-act-hitl 设计 §2.6 规划）。

这三个坑的共同根源是：**per-message 模型把"进程生命周期"变成了你必须显式管理的资源**。进程会崩、会挂、会找错路径——主进程对每一个 worker 的 spawn / close / kill / 名额，都要有对应的兜底。这是用"进程隔离"换来的简单性所要付的税。

## 配图

1. ![Per-Message Worker 全景：长连 WS + 一次性子进程](../assets/img/03-per-message-worker.svg)
2. ![四种执行方案对比（主进程内 / 常驻 worker / 线程 / 子进程）](../assets/img/03-exec-approaches.svg)
3. ![semaphore 名额生命周期：acquire → spawn → close → release](../assets/img/03-semaphore-lifecycle.svg)

## 下一篇

→ [第 04 篇：流式协议 —— seq 编号的 NDJSON 帧、stdin/stdout 双工与背压](./04-streaming-protocol.md)

worker 的 stdout 怎么一路变成浏览器里逐字蹦出来的字？下一篇把这条链拆开：为什么用 NDJSON 而不是 gRPC、`seq` 编号解决了什么、客户端断网 30 秒怎么办、以及"快流 + 慢客户端"的背压是怎么用 `bufferedAmount` 阈值挡住内存爆炸的。

---

📌 系列阅读地图：[reading-map.md](../reading-map.md)
🔗 English version: [en/03-per-message-worker-model.md](../en/03-per-message-worker-model.md)
