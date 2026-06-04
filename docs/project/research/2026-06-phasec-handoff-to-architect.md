# Phase C（成果物「真预览」）交接 + 现状更新 — 致架构师

> 日期：2026-06-04 ｜ 来源：评审/协调（非实现者） ｜ 收件：架构师 B
> 一句话：**Phase C（真预览）正式交由你完成。** 你上次拍板产出的 `2026-06-real-preview-v1-implementation-plan.md` 就是蓝图，本文只做「自你上次沟通后变了什么」的同步 + 明确归属 + 接缝交代。

---

## 0. 结论（owner 决定）

- 真预览（多文件 App 跑起来）从立项起就划为 **Phase C 沙盒线，不在 chat/Workbench 重做（S1/S2）范围内**。
- owner 决定：**Phase C 由你（架构师）来完成**——既是你拍的板，沙盒/反代/鉴权也正是你的射程，避免交给前端实现者造成域错配。
- 前端那位（做 S1/S2 的人）在 Phase C 里**只负责 UI 接缝那一小块**（见 §4），不接整期。

---

## 1. 自你上次拍板（真预览 4 点决策）以来发生了什么

你上次给的是「真预览」方向 + 4 点拍板，落成了 `…-v1-implementation-plan.md`。同期 chat/Workbench 那条线（你点名的「消息顺序 / 过程折叠 / Files-Context / artifact 去重」Phase A/B）**已经被一次更彻底的单源重做吃掉并交付**，现在 Phase C 落在一个**干净得多的地基**上：

- **S1（单源根基）已实现 + owner 实测 + 合并 `main`**。`useLocalRuntime → useExternalStoreRuntime`，`chat-session-store.messages` 成唯一有序真相源（带 `seq`），左侧流 + 右侧 Workbench 同读一份 → **Workbench 跑时实时**。历史按轮合并（一轮多条 SDK 消息 → 一条 store 消息），历史与实时渲染一致。评审中修掉 6 个问题（status 报错、自动弹面板、turn 内双卡、历史碎片化、`.js` 误执行崩 Sandpack、全局重复卡）。详见 `2026-06-cowork-s1-review-and-s2s3-handoff.md`。
- **S2（turn 卡渲染收尾）= PR #106**（`feat/cowork-s2-turn-card`，CI 绿，待 owner 重启眼测后 squash-merge）：折叠头「Worked Xs · N steps · 改 K 文件」+ thinking 去重。
- **S3（结构化输出 Stop-hook 泄漏）= 决定不修，挂到你这条线**：`ENABLE_STRUCTURED_OUTPUTS` 强制默认 `false`（已写进 `.env.example`/`CLAUDE.md`/worker 注释），泄漏当前不触发；根因备案在 `2026-06-real-preview-architect-brief.md` **§9**（随 PR #106 合并）。**且新增一个挂在你线下游的待定决策**：见 §3。
- **净结果**：成果物/Workbench 现状 = 每轮一张 turn 卡 + 一张交付物卡（带真实文件名）、Workbench 实时、HTML 单文件预览能渲染、打开不再崩。**你不必再处理这些；Phase C 直接在此之上接「真预览」即可。**

---

## 2. 需要你完成的（Phase C 本体）

蓝图就是 `2026-06-real-preview-v1-implementation-plan.md`，按其 **§5 任务拆分（粗序）** 推进：
1. `PreviewRuntime` 接口 + `DockerPreviewProvider`（ensureSandbox / install / start(static) / stop / reap / getUrl）+ 配置 + active 上限限流。
2. `preview-controller` sidecar（唯一持 docker socket）。
3. Traefik labels + forward-auth + `/__oxy/auth` bootstrap→cookie 流 + sslip.io(本地)/wildcard(生产)。
4. `.oxygenie/app.json` schema + 启发式扫描器 + 命令 allowlist。
5. UI 接缝（见 §4）。
6. 端到端验收：Vite SPA（install→build→static→iframe）、idle 回收、active 上限、跨源鉴权隔离。

**硬验收口径不变**：纯前端 SPA static preview（install→build→serve `dist/`）；Live/dev = best-effort。你点名的 6 个坑（别默认常驻 dev server / 子路径反代复杂度→走子域名 / 绝不同源 / npm install 生命周期 / 别把 DockerBackend 改成常驻 / 缺 active 上限会被击穿）仍是红线。

**起步可复用**：执行底座在 `src/claude/execution/`（`docker-backend.js`/`local-process-backend.js`/`types.js`，Phase 0.5）。计划 §2.1 已明确 `PreviewRuntime` **独立新增**、**不改** 现有 one-shot `DockerBackend`。

### 就绪自查（开工前确认，协调员建议）
1. 目标/本地环境**有 Docker**；本地 hybrid 模式（`start-production.mjs` 跑宿主）与「每会话 preview 容器」如何协调（计划 §7 已点名）。
2. active 上限 + idle 回收**从第一天进 scope**。
3. v1 范围锁死 = SPA static；不动 `DockerBackend`；子域名主线、绝不同源。

---

## 3. 挂在你线下游的待定决策：结构化输出「杀 or 修」

- 现状：`ENABLE_STRUCTURED_OUTPUTS` 强制 `false`（泄漏不触发，artifact 元数据走被动启发式探测兜底）。
- **耦合点**：计划 §2.5「未来 (A)」设想 `declare_app`/`preview_ready` 自定义 SDK 工具**写/更新同一份 `.oxygenie/app.json` manifest**。**若 manifest 成为成果物/App 声明的唯一来源，结构化输出这条路可能整体不再需要 → 直接删开关 + worker `outputFormat` + `lastStructuredOutput` + Phase 2 探测分支。**
- owner 决定：**这道「杀 or 修」等 Phase C 落地后,由你在本线一并拍板**（倾向「杀」，前提是 manifest 接管声明）。在那之前维持 env-off，不做投机性文本过滤。

---

## 4. 接缝：Phase C ↔ chat/artifact 线（唯一会撞车处）

- **后端（你）**：沙盒、`preview-controller`、Traefik/forward-auth、跨源鉴权、manifest 探测、idle/限流 —— 全归 Phase C。
- **前端（S1/S2 那位）**：只做计划 §2.6 的 **UI 入口**——预览怎么在 Workbench/成果物面板里露出、preview URL/状态怎么进前端 store。
- 两边靠 **`.oxygenie/app.json` manifest 契约**对齐，不做整体移交。
- 协调员可补一份 **seam 契约**（manifest 里 UI 需要的字段 + 预览露出方式 + URL/状态如何流到 store），把接缝钉死后两边并行不打架——**需要的话告诉我，我来写并放进 `research/`。**

---

## 5. 文档 / 代码索引

- 蓝图：`research/2026-06-real-preview-v1-implementation-plan.md`（你拍板）、`research/2026-06-real-preview-architect-brief.md`（含 §9 结构化输出备案，随 #106 合并）。
- chat 线现状/评审：`research/2026-06-cowork-chat-workbench-redesign-spec.md`、`research/2026-06-cowork-s1-review-and-s2s3-handoff.md`、`docs/project/STATUS.md` 决策日志。
- `main` 上可建之上：单源渲染（`src/routes/agents/claude-chat/route.tsx`、`src/lib/chat-session-store.ts`、`src/claude/adapters/ws-adapter.ts`）、成果物 UI（`src/components/claude-chat/artifacts-panel.tsx`、`artifact-*.tsx`、`use-artifact-detection.ts`）、执行底座（`src/claude/execution/`）。
- S1 合并 commit `8bef75a`；S2 = PR #106（github.com/foreveryh/oxygenie/pull/106，待合并）。
