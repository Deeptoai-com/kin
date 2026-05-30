# 调研:单台 16G/8核 VPS 支持 50 并发 — 方向（取代"三层解耦优先"）

> 日期：2026-05-30 · 作者：agent
> 目标（负责人设定）：**让 OxyGenie 在一台 16GB / 8 核 VPS 上同时支持 50 个并发会话。**
> 关联：[`2026-05-scalability-and-runtime.md`](./2026-05-scalability-and-runtime.md)、
> [`2026-05-tier-decoupling-design.md`](./2026-05-tier-decoupling-design.md)

## 1. references 调研结论（成熟案例怎么做）

深读三个与我们同类的项目，模式高度一致：

| 项目 | 模式 | 对我们的启示 |
|---|---|---|
| **claude-agent-server** (dzhng) | 和我们一样 Claude Agent SDK + WebSocket。架构是**单连接 1-to-1 relay，一会话一沙箱**，靠 E2B "每会话一沙箱"扩展。**不在单进程里多路复用会话。** | 一会话一隔离单元是通行做法 |
| **hermes-agent** (Nous) | `Sandbox` 抽象基类 + Local/Docker/Modal/Daytona/SSH 五后端，**一会话一沙箱**。 | 与我们 PR-1 的 `ExecutionRuntime` 接口完全同构 |
| **deer-flow** (ByteDance) | 标准单机多容器栈（backend/postgres/mongo/redis/nginx），单机可部署。 | 单机部署是现实主流，不必一上来就多机 |

**共同点：所有成熟项目都是「一会话一隔离单元 + 可插拔后端」，没有一个往单进程塞多会话。** 这正是我们已有的 `ExecutionRuntime` 接口（PR #39/#41）方向。

## 2. 关键洞察：50 并发会话 ≠ 50 个同时执行的 agent

- 一个"并发会话"大部分时间在 **idle / 打字 / 等 LLM 流式返回**，并不在本地烧 CPU。
- 真正的资源约束是 **同时活跃的 worker 子进程数**（每个 = 一个 node + Claude Agent SDK，常驻约 150–300MB）。
- WebSocket 连接本身极廉价（每条几 KB）。**16G/8核 扛 50 条 WS 连接毫无压力。**

## 3. 真正的瓶颈（已代码核实）

`ws-server.mjs` 每条消息**无条件 `spawn` 一个 worker，没有任何并发上限**
（line 798，附近无 semaphore/queue/activeWorkers）。

- 50 个用户同时发消息 → 同时 spawn 50 个 worker → 50 × ~250MB ≈ **12.5GB**，逼近 16G 上限，再叠加 Postgres/Redis/MinIO/Meili + Node 主进程 → **OOM 风险**。
- 这才是"单机 50 并发"的拦路石，**不是**三层解耦要解决的"多机分布"问题。

## 4. 方向修正：单机限流，而非三层解耦

> **三层解耦（无状态网关 + 队列 worker 池 + 对象存储）是为"多机、成百上千并发"准备的，对"单机 50"是过度工程。** 暂缓。

针对"单机 50 并发"，正确且最小的方案是**单机并发治理**：

### S1 — 有界 worker 并发 + 排队（核心，直接命中目标）
- 引入一个进程内信号量：**同时活跃 worker 上限** `MAX_CONCURRENT_WORKERS`（默认按核数，如 8）。
- 超过上限的消息**排队**等待空位，而不是立刻 spawn；给客户端发"排队中"状态。
- 效果：50 会话连着没问题，真正并行执行的只有 ≤8 个，内存可控（8 × 250MB ≈ 2GB）。

### S2 — 单 worker 资源上限
- 每个 worker 设内存/CPU 软上限（如 `--max-old-space-size`，或 Docker 后端的 `--memory`），单个失控不拖垮整机。
- 复用已有的 `EXEC_DOCKER_MEMORY` 等（PR #41 已内置）。

### S3 — idle 会话/worker 回收
- worker 跑完即退（现状已是 per-message，天然回收）；再加 WS 空闲连接超时清理。

### S4 — 背压（已完成）
- C4（PR #45）已落地：慢客户端不会让 server 无界缓冲。✅

### S5 — 容量基线压测
- 在一台 16G/8核 机器上，用 N 个模拟客户端压测，量内存/延迟曲线，校准 `MAX_CONCURRENT_WORKERS` 默认值，写进部署文档。

## 5. 与已有工作的关系

- `ExecutionRuntime`（PR #39/#41）、背压（PR #45）已经是这条路的一部分 ✅。
- S1 的"有界并发 + 排队"是新增的小改动（集中在 `ws-server.mjs` 的 spawn 处 + 一个轻量队列），**可逆、可独立验证**。
- 三层解耦文档（`2026-05-tier-decoupling-design.md`）保留作为**未来多机扩展**的设计储备，不在本目标内执行。

## 6. 建议的执行顺序（小步、可验证）

1. **S1** 有界 worker 并发 + 排队（+`MAX_CONCURRENT_WORKERS` env）→ 单机内存可控。
2. **S2** 单 worker 资源上限（env 化）。
3. **S3** idle 连接回收。
4. **S5** 16G/8核 压测校准默认值，写入 README 部署指南。

每步：`test:unit` 绿 + **真实启动 ws-server 验证**（吸取 C4 教训：node --check 不算验证）。

## 7. 给潜在用户的承诺（写入 README/ROADMAP）

- **当前**：单机可用，适合个人/小团队；**尚无并发上限保护**（高并发下有 OOM 风险）。
- **目标**：单台 16G/8核 稳定支持约 50 并发会话（≤8 并行执行 + 排队），有资源上限与背压保护。
- **未来**：需要更高并发/多机时，走三层解耦（设计已储备）。

---

### 决策点（请你确认）
1. 同意把目标从"三层解耦"修正为"**单机并发治理（S1–S5）**"作为当前优先吗？
2. `MAX_CONCURRENT_WORKERS` 默认值：建议 **8**（=核数）。是否同意，还是要更保守（如 6）/更激进（如 12）？
3. 是否从 **S1** 开始实施（最小、最直接命中 50 并发目标）？
