# REST API 迁移风险分析

**分析时间**: 2025-01-10
**关键发现**: ⚠️ **不能直接迁移所有 REST API 到 Server Functions**

---

## 🏗️ 当前架构分析

### WebSocket 服务器的依赖关系

**WS 服务器** (`ws-server.mjs`) 是一个独立进程（sidecar），通过 HTTP 调用主应用的 API：

```javascript
// ws-server.mjs 第 131 行
async function persistSession(cookie, workspaceSessionId, realSdkSessionId, claudeHomePath, title) {
  const response = await fetch(`${APP_URL}/api/agent-sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,  // 认证传递
    },
    body: JSON.stringify({
      sdkSessionId: workspaceSessionId,
      claudeHomePath,
      realSdkSessionId,
      title,
    }),
  });
}

// ws-server.mjs 第 164 行
async function loadSessionFromDb(cookie, workspaceSessionId) {
  const response = await fetch(`${APP_URL}/api/agent-sessions/by-sdk-id/${workspaceSessionId}`, {
    headers: { cookie },
  });
}
```

**关键调用**：
1. `POST /api/agent-sessions` - 创建/更新会话元数据
2. `GET /api/agent-sessions/by-sdk-id/:id` - 加载会话信息（用于 resume）

---

## ⚠️ 迁移风险

### 风险等级：🔴 高风险

**如果直接迁移到 Server Functions**：

| 问题 | 影响 | 严重性 |
|------|------|--------|
| WS 服务器调用失败 | WebSocket 服务无法创建/加载会话 | 🔴 致命 |
| 前端会话列表不可用 | 用户无法查看历史会话 | 🟠 严重 |
| Resume 功能失效 | 无法恢复历史会话 | 🟠 严重 |

### 为什么不能直接迁移？

**Server Functions 的路由路径**：
- TanStack Start 的 Server Functions 默认路径：`/api/_server/[function-id]`
- 不是 `/api/agent-sessions` 这种自定义路径

**WS 服务器需要固定路径**：
- WS 服务器硬编码了 `/api/agent-sessions`
- 改成 Server Functions 后路径会变，导致调用失败

---

## ✅ 安全的迁移策略

### 策略 1: 双端点共存（推荐）⭐

保留 REST API（供 WS 服务器使用），同时创建 Server Functions（供前端使用）：

```typescript
// 1. 保留 REST API（为 WS 服务器）
// src/routes/api/agent-sessions/index.ts
export const Route = createFileRoute('/api/agent-sessions/')({
  server: {
    handlers: {
      GET: async ({ request }) => { /* ... */ },
      POST: async ({ request }) => { /* ... */ },
    },
  },
});

// 2. 创建 Server Functions（为前端）
// src/server/function/agent-sessions.server.ts
export const listAgentSessions = createServerFn({ method: 'GET' })
  .handler(async () => {
    // 复用相同的逻辑
    return await getSessions();
  });

export const createAgentSession = createServerFn({ method: 'POST' })
  .inputValidator(sessionSchema)
  .handler(async ({ data }) => {
    return await createSession(data);
  });
```

**优点**：
- ✅ WS 服务器不受影响
- ✅ 前端使用类型安全的 Server Functions
- ✅ 逐步迁移，无风险

**缺点**：
- ⚠️ 代码重复（可以通过共享逻辑解决）

---

### 策略 2: 共享业务逻辑

创建共享的业务逻辑函数，REST API 和 Server Functions 都调用：

```typescript
// src/claude/sessions/manager.ts (新文件)
export async function getSessionsForUser(userId: string) {
  return await db.select().from(agentSession)
    .where(eq(agentSession.userId, userId));
}

export async function createSessionMeta(data: SessionData) {
  return await db.insert(agentSession).values(data);
}

// REST API 调用
export const Route = createFileRoute('/api/agent-sessions/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await requireUser(request);
        const sessions = await getSessionsForUser(user.id);
        return Response.json({ sessions });
      },
    },
  },
});

// Server Function 也调用相同逻辑
export const listAgentSessions = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireUser();
    const sessions = await getSessionsForUser(user.id);
    return { sessions };
  });
```

**优点**：
- ✅ 无代码重复
- ✅ 逻辑统一
- ✅ 安全迁移

---

### 策略 3: 保留关键 API，迁移次要 API

**保留的 REST API**（WS 服务器依赖）：
- ✅ `/api/agent-sessions` - 必须保留
- ✅ `/api/agent-sessions/by-sdk-id/:id` - 必须保留

**可以迁移的 API**（仅前端使用）：
- ✅ `/api/billing/info` - 可迁移
- ✅ `/api/subscription/cancel` - 可迁移
- ✅ `/api/invoices/*` - 可迁移
- ✅ `/api/settings/*` - 可迁移
- ✅ `/api/documents` - 可迁移

---

## 📊 API 分类和迁移建议

### 🔴 必须保留 REST API（WS 依赖）

| API 端点 | 依赖者 | 风险 | 迁移建议 |
|---------|--------|------|---------|
| `/api/agent-sessions` | WS 服务器 | 🔴 致命 | ❌ **不能迁移** |
| `/api/agent-sessions/by-sdk-id/:id` | WS 服务器 | 🔴 致命 | ❌ **不能迁移** |

### 🟡 可以迁移（前端使用）

| API 端点 | 依赖者 | 风险 | 迁移建议 |
|---------|--------|------|---------|
| `/api/chat` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/documents` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/billing/*` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/subscription/*` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/invoices/*` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/settings/*` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/threads/*` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/workspace/*` | 前端 | 🟢 低 | ✅ 建议迁移 |
| `/api/workflow/*` | 前端 | 🟢 低 | ✅ 建议迁移 |

### 🔵 特殊场景

| API 端点 | 说明 | 迁移建议 |
|---------|------|---------|
| `/api/auth/*` | Better Auth 集成 | ❌ 保留（Auth 库要求） |
| `/api/health` | 健康检查 | ❌ 保留（监控工具需要） |
| `/api/jobs/*` | 定时任务 | ❌ 保留（内部调用） |
| `/api/search/*` | 搜索服务 | ⚠️ 评估后决定 |

---

## 🎯 推荐的迁移计划

### 阶段 1: 安全迁移（1-2 周）

**迁移目标**: 仅前端使用的 API

```bash
# 可以立即迁移
✅ /api/billing/info
✅ /api/subscription/cancel
✅ /api/invoices/*
✅ /api/settings/billing
✅ /api/documents
✅ /api/threads/*
```

**验证步骤**：
1. 创建 Server Functions
2. 更新前端调用
3. 运行 `pnpm validate-routes` 确认通过
4. 测试前端功能正常
5. 删除旧的 REST API

### 阶段 2: 双端点共存（2-4 周）

**保留 REST API**（供 WS 服务器），**创建 Server Functions**（供前端）：

```typescript
// 保留: src/routes/api/agent-sessions/index.ts
// 新增: src/server/function/agent-sessions.server.ts

// 前端逐步迁移到 Server Functions
// WS 服务器继续使用 REST API
```

### 阶段 3: 重构 WS 服务器（长期）

**选项 A**: WS 服务器改用 Server Functions 调用
- 需要修改 WS 服务器代码
- 更新调用路径为 `/api/_server/...`

**选项 B**: 创建专用 API 网关
- WS 服务器调用专用网关
- 网关内部调用 Server Functions

**选项 C**: 保持现状（推荐）
- REST API 作为内部协议
- Server Functions 作为前端接口
- 两者共存，各司其职

---

## 🛡️ 风险缓解措施

### 迁移前检查

- [ ] 确认 API 被谁调用（WS 服务器 / 前端 / 其他）
- [ ] 检查是否有硬编码路径
- [ ] 验证认证方式（cookie / headers）
- [ ] 测试影响范围

### 迁移后验证

- [ ] WS 服务器正常创建会话
- [ ] WS 服务器正常恢复会话
- [ ] 前端会话列表正常显示
- [ ] 前端会话切换正常工作
- [ ] 验证 `pnpm validate-routes` 通过

### 回滚计划

```bash
# 如果出现问题，立即回滚
git revert <commit-hash>
pnpm build
pnpm start

# 验证功能恢复正常
```

---

## 📝 更新验证脚本规则

修改验证脚本，排除必须保留的 REST API：

```javascript
// scripts/validate-routes.mjs
{
  id: 'no-rest-api-routes',
  name: '禁止 REST API 路由',
  check: (filePath, content) => {
    // 排除 WS 服务器依赖的 API
    const wsApis = [
      '/api/agent-sessions',
      '/api/agent-sessions/by-sdk-id',
      '/api/auth',           // Better Auth
      '/api/health',         // 健康检查
      '/api/jobs',           // 定时任务
    ];

    const isWsApi = wsApis.some(api => filePath.includes(api.replace('/', '/api/')));
    if (isWsApi) return null;  // 跳过检查

    // 其他检查...
  },
}
```

---

## ✅ 结论

### 核心答案

**迁移所有 REST API 到 Server Functions 会导致系统崩溃吗？**

- ❌ **不会导致系统崩溃**（如果使用正确的策略）
- ⚠️ **但必须保留部分 REST API**（WS 服务器依赖）
- ✅ **可以安全迁移前端使用的 API**

### 最终建议

1. **保留关键 REST API**：
   - `/api/agent-sessions/*` - WS 服务器依赖
   - `/api/auth/*` - Better Auth
   - `/api/health` - 监控

2. **迁移前端 API**：
   - 使用双端点策略
   - 共享业务逻辑
   - 逐步迁移

3. **更新验证工具**：
   - 排除必须保留的 REST API
   - 添加注释说明原因

### 更新验证脚本

更新 `scripts/validate-routes.mjs`，添加白名单：

```javascript
// 白名单：必须保留的 REST API
const API_WHITELIST = [
  '/api/agent-sessions',      // WS 服务器依赖
  '/api/agent-sessions/by-sdk-id',
  '/api/auth',                 // Better Auth
  '/api/health',               // 健康检查
  '/api/jobs',                 // 定时任务
];

// 在检查规则中跳过白名单
if (API_WHITELIST.some(api => filePath.includes(api))) {
  return null;
}
```

---

## 📚 参考资料

- TanStack Start Server Functions 文档
- WebSocket 服务器架构文档
- Better Auth 集成指南
