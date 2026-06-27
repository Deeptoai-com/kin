# OxyGenie vs WeKnora — 架构与代码深挖

> 调研日期：2026-06-22。
> 对象：[Tencent/WeKnora](https://github.com/Tencent/WeKnora) v0.6.2（9 小时前 commit，MIT License，腾讯出品，微信对话开放平台底座，Trendshift trending）。
> 本仓库镜像：`references/useful_frameworks/WeKnora/`。
> 视角：作为 OxyGenie 的**参考实现**，挖出值得借鉴的架构决策与代码模式，输出可执行的 Roadmap 输入。

---

## 0. 一句话结论

WeKnora 和 OxyGenie **品类相邻但定位错位**——WeKnora 是「文档驱动的企业 RAG 平台」，OxyGenie 是「团队驱动的自托管 Agent 工作台」。**两者会在「自托管 + 知识库 + ReAct Agent + MCP」这块直接相撞**，但 WeKnora 在 RAG/检索/数据源同步这条轴上已经做到 v0.6.x 级别成熟度——**这是 OxyGenie 目前的弱项，需要决策：要么追、要么明确不打这条轴**。

**反过来 OxyGenie 的护城河也清楚**：

1. **每条消息独立子进程的 Agent SDK 隔离** —— WeKnora 是应用内 ReAct loop，没这层
2. **Artifacts + per-session 沙箱子域名预览** —— WeKnora 没有
3. **一键在线升级**（UI 里 pull → migrate → recreate → health-gate → 回滚）—— WeKnora 没有
4. **小团队定位（≤30 人 + 一台 Mac mini 起跑）** —— WeKnora 是企业级（4 层 RBAC、多租户、多向量库），太重

**不要正面拼 RAG 深度，守住「Agent-first 工作台 + 小团队部署体验」。**

---

## 1. 项目体量对照

| | WeKnora | OxyGenie |
|---|---|---|
| 语言/栈 | Go 1.26 后端 + Python gRPC 解析器 + Vue 前端 | Node.js 22 + TanStack Start + React + WebSocket |
| 顶层结构 | `cmd/server` + `cmd/desktop` (Wails) + `cli/` + `docreader/` (Python) + `mcp-server/` (Python) + `frontend/` + `miniprogram/` | `src/` + `ws-server.mjs` + `ws-query-worker.mjs` + `parser-sidecar/` |
| `internal/` 模块数 | 26 个（agent / sandbox / mcp / models / searchutil / datasource / tracing / ratelimit / im / stream / sandbox …） | 较扁平 |
| 多端 | Web UI + Wails 桌面端 + Chrome 扩展 + 微信小程序 + CLI + MCP server | Web UI only |
| 国际化 | 4 语言 README（英中日韩） | 中英 |
| 文档 | `docs/` 35 项；CHANGELOG.md **105K** | `docs/project/` 已成体系 |
| 仓库活跃度 | v0.6.2，最近 commit **9 小时前** | 6 天前 |

**信号**：WeKnora 是一个**工程化完成度极高、迭代极快**的项目。在腾讯背书下日均推进。OxyGenie 与之做"广度战"会输——必须打**深度差异化**。

---

## 2. 架构对照（一张图）

```
┌─────────────────────────────────────────────────────────────────┐
│                          WeKnora                                │
│  Web UI / Wails Desktop / Chrome Ext / 小程序 / CLI / MCP       │
│                          │                                      │
│                          ▼ HTTP / SSE                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Go App (cmd/server)                                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ Agent   │ │ Sandbox │ │ MCP Mgr  │ │ Stream Mgr   │   │   │
│  │  │ ReAct   │ │ Manager │ │ (OAuth)  │ │ (mem/redis)  │   │   │
│  │  └────┬────┘ └────┬────┘ └────┬─────┘ └──────┬───────┘   │   │
│  │       │           │           │              │           │   │
│  │  ┌────▼───────────▼───────────▼──────────────▼───────┐   │   │
│  │  │  Engine Factory（向量库工厂）→ 9 backends 抽象     │   │   │
│  │  │  pgvector / ES / OpenSearch / Milvus / Weaviate /  │   │   │
│  │  │  Qdrant / Doris / 腾讯 VectorDB / SQLite           │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  │  Async tasks: Asynq (Redis 队列) + 自动 trace 注入        │   │
│  │  Audit: 跨层 AuditSink 适配器                              │   │
│  │  Observability: Langfuse only（v0.6.2 移除 Jaeger）       │   │
│  └────────┬──────────────────┬─────────────────────────────┘   │
│           │ gRPC + TLS+Token │                                  │
│           ▼                  ▼                                  │
│  ┌────────────────┐  ┌─────────────────────┐                    │
│  │ docreader      │  │ mcp-server (py)     │                    │
│  │ (Python gRPC)  │  │ stdio/SSE/HTTP      │                    │
│  │ 17 parsers     │  │ 多 transport        │                    │
│  └────────────────┘  └─────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          OxyGenie                               │
│  Web UI (TanStack Start)                                        │
│                          │                                      │
│                          ▼ WebSocket /ws/agent                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ws-server.mjs (主进程)                                  │   │
│  │  ├─ Better Auth 验证                                     │   │
│  │  ├─ Session ↔ sdkSessionId 映射                          │   │
│  │  └─ spawn/kill 子进程                                    │   │
│  └────────┬─────────────────────────────────────────────────┘   │
│           │ child_process per message                           │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ws-query-worker.mjs (子进程, OS 级隔离)                 │   │
│  │  └─ @anthropic-ai/Codex-agent-sdk 0.2.112                │   │
│  │     ├─ cwd = per-session 沙箱                            │   │
│  │     ├─ settingSources=['project']（Skills/.Codex 加载）  │   │
│  │     └─ resumeSessionId（原生会话恢复）                   │   │
│  └──────────┬───────────────────────────────────────────────┘   │
│             │                                                    │
│  ┌──────────▼───────────┐  ┌────────────────────┐                │
│  │ parser-sidecar       │  │ Mastra (HTTP/SSE)  │                │
│  │ (Python 文档解析)    │  │ 文件分析/工作流    │                │
│  └──────────────────────┘  └────────────────────┘                │
│                                                                  │
│  Storage: Postgres + Drizzle / MinIO / Meilisearch / Redis       │
└─────────────────────────────────────────────────────────────────┘
```

**形态对比的本质**：

| 维度 | WeKnora | OxyGenie |
|---|---|---|
| **Agent loop 位置** | Go 进程内（一个大应用） | 独立子进程（每消息一个） |
| **隔离粒度** | 用户 → tenant；执行 → sandbox container | 会话 → 子进程；执行 → per-session sandbox |
| **状态机** | DB + Redis Stream + Asynq 队列 | DB + WebSocket session 映射 |
| **多端策略** | 全平台覆盖（Web/桌面/扩展/小程序/CLI） | Web 优先 |
| **可扩展性焦点** | 横向多 backend（向量库 9 选 1） | 纵向多沙箱（per-session） |

---

## 3. 值得借鉴的具体代码模式（按优先级）

### 🟢 P0-1：Engine Factory + 多 backend 抽象（向量库 / 沙箱 / 模型 / 数据源）

**WeKnora 做法**（`internal/container/engine_factory.go`）：

```go
func NewEngineFactory(db, cfg, auditSvc) EngineFactory {
    sink := newAuditSinkAdapter(auditSvc)
    return func(ctx, store types.VectorStore) (RetrieveEngineService, error) {
        switch store.EngineType {
        case PostgresRetrieverEngineType:        return createPostgresEngine(store, db)
        case ElasticsearchRetrieverEngineType:   return createElasticsearchEngine(store, cfg)
        case QdrantRetrieverEngineType:          return createQdrantEngine(store)
        case MilvusRetrieverEngineType:          return createMilvusEngine(ctx, store)
        case WeaviateRetrieverEngineType:        return createWeaviateEngine(store)
        case OpenSearchRetrieverEngineType:      return createOpenSearchEngine(ctx, store, sink)
        // 9 个 backend …
        }
    }
}
```

**关键设计点**：
1. **Factory 闭包捕获 audit sink**，不污染函数签名
2. 每个 backend 都是独立 sub-package：`application/repository/retriever/{postgres,milvus,…}/`
3. **DB 存 store 配置**，运行时从 DB 读出来创建 engine，支持动态注册新 backend
4. AuditSink 是单向依赖适配器（driver 定义接口，container 实现）

**对 OxyGenie 的可取之处**：
- **沙箱**已经有 Local/Docker/Disabled 三态（见 §3-2），但**模型 provider** 目前主要绑定 ARK——可以参考这种 factory 模式做 provider 抽象，让"用户 BYOK 不同网关"成为一等公民
- **检索**如果未来要支持 pgvector / Meilisearch 二选一，按此模式实现
- **AuditSink 适配器模式**很值得偷——把审计抽成驱动层接口、应用层实现，不让 driver 反向依赖业务

---

### 🟢 P0-2：Sandbox 三态降级 + 脚本静态校验（WeKnora 比 OxyGenie 安全栈完整）

**WeKnora 做法**（`internal/sandbox/sandbox.go`、`manager.go`、`validator.go`）：

```go
type SandboxType string
const (
    SandboxTypeDocker   SandboxType = "docker"
    SandboxTypeLocal    SandboxType = "local"      // 进程隔离 + 资源限制
    SandboxTypeDisabled SandboxType = "disabled"   // 显式禁用
)

// 启动时：探测 Docker 可用 → 用 Docker；不可用 + 允许 fallback → 用 Local
func (m *DefaultManager) initializeSandbox(ctx context.Context) error {
    case SandboxTypeDocker:
        if dockerSandbox.IsAvailable(ctx) {
            m.sandbox = dockerSandbox
            go dockerSandbox.EnsureImage(ctx)   // 异步预拉镜像
            return nil
        }
        if m.config.FallbackEnabled { m.sandbox = NewLocalSandbox(...) }
    ...
}

// ScriptValidator：执行前静态扫危险命令 + 注入模式 + 参数注入
type ScriptValidator struct {
    dangerousCommands    []string         // rm -rf / / curl …
    dangerousPatterns    []*regexp.Regexp // shell injection
    argInjectionPatterns []*regexp.Regexp
}
```

**关键决策**：
1. **三态明确**：Disabled 不是"忘了开"，是**显式产品形态**——让管理员知道"我关掉了"
2. **降级链**：Docker → Local → Error，启动时探测，不在执行时晚发现
3. **异步预拉镜像**：避免首次调用阻塞
4. **静态校验先于执行**：dangerous commands + regex patterns + arg injection 三道关

**对 OxyGenie 的可取之处**：
- OxyGenie 的 sandbox 目前是 per-session 子进程沙箱——可以抽出**统一 Sandbox 接口** + 多 backend（Docker / Local / Firecracker / 未来 gVisor）
- **ScriptValidator 直接抄过来**：这是 P0 安全资产，OxyGenie 跑 Python sandbox 没有这层就是裸奔
- 异步预拉镜像模式：OxyGenie 的 Docker artifacts sandbox 可以套用

---

### 🟢 P0-3：MCP 安全决策 —— 显式禁用 stdio + OAuth 多用户隔离

**WeKnora 做法**（`internal/mcp/manager.go`、`client.go`）：

```go
func (m *MCPManager) GetOrCreateClient(ctx, service) (MCPClient, error) {
    // ❗ Stdio 显式禁用
    if service.TransportType == MCPTransportStdio {
        return nil, fmt.Errorf("stdio transport is disabled for security reasons; please use SSE or HTTP Streamable transport instead")
    }
    // OAuth 服务：按 user 缓存（每个用户独立 token store）
    // 非 OAuth：按 service ID 共享单连接
    if service.AuthConfig.IsOAuth() {
        userID, _ = UserIDFromContext(ctx)
        ...
    }
    key := cacheKey(service, userID)
    ...
}

// cache key 设计
func cacheKey(service *types.MCPService, userID string) string {
    if service.AuthConfig.IsOAuth() {
        return service.ID + "\x00" + userID  // OAuth 按用户隔离
    }
    return service.ID                          // 非 OAuth 共享
}
```

**关键决策**：
1. **Stdio 在企业版完全禁用**——理由：stdio 本质是"在服务器上跑任意命令"，对 SaaS / 自托管的多租户都是炸弹
2. **OAuth Token 按 (tenant, user, service) 三元组隔离**——每个用户用自己的 GitHub/Notion/Slack 凭据
3. **连接复用按 cache key 区分** —— 非 OAuth 服务全 tenant 共享一个连接，省资源
4. 用 `mark3labs/mcp-go` 客户端（社区库），不重复造轮子

**与 OxyGenie AGENTS.md 的张力**：

> AGENTS.md §1：**触达服务器的强力功能（stdio MCP、连内网/本地工具、代码执行）是合法核心用途**——用沙盒 + 警示护栏，而非禁止。

OxyGenie 的定位是"半可信同事"——stdio MCP 是合法用法。**这是和 WeKnora 的关键产品决策分歧**。但仍可借鉴：
- ✅ OAuth Token 按 user 隔离 → 必须做
- ✅ 连接复用 cache key 模式 → 直接抄
- ⚠️ stdio 禁用 → **不抄**，但要给管理员**清晰的 stdio 启停开关 + 审计**
- ✅ HITL（Human-in-the-Loop）审批 → v0.5.2 新增，OxyGenie 没有但应该有

---

### 🟡 P1-1：Wiki Mode 的提示词工程 —— 唯一原创性突破

WeKnora v0.5.0 GA 的 Wiki Mode：**Agent 把上传的原始文档蒸馏成结构化、相互链接的 Markdown wiki + 知识图谱**。

**核心管线**（`internal/agent/prompts_wiki.go`）：

1. **WikiKnowledgeExtractPrompt** — 抽取 entities + concepts，强制 slug 连续性（"如果上次提取过这个实体，必须复用旧 slug"）
2. **WikiTaxonomyPlanPrompt** — 一次性给整批新页面分配目录路径，避免每页独立分类导致目录树发散
3. **WikiSummaryPrompt** — 故意**不传文件名**（很多 PDF 文件名就是扫描仪型号），逼模型只看内容
4. **空内容防御**：所有 prompt 都要求"如果 content 为空，输出固定的占位语，不要编造"

**值得偷的工程经验**：
- **Slug 稳定性** —— 文档更新时复用历史 slug，避免链接断裂
- **批量分类一次过** —— LLM 看到全集才能做一致的分类决定（单条决定 → 目录树发散是 hard problem）
- **反幻觉护栏** —— 显式列出"何时输出空"，比"不要幻觉"管用 10 倍

**对 OxyGenie 的判断**：
- Wiki Mode 是一个**完整的新产品线**，不是"加个 feature"
- 跟 OxyGenie "Agent 工作台 + 真做活" 的定位**不直接冲突**——可以作为 v2+ 的"知识沉淀"卖点
- **不抄管线，偷提示词工程方法**：slug 稳定性 + 批量决定 + 空内容显式护栏

---

### 🟡 P1-2：DataSource Connector 抽象（飞书/Notion/语雀 同步）

**WeKnora 做法**（`internal/datasource/connector.go`）：

```go
type Connector interface {
    Type() string
    Validate(ctx, config) error

    // 懒加载树形资源
    ListResources(ctx, config, parentID string) ([]Resource, error)

    // 反向解析祖先路径（支持深度选择回显）
    ResolveResourceAncestors(ctx, config, resourceIDs []string) ([]string, error)

    FetchAll(ctx, config, resourceIDs) ([]FetchedItem, error)
    FetchIncremental(ctx, config, cursor) ([]FetchedItem, *SyncCursor, error)
}
```

**5 个方法**就把"飞书 wiki（懒加载树）/ Notion（一次性全树）/ 语雀（扁平列表）" 三种完全不同形态的数据源**统一**了。

**关键设计**：
- `parentID` 懒加载 vs 扁平返回——同一接口能容纳两种 backend 形态
- `ResolveResourceAncestors` —— 用户上次选了深层资源，重新打开 picker 时只查 O(depth) 而不是重遍历全树
- Cursor-based 增量同步 —— 不存"上次同步时间"，存连接器自己定义的不透明 cursor

**对 OxyGenie 的可取之处**：
- 你在飞书生态深耕（lark-* skills 全套）—— **飞书自动同步**是 OxyGenie 天然抓手
- **直接抄这个 Connector 接口** —— 5 个方法定义清楚，是教科书级别的好抽象
- 第一版只做 Lark Drive + Lark Wiki，后续按需扩 Notion、Confluence

---

### 🟡 P1-3：Langfuse 追踪集成（v0.6.2 已成唯一 tracing 后端）

**WeKnora 做法**（`internal/tracing/langfuse/`）：

模块完整度极高：
```
asynq.go          # 把 trace 注入 Asynq 任务 payload（跨进程/异步任务传播）
client.go         # HTTP 客户端，带 flush 队列
config.go         # SDK key、host、sample rate、flush 间隔
context.go        # context-based trace 传播
events.go         # 事件序列化
manager.go        # 全局 Manager 单例 + 优雅 shutdown
middleware.go     # Gin middleware 自动开 trace
retrieval_obs.go  # 检索可观测性（专门的 helper）
tracer.go         # StartTrace / StartSpan API
```

**关键模式**（从 `asynq_test.go` 看到）：
```go
// 任务入队前注入 trace
InjectTracing(ctx, payload)  // payload 里有 LangfuseTraceID / LangfuseParentObservationID

// Worker 出队后 peek 出来，继续 span
ctx := peekTracingContext(ctx, payload)
```

**这是教科书级的跨进程 trace 传播实现**。

**对 OxyGenie 的可取之处**：
- ⭐ **P0 级建议加入 Roadmap** —— 一周可上，对开源用户感知极强
- OxyGenie 是"子进程 per message"架构，跨进程 trace 传播尤其需要这套
- 直接参考 WeKnora 的 trace context 序列化协议（注入到子进程 stdin / env / payload）

---

### 🟢 P0-4：Stream Manager 工厂（内存 / Redis 双模）

**WeKnora 做法**（`internal/stream/factory.go`）：

```go
func NewStreamManager() (StreamManager, error) {
    switch os.Getenv("STREAM_MANAGER_TYPE") {
    case "redis":
        return NewRedisStreamManager(addr, user, pwd, db, prefix, ttl)
    default:
        return NewMemoryStreamManager(), nil
    }
}
```

**关键**：开发/单机 → memory，生产/多副本 → Redis Stream。30 行代码搞定"水平扩展能力"。

**对 OxyGenie 的可取之处**：OxyGenie 当前 WebSocket session 状态在 ws-server.mjs 主进程内存里——**单实例瓶颈**。要做多副本部署，必须按这个模式抽出 StreamManager 接口。这是为"团队 5-30 人 + 双副本高可用"做的准备。

---

### 🔴 不抄：完整 4 层 RBAC + 多 tenant + IM 多渠道

WeKnora 的这三块都很完整，但**会摧毁 OxyGenie 的"小团队、Mac mini 起跑"定位**：

- **4 层 RBAC**（Owner/Admin/Contributor/Viewer + per-KB ownership + audit log）→ OxyGenie 应该是**简化版**："Org admin + member" 两档 + per-resource ownership + audit log。律所/基金需要的不是矩阵复杂度，是**清楚谁动了什么**。
- **多 tenant**（cross-tenant superuser + 邀请制工作区）→ OxyGenie **明确不做**，AGENTS.md §1 已写"不是面向公网匿名大众的多租户 SaaS"
- **IM 多渠道**（WeCom / 飞书 / Slack / Telegram / DingTalk / Mattermost / 微信小程序）→ 先做飞书一个就行。WeKnora 全要是因为它服务腾讯生态，OxyGenie 没那个分发渠道。

---

## 4. WeKnora 没做、OxyGenie 已做的事（你的真正护城河）

为了避免"被对标焦虑"，明确列出你已经赢的地方：

| 能力 | WeKnora | OxyGenie | 战术意义 |
|---|---|---|---|
| 每消息独立子进程 | ❌ 应用内 loop | ✅ child_process | **崩溃隔离 + 干净取消** —— 写在 README 第一段 |
| 会话原生 resume（SDK 级） | ❌ 应用层重建上下文 | ✅ `resumeSessionId` | 长会话稳定性吊打 |
| 后台继续 + 并发会话 | ❌ | ✅ sidebar 标记 | ChatGPT/Claude 同款体验 |
| Artifacts + 子域名沙箱预览 | ❌ | ✅ 多文件 web app 跑得起来 | 杀手级产品力 |
| 一键在线升级 + 健康闸 + 回滚 | ❌ 手动 docker pull | ✅ UI 操作 | **自托管运维体验的天花板** |
| 现代 TS 全栈 | Go + Vue（迭代慢） | TanStack Start + React + Drizzle | 招人更容易、迭代更快 |
| 部署最小尺寸 | docker-compose 19K 行 + 多 profile | 一台 Mac mini 起跑 | 律所/基金的 buying signal |

**真正应该写进 README 第一段的事**：
> "**OxyGenie 是给团队的 Claude Cowork** —— 不是单机桌面，不是企业级 SaaS。
> 一台 Mac mini 就能让 5-30 人共用一个 Agent，每条消息独立沙箱、崩了不影响别人、UI 里一键升级。"

---

## 5. 给 Roadmap 的具体输入（按优先级）

| 优先级 | 项目 | WeKnora 参考 | OxyGenie 工作量 | 战略价值 |
|---|---|---|---|---|
| **P0** | Langfuse 追踪 + 跨进程 trace context 传播 | `internal/tracing/langfuse/` 整套 | 1 周 | ⭐⭐⭐ 开源用户感知极强 |
| **P0** | ScriptValidator（执行前静态扫危险命令/注入） | `internal/sandbox/validator.go` | 3 天 | ⭐⭐⭐ 安全资产，sandbox 必备 |
| **P0** | Sandbox 三态降级（Docker / Local / Disabled） | `internal/sandbox/manager.go` | 已部分有，1 周补全 | ⭐⭐ 部署灵活性 |
| **P0** | MCP OAuth token 按 user 隔离 + 连接 cache key | `internal/mcp/manager.go` | 1 周 | ⭐⭐⭐ 多用户必备 |
| **P0** | StreamManager 抽象（memory / Redis 双模） | `internal/stream/factory.go` | 3 天 | ⭐⭐ 多副本部署铺路 |
| **P1** | 飞书 Connector（DataSource 接口抽象） | `internal/datasource/connector.go` | 2 周 | ⭐⭐⭐ 你的天然抓手 |
| **P1** | MCP HITL 审批 | v0.5.2 新增的能力 | 1 周 | ⭐⭐ 律所/基金强需求 |
| **P1** | AuditSink 适配器模式（驱动层 → 服务层） | `internal/container/audit_sink.go` | 3 天 | ⭐⭐ 审计架构卫生 |
| **P1** | Provider Factory（让 BYOK 多网关一等公民） | `internal/models/provider/*.go` × 28 | 2 周 | ⭐⭐ 摆脱 ARK 钉死焦虑 |
| **P2** | 多语言 README（日韩） | WeKnora 4 语言 | 1 周 | ⭐ 海外触达 |
| **P2** | Wiki Mode 精简版（按 slug 稳定性 + 批量分类的提示词工程） | `internal/agent/prompts_wiki.go` | 3 周 | ⭐ v2 的"知识沉淀"卖点 |
| **P2 推迟** | 桌面端（Tauri 客户端） | `cmd/desktop/` (Wails) | 后置（见下方说明） | ⭐⭐ 未来正确的客户端形态 |
| **不做** | 4 层 RBAC 矩阵 | 已发布 | — | 摧毁定位 |
| **不做** | 9 种向量库 backend | engine_factory.go | — | 过度工程，pgvector + Meilisearch 够了 |
| **不做** | IM 多渠道全要（仅做飞书） | `internal/im/*` | — | 渠道分散 |

### 关于桌面端的修正判断（2026-06-22 update）

第一版判断"桌面端摧毁小团队定位"是错的。重新分析后**桌面端实际上加强**小团队定位：

- **"Mac mini 服务器 + 同事桌面客户端"才是律所/基金最舒服的部署形态**——同事电脑上一个 OxyGenie.app 图标，比"打开浏览器输 `https://kin.lawfirm.com`"体验好
- **文件拖入即上传到知识库**——Web 端做拖拽要权限弹窗，桌面端原生支持，律所天天处理 PDF 是刚需
- **系统级通知**——Agent 长任务跑完桌面通知，比浏览器标签页红点强得多
- **本地文件直读**——桌面端可以直接读 `~/Documents`，对"数据不出本地"敏感的律所是巨大卖点
- WeKnora 的 Wails 桌面端实际上是**对接同一个后端的另一个客户端**，不是独立单机产品。OxyGenie 可以用 Tauri 走同样路径

**为什么仍然 P2 推迟**（不是 P0/P1）：
- 多平台打包成本（macOS notarization、Windows 代码签名、Linux 三种格式）
- 桌面端自动更新要单做一套（Tauri updater / Sparkle / Squirrel）
- 版本兼容矩阵（旧客户端 ↔ 新服务器）
- 当下 Web 端已经能用，**收益 < 成本**

**触发条件**：Web 端稳定 + 有 3-5 个付费客户 + API 版本已锁定后再启动。提前做技术债大。

---

## 6. 风险与提醒

1. **WeKnora 是腾讯出品 + 微信对话开放平台底座** —— 海外认知有限但中国市场会被它先吃。OxyGenie 在中国应**避开 RAG 正面对标**，主打 Agent 工作流 / 团队协作 / 海外团队私有化。
2. **MIT License 让 WeKnora 可被任意商业化封装** —— 它的扩散速度可能比预期快。OxyGenie 用 AGPLv3 + 商业双轨是对的，但要警惕"被 fork 后剥离品牌"。
3. **它迭代极快**（9 小时前还在 commit、CHANGELOG 105K）—— 这份分析有半衰期，**建议每季度 review 一次**。
4. **OxyGenie AGENTS.md 与 README.md 的命名分歧**（OxyGenie vs Kin）需尽快收口——对外宣传一个名字。这是看完 WeKnora 4 语言一致品牌后产生的紧迫感。

---

## 7. 镜像与版本

- 仓库镜像本地路径：`/Users/peng/Dev/Projects/active/ClaudeAgentChat/references/useful_frameworks/WeKnora/`
- 分析时版本：v0.6.2
- 最近 commit（分析时）：`feat(mcp): add custom headers functionality to MCP service dialog`（9 小时前）
- 上游：`https://github.com/Tencent/WeKnora`
- 关联文档：[`COMPETITIVE-LANDSCAPE.md`](./COMPETITIVE-LANDSCAPE.md)（早先的开源 Cowork 替代品全景）

---

> **下一步建议**：从这份文档的 §5 表里挑 2-3 个 P0 项进入 `docs/5. 研发实施` 的实施计划，不要全要。优先做 **Langfuse + ScriptValidator** 这两个——它们对开源用户的感知最强、工作量最小、与现有架构冲突最少。
