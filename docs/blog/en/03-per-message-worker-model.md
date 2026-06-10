---
title: "Part 03: The Per-Message Worker Model — Why spawn a child process per message instead of running a resident loop"
slug: 03-per-message-worker-model
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 3
keywords: [Agent Harness, Claude Agent SDK, child_process, per-message worker, multi-tenant agent, WebSocket]
prev: 02-oxygenie-stack-overview
next: 04-streaming-protocol
---

# Part 03: The Per-Message Worker Model — Why spawn a child process per message instead of running a resident loop

> HarWork's Part 03 argues "why the Agent Loop must be an async generator." But OxyGenie **doesn't write its own loop** — the loop lives inside the Claude Agent SDK's `query()`. OxyGenie's real decision is a different one: **for every user message, `spawn` a brand-new Node child process, run `query()` to completion, and let it die.** This article answers: why a one-shot child process, rather than one resident worker per session, and rather than `await query()` straight in the main process?

**Jump to:** [Problem](#the-problem) · [Naive approaches](#why-the-naive-approaches-fail) · [Core solution](#core-solution-per-message-worker) · [Implementation](#key-implementation-details) · [Counterintuitive](#the-counterintuitive-takeaway) · [Production traps](#three-production-traps)

## The Problem

OxyGenie is a **multi-tenant, self-hosted** web agent platform: dozens of users with browsers open, any of whom can fire a message at any moment, triggering an agent run that calls tools, runs Python, writes files, and may take five minutes. The backend must satisfy five constraints at once:

1. **Isolation**: User A's runaway Python (memory bomb, `while True`, segfault) must not drag down User B's session, let alone take the whole Node process with it.
2. **Interruptible**: A user can hit "stop", close the browser, or lose network at any time. Stopping must not leave half-finished child processes or half-written files.
3. **Streaming**: `query()` emits tokens as it thinks; you must **forward as you receive**, not wait for the full block.
4. **Bounded**: A 16GB / 8-core box must hold ~50 concurrent sessions without one memory spike OOM-ing the host.
5. **Don't rewrite the loop**: The official SDK already implements "call LLM → parse tool_use → run tool → feed back → call again", context management, and token accounting. Rewriting that is both duplicated effort and a guarantee you'll fall behind SDK updates.

Constraint 5 is the biggest fork between OxyGenie and HarWork: **HarWork chose to build its own engine and own the loop; OxyGenie chose to stand on the official SDK and spend all engineering on "the ring around it."** And once you commit to the SDK's `query()`, constraints 1–4 push one question to the front: **where should `query()` actually run?**

## Why the Naive Approaches Fail

**Approach 1: `for await (const ev of query(...))` in the main process.** Simplest — the WebSocket receives a message and consumes the SDK's async generator right in the ws-server process. The problem hits immediately: the SDK executes tools in the **same V8 heap**. A few concurrent users generating 50MB of HTML or grepping 100K lines push the ws-server main process to its heap limit — **one crash, and everyone's WebSocket drops**. Isolation (constraint 1) is gone.

**Approach 2: one resident worker per session (warm pool).** Keep a long-lived child for each active session, reuse it per message, skip cold start. Sounds efficient, but the math fails in multi-tenant: 50 sessions = 50 resident processes, **even if 90% are idle**, each holding 150–300MB of SDK init + MCP connections + resident heap — tens of GB just idling. Resident also means **stateful** — leftover globals, uncleared timers, half-open MCP connections from the last message pollute the next. You then have to write health-check / restart / state-reset yourself. Warm pools are an optimization for 100+ real concurrency, not a starting point for 50.

**Approach 3: worker_threads instead of child processes.** Lighter. But threads **share the process address space and resource limits** — one thread bombs memory, the whole process OOMs; you can't `prlimit` a single task's memory/proc count (that's per-process). Insufficient isolation.

**Approach 4: serverless / fresh container per call.** Strongest isolation, but a cold container per message stacks hundreds of ms to seconds onto every turn; and OxyGenie targets "single-VPS self-hosting", not "pay-per-call cloud functions."

The shared lesson: **isolation strength, memory ceiling, startup latency, and clean state pull against each other in multi-tenant.** `query()` in the main process = no isolation; resident worker = dirty state and memory-heavy; threads = weak isolation; fresh container each time = too slow. The sweet spot in the middle is exactly Node's `child_process.spawn`.

## Core Solution: Per-Message Worker

OxyGenie's execution model in one sentence:

> **One long-lived WebSocket (one per browser tab) + one one-shot child process per message.** The main process `ws-server.mjs` only does "schedule + forward + throttle" and never runs `query()` itself; the actual SDK runner is `ws-query-worker.mjs`, spawned to run this single message and exit the moment the `result` event arrives.

```
Browser ──WebSocket──▶ ws-server.mjs (main, resident)
                          │  ① semaphore.acquire()  ← throttle, ≤ 8 running
                          │  ② child_process.spawn('node', ['ws-query-worker.mjs'])
                          │     └─ env injects model / ARK token (dangerous secrets stripped)
                          │     └─ --max-old-space-size=1536  ← per-worker heap hard cap
                          ▼
                   ws-query-worker.mjs (child, one-shot)
                          │  stdin  ← this one run request (prompt / sessionId / permission mode)
                          │  query({ tools:{preset:'claude_code'}, mcpServers:[python, glm-image, bash?] })
                          │  for await (ev of query) { writeFrame({type:'event', event:ev, seq:n++}) }
                          │  stdout ─(NDJSON frames, with seq)─▶ back to ws-server ─▶ browser
                          ▼
                   result event → write usage/audit → process.exit()
                          │
             ws-server hears 'close' → semaphore.release()  ← slot returned
```

Why does this shape absorb all four constraints?

- **Isolation, naturally**: one **independent V8 heap + independent PID** per message. Runaway user code bombs only its own worker; the `ws-server` main process is untouched and everyone else keeps running. On Linux the worker also wears `--max-old-space-size` + `prlimit` for **hard caps** on memory/proc-count/file-size (which threads can't do).
- **Interruptible, naturally**: want to stop? `worker.kill()` — the OS reaps the child along with the Python/Bash it forked. The main process doesn't have to carefully "undo half-finished state."
- **Clean state, naturally**: the worker dies after the run — **no cross-message dirty state.** The next message is a blank slate. No health checks, no global resets.
- **Bounded, naturally**: before `spawn`, pass the semaphore — **at most 8 workers running at once** (`MAX_CONCURRENT_WORKERS`); the 9th message waits FIFO in queue. 8 × 1.5GB heap cap ≈ 12GB, leaving headroom on a 16GB box. This is why "50 concurrent sessions" holds on a single host — **concurrent sessions ≠ concurrent executions.** Most sessions idle; the ones actually burning CPU/memory are always ≤ 8.

And constraint 5 (don't rewrite the loop) is **free** in this model: that one line `for await (const ev of query(...))` inside the worker *is* the entire Agent Loop, and it's the SDK's async generator — everything HarWork's Part 03 laboriously argues about "why it must be an async generator" is already done for us by the SDK. OxyGenie's engineering isn't *in* the loop, it's **in the ring around the loop**: spawn, throttle, stream-forward, sandbox, persist.

## Key Implementation Details

**1. Main process: spawn + slot (`ws-server.mjs` L1113–1145)**

The worker's lifecycle is bracketed by a pair of `acquire / release`. The slot is taken before `spawn` and returned in the `'close'` event:

```javascript
// ws-server.mjs ~L1125
await workerSemaphore.acquire()            // if full, awaits here, FIFO queue
const worker = spawn('node', [
  `--max-old-space-size=${WORKER_MAX_OLD_SPACE_MB}`,   // default 1536, per-worker heap cap
  workerScriptPath,
], { env: buildWorkerEnv(config), stdio: ['pipe','pipe','pipe'] })

worker.on('close', () => {
  workerSemaphore.release()               // return the slot whether it exits cleanly or crashes
})
```

> The slot must be returned in `'close'`, not on "received the result frame" — otherwise a worker that crashes before result leaks its slot permanently, and after 8 runs the whole system deadlocks. This is the per-message model's easiest resource leak.

**2. The throttle gate is a FIFO semaphore (`src/server/concurrency/semaphore.js` L11–60)**

`Semaphore(max)` does exactly one thing: `acquire()` returns a Promise; with no slot it joins the `_waiters` queue; `release()` `shift()`s and wakes the earliest waiter. FIFO prevents starvation. **Note it caps "workers running at once", not an external task queue** — the 9th message isn't rejected, it waits inside the semaphore.

**3. Child: stdin receives the request → `query()` → stdout emits frames (`ws-query-worker.mjs` L238–380 startup, L630–780 stream loop)**

The worker doesn't take its task via CLI args — it **keeps stdin open** and reads JSON line by line: line 1 is the run request, later lines are HITL approval responses (see Part 09). The core is turning the SDK's async generator into seq-tagged NDJSON frame by frame:

```javascript
// ws-query-worker.mjs ~L630
let __frameSeq = 0
const writeFrame = (obj) => process.stdout.write(JSON.stringify({ ...obj, seq: __frameSeq++ }) + '\n')

for await (const ev of query({
  prompt,
  options: {
    model: process.env.ANTHROPIC_MODEL,                 // ARK alias, see Part 14
    cwd: sessionWorkspace,                               // per-session workspace, see Part 11
    permissionMode,                                      // ask→default / act→acceptEdits, see Part 09
    canUseTool,                                          // HITL hook
    tools: { type: 'preset', preset: 'claude_code' },    // SDK built-in tools
    mcpServers: [pythonMcp, glmImageMcp, ...(sandboxReady ? [bashMcp] : []), ...userMcp],
  },
})) {
  writeFrame({ type: 'event', event: ev })               // emit each frame immediately, zero buffering
  if (ev.type === 'result') { await persistUsageAndAudit(ev); break }
}
process.exit(0)
```

**4. env injection and secret stripping (`ws-server.mjs` L1058–1070 + `execution/sandbox.js` `buildSafeEnv`)**

The worker inherits the parent env, but **when a tool subprocess executes a command** it passes through `buildSafeEnv()`, which strips `ANTHROPIC_API_KEY` and other sensitive vars, allowing only a PATH/HOME/LANG-style allowlist (see Part 10). The model, ARK base URL, and auth token that the worker itself needs are injected explicitly at spawn.

**5. Config is the ceiling (`ws-server.mjs` L45–72)**

| Parameter | Default | Role |
|------|------|------|
| `MAX_CONCURRENT_WORKERS` | 8 | Cap on concurrently running workers (semaphore capacity) |
| `WORKER_MAX_OLD_SPACE_MB` | 1536 | Per-worker V8 heap hard cap (0 = unlimited) |
| Stream throttle | 100ms | text deltas batched at 100ms, non-text forwarded immediately (Part 04) |
| Backpressure | 128KB / 32KB | pause worker stdout above 128KB client send buffer, resume below 32KB (Part 04) |

## The Counterintuitive Takeaway

> [!IMPORTANT]
> **OxyGenie's most important engineering decision isn't "how to write the Agent Loop" — it's "deciding not to write it."**
>
> Once you hand the loop to the official SDK, the real problem shifts from "how does the loop turn" to "**which process should this SDK call run in, how do I throttle it, isolate it, and clean it up afterward.**" The answer is a per-message child process: use the OS process boundary to buy isolation, interruptibility, and clean state — at the cost of one cold start per message.

Another angle: **the process boundary is OxyGenie's isolation primitive.** HarWork isolates with per-user persistent Docker (heavy, but state persists); OxyGenie isolates with one-shot child processes (light, but stateless). Both are right — the difference is only that HarWork **keeps state in the container** while OxyGenie **keeps state on disk** (SDK transcript + DB, see Part 12), with the process itself disposable. **When the execution unit is stateless, scaling, throttling, and fault tolerance all get simpler** — that's the real dividend of the per-message model, and why "50 concurrent sessions" holds on one 16GB box.

## Three Production Traps

> [!WARNING]
> **Trap 1 — return the slot in `'close'`, not in result.**
> If you `release()` on receiving the `result` frame, and the worker crashes after result but before exit (or never reaches result, OOM-killed), the slot leaks permanently. After `MAX_CONCURRENT_WORKERS` such events the semaphore can never hand out a slot and the system silently deadlocks. **Fix**: release only in `worker.on('close')`, which fires for both clean exit and crash.

> [!WARNING]
> **Trap 2 — `CLAUDE_SESSIONS_ROOT` must be an absolute path.**
> The worker's cwd is the per-session workspace, different from the ws-server cwd. If the sessions root is configured relative, the transcript path the worker resolves won't match what ws-server wrote to the DB, so **resume can't find the transcript and history is wiped.** This was exactly the pre-2026-06-02 resume bug (see Part 12). Fix: always store absolute paths in the DB.

> [!WARNING]
> **Trap 3 — in Ask mode, a worker hangs forever if approval never returns.**
> HITL goes over worker stdin: `canUseTool` emits an `approval_request` frame then `await`s a pending Promise, waiting for the browser to write `approval_response` back to stdin (Part 09). But the pending map has **no timeout** — if the browser crashes, the approval frame is lost, or the user navigates away, the worker waits forever, still holding a semaphore slot. Fix direction: configurable approval timeout + auto-deny (already planned in the ask-act-hitl design §2.6).

The shared root of these three traps: **the per-message model turns "process lifecycle" into a resource you must explicitly manage.** Processes crash, hang, resolve wrong paths — the main process needs a fallback for every worker's spawn / close / kill / slot. That's the tax you pay for the simplicity that process isolation buys.

## Diagrams

1. ![Per-message worker overview: long-lived WS + one-shot child](../assets/img/03-per-message-worker.svg)
2. ![Four execution approaches compared (in-process / resident worker / thread / child)](../assets/img/03-exec-approaches.svg)
3. ![Semaphore slot lifecycle: acquire → spawn → close → release](../assets/img/03-semaphore-lifecycle.svg)

## Next

→ [Part 04: Streaming protocol — seq-numbered NDJSON frames, stdin/stdout duplex, and backpressure](./04-streaming-protocol.md)

How does the worker's stdout become characters popping out one by one in the browser? Next we take that chain apart: why NDJSON over gRPC, what `seq` numbering solves, what happens when the client drops for 30 seconds, and how "fast stream + slow client" backpressure stops a memory blowup with `bufferedAmount` thresholds.

---

📌 Reading map: [reading-map.md](../reading-map.md)
🔗 中文版：[zh/03-per-message-worker-model.md](../zh/03-per-message-worker-model.md)
