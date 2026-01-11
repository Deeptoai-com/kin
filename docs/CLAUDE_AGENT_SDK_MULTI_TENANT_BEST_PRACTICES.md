# Claude Agent SDK 在多租户类 ChatGPT 系统中的最佳实践

**文档创建日期**: 2025-01-11
**目标读者**: 架构师、后端工程师、DevOps 工程师
**应用场景**: 多租户 SaaS、类 ChatGPT 的 AI 聊天系统

---

## 📋 目录

1. [场景概述](#1-场景概述)
2. [核心架构决策](#2-核心架构决策)
3. [多租户隔离策略](#3-多租户隔离策略)
4. [会话管理最佳实践](#4-会话管理最佳实践)
5. [权限控制策略](#5-权限控制策略)
6. [沙盒隔离方案](#6-沙盒隔离方案)
7. [性能优化](#7-性能优化)
8. [监控和日志](#8-监控和日志)
9. [安全最佳实践](#9-安全最佳实践)
10. [部署和运维](#10-部署和运维)

---

## 1. 场景概述

### 1.1 典型应用特征

**多租户类 ChatGPT 系统**通常具备以下特征：

- **多用户隔离**: 每个用户有独立的数据、会话、配置
- **持久化会话**: 支持会话恢复和历史记录
- **资源配额**: 每个用户有 API 调用限制、存储限制
- **可扩展性**: 支持水平扩展，应对并发用户增长
- **安全性**: 用户间数据隔离，防止跨租户访问

### 1.2 Claude Agent SDK 的定位

**SDK 的角色**：
- 提供底层 Agent 能力（对话、工具调用、流式响应）
- 不直接处理多租户、认证、计费等业务逻辑
- 需要配合上层应用实现完整的 SaaS 功能

**架构层级**：
```
┌─────────────────────────────────────────┐
│   业务层: 认证、计费、用户管理、UI      │
├─────────────────────────────────────────┤
│   会话层: 会话管理、历史记录、恢复      │
├─────────────────────────────────────────┤
│   Agent 层: Claude Agent SDK            │
├─────────────────────────────────────────┤
│   基础设施层: Docker、数据库、存储     │
└─────────────────────────────────────────┘
```

### 1.3 关键挑战

| 挑战 | 描述 | 优先级 |
|------|------|--------|
| **租户隔离** | 如何隔离不同用户的数据和会话 | 🔴 高 |
| **会话持久化** | 如何保存和恢复会话状态 | 🔴 高 |
| **并发控制** | 如何处理大量并发请求 | 🟡 中 |
| **资源管理** | 如何限制每个用户的资源使用 | 🟡 中 |
| **成本控制** | 如何控制 API 调用成本 | 🔴 高 |

---

## 2. 核心架构决策

### 2.1 会话管理架构

#### 决策点：谁来管理会话？

**选项A：SDK 管理会话**
```typescript
// SDK 提供的 sessionId，由 SDK 管理
const stream = query({
  prompt: userMessage,
  options: {
    resume: 'sdk-session-id',  // SDK 管理的会话 ID
  },
});
```

**优点**：
- ✅ 简单，SDK 自动处理
- ✅ 会话元数据由 SDK 维护

**缺点**：
- ❌ 无法绑定业务数据（用户、标题、标签）
- ❌ 无法控制会话生命周期
- ❌ 会话数据存储在 SDK 内部，难以迁移

**选项B：应用层管理会话**（推荐）
```typescript
// 应用层生成 sessionId，映射到 SDK 会话
const workspaceSessionId = generateUuid();
const sdkSessionId = await createAgentSession(userId, workspaceSessionId);

// 启动 Worker 进程，传入 workspaceSessionId
const worker = spawn('node', ['ws-query-worker.mjs'], {
  env: {
    WORKSPACE_SESSION_ID: workspaceSessionId,
    // ...
  },
});

// 保存映射关系到数据库
await db.insert(agentSessions).values({
  userId,
  workspaceSessionId,
  sdkSessionId,  // SDK 返回的真实会话 ID
  createdAt: new Date(),
});
```

**优点**：
- ✅ 完全控制会话生命周期
- ✅ 可以关联业务数据（用户、标题、标签）
- ✅ 可以实现会话列表、搜索、导出等功能
- ✅ 可以控制会话存储位置（本地、S3、数据库）

**缺点**：
- ⚠️ 需要自己维护映射关系
- ⚠️ 需要处理会话清理逻辑

**推荐方案**：**选项B - 应用层管理会话**

**理由**：
1. 多租户系统需要绑定用户数据
2. 需要会话列表、搜索、标签等业务功能
3. 需要控制会话存储和清理策略

### 2.2 进程架构

#### 决策点：单进程 vs 多进程

**选项A：单进程（所有会话共享进程）**
```typescript
// 一个 Node.js 进程处理所有会话
const app = express();

app.post('/api/chat', async (req, res) => {
  const stream = await query({ prompt: req.body.message });
  // ...
});
```

**优点**：
- ✅ 简单，易于部署
- ✅ 资源利用率高

**缺点**：
- ❌ 会话间干扰（内存泄漏、状态污染）
- ❌ 无法隔离不同用户的环境
- ❌ 一个会话崩溃可能影响其他会话

**选项B：多进程（每个会话独立进程）**（推荐）
```typescript
// 每个会话启动独立的 Worker 进程
const worker = spawn('node', ['ws-query-worker.mjs'], {
  env: {
    CLAUDE_HOME: userClaudeHome,  // 用户特定的环境
    WORKSPACE_SESSION_ID: sessionId,
  },
});
```

**优点**：
- ✅ 完全隔离（环境、内存、文件系统）
- ✅ 一个会话崩溃不影响其他会话
- ✅ 可以独立控制和清理资源

**缺点**：
- ⚠️ 资源开销大（每个会话一个进程）
- ⚠️ 需要管理进程生命周期

**选项C：混合（进程池 + 会话隔离）**
```typescript
// 维护一个 Worker 进程池
const workerPool = new WorkerPool({
  min: 2,
  max: 10,
});

// 从池中分配空闲 Worker
const worker = workerPool.acquire();
worker.send({ type: 'query', sessionId, prompt });

// 使用完毕后归还
worker.on('done', () => workerPool.release(worker));
```

**优点**：
- ✅ 平衡隔离和资源利用
- ✅ 可以控制最大并发数

**缺点**：
- ⚠️ 实现复杂
- ⚠️ 需要处理 Worker 复用的环境隔离问题

**推荐方案**：**选项B - 多进程（适合中小规模）**

**理由**：
1. 多租户系统需要强隔离
2. 实现相对简单
3. 进程管理开销在现代硬件上可接受

**规模调整**：
- < 1000 并发用户：多进程即可
- \> 1000 并发用户：考虑进程池或分布式架构

### 2.3 通信架构

#### 决策点：HTTP vs WebSocket

**选项A：HTTP（Server-Sent Events）**
```typescript
// 使用 SSE 流式传输
app.post('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');

  const stream = query({ prompt });
  for await (const event of stream) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
});
```

**优点**：
- ✅ 简单，易于实现
- ✅ 天然支持流式传输

**缺点**：
- ❌ 单向通信（服务器 → 客户端）
- ❌ 无法主动中断请求（需要依赖超时或 AborController）

**选项B：WebSocket**（推荐）
```typescript
// WebSocket 持久连接
ws.on('message', async (data) => {
  if (data.type === 'chat') {
    const stream = query({ prompt: data.message });
    for await (const event of stream) {
      ws.send({ type: 'event', event });
    }
  } else if (data.type === 'interrupt') {
    abortController.abort();
  }
});
```

**优点**：
- ✅ 双向通信（可以中断、恢复）
- ✅ 持久连接，减少握手开销
- ✅ 更好的实时性

**缺点**：
- ⚠️ 需要管理连接状态
- ⚠️ 需要处理重连逻辑

**推荐方案**：**选项B - WebSocket**

**理由**：
1. 类 ChatGPT 系统需要支持中断（停止生成）
2. 需要实时流式传输
3. WebSocket 是业界标准（OpenAI 使用）

---

## 3. 多租户隔离策略

### 3.1 数据隔离层级

#### 层级 1：用户级隔离（必需）

**目标**: 不同用户的数据完全隔离

**实现方案**：

```dockerfile
# Dockerfile
ENV CLAUDE_SESSIONS_ROOT=/data/users
```

```javascript
// ws-server.mjs
const SESSIONS_ROOT = process.env.CLAUDE_SESSIONS_ROOT;

// 为每个用户创建独立的 CLAUDE_HOME
const userClaudeHome = path.join(
  SESSIONS_ROOT,
  sanitizeUserId(userId)  // 防止路径遍历
);

// 设置环境变量
workerEnv.CLAUDE_HOME = userClaudeHome;
```

**目录结构**：
```
/data/users/
  ├─ userA/
  │   ├─ .claude/
  │   │   ├─ skills/
  │   │   ├─ sessions/
  │   │   └─ settings.json
  │   └─ sessions/
  │       └─ session1/
  └─ userB/
      ├─ .claude/
      └─ sessions/
```

**关键点**：
- ✅ 使用 `sanitizeUserId()` 防止路径遍历攻击
- ✅ 每个 user 有独立的 CLAUDE_HOME
- ✅ SDK 会自动加载用户特定的 skills 和配置
- ⚠️ CLAUDE_HOME 指向用户根目录，`.claude/` 在其内部

#### 层级 2：会话级隔离（推荐）

**目标**: 同一用户的不同会话相互隔离

**实现方案**：

```javascript
// ws-server.mjs
const sessionWorkspace = path.join(
  userClaudeHome,
  'sessions',
  sessionId,
  'workspace'
);
await mkdir(sessionWorkspace, { recursive: true });

// 传递给 Worker
workerEnv.WORKER_CWD = sessionWorkspace;
```

**目录结构**：
```
/data/users/userA/
  ├─ .claude/
  │   ├─ skills/           ← 用户共享的 skills
  │   └─ settings.json
  └─ sessions/
      ├─ session-abc/
      │   └─ workspace/    ← 会话特定的工作目录
      │       ├─ file1.html
      │       └─ src/
      └─ session-def/
          └─ workspace/
              ├─ file2.html
              └─ src/
```

**好处**：
- ✅ 会话间文件不冲突
- ✅ 会话结束后可以清理整个目录
- ✅ 符合用户对"会话"的预期

#### 层级 3：进程级隔离（可选）

**目标**: 会话间进程隔离

**实现方案**：

```javascript
// 每个会话一个 Worker 进程
const worker = spawn('node', ['ws-query-worker.mjs'], {
  env: {
    CLAUDE_HOME: userClaudeHome,
    WORKER_CWD: sessionWorkspace,
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

**优点**：
- ✅ 内存隔离
- ✅ 崩溃隔离

**缺点**：
- ⚠️ 资源开销大

**何时使用**：
- 高安全要求场景（金融、医疗）
- 不信任的代码执行

### 3.2 路径安全

#### 防止路径遍历攻击

```javascript
/**
 * 清理 userId，防止路径遍历和其他安全问题
 * @param {string} userId - 原始 userId
 * @returns {string} 安全的 userId
 */
function sanitizeUserId(userId) {
  // 移除路径分隔符和危险字符
  return userId
    .replace(/[\/\\\.]+/g, '_')  // 替换 / \ . 为 _
    .replace(/[^a-zA-Z0-9_-]/g, '_');  // 移除非字母数字字符
}

// 示例
sanitizeUserId('../../../etc/passwd');  // → "_____etc_passwd"
sanitizeUserId('user@example.com');    // → "user_example_com"
sanitizeUserId('W4dBHOx5UNQdSi0m4md1eWbkIHf83ZFb');  // → "W4dBHOx5UNQdSi0m4md1eWbkIHf83ZFb"
```

**使用场景**：
- 所有涉及用户输入的路径操作
- 数据库查询（如果使用 userId 作为文件路径）

**其他安全措施**：
```javascript
// 验证路径是否在允许的目录内
import path from 'node:path';

function ensurePathIsSafe(userPath, allowedBase) {
  const resolvedPath = path.resolve(allowedBase, userPath);
  const normalizedPath = path.normalize(resolvedPath);

  // 检查是否在允许的基础目录内
  if (!normalizedPath.startsWith(allowedBase)) {
    throw new Error('Path traversal detected');
  }

  return normalizedPath;
}
```

---

## 4. 会话管理最佳实践

### 4.1 会话生命周期

#### 会话状态机

```
┌──────────┐  chat  ┌───────────┐  done   ┌──────────┐
│  Created │ ──────> │ Active    │ ──────> │ Finished │
└──────────┘        └───────────┘         └──────────┘
     │                  │                     │
     │             interrupt                │
     │                  ↓                     │
     │            ┌──────────┐               │
     └───────────> │ Aborted  │ <────────────┘
                  └──────────┘
```

#### 状态管理

```javascript
// 会话状态定义
const SessionState = {
  CREATED: 'created',     // 会话已创建，等待首次消息
  ACTIVE: 'active',       // 会话进行中
  FINISHED: 'finished',   // 会话正常完成
  ABORTED: 'aborted',     // 会话被中断
  ERROR: 'error',         // 会话出错
};

// 数据库 schema
class AgentSession {
  id: string;
  userId: string;
  workspaceSessionId: string;  // 应用层的会话 ID
  sdkSessionId: string;        // SDK 返回的真实会话 ID
  claudeHomePath: string;
  state: SessionState;
  title: string | null;        // 会话标题（从第一条消息提取）
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 会话创建

#### 创建流程

```javascript
async function createSession(userId, firstMessage) {
  // 1. 生成会话 ID
  const workspaceSessionId = crypto.randomUUID();

  // 2. 计算用户特定的路径
  const userClaudeHome = path.join(
    SESSIONS_ROOT,
    sanitizeUserId(userId)
  );

  const sessionWorkspace = path.join(
    userClaudeHome,
    'sessions',
    workspaceSessionId,
    'workspace'
  );

  // 3. 创建目录
  await mkdir(sessionWorkspace, { recursive: true });

  // 4. 启动 Worker 进程
  const worker = spawnWorker({
    userId,
    workspaceSessionId,
    claudeHome: userClaudeHome,
    cwd: sessionWorkspace,
  });

  // 5. 保存到数据库
  const [session] = await db.insert(agentSessions).values({
    userId,
    workspaceSessionId,
    sdkSessionId: null,  // 首次查询后会由 SDK 返回
    claudeHomePath: userClaudeHome,
    state: SessionState.CREATED,
    title: null,  // 稍后从第一条消息提取
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  // 6. 发送第一条消息
  const stream = await queryInWorker(worker, firstMessage);

  return { sessionId: workspaceSessionId, stream };
}
```

### 4.3 会话恢复

#### 恢复流程

```javascript
async function resumeSession(userId, workspaceSessionId, message) {
  // 1. 从数据库查询会话
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.userId, userId),
        eq(agentSessions.workspaceSessionId, workspaceSessionId)
      )
    );

  if (!session) {
    throw new Error('Session not found');
  }

  // 2. 检查会话状态
  if (session.state === SessionState.FINISHED ||
      session.state === SessionState.ABORTED) {
    // 已结束的会话可以恢复（创建新会话，但保留历史）
    return await createSession(userId, message);
  }

  // 3. 重新启动 Worker（使用相同的 workspaceSessionId）
  const worker = spawnWorker({
    userId,
    workspaceSessionId,
    claudeHome: session.claudeHomePath,
    sdkResumeId: session.sdkSessionId,  // ← 关键：传递 SDK 会话 ID
  });

  // 4. 发送消息
  const stream = await queryInWorker(worker, message);

  return stream;
}
```

**注意事项**：
- ✅ `workspaceSessionId`（应用层）和 `sdkSessionId`（SDK 层）是两个不同的概念
- ✅ 恢复时需要传递 `sdkSessionId` 给 SDK
- ✅ 已结束的会话可以"软恢复"（创建新会话，保留历史）

### 4.4 会话清理

#### 清理策略

**策略A：手动清理**（用户主动删除）
```javascript
async function deleteSession(userId, workspaceSessionId) {
  // 1. 验证权限
  const session = await getSession(userId, workspaceSessionId);

  // 2. 停止 Worker 进程
  await stopWorker(session.workspaceSessionId);

  // 3. 删除工作目录
  const workspaceDir = path.join(
    session.claudeHomePath,
    'sessions',
    workspaceSessionId
  );
  await rm(workspaceDir, { recursive: true, force: true });

  // 4. 删除数据库记录
  await db.delete(agentSessions)
    .where(eq(agentSessions.workspaceSessionId, workspaceSessionId));
}
```

**策略B：自动清理**（定期清理过期会话）
```javascript
// 定时任务（每天凌晨执行）
cron.schedule('0 3 * * *', async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 查找 30 天前的会话
  const oldSessions = await db
    .select()
    .from(agentSessions)
    .where(lt(agentSessions.lastMessageAt, thirtyDaysAgo));

  for (const session of oldSessions) {
    try {
      await deleteSession(session.userId, session.workspaceSessionId);
      console.log(`[Cleanup] Deleted session ${session.workspaceSessionId}`);
    } catch (error) {
      console.error(`[Cleanup] Failed to delete session ${session.workspaceSessionId}:`, error);
    }
  }
});
```

**策略C：限制会话数量**（每个用户最多 N 个会话）
```javascript
async function enforceSessionLimit(userId, maxSessions = 100) {
  const [{ count }] = await db
    .select({ count: count() })
    .from(agentSessions)
    .where(eq(agentSessions.userId, userId));

  if (count > maxSessions) {
    // 删除最旧的会话
    const oldSessions = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.userId, userId))
      .orderBy(asc(agentSessions.lastMessageAt))
      .limit(count - maxSessions);

    for (const session of oldSessions) {
      await deleteSession(userId, session.workspaceSessionId);
    }
  }
}
```

---

## 5. 权限控制策略

### 5.1 权限模式选择

#### 多租户场景的推荐配置

> **重要**：官方文档说明 `bypassPermissions` 会绕过所有权限检查。  
> 在共享容器场景中，**必须**搭配强制权限边界（`canUseTool`/hooks）与网络 egress 控制。
> 本项目当前阶段仅保证工具可用性，尚未启用安全边界与 egress 控制，需在二期补齐。

```javascript
const stream = query({
  prompt: userMessage,
  options: {
    // 使用 bypassPermissions 模式（容器化环境）
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,

    // 工具配置
    tools: {
      type: 'preset',
      preset: 'claude_code',
      // 注意：共享容器场景可考虑启用 sandbox 以补强隔离
    },
  },
});
```

**为什么使用 bypassPermissions？**

| 场景 | 是否适合 bypassPermissions | 理由 |
|------|----------------------------|------|
| **开发者的本地环境** | ❌ 不适合 | 需要确认每个操作 |
| **CI/CD 环境** | ✅ 适合 | 环境受控，脚本自动化 |
| **Docker 容器** | ⚠️ 有条件 | 仅在单租户容器或强制权限边界下可接受 |
| **多租户 SaaS** | ⚠️ 有条件 | 共享容器必须加 canUseTool/hooks + egress 控制 |

### 5.2 安全决策：bypassPermissions 使用条件

**允许使用 bypassPermissions 的最低要求**（共享容器场景）：
- ✅ 会话级 workspace 隔离（每会话独立目录）
- ✅ `canUseTool`/hooks 强制路径白名单（阻断跨租户与系统路径）
- ✅ 网络 egress 限制（域名 allowlist）
- ✅ 关键操作审计日志（可追溯）

**不满足上述条件时的替代方案**：
- 使用 `permissionMode: 'default'` 或 `'dontAsk'`
- 通过 allow/deny 规则显式限制可用工具与路径

### 5.3 细粒度权限控制

#### 使用 allow/deny 规则

> ⚠️ 当 `permissionMode: 'bypassPermissions'` 时，这些规则可能不会生效。  
> 若要依赖 allow/deny，请使用 `default` 或 `dontAsk`。

创建 `.claude/settings.json`：

```json
{
  "permissions": {
    "defaultMode": "dontAsk",
    "allow": [
      {
        "tool": "bash",
        "commands": ["ls", "cat", "echo", "pwd", "cd", "grep", "find", "head", "tail"]
      },
      {
        "tool": "read",
        "paths": ["/app/**", "/data/users/{userId}/**"]
      },
      {
        "tool": "write",
        "paths": ["/data/users/{userId}/sessions/**"]
      },
      {
        "tool": "glob",
        "patterns": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.md"]
      }
    ],
    "deny": [
      {
        "tool": "bash",
        "commands": ["rm -rf /", "dd if=/dev/zero", "mkfs", "fdisk"]
      },
      {
        "tool": "write",
        "paths": ["/etc/**", "/bin/**", "/usr/**", "/proc/**", "/sys/**"]
      },
      {
        "tool": "bash",
        "commands": ["curl *", "wget *", "nc *"]
      }
    ]
  }
}
```

**注意事项**：
- ⚠️ 规则按顺序检查：deny → allow → ask
- ⚠️ 通配符匹配需要谨慎测试
- ⚠️ `${CLAUDE_HOME}` 环境变量替换未在官方文档中说明，建议写入绝对路径

### 5.4 动态权限控制

#### 使用 canUseTool 回调

```javascript
// 在 SDK 配置中添加权限回调
const stream = query({
  options: {
    canUseTool: async (toolName, input, options) => {
      // 1. 获取用户信息
      const userId = getUserIdFromContext();
      const userPermissions = await getUserPermissions(userId);

      // 2. 检查用户权限
      if (!userPermissions.allowedTools.includes(toolName)) {
        return { behavior: 'deny', message: 'Tool not allowed for this user' };
      }

      // 3. 检查资源访问权限
      if (toolName === 'read' || toolName === 'write') {
        const path = input.file_path;
        if (path && !isPathAllowedForUser(userId, path)) {
          return { behavior: 'deny', message: 'Path not accessible' };
        }
      }

      // 4. 检查配额
      const usage = await getUserUsage(userId);
      if (usage.toolCalls >= userPermissions.quota.toolCalls) {
        return { behavior: 'deny', message: 'Quota exceeded' };
      }

      return { behavior: 'allow', updatedInput: input };
    },
  },
});
```

**注意**：
- 在 `permissionMode: 'bypassPermissions'` 下，`canUseTool` 可能不会被调用；如需强制边界，建议使用 `PreToolUse` hooks。

**适用场景**：
- 不同用户等级（免费、付费、企业）
- 资源访问控制（只能访问自己的文件）
- 配额限制（API 调用次数、存储容量）

---

## 6. 沙盒隔离方案

### 6.1 Docker 容器隔离（推荐）

#### 为什么选择 Docker 而非 OS 级沙盒？

**对比**：

| 维度 | Docker 容器 | OS 级沙盒 (bubblewrap) |
|------|-------------|----------------------|
| **隔离粒度** | 容器级（粗粒度） | 进程级（细粒度） |
| **部署复杂度** | 🟢 简单 | 🟡 中等 |
| **资源开销** | 🟡 中等 | 🟢 低 |
| **网络隔离** | ✅ 内置 | ⚠️ 需额外配置 |
| **文件系统隔离** | ✅ 内置 | ✅ 内置 |
| **进程隔离** | ✅ 内置 | ✅ 内置 |
| **嵌套隔离** | ⚠️ 有限 | ✅ 支持多层嵌套 |
| **监控成熟度** | ✅ 成熟 | ⚠️ 较新 |

**结论**：
- ✅ **Docker 是隔离基础设施的首选**
- ✅ 部署和运维简单
- ✅ 生态成熟（Docker Compose、Kubernetes）
- ⚠️ 共享容器不是租户边界，需额外权限/网络隔离或改用“每租户一容器”

#### Docker 隔离最佳实践

**1. 非 root 用户运行**
```dockerfile
# Dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
```

**2. 只读文件系统**（可选）
```dockerfile
# 只挂载特定目录为可写
VOLUME ["/data/users"]
```

**3. 资源限制**
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 512M
```

**4. 网络隔离**
```yaml
services:
  app:
    networks:
      - isolated_network
    # 禁止访问外网（通过配置代理）
```

### 6.2 会话级工作目录隔离

#### 实现方案

```javascript
// ws-server.mjs
const sessionWorkspace = path.join(
  userClaudeHome,
  'sessions',
  workspaceSessionId,
  'workspace'
);
await mkdir(sessionWorkspace, { recursive: true });

// 传递给 Worker
const workerEnv = {
  ...process.env,
  WORKER_CWD: sessionWorkspace,
  CLAUDE_HOME: userClaudeHome,
};

const worker = spawn('node', [WORKER_PATH], {
  env: workerEnv,
});
```

**目录结构**：
```
/data/users/userA/
  ├─ .claude/
  │   ├─ skills/           ← 用户共享（只读）
  │   ├─ settings.json     ← 用户配置（只读）
  │   └─ sessions/         ← 会话数据
  └─ sessions/
      ├─ session-1/
      │   ├─ workspace/    ← 会话 1 工作目录（可写）
      │   │   ├─ file1.html
      │   │   └─ src/
      │   └─ .enabled      ← 会话启用标记
      └─ session-2/
          └─ workspace/    ← 会话 2 工作目录（可写）
              └─ file2.html
```

**好处**：
- ✅ 会话间文件不冲突
- ✅ 会话结束后可整体删除
- ✅ 符合用户对"会话"的预期

### 6.3 System Prompt 引导

#### 告诉 Claude 工作边界

```javascript
// ws-query-worker.mjs
const workspaceInstructions = `

IMPORTANT - Workspace File Operations:
You are working in an isolated workspace directory at: ${config.cwd}

When creating, writing, or editing files:
- ALWAYS use relative paths (e.g., "index.html", "styles.css", "src/App.jsx")
- NEVER use absolute paths like "/tmp/file.html" or "/home/user/file.html"
- Files will be created relative to the current working directory
- The workspace is isolated for this conversation session

⭐ Accessing User Skills and Data:
- User skills are located in: ${process.env.CLAUDE_HOME}/.claude/skills/
- To search for skills, use absolute paths, e.g., "${process.env.CLAUDE_HOME}/.claude/skills/**/*"
- Project source is in: /app (read-only unless explicitly allowed)
- Workspace is in: ${config.cwd}

Example good file paths:
- "index.html" (creates in workspace root)
- "src/components/Header.tsx" (creates in subdirectory)
- "${process.env.CLAUDE_HOME}/.claude/skills/**/*.md" (search user skills)
- "/app/src/**/*.ts" (search project source files)

Example bad file paths:
- "/tmp/index.html" (DON'T use /tmp)
- "/home/user/index.html" (DON'T write outside workspace)
- ".claude/skills/**/*" (DON'T use relative path for skills - use absolute path)`;
```

---

## 7. 性能优化

### 7.1 连接池管理

#### WebSocket 连接池

```javascript
// ws-server.mjs
const connections = new Map();  // sessionId → WebSocket

function handleConnection(ws, sessionId) {
  // 保存连接
  connections.set(sessionId, ws);

  // 清理逻辑
  ws.on('close', () => {
    connections.delete(sessionId);
  });
}

function broadcastToSession(sessionId, message) {
  const ws = connections.get(sessionId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(message);
  }
}
```

### 7.2 Worker 进程管理

#### 进程生命周期

```javascript
// ws-server.mjs
const workers = new Map();  // sessionId → Worker

function spawnWorker(sessionConfig) {
  const worker = spawn('node', ['ws-query-worker.mjs'], {
    env: sessionConfig.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // 清理逻辑
  worker.on('exit', (code) => {
    console.log(`[Worker] Exited with code ${code}`);
    workers.delete(sessionConfig.sessionId);

    // 清理工作目录
    cleanupWorkspace(sessionConfig.workspaceDir);
  });

  workers.set(sessionConfig.sessionId, worker);
  return worker;
}

function stopWorker(sessionId) {
  const worker = workers.get(sessionId);
  if (worker) {
    worker.kill('SIGTERM');
    workers.delete(sessionId);
  }
}
```

### 7.3 内存管理

#### 限制会话数量

```javascript
const MAX_CONCURRENT_SESSIONS = 100;
const MAX_SESSIONS_PER_USER = 10;

async function enforceLimits() {
  // 全局限制
  const [{ count }] = await db
    .select({ count: count() })
    .from(agentSessions)
    .where(eq(agentSessions.state, 'active'));

  if (count > MAX_CONCURRENT_SESSIONS) {
    throw new Error('System at capacity, please try again later');
  }

  // 用户级限制
  const userCount = await db
    .select({ count: count() })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.userId, userId),
        eq(agentSessions.state, 'active')
      )
    );

  if (userCount > MAX_SESSIONS_PER_USER) {
    throw new Error('Too many active sessions, please close some first');
  }
}
```

### 7.4 缓存策略

#### 缓存用户配置

```javascript
const userConfigCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 5,  // 5 分钟
});

async function getUserPermissions(userId) {
  // 检查缓存
  if (userConfigCache.has(userId)) {
    return userConfigCache.get(userId);
  }

  // 从数据库加载
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  const permissions = {
    allowedTools: user.allowedTools || [],
    quota: user.quota || {},
  };

  // 保存到缓存
  userConfigCache.set(userId, permissions);

  return permissions;
}
```

---

## 8. 监控和日志

### 8.1 日志策略

#### 结构化日志

```javascript
// 使用结构化日志
console.log(JSON.stringify({
  level: 'info',
  timestamp: new Date().toISOString(),
  sessionId: workspaceSessionId,
  userId: userId,
  event: 'session_created',
  data: {
    claudeHome: userClaudeHome,
    workspace: sessionWorkspace,
  },
}));
```

#### 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| **error** | 错误和异常 | Worker 崩溃、查询失败 |
| **warn** | 警告 | 资源不足、配额超限 |
| **info** | 关键事件 | 会话创建、用户登录 |
| **debug** | 调试信息 | SDK 事件、工具调用 |

### 8.2 监控指标

#### 关键指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| **活跃会话数** | 当前活跃的会话数量 | > 80% MAX_CONCURRENT_SESSIONS |
| **Worker 进程数** | 当前运行的 Worker 数量 | > 100 |
| **平均响应时间** | 从接收到响应的时间 | > 10 秒 |
| **错误率** | 查询失败的比例 | > 5% |
| **内存使用** | 容器内存使用率 | > 90% |
| **CPU 使用** | 容器 CPU 使用率 | > 80% |

#### Prometheus 集成

```javascript
import promClient from 'prom-client';

// 指标定义
const activeSessionsGauge = new promClient.Gauge({
  name: 'claude_active_sessions',
  help: 'Number of active Claude sessions',
});

const toolCallsCounter = new promClient.Counter({
  name: 'claude_tool_calls_total',
  help: 'Total number of tool calls',
  labelNames: ['tool', 'user_id'],
});

const queryDurationHistogram = new promClient.Histogram({
  name: 'claude_query_duration_seconds',
  help: 'Duration of Claude queries',
  buckets: [1, 5, 10, 30, 60, 300],
});

// 使用指标
activeSessionsGauge.inc();
toolCallsCounter.inc({ tool: 'bash', user_id: userId });
queryDurationHistogram.observe(durationInSeconds);
```

### 8.3 审计日志

#### 记录关键操作

```javascript
async function logAuditEvent(userId, sessionId, event, data) {
  await db.insert(auditLogs).values({
    userId,
    sessionId,
    event,
    data: JSON.stringify(data),
    timestamp: new Date(),
    ipAddress: getClientIP(),
    userAgent: getUserAgent(),
  });
}

// 使用示例
await logAuditEvent(userId, sessionId, 'tool_call', {
  tool: 'bash',
  command: 'ls -la',
  result: 'success',
});
```

---

## 9. 安全最佳实践

### 9.1 输入验证

#### 验证用户输入

```javascript
import { z } from 'zod';

// 定义输入 schema
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  model: z.enum(['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307']).optional(),
});

// 验证输入
function validateChatRequest(input) {
  try {
    return ChatRequestSchema.parse(input);
  } catch (error) {
    throw new Error('Invalid request: ' + error.errors.map(e => e.message).join(', '));
  }
}
```

### 9.2 速率限制

#### 全局限流

```javascript
import rateLimit from 'express-rate-limit';

const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 100,  // 每个 IP 最多 100 次请求
  message: 'Too many requests from this IP, please try again later.',
});

app.post('/api/chat', chatRateLimit, async (req, res) => {
  // ...
});
```

#### 用户级限流

```javascript
async function checkUserRateLimit(userId) {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const [{ count }] = await db
    .select({ count: count() })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.userId, userId),
        gte(agentSessions.createdAt, oneMinuteAgo)
      )
    );

  if (count > 20) {  // 每分钟最多 20 次请求
    throw new Error('Rate limit exceeded, please slow down');
  }
}
```

### 9.3 内容安全

#### 过滤恶意内容

```javascript
// 敏感词列表（示例）
const SENSITIVE_WORDS = ['password', 'api_key', 'secret', 'token'];

function detectSensitiveContent(message) {
  const lower = message.toLowerCase();
  return SENSITIVE_WORDS.some(word => lower.includes(word));
}

// 使用
if (detectSensitiveContent(userMessage)) {
  return res.status(400).json({
    error: 'Your message contains sensitive content',
  });
}
```

### 9.4 数据加密

#### 加密敏感数据

```javascript
import crypto from 'node:crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;  // 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

function decrypt(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 9.5 多租户隔离与权限边界测试清单

- **跨租户文件访问**：userA 读写 `/data/users/userB/**` 必须失败
- **路径遍历**：`../`、绝对路径越界访问必须被拦截
- **软链接逃逸**：workspace 内软链接指向系统目录时应被拒绝
- **会话隔离**：sessionA 创建的文件在 sessionB 默认不可见
- **工具边界**：`PreToolUse` hooks 或 `canUseTool`（非 bypass 模式）拒绝非白名单路径与危险命令
- **网络 egress**：非 allowlist 域名访问必须失败
- **工具可用性**：`bash` / `rg` / `glob` 在期望路径上可用
- **审计日志**：每次 tool call 记录 userId、sessionId、路径与结果

---

## 10. 部署和运维

### 10.1 Docker Compose 部署

#### 完整配置示例

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    container_name: claude-app
    restart: unless-stopped

    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 512M

    # 环境变量
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CLAUDE_SESSIONS_ROOT=/data/users

      # 数据库
      - DATABASE_URL=postgres://user:pass@db:5432/claude

      # Redis（用于速率限制）
      - REDIS_URL=redis://redis:6379

      # 日志级别
      - LOG_LEVEL=info

    # 数据卷
    volumes:
      - claude-sessions:/data/users

    # 端口
    ports:
      - "5050:5000"  # HTTP
      - "3051:3001"  # WebSocket

    # 网络
    networks:
      - isolated_network

    # 依赖
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

    # 健康检查
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: pgvector/pgvector:0.8.0-pg17
    container_name: claude-db
    restart: unless-stopped

    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=claude

    volumes:
      - db-data:/var/lib/postgresql/data

    networks:
      - isolated_network

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d claude"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: claude-redis
    restart: unless-stopped

    volumes:
      - redis-data:/data

    networks:
      - isolated_network

    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  isolated_network:
    driver: bridge

volumes:
  claude-sessions:
  db-data:
  redis-data:
```

### 10.2 环境变量配置

#### .env 文件模板

```bash
# ===== 应用配置 =====
NODE_ENV=production
PORT=5000
WS_PORT=3001

# ===== Anthropic API =====
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_BASE_URL=  # 可选
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# ===== 会话管理 =====
CLAUDE_SESSIONS_ROOT=/data/users
MAX_CONCURRENT_SESSIONS=100
MAX_SESSIONS_PER_USER=10

# ===== 数据库 =====
DATABASE_URL=postgres://user:pass@db:5432/claude
POSTGRES_USER=claude_user
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=claude

# ===== Redis =====
REDIS_URL=redis://redis:6379

# ===== 安全 =====
ENCRYPTION_KEY=your-32-byte-hex-key-here
JWT_SECRET=your-jwt-secret-here

# ===== 日志 =====
LOG_LEVEL=info

# ===== 监控 =====
ENABLE_METRICS=true
PROMETHEUS_PORT=9090

# ===== 速率限制 =====
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 10.3 健康检查

#### 健康检查端点

```javascript
// routes/health.ts
export async function GET(req: Request) {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      disk: await checkDisk(),
      memory: await checkMemory(),
    },
  };

  const allHealthy = Object.values(checks.checks).every(c => c.status === 'ok');

  return Response.json(checks, {
    status: allHealthy ? 200 : 503,
  });
}

async function checkDatabase() {
  try {
    await db.select({ count: count() }).from(users);
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}
```

### 10.4 优雅关闭

#### 处理 SIGTERM

```javascript
// ws-server.mjs
const workers = new Map();

async function gracefulShutdown(signal) {
  console.log(`[WS Server] Received ${signal}, shutting down gracefully`);

  // 1. 停止接受新连接
  server.close(() => {
    console.log('[WS Server] WebSocket server closed');
  });

  // 2. 等待现有查询完成（最多 30 秒）
  const shutdownTimeout = setTimeout(() => {
    console.log('[WS Server] Shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000);

  // 3. 停止所有 Worker
  for (const [sessionId, worker] of workers) {
    console.log(`[WS Server] Stopping worker for session ${sessionId}`);
    worker.kill('SIGTERM');
  }

  // 4. 清理资源
  await cleanup();

  clearTimeout(shutdownTimeout);
  console.log('[WS Server] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## 附录

### A. 参考文档

**官方文档**：
- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [Docker Documentation](https://docs.docker.com/)

**相关项目**：
- [constructa-starter](https://github.com/instructa/constructa-starter)
- [claude-agent-chat](https://github.com/foreveryh/constructa-starter)

### B. 关键代码位置

| 文件 | 路径 | 职责 |
|------|------|------|
| **WebSocket Server** | `ws-server.mjs` | 处理 WebSocket 连接、会话管理 |
| **Query Worker** | `ws-query-worker.mjs` | 调用 Claude Agent SDK |
| **Session Manager** | `src/claude/agent/session.ts` | 会话生命周期管理 |
| **Database Schema** | `src/db/schema/agent-session.schema.ts` | 会话数据模型 |

### C. 故障排查

#### 常见问题

**问题 1：Worker 进程崩溃**
```
解决方案：
1. 检查日志：docker logs ex0-app
2. 检查内存：docker stats ex0-app
3. 增加内存限制：docker-compose.yml 中的 deploy.resources.limits.memory
```

**问题 2：会话无法恢复**
```
解决方案：
1. 检查数据库中的 sdkSessionId 是否存在
2. 检查 CLAUDE_HOME 目录是否存在
3. 检查 Worker 进程是否传递了 resume 参数
```

**问题 3：权限错误**
```
解决方案：
1. 检查 .claude/settings.json 语法
2. 检查 permissionMode 和 allowDangerouslySkipPermissions 是否正确设置
3. 检查 allow/deny 规则是否冲突
```

**问题 4：bash/grep/glob 不可用**
```
解决方案：
1. bash 缺失：安装 bash（Alpine: apk add --no-cache bash）
2. grep 失败：Grep 工具依赖 ripgrep (rg)，安装 ripgrep 或改用 Debian/Ubuntu 镜像
3. glob 为空：确认 cwd 是 workspace；扫描项目源码请设置 path: /app
```

---

**文档版本**: v1.0
**最后更新**: 2025-01-11
**作者**: Claude (Sonnet 4.5)
