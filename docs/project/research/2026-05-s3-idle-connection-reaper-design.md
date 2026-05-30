# S3 设计:WS 空闲连接回收(idle connection reaper)

> 日期:2026-05-30 · 作者:agent · 状态:**已实现(见 PR;默认 15min)**
> 目标:单台 16G/8核 撑 ~50 并发的 S 系列之一。S1=限「几个」worker,S2=限「每个吃多少」,
> **S3=回收「长期不说话的空闲连接」**,避免僵尸连接长期占槽/占 worker。
> 关联:[`2026-05-single-host-50-concurrency.md`](./2026-05-single-host-50-concurrency.md)(S 系列母文档)

## 1. references 调研结论

| 项目 | 怎么做的 | 对我们的启示 |
|---|---|---|
| **claude-agent-kit**(强制后端参考)`examples/basic-example/server/server.ts:50`、`claude-code-v0/server/server.ts:19` | 用 **Bun 原生 `idleTimeout: 120`**(秒),连接级空闲超时由 `Bun.serve` 内置 | 思路对(连接级 idle 超时),但**实现不可直接搬** |
| 同上 `packages/server/src/server/session-manager.ts` | 用 `lastModifiedTime` 跟踪会话活跃度(排序/quick-select) | 我们可类比:每连接记 `lastActivityAt` |

**关键差异**:OxyGenie 用 Node 的 **`ws` 库,没有内置 idleTimeout**,必须**手动实现**。Bun 那套搬不过来。

## 2. OxyGenie 现状(已代码核实)

- **已有 heartbeat**(`ws-server.mjs:1402-1411`):每 `HEARTBEAT_INTERVAL_MS`(30s)对所有 `wss.clients` ping;
  上一轮没回 pong 的 `ws.terminate()`。
  → 这只杀**死连接**(TCP 断/半开),**不管「活着但长期不说话」的空闲连接**。
- **worker 清理已在关闭侧覆盖**(`ws-server.mjs:1353-1364`):`ws.on('close')` 会 kill `ws.workerProcess`;
  且 `terminate()` 也会触发 `'close'` 事件,所以**死连接路径也清理 worker**。
- worker「每消息即起即退」(handoff 已述),所以泄漏面主要在**连接侧**——正是 S3 的目标。

**结论**:S3 不需要碰 worker 生命周期(已天然回收),只需**在连接侧加 idle 回收**;
回收时复用已有的 `ws.on('close')` → worker 不泄漏天然成立。

## 3. 设计(最小改动:扩展现有 heartbeat 循环)

### 3.1 活动打点
- `wss.on('connection')` 鉴权成功后 `ws.lastActivityAt = Date.now()`。
- `ws.on('message')` 处理**真实入站业务消息**时刷新 `ws.lastActivityAt = Date.now()`。
- ⚠️ **pong 不算活动**:协议层心跳 pong **不能**重置 `lastActivityAt`,否则连接永不空闲超时。
  (现有 `ws.on('pong')` 只设 `ws.isAlive=true`,保持不变,两者职责分离。)

### 3.2 空闲判定(两段保护,关键)
在现有 heartbeat 的 `wss.clients.forEach` 里、心跳逻辑之后追加:
1. **若 `ws.workerProcess` 在跑 → 跳过**(正在服务:长查询可能流式输出数分钟,期间无入站消息也**绝不能**杀)。
2. 否则 `now - ws.lastActivityAt > WS_IDLE_TIMEOUT_MS` → **回收**。

### 3.3 回收方式
- `ws.close(4002, 'idle timeout')`(优雅关闭,客户端可提示「因长时间无活动断开,请重连」)。
- 现有 `ws.on('close')` 自动 kill 残留 worker → **worker 不泄漏天然保证**。
- (心跳已负责真·死连接的 `terminate()`,此处用 `close()` 走优雅握手即可。)

### 3.4 新增 env 旋钮
- `WS_IDLE_TIMEOUT_MS`,**默认 900000(15 分钟)**——已与负责人确认。
  - 理由:OxyGenie 是交互式聊天,用户读长文/思考停几分钟很常见;参考项目的 120s 是**演示值**,
    对真实聊天会误杀。15min 几乎不影响活动用户,只收开着 tab 走人 / 笔记本休眠的僵尸连接。
  - `0` = 关闭 idle 回收(只保留心跳死连接清理)。
- 写进 `.env.example`,紧挨 `MAX_CONCURRENT_WORKERS` / `WORKER_MAX_OLD_SPACE_MB`。

## 4. 改动点清单(实现时照此)

| 文件 | 改动 | 位置(核实过) |
|---|---|---|
| `ws-server.mjs` | 加 `WS_IDLE_TIMEOUT_MS` 常量(默认 900000,`0` 关闭) | 紧挨 `HEARTBEAT_INTERVAL_MS`(`:245`)或 S2 配置块 |
| `ws-server.mjs` | `connection` + `message` 处理里打 `ws.lastActivityAt` | `:1328`(message)、`:1377-1380`(鉴权后) |
| `ws-server.mjs` | heartbeat 循环内加两段空闲判定 → `ws.close(4002,…)` | `:1403-1411` |
| `.env.example` | 文档化 `WS_IDLE_TIMEOUT_MS` | 紧挨 `WORKER_MAX_OLD_SPACE_MB` |

> 单元测试:idle 判定是「纯函数式」决策(给定 `now/lastActivityAt/hasWorker/timeout` → 该不该回收),
> 可抽一个小纯函数(如 `shouldReapIdle(...)`)放进 `src/server/concurrency/` 或就近,
> 配 `tests/unit/` 用例(timeout=0 关闭、worker 活跃不杀、超时杀、未超时不杀),延续 S1 semaphore 的可测风格。

## 5. 风险 / 边界

- **长查询误杀**:由「worker 活跃跳过」覆盖。✅
- **慢客户端**:S4 背压(PR #45)已处理缓冲;idle 与背压正交。
- **重连风暴**:被回收的客户端会重连——15min 粒度 + 仅僵尸连接,风暴风险极低。
- **与心跳交互**:idle 用业务消息计时,心跳用 pong 判活,两套互不污染(见 3.1 警告)。

## 6. 验证计划(延续 S1/S2 的诚实验证纪律)

- `node --check ws-server.mjs`(语法)
- `pnpm test:unit`(新增 idle 判定纯函数用例 + 原有 20 个)
- `WS_PORT=<free> node ws-server.mjs` 真启动:
  - 默认 → 日志打印 idle 超时配置、listening 无 ReferenceError
  - `WS_IDLE_TIMEOUT_MS=0` → 打印「idle reaping disabled」、正常启动
  - (可选)`WS_IDLE_TIMEOUT_MS=2000` + 一条静默连接,观察 ~2s 后被 `close(4002)`

## 7. 待确认 / 已确认

- [x] `WS_IDLE_TIMEOUT_MS` 默认值 = **900000(15min)** — 已确认。
- [x] 回收前先发一帧 `type:'idle_timeout'` 业务消息再 `close(4002)` — **已实现**
      (负责人建议:部分浏览器拿不到 close reason,单靠 code 前端体验不一致;故发业务帧 + close code 双保险)。

## 8. 实现落地(本 PR)
- 纯判定函数 `src/server/concurrency/idle-reaper.js` → `shouldReapIdle({now,lastActivityAt,hasActiveWorker,idleTimeoutMs})`,
  单测 `tests/unit/idle-reaper.test.ts`(6 例:disabled/active-worker/never-stamped/over/under/boundary)。
- `ws-server.mjs`:`WS_IDLE_TIMEOUT_MS` 常量(默认 900000,`0` 关闭)+ `BUSINESS_MESSAGE_TYPES` 白名单
  (仅 `create_session/init_session/chat/resume/abort` 刷新计时,`ping`/未知类型不刷新)+ 连接鉴权后种下
  `lastActivityAt` + heartbeat 循环内 `shouldReapIdle` 命中则发 `idle_timeout` 帧 + `ws.close(4002)`。
- 验证:`node --check` 通过;`pnpm test:unit` 26/26;默认/`=0` 启动日志正确;
  **真·端到端**(stub auth + 1s 超时 + 空闲客户端):客户端收到 `idle_timeout` 帧 + close code 4002,
  服务端打印 `Reaping idle connection`。
