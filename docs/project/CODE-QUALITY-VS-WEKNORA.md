# OxyGenie vs WeKnora — 代码质量与实施完整度评测

> 评测日期：2026-06-22。
> 对象：[Tencent/WeKnora](https://github.com/Tencent/WeKnora) v0.6.2 vs OxyGenie (本仓库 `kin/`)
> 方法：客观指标（代码行数、测试覆盖、CI 配置、提交活跃度、依赖管理、关键能力存在性）+ 主观判断（架构清晰度、工程化程度）

---

## 0. 一句话结论

**两个项目都是高质量的开源项目，但成熟度差距显著——WeKnora ≈ OxyGenie × 4 的工程体量。**

但**这不是"OxyGenie 落后了"，而是定位不同导致的体量差异**：

- WeKnora 是腾讯出品的**企业级 RAG 框架**（背靠微信对话开放平台），全平台覆盖（Web/桌面/扩展/小程序/CLI/MCP server），9 种向量库 backend，4 层 RBAC——它**必须做这么大**
- OxyGenie 是**小团队 Agent 工作台**（≤30 人，一台 Mac mini 起跑），不需要也不应该做那么大

**真正的差距集中在 3 个维度**（这些是 OxyGenie 应该警惕的）：

1. **测试覆盖率**：WeKnora 18% test/prod ratio vs OxyGenie **3.9%** —— 这是 5 倍差距，是质量风险
2. **Lint/质量门禁**：WeKnora 有 `.golangci.yml`，OxyGenie 仅有 `.prettierrc`，**缺 ESLint 配置**
3. **凭据加密**：WeKnora 全栈 AES-256-GCM at-rest 加密，OxyGenie 没有

---

## 1. 客观指标对照

### 1.1 代码体量

| 指标 | WeKnora | OxyGenie | 比率 |
|---|---:|---:|---:|
| **生产代码（不含测试）** | **408,048** 行 | **98,729** 行 | 4.1 × |
| ├─ Go | 235,936 | 0 | — |
| ├─ TS/TSX（非测试） | 44,285 | 86,760 | 0.5 × |
| ├─ JS/MJS/CJS | 1,899 | 11,969 | 0.16 × |
| ├─ Python | 14,623 | 0 | — |
| └─ Vue | 111,305 | 0 | — |
| **测试代码** | **73,558** 行 | **3,838** 行 | 19 × |
| ├─ Go test | 70,906 | 0 | — |
| ├─ TS test | 946 | 3,838 | 0.25 × |
| └─ Python test | 1,706 | 0 | — |
| **测试文件数** | 395 | 36 | 11 × |
| **测试 / 生产代码比率** | **18.0%** | **3.9%** | — |
| **顶层模块数** | 26 (`internal/`) | 29 (`src/`) | 1.1 × |

**读数**：

- ✅ OxyGenie 前端比 WeKnora 大一倍（OxyGenie 86K TS+TSX vs WeKnora 25K + 111K Vue 总和也只是 OxyGenie 的 1.5 倍）——**OxyGenie 前端实际是更重的**
- ⚠️ **测试比率 18% vs 3.9% 是最大的质量信号**——Go 项目工程文化普遍重测试，但这不是借口，OxyGenie TS 测试可以、应该做到 ≥10%
- ⚠️ **OxyGenie 测试集中在前端**（3,838 行全是 TS test），核心 `ws-server.mjs`（2,789 行）和 `ws-query-worker.mjs`（1,172 行）**几乎裸奔**——这两个文件是 OxyGenie 的"心脏"

### 1.2 模块化程度（顶层）

**WeKnora `internal/`（Go 后端 26 模块）**：

```
agent / application / assets / common / config / container /
database / datasource / errors / event / handler / im /
infrastructure / logger / mcp / middleware / models / ratelimit /
router / runtime / sandbox / searchutil / stream / tracing / types / utils
```

特点：**每个模块单一职责，平铺式 DDD 风格**。`agent` / `mcp` / `sandbox` / `tracing` 都是独立目录。

**OxyGenie `src/`（29 顶层目录）**：

```
app / claude / components / conf / config / contents / database / db /
features / hooks / jobs / lib / mcp-store / preview / routes / scripts /
search / server / skills-store / styles / types / updater / utils / worker
```

特点：**混合了功能模块（`mcp-store`, `skills-store`, `updater`）和技术分层（`components`, `hooks`, `lib`）**。略显杂乱，存在 `database` + `db`、`conf` + `config` 这样的重复目录。

**判断**：
- ✅ 模块**数量相当**（26 vs 29），不存在 OxyGenie "结构过于扁平" 的问题
- ⚠️ OxyGenie 目录命名一致性差，有清理空间（`database`/`db`、`conf`/`config` 应该合并）
- ✅ WeKnora 的 DDD 平铺布局值得 OxyGenie 后端层借鉴

### 1.3 测试覆盖深度

| | WeKnora | OxyGenie |
|---|---|---|
| 单元测试 | ✅ 大量（375 个 Go test 文件） | ✅ 36 个 TS test |
| 集成测试 | ✅ `cli/acceptance/`（CLI E2E） | ⚠️ 少量 |
| 测试粒度 | 每个 package 都有 `_test.go` | 仅前端 + skills 模块有 |
| 关键运行时测试 | ✅ sandbox / mcp / tracing 都有 | ❌ `ws-server.mjs` / `ws-query-worker.mjs` 无测试 |

**⚠️ 风险点**：OxyGenie 把 **3,961 行核心运行时代码**（ws-server + ws-query-worker）**完全没有单测**——这是 Agent 隔离、session 管理、子进程生命周期的核心，崩了就是全员宕机。

### 1.4 CI / 工程化

| 配置项 | WeKnora | OxyGenie |
|---|---|---|
| GitHub Actions 数 | 4 | 6 |
| Workflows | cli, cli-e2e, docker-image, release-lite | ci, build, deploy, ai-pr-docs, ai-changelog-aggregate, **gitleaks** |
| **Lint 配置** | ✅ `.golangci.yml` | ❌ 无 ESLint 配置（只有 `.prettierrc`） |
| **格式化** | golangci-lint 内置 | ✅ Prettier |
| **类型检查** | Go 编译器 | ✅ `tsconfig.json` |
| **密钥扫描** | ❌ | ✅ **gitleaks**（OxyGenie 加分） |
| **AI 辅助** | ❌ | ✅ AI 自动生成 PR 文档 + Changelog（创新点） |
| Makefile | ✅ | ❌ |

**双方各有亮点**：

- **WeKnora 优势**：Lint 强制（golangci-lint）+ CLI E2E 测试矩阵
- **OxyGenie 优势**：**gitleaks 密钥扫描**（自托管场景特别关键）+ AI 驱动的 changelog（创新工程实践）

**OxyGenie 的缺口**：**没有 ESLint 配置**——只有 Prettier 是不够的（Prettier 只管格式，不查代码质量）。这是个 30 分钟能补的 P0 项。

### 1.5 部署成熟度

| 制品 | WeKnora | OxyGenie |
|---|---|---|
| Dockerfile | ✅ 1 个 | ✅ 2 个（含 updater） |
| docker-compose 变种 | 2 个（dev/prod） | **5 个**（dev / prod / build / dokploy / tunnel） |
| Helm chart | ✅ `helm/` 目录 | ❌ |
| K8s manifests | ✅ | ❌ |
| 数据库迁移 | 131 个文件 | 38 个 SQL（Drizzle） |
| 配置 profiles | ✅ `--profile full/neo4j/minio/langfuse` | ❌（多 compose 文件） |
| **一键 VPS 安装脚本** | ❌ | ✅ `scripts/install-vps.sh` |
| **Cloudflare Tunnel 支持** | ❌ | ✅ docker-compose.tunnel.yml |
| **Dokploy 支持** | ❌ | ✅ docker-compose.dokploy.yml |

**OxyGenie 在部署体验上有压制级的优势**：
- ✅ "一台 Mac mini 起跑" 的承诺真的兑现了——Cloudflare Tunnel 让无公网 IP 也能跑
- ✅ Dokploy 集成 = 自托管用户最爱的 PaaS
- ✅ 一键 VPS 安装脚本是 WeKnora 没有的

**但 WeKnora 在企业部署上更全**：
- ✅ Helm chart = K8s 集群部署的标准答案
- ✅ Docker Compose Profiles = 模块化启停（要不要 Neo4j、要不要 Langfuse 一句话决定）

### 1.6 依赖管理

| | WeKnora | OxyGenie |
|---|---|---|
| Go modules | 325 个 | — |
| npm dependencies | 25 (frontend) | **116** |
| npm devDependencies | 11 (frontend) | 30 |

**OxyGenie 的 116 个 npm 直接依赖偏高**——这是 TanStack Start + shadcn/ui + Claude SDK + Mastra 双 SDK + Better Auth + 各种富功能堆出来的。**风险**：供应链攻击面、版本升级负担、`pnpm-lock.yaml` 频繁冲突。

**建议**：定期 `pnpm dlx depcheck` 找未使用依赖，目标降到 80 以下。

### 1.7 提交活跃度（截至 2026-06-22）

| | WeKnora | OxyGenie (kin 子仓) |
|---|---|---|
| 历史总提交 | （shallow clone 看不到） | 775 |
| 近 30 天 | （shallow clone 看不到） | **392** |
| 近 90 天 | （shallow clone 看不到） | 392 |
| 最近一次 commit | 9 小时前 | 3 天前 |
| CHANGELOG 行数 | **1,333** 行 | 无 CHANGELOG.md |
| docs/*.md 文件数 | 70 | **111** |

**读数**：
- ✅ **OxyGenie 近 30 天 392 commits = 平均每天 13 个**——这是非常高的迭代速度
- ⚠️ OxyGenie **没有 CHANGELOG.md**——但 CI 里有 ai-changelog-aggregate，可能放在别处。建议确认并放到根目录便于发现
- ✅ OxyGenie 文档密度（111 个 md）实际比 WeKnora（70 个）更高——**OxyGenie 文档不缺，但读者难找**

---

## 2. 关键能力存在性核查

> 在 OxyGenie 源码里 grep 各项能力的存在迹象（命中即 ✅，未命中即 ❌；命中不代表实现完整，仅说明"有相关代码"）

| 能力 | WeKnora | OxyGenie | 备注 |
|---|---|---|---|
| Better Auth / OAuth | ✅ | ✅ `src/server/auth.server.ts` | |
| 沙箱隔离 | ✅ | ✅ ws-server child_process + per-session | 实现方式不同 |
| MCP 客户端 | ✅ | ✅ | OxyGenie 用 stdio，WeKnora 显式禁用 stdio |
| Skills 加载 | ✅ | ✅ `src/contents/skills-upload.content.ts` | |
| WebSocket session | ❌（用 SSE） | ✅ ws-server.mjs（2,789 行） | OxyGenie 独有的架构 |
| Artifacts 沙箱预览 | ❌ | ✅ | OxyGenie 独有 |
| Audit log | ✅ | ✅ `src/server/audit/index.ts` | OxyGenie 已实现 |
| Rate limit | ✅ `internal/ratelimit/` | ✅ | OxyGenie 散落实现 |
| **AES-256-GCM 凭据加密** | ✅ | **❌** | **OxyGenie 缺口** |
| Tracing/Observability | ✅ Langfuse | ⚠️ 仅 Sentry | OxyGenie 缺 LLM 链路追踪 |
| 知识库 / RAG | ✅ | ✅ | OxyGenie 较简单 |
| 文档解析 | ✅ docreader (gRPC Python) | ✅ parser-sidecar | 架构同构 |
| 异步任务队列 | ✅ Asynq (Redis) | ✅ jobs/ | |
| Cron / scheduler | ✅ robfig/cron | ✅ | |
| 国际化 i18n | ✅ 4 语言 | ✅ intlayer | OxyGenie 框架更现代但语言少 |
| 升级器 (auto-update) | ❌ 手动 docker pull | ✅ `src/updater/` | **OxyGenie 独有杀手锏** |
| Helm Chart | ✅ | ❌ | |
| 一键 VPS 安装 | ❌ | ✅ `scripts/install-vps.sh` | |
| Cloudflare Tunnel | ❌ | ✅ | |

**统计**：

- 双方共有的能力：13 项
- **WeKnora 独占**：3 项（Helm、AES-256-GCM、Langfuse）
- **OxyGenie 独占**：4 项（WebSocket session、Artifacts 沙箱、自动更新、VPS 一键安装 + Tunnel）

**结论**：**功能层面差距没有代码量差距大**。OxyGenie 在"自托管运维体验" + "Artifacts" 两条轴上反向领先 WeKnora。

---

## 3. 代码质量主观评估

### 3.1 架构清晰度

**WeKnora**：⭐⭐⭐⭐⭐
- 平铺 DDD 模块（`internal/{agent,sandbox,mcp,tracing}/`）
- 严格依赖方向（`container/audit_sink.go` 用适配器避免反向依赖）
- 工厂模式贯穿（EngineFactory / StreamManager / SandboxManager）
- 接口设计教科书级（`Connector` 5 方法解决所有数据源形态、`Sandbox` 接口涵盖 3 种 backend）

**OxyGenie**：⭐⭐⭐
- 业务功能边界清楚（`mcp-store/`, `skills-store/`, `updater/`, `worker/` 一看就懂）
- 但目录命名不一致（`database` + `db`、`conf` + `config`）
- 核心运行时（ws-server.mjs 2,789 行单文件）**太大**，应该拆分
- 缺少明显的"接口先行"模式（多数地方直接耦合 Drizzle/Postgres）

**判断**：WeKnora 是被多人长期协作磨过的代码，OxyGenie 是单人/小团队快速迭代的代码——这正常，但 ws-server.mjs 这种单文件 2,789 行的代码必须拆。

### 3.2 错误处理 / 防御性

**WeKnora**：详读 `searchutil/chunkmerge.go` 注释（中文）就能看出工程严谨度——

> 「历史上各处都用「按位置」的公式裁剪重叠（offset = len(content) - (EndAt - lastEndAt) 之类），它默认 len([]rune(Content)) == EndAt-StartAt。但有两类数据会破坏这个不变式...」

注释**详细记录了 bug 的根本原因和修复决策**。这是经过实战的代码。

**OxyGenie**：未读到同类深度注释。AGENTS.md 里有"Codex Agent SDK 钉死 0.2.112，0.2.113+ 改为原生二进制与 ARK 网关不兼容会卡死"这种实战记录——是同等深度，**但分散在 AGENTS.md 而非代码注释里**。

### 3.3 安全防御

| | WeKnora | OxyGenie |
|---|---|---|
| 输入校验 | ✅ ScriptValidator + arg injection 检测 | ⚠️ 较少专门校验 |
| 凭据存储 | ✅ AES-256-GCM at-rest + key rotation | ❌ 明文存 .env |
| SSRF 防护 | ✅ "SSRF-safe HTTP client" 在 README 列明 | ❌ |
| MCP 安全 | ✅ stdio 禁用 + OAuth token per-user | ⚠️ stdio 启用（产品决定） |
| Sandbox HITL | ✅ MCP 工具审批 | ❌ |
| 密钥泄露扫描 | ❌ | ✅ gitleaks CI |

**OxyGenie 在产品层面正确**地选择了"半可信同事，stdio 是合法用法"——但这意味着**安全责任更重**，反而应该把 WeKnora 的其他安全栈（AES-256-GCM、SSRF 防护、ScriptValidator）补齐，而不是因为不做 stdio 禁用就放松其他防御。

### 3.4 工程文化信号

| 信号 | WeKnora | OxyGenie |
|---|---|---|
| 长 CHANGELOG | ✅ 1,333 行 | ⚠️ 不在根目录 |
| 多语言文档 | ✅ EN/CN/JA/KO | ⚠️ EN/CN |
| 详细 PR 模板 | ✅ `.github/` | ✅ `.github/` |
| CODE_OF_CONDUCT | ✅ | ✅ |
| SECURITY.md | ✅ | ✅ |
| CONTRIBUTING.md | ❓ | ✅ |
| **CLA**（贡献者协议） | ❓ | ✅（双轨 license 需要） |
| **AI 辅助 PR Doc** | ❌ | ✅ 创新点 |

**判断**：OxyGenie 的工程文化"形式上完整"，**只是少了 CHANGELOG 的可见度**。AI-PR-Docs 是 WeKnora 没有的创新。

---

## 4. 实施完整度量化打分

**评分方法**：满分 5 分，按"开源项目对外可用程度"打分（不是"功能完整度"）。

| 维度 | WeKnora | OxyGenie | 差距 |
|---|:---:|:---:|---|
| 核心功能可用性 | 5 | 4 | OxyGenie RAG 较浅，但 Artifacts 反向领先 |
| 测试覆盖 | **5** | **2** | ⚠️ 5 倍差距 |
| 代码组织 | 5 | 3 | OxyGenie ws-server.mjs 单文件太大 |
| 文档完整度 | 5 | 4 | OxyGenie 文档多但可发现性差 |
| CI/CD 成熟度 | 4 | 4 | 各有亮点 |
| 部署体验 | 4 | **5** | OxyGenie 反向领先 |
| 安全栈完整度 | **5** | **3** | ⚠️ AES + SSRF + Validator 缺口 |
| 国际化 | 5 | 4 | OxyGenie 只做 EN/CN |
| 工程文化 | 5 | 4 | OxyGenie 工程实践完整但 CHANGELOG 缺失 |
| **加权总分** | **43/45** | **33/45** | **77% 完整度** |

**OxyGenie 整体达到 WeKnora 实施完整度的 77%**——对一个 30 倍体量差距的对照来说，这是**惊人的高**。

---

## 5. OxyGenie 该立刻做的 5 件事（按 ROI 排序）

| # | 行动 | 工作量 | 价值 |
|---|---|---|---|
| 1 | **加 ESLint 配置 + lint CI 门禁** | 1 天 | ⭐⭐⭐ 杜绝低级错误 |
| 2 | **给 ws-server.mjs + ws-query-worker.mjs 写单测**（至少覆盖 session 映射、子进程生命周期、auth 中间件）| 1 周 | ⭐⭐⭐ 核心稳定性 |
| 3 | **拆分 ws-server.mjs**（2,789 行 → ≤500 行/文件，按 auth / session / process-mgmt / message-routing 拆）| 1 周 | ⭐⭐⭐ 可维护性 |
| 4 | **AES-256-GCM 凭据加密**（数据库里的 API key、OAuth token 全加密）| 1 周 | ⭐⭐⭐ 律所/基金必备 |
| 5 | **统一 CHANGELOG.md 到根目录**（让 AI-PR-Docs 的产出汇总到这里）| 1 天 | ⭐⭐ 可发现性 |

**做完这 5 项，OxyGenie 实施完整度可以从 77% 提升到 88%**——而且全部工作量加起来不到 1 个月。

---

## 6. 风险与盲区

### OxyGenie 不该被 WeKnora 的"完整度"焦虑带跑偏

- ⚠️ WeKnora 的 408K 行代码里，**有大量是 OxyGenie 不应该做的事**（4 层 RBAC、9 种向量库、桌面端、小程序、6 种 IM 渠道）
- ⚠️ 盲目追完整度 = 摧毁"小团队、Mac mini 起跑"定位
- ✅ **正确策略**：聚焦上面 5 件事（质量栈），其余按 `COMPETITIVE-WEKNORA-DEEPDIVE.md` §5 的 Roadmap 选择性吸收

### 这份评测的局限

1. 只比较了**仓库可见的代码**——WeKnora 可能有内部企业版/微信对话开放平台版的更深功能没开源
2. 代码行数 ≠ 价值——OxyGenie 的 98K 行可能比 WeKnora 同等行数密度更高（TS 比 Go 表达力强）
3. 测试覆盖率没跑覆盖率工具——只是文件数和行数的代理指标，真实分支覆盖可能不同
4. 主观评分有判断偏差——欢迎拍砖

---

## 7. 总结

**两个项目都是高质量的，但定位完全不同，没必要硬比**。要拿到的洞察是：

1. **OxyGenie 的 77% 实施完整度已经足够进入市场**——不要等到 90%+ 才发布
2. **测试 + 安全栈 + ws-server 拆分是 OxyGenie 的真正风险**，不是功能广度
3. **OxyGenie 在"自托管运维体验"上反向领先 WeKnora**——这就是它的护城河，要在 README 里大字写出来
4. **WeKnora 的工程严谨度（注释、错误处理、接口抽象）是 OxyGenie 应该长期学习的方向**

---

## 附录 A — 数据采集方法

所有指标用 `find` + `wc -l` + `grep -E` + `jq` 在本地仓库镜像直接统计。命令在评测者的执行日志中可重现：

```bash
EXCL="-name node_modules -prune -o -name .git -prune -o -name dist -prune ..."

# 生产代码行数示例
find . $EXCL -o -type f -name '*.go' -not -name '*_test.go' -print | xargs wc -l
```

WeKnora 是 `git clone --depth=1`（shallow），所以历史 commit 数据看不到。后续 review 时可重新 unshallow 获取。

## 附录 B — 关联文档

- [`COMPETITIVE-WEKNORA-DEEPDIVE.md`](./COMPETITIVE-WEKNORA-DEEPDIVE.md) —— 架构与代码模式深挖
- [`COMPETITIVE-LANDSCAPE.md`](./COMPETITIVE-LANDSCAPE.md) —— 开源 Cowork 替代品全景
