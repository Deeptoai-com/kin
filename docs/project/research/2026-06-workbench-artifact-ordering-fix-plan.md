# 修正计划：Workbench 面板 / 成果物预览 / 消息顺序 + UI 优雅化

> 日期：2026-06-04 ｜ 状态：计划待评审（仅诊断+计划，未改代码）
> 关联：本轮三象限诊断 + 参考研究（Fragments、deep-agents-ui）。
> 背景：owner 反馈右侧 Workbench 只有 Progress 有内容且滞后；每个生成文件一张「打开成果物」卡且 React+Vite 结果看不到；消息前后错乱。沙盒 + SDK 新功能兼容将由**单独的新对话**集中处理。

---

## 1. 根因（concrete，file:line）

**A. Workbench 只有 Progress、且滞后**
- Files / Context = **从未实现的占位**：`workbench-panel.tsx:248-259` 硬编码 `EmptyState`，无 store 字段/selector。
- Progress / Sub-agents = **靠刮消息流里的 tool-call**（`use-session-workbench.ts:57-84` 刮 `TodoWrite`、`:109-140`/`:113` 刮 `Task`）。滞后因 selector 依赖 `messages` 变化、只在完整 assistant 消息落库时更新（`ws-adapter.ts:988-1027`），非增量。
- Sub-agents 空：要么没派生 Task，要么 SDK/沙盒下 `Task` tool-call 事件形状漂移未被识别。**脆弱点：刮 tool-call 名字而非读结构化状态。**

**B. 每文件一张「打开成果物」+ 多文件 App 看不到**
- 过度触发：`use-artifact-detection.ts:97-121` 把每个 `Write`/`Edit` 抽成 artifact，`:243-256` 每文件 `createArtifact`；`route.tsx:2077` 每条消息触发、`:2176-2183` 每 artifact 一个按钮。
- React 预览仅单文件：`artifact-react.tsx:29` Sandpack 单入口文件，无 `package.json`/兄弟文件 → 多文件 import 失败。
- **无真 dev-server**：走浏览器内 Sandpack 打包，从不起真实 Vite。
- 两套系统脱节：结构化输出 artifact 元数据（`ws-query-worker.mjs:115-151`）vs 沙盒 workspace 真文件，互不连通。已有 `workspace-sandpack-panel.tsx:82-102`（多文件 Sandpack）但独立、未接入。

**C. 消息前后错乱**
- 无序号：worker→ws→UI 全靠 JS 到达顺序（`ws-server.mjs:745` 发送不加 seq；`ws-adapter.ts:761` `content` 只 push）。
- `messages_loaded` 双处理：`ws-adapter.ts:524-531` 既回调进 zustand 又转发进 queue，而 queue switch（`:834-1367`）无该分支 → 死事件卡队列。
- 历史 + live 两段渲染无合并去重：`route.tsx:1459-1471`。
- tool_use/tool_result 回填假定顺序：`chat-session-store.ts:401-538`。

---

## 2. 参考结论（references）

- **Fragments (e2b-dev/fragments)** —— 「看到生成 App」的标准答案：**一次生成=一个完整可跑 fragment**（`fragmentSchema`: `template/file_path/code/additional_dependencies/install_dependencies_command/port/title/description`）；`Sandbox.create(template)` → 写文件 → 装依赖 → **web 模板返回 `https://${sbx.getHost(port)}` live 预览 URL**（iframe 嵌），**真 dev server 而非浏览器内打包**。
- **deep-agents-ui (langchain-ai)** —— 面板读 agent **结构化 state**（files/todos/sub-agents），不刮 tool-call。Files 应直接读沙盒 workspace FS。

---

## 3. UI/IA 设计：什么展示、什么处理完收起（核心）

**原则**：交付物 **push**（推到消息流并保留）；过程信息 push 到**可折叠**载体、**完成即自动收起**；导航/索引/元信息 **pull**（右侧 Workbench，按需打开，不抢主流）。一轮对话 = 一张「assistant turn 卡」。

| 内容 | 性质 | 处理中（live） | 完成后 | 位置 |
|---|---|---|---|---|
| 最终回答文本 | **交付物** | 流式 | **保留**展开 | 消息流（turn 卡主体） |
| 生成的 App / 文档 / 图（artifact） | **交付物** | 末尾浮现「查看预览」卡 | **保留** —— **每轮/每 App 一张卡**（非每文件） | turn 卡顶部 + 右侧 Preview |
| 推理 / thinking | 过程 | 流式（弱化样式） | **收起** 为「Thought for Xs ▸」 | turn 卡内可折叠 |
| 工具步骤（Read/Write/Bash/Task…） | 过程 | 实时一行状态「正在编辑 App.tsx…」 | **收起** 为「运行过程 · N 步 · 改 3 文件 ▸」 | turn 卡内可折叠组 |
| Todos / 计划 | 过程+导航 | 实时勾选 | 折叠「计划 4/4 ✓」 | 右侧 **Progress**（pull） |
| 子代理 | 过程 | 实时树 | 折叠摘要 | 右侧 **Sub-agents**（pull） |
| Files（workspace） | 交付物索引 | 实时增长 | **保留** | 右侧 **Files**（pull，读沙盒 FS） |
| Context（用量/模型/skills/mcp） | 元信息 | — | 按需 | 右侧 **Context**（pull） |

**直接消除的乱象**：① 每文件一张「打开成果物」→ 每轮一张交付物卡；② 散落的「步骤已完成」→ 一个折叠的「运行过程」；③ 过程信息抢占主流 → 完成即收起，主流只留答案 + 交付物。

---

## 4. 修正计划（分期 + 归属）

### Phase A — 消息流正确性 + 过程折叠（前端/adapter；安全；当前 UI 轨道可做）
- **A1 单一有序时间线**：worker 事件加单调 `seq`；UI 把历史+live 合并成**一个按 seq 排序、按 id 去重**的列表；删除 `messages_loaded` 双处理。→ 解决「错乱」。
- **A2 turn 卡 + 过程折叠**：每个 assistant turn 聚合为一张卡；reasoning + 工具步骤收进**可折叠「运行过程」组**，turn 完成自动折叠 + 一行摘要（步数/改动文件数）。→ 优雅化 + 消除散落卡。
- **A3 artifact 去重**：交付物**每轮/每 App 一张**（不再每 Write/Edit 一张）；改 `use-artifact-detection`/`route.tsx` 的渲染聚合逻辑。

### Phase B — Workbench 真数据（前端 + 轻量 server fn；当前轨道可做）
- **B1 Files**：新增 server fn 读 session workspace 目录树 + 文件内容（沙盒 FS = 真相源），Files tab 接上。
- **B2 Context**：接已有 `usageData` + `sessionMetadata`（模型/skills/mcp/本月用量）。
- **B3 Progress/Sub-agents 稳健化**：先在 `ws-adapter` 加日志核实 SDK 0.2.112 是否真发 `TodoWrite`/`Task`/tool 事件；修滞后（增量更新）。**与沙盒/SDK 对话重叠** → 见 Phase C。

### Phase C — 真预览（沙盒为主 → **新对话**）
- **C1 Fragments 式沙盒预览**：在 per-session 沙盒里起 dev server（或 build+serve）→ 暴露端口 → 返回预览 URL → iframe 嵌。替代多文件场景的单文件 Sandpack。
- **C2 「成果物」= App 预览卡**：接 C1 的预览 URL；无 dev server 时用 `workspace-sandpack-panel`（多文件）兜底。
- **C3 SDK 事件核验**：确认 Task/TodoWrite/tool_result 事件形状，根治 Progress 滞后 + Sub-agents 空（B3 的根治版）。

**归属**：A + B 属于本「UI/前端」轨道（不碰沙盒运行时）；**C（+B3 根治）属于 owner 要开的「沙盒 + 与沙盒交互」新对话**。A1/A2 的 turn-卡与折叠是后续一切的承载，建议先做。

---

## 5. 验收
- 消息严格按真实顺序、resume 后历史与新消息不交错/不重复（A1）。
- 一轮只有：最终文本 +（可选）一张交付物卡 + 一个折叠「运行过程」；过程完成即收起（A2/A3）。
- 右侧 Files 显示真实 workspace 文件可点看；Context 显示用量/模型/能力（B1/B2）。
- 生成多文件 React+Vite App → 一张预览卡 → 点开看到**真正运行**的页面（C1/C2）。
- Progress 实时不滞后、Sub-agents 有数据（B3/C3）。

## 6. 开放问题
1. 预览的运行方式：沙盒内 `npm run dev`（长驻端口）vs `build` 后静态 serve？长驻 dev server 的生命周期/回收（对齐 idle-reaper）需设计。
2. 预览安全：iframe sandbox 属性、端口仅本组织可达（对齐 VISION 半可信威胁模型）。
3. artifact「一个 App」的边界判定：按一轮里写入 workspace 的文件集合？还是靠结构化输出声明一个 app？
</content>
