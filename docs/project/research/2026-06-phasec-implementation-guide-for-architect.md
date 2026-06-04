# Phase C（成果物「真预览」）实施指南 — 致架构师

> 日期：2026-06-04 ｜ 作者：评审/协调（非实现者） ｜ 收件：架构师 B（Phase C owner）
> 性质：**给你的单一入口文档**。你之前拍板的 `2026-06-real-preview-v1-implementation-plan.md` 是技术蓝图，本文不重复它，只把你接手要的四件事讲清：**① 如何实施 ② 预期是什么 ③ 如何被验证 ④ 如何寻求帮助**，并补上唯一会和前端撞车处的 **UI 接缝契约**（我刚把成果物/Workbench 那一侧摸透了，这是我能给你的最大增量）。

**先读（10 分钟，按序）**：
1. 本文。
2. `2026-06-real-preview-v1-implementation-plan.md`（你的蓝图：组件、§5 任务拆分、§7 六个坑）。
3. `2026-06-real-preview-architect-brief.md`（你的决策 + §9 结构化输出「杀/修」检查点——挂在你这条线下游）。
4. `2026-06-phasec-handoff-to-architect.md`（现状/归属/就绪自查）、`2026-06-cowork-s1-review-and-s2s3-handoff.md`（chat 线已发生的修复，避免你重复踩）。

---

## 1. 如何实施

### 1.1 蓝图（不重复，照做）
照 v1 计划 **§5 任务拆分**推进：`PreviewRuntime` 接口 + `DockerPreviewProvider`（ensureSandbox/install/start(static)/stop/reap/getUrl）+ active 上限 → `preview-controller` sidecar（唯一持 docker socket）→ Traefik labels + forward-auth + 一次性 token 换 cookie → `.oxygenie/app.json` schema + 启发式扫描 → UI 接缝（见 §1.3）→ 端到端验收。

### 1.2 复用地图（站在已合并的 `main` 上，别造轮子）
| 你要建的 | 复用/不碰 |
|---|---|
| `PreviewRuntime`/沙盒 | **新增**，独立于 `src/claude/execution/`（`docker-backend.js`/`local-process-backend.js`/`types.js`）。**不要**把现有 one-shot `DockerBackend` 改成常驻（计划坑⑤）。 |
| 会话级状态推送 | 走 **`ws-server.mjs` 的会话级 WS**，**不是**每消息的 `ws-query-worker.mjs`（worker 短命、随消息结束；预览是会话级、跨消息存活）。 |
| 前端消息/状态真相源 | 已是单源 `chat-session-store.ts`（S1 重做）。预览状态加一个新 slot 即可，沿用同套 selector 模式（`use-session-workbench.ts`）。 |
| 成果物预览 UI | `artifacts-panel.tsx`（type→组件路由）、`artifact-html.tsx`（单文件 blob iframe，**保留**给单文件）。多文件 App 走你的 live URL（见 §1.3）。 |

### 1.3 ⭐ UI 接缝契约（后端 ↔ 前端唯一撞车处，照此各写各的）

预览的 90% 是你的后端；前端只接「状态 + 露出」。两边对着下面这份契约写，互不碰对方文件。

**(A) 静态声明 `.oxygenie/app.json`（后端探测/未来 `declare_app` 写入；UI 消费这些字段）**
```jsonc
{
  "name": "我的待办",        // 卡片/标题展示
  "type": "spa",             // "spa" | "static" | "server"(best-effort) — UI 据此决定能否「运行预览」
  "framework": "vite",       // 仅展示
  "entry": "index.html",     // 关联到成果物/文件
  "buildCommand": "npm run build",  // 后端执行；UI 只读展示
  "outputDir": "dist"        // 后端用
}
```

**(B) 运行态 `PreviewState`（后端 PreviewRuntime/preview-controller 产生，UI 据此渲染）**
```ts
type PreviewState = {
  sessionId: string
  previewId: string
  mode: 'static' | 'live'
  status: 'detecting' | 'installing' | 'building' | 'ready' | 'error' | 'stopped'
  url?: string     // status==='ready' 的可访问子域名 URL（已走完一次性 token→cookie 鉴权）
  error?: string   // status==='error' 的简要原因
}
```

**(C) 传输 + 落点（这就是契约本体）**
- 后端经会话 WS 推一个**新增 OutboundMessage 变体**：`{ type: 'preview_state', state: PreviewState, seq }`（与现有 `session_metadata`/`message`/`done` 并列，定义在 `ws-adapter.ts` 的 `OutboundMessage` union；沿用 S1 的单调 `seq`）。
- 前端 `ws-adapter.ts` 收到后写进 `chat-session-store` 的**新 slot** `previewState`（按 session）。
- 前端新增 selector `useSessionPreview(): PreviewState | null`（与 `useSessionFiles`/`useSessionContext` 并列于 `use-session-workbench.ts`）。
- manifest 同理进 store（随 `preview_state` 带上，或单独 `sessionManifest`）。

**(D) UI 露出（前端 chat/artifact 线 owner 做）**
- 成果物卡：当存在 manifest 且 `type∈{spa,static}` → 卡片多一个「**运行预览**」动作；点了在 artifacts 面板用 **live `url` iframe** 渲染（取代当前单文件 blob）。`building` 显进度、`ready` 显预览、`error` 显错误+日志入口。
- 我刚加的「多文件 App 提示」横幅（`artifact-html.tsx`，见 §3 回归项）= 占位：live 预览可用后，把它替换成「运行预览」CTA。
- 现有单文件 blob 预览**保留**给纯单文件 HTML。

**(E) 归属切分（关键，避免双人编辑同文件）**
- **你（后端）**：`PreviewRuntime`/`preview-controller`/Traefik/鉴权/manifest 探测 + **推 `preview_state` 事件 + 提供 `url`**。`ws-server.mjs`、新增 `src/claude/preview/*`、Docker/Traefik 配置。
- **前端（chat/artifact 线 owner）**：`ws-adapter.ts` 接事件→store、`use-session-workbench.ts` selector、`artifacts-panel.tsx`/卡片的「运行预览」UI。
- **契约（本节 A–C）一旦定死，两边并行，不碰对方文件。** 若契约要改 → 走协调（§4），别单方面改了对方依赖的 shape。

### 1.4 开工前就绪门（全 yes 再写代码）
1. 目标/本地环境**有 Docker**；本地 hybrid（`start-production.mjs` 跑宿主）与「每会话 preview 容器」如何协调（计划 §7 已点名）。
2. **active 上限 + idle 回收第一天就在 scope**（坑⑥：缺上限会被瞬时击穿）。
3. v1 范围锁死 = **SPA static**；不动 `DockerBackend`；**子域名主线、绝不同源**（坑②③）。
4. 先和前端 owner 把 §1.3 契约 (A)(B)(C) 敲定，再各自动手。

### 1.5 红线（计划 §7 的六个坑，复述）
① 别默认常驻 dev server；② 别走子路径反代（Vite base/HMR ws/绝对路径/history fallback 全是坑）→ 子域名；③ 预览**绝不**与主站同源（最危险捷径）；④ npm install 生命周期要管好；⑤ 别把 `DockerBackend` 改成常驻；⑥ 没 active 上限会被击穿。

---

## 2. 预期是什么（验收口径，别扩张）

- **硬验收 = 纯前端 SPA 静态预览**：用户让 agent 生成一个 Vite/SPA 项目 → 一键「运行预览」→ 后端 `install → build → serve dist/`（用 preview 镜像内置静态服务器，不依赖用户项目装 `serve`）→ 前端 iframe 通过**子域名 + 鉴权 cookie** 看到**可交互**的成品（比如那个待办 App 能真的增删改 + localStorage 生效）。
- **best-effort（不卡验收）**：Live/dev（HMR 编辑态）、Next/Express/带 API 的服务端应用。
- **明确不在 v1**：多框架全自动、生产级多租户预览编排、复杂 API 后端。
- **安全即预期的一部分**：低权限容器、无宿主密钥、无 docker socket 进 app/preview 容器、egress 分阶段（install 放行 registry、run 默认 deny/allowlist）、active 上限 + idle 回收。**安全不达标 = 预期不达标。**

---

## 3. 如何被验证

### 3.1 端到端硬验收清单（逐条可勾）
1. **SPA 跑通**：生成一个 Vite SPA（或就用「待办清单」那个多文件 App）→「运行预览」→ 状态流 `detecting→installing→building→ready` → iframe 显示成品 → **点交互（加一条待办）真的生效、刷新后 localStorage 还在**。（这正是当前单文件预览做不到、你要解决的那一刀。）
2. **鉴权隔离**：预览子域名带一次性 token→cookie；**未授权/跨 session 拿不到**别人的预览；预览**不同源**于主站。
3. **回收**：idle 超时容器被 reap；再次访问能重新拉起。
4. **限流**：并发预览达 active 上限时优雅排队/拒绝，**不击穿宿主**。
5. **失败优雅**：build 失败 → `status:'error'` + 错误信息进 UI，不崩前端、不挂宿主。

### 3.2 怎么跑/怎么观察
- 本地：`source .env` 后用 `ENABLE_STRUCTURED_OUTPUTS=false PORT=3000 APP_URL=http://localhost:3000 node start-production.mjs`（**每次改完代码必须重建 `pnpm build` 再重启**，这是本项目铁律；Node 20 本机构建加 `NODE_OPTIONS=--max-old-space-size=8192`）。
- 子域名本地用 sslip.io、生产用 wildcard（计划 §2.3）。
- 观察 `preview_state` 事件流是否按 (B) 的 status 机推进；前端 `useSessionPreview()` 是否实时反映。

### 3.3 回归（别打破已合并的 `main`）
- **S1**：Workbench 实时 / 消息顺序 / 历史=实时 / 每轮一张交付物卡 / 打开成果物不崩。
- **S2**：turn 卡折叠头「Worked Xs · N steps · 改 K 文件」/ 无重复 thinking。
- **单文件 HTML 预览**仍用 `artifact-html.tsx` blob iframe；**多文件提示横幅**在 live 预览接好前保留。
- 门禁：`oxlint`（0 errors）+ `pnpm build` 必须绿；CI 的 `Quality Checks` 必须过（`changedoc` 那条是基础设施无关项，owner 已说忽略）。

---

## 4. 如何寻求帮助

### 4.1 谁负责什么
- **你（架构师 B）**：Phase C 全部后端 + 总体设计与质量把关（你的本职）。
- **前端 chat/artifact 线 owner**（做 S1/S2 那位）：只做 §1.3(D) 的 UI 露出；找 ta 对 §1.3 契约。
- **评审/协调（我）**：chat/artifact UI 侧上下文最熟；接缝契约、评审、跨人协调找我。
- **Owner（产品/战略拍板）**：范围/优先级/「杀或修结构化输出」等产品级决策找 owner。

### 4.2 已为你解掉/挂起的上下文（别重复纠结）
- **结构化输出 `ENABLE_STRUCTURED_OUTPUTS`**：现强制默认 `false`（`.env` 已真改、`.env.example`/`CLAUDE.md`/worker 注释都写明）。**「杀 or 修」是挂在你线下游的决策**（brief §9 检查点）：若你的 `.oxygenie/app.json` manifest 成为成果物/App 声明唯一来源 → 直接**杀**（删开关 + worker `outputFormat` + store `lastStructuredOutput` + `use-artifact-detection.ts` Phase 2 分支）；否则**修** Stop-hook 再启用。**默认倾向杀**——你拍板。
- chat 线已修的 6 个问题见 `…-s1-review-and-s2s3-handoff.md`，别重复踩（尤其 `.js` 误执行、历史碎片化）。

### 4.3 协作硬规矩（CLAUDE.md，踩了会出乱子）
- **❌ 禁止改 `.env`**（要改改 `.env.example`）；启动时用 env 覆盖。
- **❌ 永远不要两个人同时编辑同一个文件**：你动后端文件，前端动 UI 文件，靠 §1.3 契约对齐。
- **⚠️ 别共用一个工作副本**：之前多 session 共用一个 clone 导致分支在彼此脚下被切、提交落错地方。**用你自己的 clone 或 `git worktree`**。
- **开工前 `git pull --rebase origin main`**（S1/S2 + 多文件提示都已在 `main`）。
- **每次 `pnpm build` 后必须重启**服务器才生效。
- SDK 钉死 `0.2.112`（ARK 兼容），别用 0.3.x 特性。

### 4.4 怎么提问 / 升级
- 设计/接缝问题 → 在 `research/` 加一份 markdown 或直接找协调（我），我熟 UI 侧。
- 范围/产品决策 → 升级 owner。
- 任务流转按 PM 仓库 `docs/5. 研发实施/2. 研发过程/` 走（若 owner 要正式分派）。

---

## 5. 一句话
**Phase C 是你的：照 v1 计划 §5 实施，硬验收=多文件 SPA 能真跑起来且可交互；前端只接 §1.3 契约的状态与露出；结构化输出杀/修在你这条线落地后定。卡住了——接缝找我、产品找 owner、后端你拿主意。**
