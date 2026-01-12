# Artifact 更新与历史恢复

**状态**: [待实施]  
**日期**: 2026-01-12  
**指派人员**: Codex  
**难度**: ⭐⭐⭐ 中等  
**PRD 关联**: Claude Chat - Artifacts 体验一致性  

---

## 🎯 任务目标

满足用户使用习惯：
1. **更新 artifact 时必须看到最新版本**，不需要手动刷新。
2. **同一会话多次生成/重写**时，自动打开并显示最新版本。
3. **刷新浏览器后进入历史会话**，artifact 入口卡片仍可出现并打开。

不使用数据库持久化。

---

## 📌 已知问题（原因定位）

1. **Artifact 只按 messageId 存一份**  
   `useArtifactDetection` 对同一 `messageId` 已存在 artifact 直接跳过，导致“重试/更新”无法刷新。

2. **只识别 Write，不识别 Edit**  
   重写经常走 `Edit`，但检测逻辑只看 `Write`，所以不会触发更新。

3. **刷新后 Artifacts Store 被清空**  
   历史会话加载时不回放 `result/structured_output`，且 `tool_result` 被过滤，导致入口卡片无法恢复。

---

## ✅ 推荐方案（不走 DB）

### 核心思路
以 **文件路径 (filePath)** 作为 artifact 的主键，做到：
- 同一路径写入时 **更新现有 artifact**；
- 不依赖 messageId；
- 历史恢复时从 workspace 或 registry 重新 hydrate。

### 方案结构

**A. 运行中更新（核心体验）**
- 识别 `Write` + `Edit` 工具调用。
- 当工具完成后读取 workspace 的实际文件内容，保证展示的是最终版本。
- 若同一 `filePath` 已存在 artifact → **update + 自动打开**。

**B. 历史会话恢复（不落库）**
- 引入轻量 **artifact registry 文件**（如：`${workspace}/.artifacts.json`）。
- 每次创建/更新 artifact 时同步写入 registry。
- 刷新后进入历史会话时：读取 registry → hydrate store → 入口卡片恢复。

> 说明：registry 属于 workspace 文件，不是数据库，符合“不落库”偏好。

---

## 🧩 实施计划

### 阶段 1：更新逻辑改造（核心功能）

1. **Artifacts Store 扩展**
   - 新增字段：`sessionId`、`sourceFilePath`、`updatedAt`。
   - 新增查询：`getArtifactByFilePath(sessionId, filePath)`。

2. **Artifact 检测扩展**
   - 支持 `Write` + `Edit`。
   - 如果有 `filePath`：
     - 调用 workspace file API 获取内容（保证最终版本）。
     - 有则 `updateArtifact`，无则 `createArtifact`。
   - 每次更新后执行 `setActiveArtifact`，自动打开最新版本。

3. **行为验证**
   - 重写同一文件时，artifact 自动刷新且入口不消失。
   - `Edit` 也能触发更新。

---

### 阶段 2：历史恢复（不落库）

1. **Artifact Registry 文件**
   - 文件位置：`${workspace}/.artifacts.json`
   - 内容：`[{ filePath, type, title, description, updatedAt }]`

2. **注册写入**
   - artifact create/update 时写入 registry（追加/覆盖）。
   - 由后端 API 完成写文件，避免前端直接写文件。

3. **会话恢复**
   - resume 会话后：读取 registry → hydrate store
   - 如果 registry 缺失：可退化为 `list files + 过滤扩展名 + 读取内容`（兜底）

---

## ✅ 验收标准

1. **实时更新**  
   同一会话内多次修改 artifact，入口自动更新并打开最新版本。

2. **刷新后恢复**  
   刷新浏览器后进入历史会话，artifact 入口卡片可见并可打开。

3. **Edit/Write 都有效**  
   使用 Edit 更新 artifact 文件后，展示内容为最新版本。

---

## 📎 相关文件（需改造）

- `src/lib/hooks/use-artifact-detection.ts`
- `src/lib/stores/artifacts-store.ts`
- `src/routes/api/workspace/$sessionId.file.$filePath.ts`（复用）
- 新增：`src/routes/api/workspace/$sessionId.artifacts.ts`（registry 读写）

---

## 备注

本任务不涉及数据库方案。如后续需要审计或跨设备同步，再评估 DB 方案。
