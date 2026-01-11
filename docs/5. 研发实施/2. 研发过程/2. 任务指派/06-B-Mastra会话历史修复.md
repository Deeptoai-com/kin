# Mastra 会话历史修复

**状态**: [完成待回收]
**日期**: 2026-01-06
**指派人员**: B（架构师）
**难度**: ⭐⭐⭐ 中等
**PRD 关联**: Mastra AI SDK 集成 - 会话持久化

---

## 🎯 任务目标

修复 Mastra Chat 会话历史不显示的问题。当前症状：开始对话后，会话不会出现在 session list 中。

---

## 📋 问题分析（已完成）

### 根因诊断

经代码审查和 Mastra 官方文档比对，确认存在 **三个关键配置缺失**：

| # | 缺失项 | 当前状态 | 影响 |
|---|--------|----------|------|
| 1 | Storage Provider | Mastra 实例无 `storage` 配置 | 线程/消息无法持久化 |
| 2 | Agent Memory | chatAgent 无 `memory` 配置 | Agent 不记录对话历史 |
| 3 | threadId/resourceId | API 调用未传递 | 消息无法关联到会话 |

### 相关文件

| 文件 | 问题 |
|------|------|
| `src/mastra/index.ts` | 缺少 `storage` 配置 |
| `src/mastra/agents/chat-agent.ts` | 缺少 `memory` 配置 |
| `src/routes/api/chat.tsx` | 未传递 `threadId`/`resourceId` |

### 参考文档

- `memory/overview.mdx` - Memory 概述
- `memory/storage.mdx` - Storage 配置
- `reference/memory/createThread.mdx` - 创建线程 API
- `reference/memory/getThreadsByResourceId.mdx` - 获取用户线程

---

## 📝 实施计划

### 阶段 1：配置 Storage Provider

**目标**：为 Mastra 实例添加 PostgreSQL 存储支持

**步骤**：
1. 安装依赖：`pnpm add @mastra/pg @mastra/memory`
2. 修改 `src/mastra/index.ts`：
   ```typescript
   import { PostgresStorage } from '@mastra/pg';

   const storage = new PostgresStorage({
     connectionString: process.env.DATABASE_URL,
   });

   export const mastra = new Mastra({
     agents: { ... },
     storage,  // 添加
   });
   ```

**验证**：Mastra 实例初始化成功，无报错

---

### 阶段 2：为 Agent 添加 Memory

**目标**：启用 chatAgent 的消息历史记忆

**步骤**：
1. 修改 `src/mastra/agents/chat-agent.ts`：
   ```typescript
   import { Memory } from '@mastra/memory';

   const memory = new Memory();

   export const chatAgent = new Agent({
     // ... existing config
     memory,  // 添加
   });
   ```

**验证**：Agent 初始化成功，Memory 关联正常

---

### 阶段 3：修改 API 传递会话参数

**目标**：确保每次请求关联到正确的线程和用户

**步骤**：
1. 修改 `src/routes/api/chat.tsx`：
   ```typescript
   const stream = await handleChatStream({
     mastra,
     agentId: 'chat-agent',
     params: {
       ...params,
       threadId: body.threadId,      // 新增
       resourceId: body.resourceId,  // 新增（用户 ID）
     },
   });
   ```

2. 修改前端调用，传递 `threadId` 和 `resourceId`

**验证**：API 正确接收并处理会话参数

---

### 阶段 4：实现 Session List API

**目标**：提供获取用户会话列表的 API

**步骤**：
1. 创建 `src/routes/api/mastra-sessions.tsx`：
   ```typescript
   // GET /api/mastra-sessions - 获取用户的所有会话
   // POST /api/mastra-sessions - 创建新会话
   // DELETE /api/mastra-sessions/$threadId - 删除会话
   ```

2. 调用 Mastra Memory API：
   - `memory.getThreadsByResourceId({ resourceId })`
   - `memory.createThread({ resourceId, title })`
   - `memory.deleteThread({ threadId })`

**验证**：
- 新对话创建后出现在列表中
- 切换会话能恢复历史消息
- 删除会话正常工作

---

### 阶段 5：前端集成

**目标**：前端 UI 正确显示和管理 Mastra 会话

**步骤**：
1. 创建/修改 Mastra session 列表组件
2. 实现会话切换逻辑
3. 传递正确的 threadId/resourceId 到 API

**验证**：完整的用户流程测试

---

## 🔍 技术细节

### Storage Schema（由 @mastra/pg 自动创建）

```sql
-- threads 表
CREATE TABLE mastra_threads (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  title TEXT,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- messages 表
CREATE TABLE mastra_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES mastra_threads(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP
);

-- 索引
CREATE INDEX idx_threads_resource_id ON mastra_threads(resource_id);
CREATE INDEX idx_messages_thread_id ON mastra_messages(thread_id);
```

### API 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `threadId` | string | 会话唯一标识，新会话时由后端创建 |
| `resourceId` | string | 用户标识（通常是 user.id） |
| `title` | string | 会话标题（可选，默认自动生成） |

---

## ⚠️ 注意事项

1. **数据库迁移**：@mastra/pg 可能需要运行迁移创建表
2. **环境变量**：确保 `DATABASE_URL` 在所有环境中可用
3. **向后兼容**：新表不影响现有 Claude Chat 的 session 表
4. **错误处理**：Memory 操作失败时需优雅降级

---

## 📊 验收标准

- [ ] 新对话创建后出现在 session list
- [ ] 切换会话能恢复历史消息
- [ ] 刷新页面后会话列表保持
- [ ] 删除会话正常工作
- [ ] 多用户会话隔离正确
- [ ] Docker 部署环境正常工作

---

## 📅 依赖关系

- **前置依赖**：无
- **阻塞任务**：无

---

## 📚 参考资源

### Mastra 官方文档
- [Memory Overview](https://mastra.ai/docs/memory/overview)
- [Storage Configuration](https://mastra.ai/docs/memory/storage)
- [Using AI SDK UI](https://mastra.ai/guides/v1/build-your-ui/ai-sdk-ui)

### 项目参考
- `src/claude/` - Claude Chat 的会话管理实现（可参考）
- `src/db/schema/agent-session.schema.ts` - 现有 session schema

---

**创建时间**: 2026-01-06
**创建人**: A（总指挥）
**指派给**: B（架构师）

---

## ✅ 实施总结

### 完成的修改

#### 1. 安装依赖
```bash
pnpm add @mastra/pg@beta @mastra/memory@beta
```

#### 2. 配置 Agent Memory (`src/mastra/agents/chat-agent.ts`)
```typescript
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

const memory = new Memory({
  storage: new PostgresStore({
    id: 'chat-agent-storage',
    connectionString: process.env.DATABASE_URL!,
  }),
  options: {
    threads: {
      generateTitle: true,
    },
  },
});

export const chatAgent = new Agent({
  // ... existing config
  memory,
});
```

#### 3. 修改 Chat API (`src/routes/api/chat.tsx`)
- 从请求体提取 `memory` 配置
- 支持新格式 `memory.thread`/`memory.resource` 和旧格式 `threadId`
- 将参数传递给 `handleChatStream`

#### 4. 更新 Threads API
- `src/routes/api/threads/index.tsx`: POST 创建时同步创建 Mastra thread
- `src/routes/api/threads/$threadId.tsx`: GET 使用 `memory.recall()` 获取消息

### 架构说明

采用**双层存储**架构：
1. **本地数据库表** (`mastra_thread`): 存储 thread 元数据、用户关联、agent 关联
2. **Mastra Memory** (`mastra_threads`/`mastra_messages`): 存储实际的对话消息

这样设计的优势：
- 保持用户认证和权限控制
- 支持多 Agent 会话
- 利用 Mastra 内置的消息管理功能

### 待验证

- [ ] 本地开发测试
- [ ] Docker 部署测试
- [ ] 数据库迁移验证（Mastra 表是否自动创建）

---

**完成时间**: 2026-01-06
**完成人**: B（架构师）
