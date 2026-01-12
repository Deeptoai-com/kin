# Phase 1: 路径级安全边界实施任务

**指派给**: Codex
**任务来源**: `2025-01-11-Sandbox隔离实施路线图.md` Phase 1
**前置条件**: 统一权限解析逻辑已完成（`src/claude/permissions.ts`）
**优先级**: 🔴 P0 - 必须完成

---

## 📋 任务概览

本阶段的目标是在**现有权限系统**（`permissionMode` + `disallowedTools`）基础上，添加**路径级安全边界**，防止：

1. ❌ 跨用户访问（用户 A 访问用户 B 的数据）
2. ❌ 系统路径访问（/etc、/proc、/sys 等）
3. ❌ /app 目录写入（只能读，不能写）

---

## 🎯 技术方案确认

**重要约束**：
- ✅ **保留**现有的 `permissionMode` 机制（default/plan/dontAsk/acceptEdits/delegate/bypassPermissions）
- ✅ **保留**现有的 `disallowedTools` 机制（Phase 1 默认禁用 Bash）
- ✅ **使用** `canUseTool` 实现路径级边界（仅在非 bypass 模式下有效）
- ✅ **bypassPermissions 仅白名单可用**（非白名单回退 default）
- ❌ **不使用** `allow/deny`（SDK Options 不支持该字段）
- ❌ **不使用** hooks（Phase 2 可选增强）

**SDK 配置方式（可落地）**：
```typescript
const permissionMode = resolvePermissionMode(userId, requestedMode);
const disallowedTools = resolveDisallowedTools(permissionMode);
const allowDangerouslySkipPermissions = permissionMode === 'bypassPermissions';

const canUseTool = async (toolName, input, options) => {
  const decision = checkPathBoundary({ toolName, input, workspace, userRoot, claudeHome });
  if (!decision.allowed) {
    return { behavior: 'deny', message: decision.message, interrupt: true };
  }
  return { behavior: 'allow' };
};

const stream = query({
  prompt,
  options: {
    permissionMode,
    disallowedTools,
    ...(allowDangerouslySkipPermissions && { allowDangerouslySkipPermissions: true }),
    ...(permissionMode !== 'bypassPermissions' && { canUseTool }),
  },
});
```

**关键机制**：
- `permissionMode !== 'bypassPermissions'` 时，`canUseTool` 可执行强制拦截
- `bypassPermissions` 会绕过权限检查，**Phase 1 不保证路径边界**
- Bash 默认禁用，避免命令行绕过路径检查

**配置来源（permissions.ts / path-security.js）**：
- `CLAUDE_PERMISSION_MODE`：默认权限模式
- `CLAUDE_BYPASS_USER_IDS`：bypass 白名单（逗号分隔）
- `CLAUDE_ALLOW_BASH=true`：仅在 bypass 下允许 Bash
- `CLAUDE_SESSIONS_ROOT`：用户目录根路径（默认 `/data/users`）
- `CLAUDE_READ_ALLOWED_PREFIXES`：额外读允许前缀（逗号分隔，绝对路径）
- `CLAUDE_WRITE_ALLOWED_PREFIXES`：额外写允许前缀（逗号分隔，绝对路径）
- `CLAUDE_BLOCKED_PREFIXES`：额外阻止前缀（逗号分隔，绝对路径）

**说明**：当前仅支持环境变量配置，管理后台接入留作后续任务。

---

## 🧩 Admin 配置接入设计（后续）

**目标**：让组织管理员在管理后台配置权限模式与路径安全规则，并在运行时生效。

**配置存储**：
- 使用 `organization.metadata` 存储权限设置（已有 `permissionMode` 与 `allowBash`）
- 新增 `pathSecurity` 字段保存路径规则
- 仍保留环境变量作为默认值与回退

**建议的 metadata 结构**：
```json
{
  "permissionMode": "default",
  "allowBash": false,
  "pathSecurity": {
    "readAllowedPrefixes": ["/mnt/shared"],
    "writeAllowedPrefixes": ["/mnt/shared/project"],
    "blockedPrefixes": ["/mnt/secret"]
  }
}
```

**可配置项（Admin UI）**：
- 权限模式：`default` / `bypassPermissions`（仅管理员可启用）
- Bash 开关：仅在 `bypassPermissions` 下可用
- 读允许前缀（追加）
- 写允许前缀（追加）
- 阻止前缀（追加）

**不可配置项（固定规则）**：
- `/app/` 只读
- `workspace` 与 `${userRoot}/sessions/` 的基础允许规则
- 系统阻止前缀（`/etc`, `/proc`, `/sys`, `/root`, `/var`, `/bin`, `/usr`, `/sbin`, `/boot`, `/lib`）
- `bypassPermissions` 下 **不保证路径边界**

**运行时接入方式（设计）**：
1. 扩展 `getPermissionInfo` / `updateOrganizationPermissions` 返回与更新 `pathSecurity`
2. WebSocket/Worker 入口在创建 `createPathSecurity()` 时注入 `extraReadPrefixes` / `extraWritePrefixes` / `extraBlockedPrefixes`
3. 仍保留环境变量作为默认值；组织配置覆盖默认值

**权限与审计**：
- 仅 `owner/admin` 可编辑
- 需记录修改人、时间与变更内容（审计日志）

**说明**：此部分为设计稿，Phase 1 不实施，仅作为后续管理后台接入参考。

---

## 📝 任务清单

### 任务 1.1: 实现跨用户隔离

**目标**：用户 A 不能访问用户 B 的任何数据

**威胁模型**：
```
用户 A: /data/users/UserA/sessions/...
用户 B: /data/users/UserB/sessions/...

攻击尝试：
Read("/data/users/UserB/sessions/.../file")  // ❌ 必须阻止
Write("/data/users/UserB/sessions/.../file") // ❌ 必须阻止
```

**实施步骤**：

1. **修改 `ws-query-worker.mjs`**
   - 在 `query()` 调用中注入 `canUseTool`
   - 从环境变量或 WORKER_CWD 解析 `userRoot`
   - 在 `canUseTool` 内实现路径边界检查（跨用户禁止）

2. **修改 `src/claude/agent/session.ts`**
   - 同步注入相同的 `canUseTool` 校验
   - 确保 AgentSession 也使用路径级安全边界

3. **修改 `src/claude/ws/bootstrap.ts`**
   - 同步注入相同的 `canUseTool` 校验

**代码示例**（ws-query-worker.mjs）：

```javascript
// 在 process.stdin.on('end') 中添加
import path from 'node:path';

// 1. 解析用户根目录
const userRoot = resolveUserRoot(config.cwd, process.env.CLAUDE_HOME);
const workspace = config.cwd;

function resolveUserRoot(workerCwd, claudeHome) {
  // 方法 1: 从 CLAUDE_HOME 解析（最可靠）
  if (claudeHome && claudeHome.includes('/data/users/')) {
    return claudeHome;  // /data/users/{userId}
  }

  // 方法 2: 从 WORKER_CWD 解析（备用）
  // /data/users/{userId}/sessions/{sessionId}/workspace
  const match = workerCwd.match(/^\/data\/users\/[^/]+\//);
  if (match) {
    return match[0];  // /data/users/{userId}/
  }

  // 方法 3: 回退到 CLAUDE_HOME
  return claudeHome || workerCwd;
}

const READ_ALLOWED_PREFIXES = [
  workspace,                  // workspace
  `${userRoot}/sessions/`,     // 当前用户的所有会话
  '/app/',                    // 项目源码（只读）
  `${process.env.CLAUDE_HOME}/.claude/`, // 用户技能（只读）
];

const WRITE_ALLOWED_PREFIXES = [
  workspace,                  // workspace
  `${userRoot}/sessions/`,     // 当前用户的所有会话
];

// 2. 提取工具输入中的路径
function extractTargetPaths(toolName, input, workspaceRoot) {
  const tool = String(toolName || '').toLowerCase();
  if (!input) {
    return (tool === 'glob' || tool === 'grep') ? [workspaceRoot] : [];
  }
  if (typeof input === 'string') return [input];
  const candidates = [];
  if (input.file_path) candidates.push(input.file_path);
  if (input.path) candidates.push(input.path);
  if (input.directory) candidates.push(input.directory);
  const flattened = candidates.flat().filter(Boolean);
  if (flattened.length === 0 && (tool === 'glob' || tool === 'grep')) {
    return [workspaceRoot];
  }
  return flattened;
}

// 3. 规范化路径（处理相对路径和 ..）
function normalizePath(candidate, workspaceRoot) {
  const raw = typeof candidate === 'string' ? candidate : String(candidate);
  const absolute = raw.startsWith('/') ? raw : path.resolve(workspaceRoot, raw);
  return path.posix.normalize(absolute.replace(/\\/g, '/'));
}

function isReadTool(toolName) {
  const name = String(toolName || '').toLowerCase();
  return name === 'read' || name === 'glob' || name === 'grep';
}

function isWriteTool(toolName) {
  const name = String(toolName || '').toLowerCase();
  return name === 'write' || name === 'edit';
}

function isUnderAnyPrefix(normalizedPath, prefixes) {
  return prefixes.some((prefix) => {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return normalizedPath === prefix.replace(/\/$/, '') || normalizedPath.startsWith(normalizedPrefix);
  });
}

// 4. 路径级安全边界（跨用户 + 允许列表）
function checkPathBoundary({ toolName, input, workspace, userRoot }) {
  const targets = extractTargetPaths(toolName, input, workspace);
  for (const target of targets) {
    const normalized = normalizePath(target, workspace);

    if (isBlockedPath(normalized, userRoot)) {
      return { allowed: false, message: `❌ Access denied: ${normalized}` };
    }

    if (isWriteTool(toolName) && !isUnderAnyPrefix(normalized, WRITE_ALLOWED_PREFIXES)) {
      return { allowed: false, message: `❌ Write outside allowed paths: ${normalized}` };
    }

    if (isReadTool(toolName) && !isUnderAnyPrefix(normalized, READ_ALLOWED_PREFIXES)) {
      return { allowed: false, message: `❌ Read outside allowed paths: ${normalized}` };
    }
  }
  return { allowed: true };
}

// 5. 配置 canUseTool
const canUseTool = async (toolName, input, options) => {
  const decision = checkPathBoundary({ toolName, input, workspace, userRoot });
  if (!decision.allowed) {
    return { behavior: 'deny', message: decision.message, interrupt: true };
  }
  return { behavior: 'allow' };
};

// 6. 在 query() 中启用（仅非 bypass）
const stream = query({
  prompt,
  options: {
    cwd: config.cwd,
    model: config.model,
    permissionMode,
    disallowedTools,
    ...(allowDangerouslySkipPermissions && { allowDangerouslySkipPermissions: true }),
    ...(permissionMode !== 'bypassPermissions' && { canUseTool }),

    settingSources: ['project'],
    tools: { type: 'preset', preset: 'claude_code' },
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: workspaceInstructions,
    },
    ...(useStructuredOutputs && {
      outputFormat: { type: 'json_schema', schema: artifactJsonSchema },
    }),
    ...(sdkResumeId && { resume: sdkResumeId }),
  },
});
```

**验收标准**：
- [ ] 用户 A 无法 `Read/Write/Edit/Glob/Grep` 用户 B 的文件
- [ ] `Bash` 工具在 Phase 1 默认禁用
- [ ] 用户 A 可以访问自己的所有会话
- [ ] 访问白名单之外的路径被阻止（例如 `/tmp`）
- [ ] 控制台日志输出安全边界信息（用于调试）
- [ ] 所有 3 个入口（worker、AgentSession、bootstrap）同步更新

**测试用例**：
```javascript
// 测试 1: 阻止跨用户访问
用户 A 尝试: Read("/data/users/UserB/sessions/...")
预期: 错误 "Access denied"

// 测试 2: 允许当前用户
用户 A 尝试: Read("/data/users/UserA/sessions/...")
预期: 成功

// 测试 3: Bash 工具不可用
尝试: Bash("ls /data/users")
预期: 工具不可用或权限被拒绝

// 测试 4: 白名单之外路径
Read("/tmp/should-block.txt")
预期: 错误 "Read outside allowed paths"
```

**依赖**：无

---

### 任务 1.2: 阻止系统路径访问

**目标**：不能访问 /etc、/proc、/sys 等敏感系统路径

**威胁模型**：
```javascript
Read("/etc/passwd")              // ❌ 必须阻止
Read("/proc/cpuinfo")            // ❌ 必须阻止
Glob("**/*", { path: "/etc" })   // ❌ 必须阻止
```

**实施步骤**：

1. **在任务 1.1 的基础上扩展系统路径黑名单**
   - 在 `checkPathBoundary` 中维护 `BLOCKED_PREFIXES`
   - 确保所有路径在比较前先 `normalizePath`

2. **添加额外的系统路径**
   - `/bin/` - 系统二进制
   - `/usr/` - 系统程序
   - `/sbin/` - 系统管理工具
   - `/boot/` - 启动文件
   - `/lib/` - 系统库

**代码更新**（在任务 1.1 基础上）：
```javascript
const BLOCKED_PREFIXES = [
  '/data/users/',           // 跨用户访问（结合 userRoot 例外处理）
  '/etc/',                  // 系统配置
  '/proc/',                 // 进程信息
  '/sys/',                  // 系统信息
  '/root/',                 // root 用户目录
  '/var/',                  // 系统数据
  '/bin/',                  // 系统二进制
  '/usr/',                  // 系统程序
  '/sbin/',                 // 系统管理工具
  '/boot/',                 // 启动文件
  '/lib/',                  // 系统库
];

function isBlockedPath(normalizedPath, userRoot) {
  for (const prefix of BLOCKED_PREFIXES) {
    if (normalizedPath.startsWith(prefix)) {
      if (prefix === '/data/users/' && normalizedPath.startsWith(`${userRoot}/`)) {
        return false;
      }
      return true;
    }
  }
  return false;
}
```

**验收标准**：
- [ ] `Read("/etc/passwd")` 被阻止
- [ ] `Read("/proc/cpuinfo")` 被阻止
- [ ] `Glob/Grep` 访问系统路径被阻止
- [ ] 错误信息清晰，说明访问被拒绝
- [ ] 控制台日志记录所有系统路径访问尝试

**测试用例**：
```javascript
// 测试 1: /etc 路径
Read("/etc/passwd")
预期: 错误 "Access denied: /etc/passwd"

// 测试 2: /proc 路径
Read("/proc/cpuinfo")
预期: 错误 "Access denied: /proc/cpuinfo"

// 测试 3: Glob 访问系统路径
Glob("**/*", { path: "/etc" })
预期: 错误 "Access denied"
```

**依赖**：任务 1.1

---

### 任务 1.3: /app 只读保护

**目标**：可以读取 /app 项目源码，但不能写入

**威胁模型**：
```javascript
Read("/app/src/lib/db.ts")           // ✅ 应该允许
Write("/app/src/lib/db.ts", "...")   // ❌ 必须阻止
Edit("/app/src/lib/db.ts", ...)      // ❌ 必须阻止
```

**技术挑战**：
- SDK Options 不支持 `allow/deny`，需在 `canUseTool` 中区分读写工具  
- `bypassPermissions` 下不会触发 `canUseTool`，因此 Phase 1 只在默认模式生效  
- Phase 1 默认禁用 `Bash`，避免命令行绕过  

**实施方案**：

在 `checkPathBoundary` 中通过允许列表实现 `/app` 只读：
- `READ_ALLOWED_PREFIXES` 包含 `/app/`
- `WRITE_ALLOWED_PREFIXES` 不包含 `/app/`

**代码示例**（在任务 1.1 的允许列表上确认即可）：
```javascript
const READ_ALLOWED_PREFIXES = [
  workspace,
  `${userRoot}/sessions/`,
  '/app/',                       // 只读
  `${process.env.CLAUDE_HOME}/.claude/`,
];

const WRITE_ALLOWED_PREFIXES = [
  workspace,
  `${userRoot}/sessions/`,        // 不包含 /app/
];
```

**验收标准**：
- [ ] `Read("/app/src/...")` 正常工作
- [ ] `Write("/app/src/...", "...")` 被阻止，错误信息清晰
- [ ] `Edit("/app/src/...", ...)` 被阻止，错误信息清晰
- [ ] 控制台日志记录所有 /app 写入尝试
- [ ] 错误信息提供用户友好的提示

**测试用例**：
```javascript
// 测试 1: 允许读取 /app
Read("/app/src/lib/db.ts")
预期: 成功，返回文件内容

// 测试 2: 阻止写入 /app
Write("/app/src/test.ts", "test")
预期: 错误 "Cannot write to /app (read-only)"

// 测试 3: 阻止编辑 /app
Edit("/app/src/test.ts", { newText: "..." })
预期: 错误 "Cannot write to /app (read-only)"

// 测试 4: 允许写入 workspace
Write("test.ts", "test")
预期: 成功
```

**依赖**：任务 1.1

---

## 🔍 验证和测试要求

### 1. 功能测试

为每个任务编写测试用例，确保：
- [ ] 允许的操作正常工作
- [ ] 阻止的操作被正确拒绝
- [ ] 错误信息清晰且用户友好
- [ ] 控制台日志记录所有拒绝操作

### 2. 跨入口一致性测试

确保所有 3 个入口行为一致：
- [ ] `ws-query-worker.mjs`
- [ ] `src/claude/agent/session.ts`
- [ ] `src/claude/ws/bootstrap.ts`

**测试方法**：
```bash
# 1. 通过前端 UI 测试（推荐）
#    使用产品界面直接发起对话

# 2. 通过 WebSocket 客户端测试（需携带登录 Cookie）
#    例：npx wscat -H "Cookie: <SESSION_COOKIE>=<value>" -c ws://localhost:3001/ws/agent

# 3. 通过 AgentSession 测试
# （需要查找或创建测试入口）

# 4. 通过 bootstrap 测试
# （需要查找或创建测试入口）
```

### 3. 性能测试

确保安全检查不影响性能：
- [ ] 路径解析延迟 < 10ms
- [ ] canUseTool 执行延迟 < 50ms
- [ ] 整体响应时间无明显增加

### 4. 日志验证

添加调试日志，便于排查问题：
```javascript
console.error(`[Security] Permission Mode: ${permissionMode}`);
console.error(`[Security] User Root: ${userRoot}`);
console.error(`[Security] Workspace: ${workspace}`);
console.error(`[Security] Disallowed Tools:`, disallowedTools);
console.error(`[Security] Blocked Prefixes:`, BLOCKED_PREFIXES);
console.error(`[Security] Read Allowed Prefixes:`, READ_ALLOWED_PREFIXES);
console.error(`[Security] Write Allowed Prefixes:`, WRITE_ALLOWED_PREFIXES);
```

---

## 📊 完成标准

### 必须完成
- [ ] 所有 3 个任务（1.1, 1.2, 1.3）实施完成
- [ ] 所有 3 个入口同步更新
- [ ] 所有测试用例通过
- [ ] 控制台日志清晰，便于调试

### 代码质量
- [ ] 代码遵循项目规范（TypeScript/JavaScript 风格一致）
- [ ] 添加必要的注释，解释安全逻辑
- [ ] 没有硬编码的路径或用户 ID
- [ ] 错误处理完善

### 文档更新
- [ ] 更新 `2025-01-11-Sandbox隔离实施路线图.md`，标记完成的任务
- [ ] 添加 Phase 1 完成报告，说明实施细节和测试结果

---

## ⚠️ 注意事项

### 1. 与现有权限系统的兼容性

**重要**：Phase 1 的路径级安全边界必须与现有的 `permissionMode` + `disallowedTools` 机制协同工作，**不能破坏**现有功能。

**验证清单**：
- [ ] `permissionMode: 'default'` + `canUseTool` → 路径级边界正常生效
- [ ] `permissionMode: 'bypassPermissions'`（白名单）→ **不保证路径级边界**（仅用于可信用户）
- [ ] `permissionMode: 'bypassPermissions'`（非白名单）→ 回退 `default` 且路径边界生效
- [ ] `disallowedTools: ['Bash']` → Bash 工具被禁用
- [ ] `CLAUDE_ALLOW_BASH=true` 仅在 `bypassPermissions` 下生效

**说明**：如需在 `bypassPermissions` 下也具备强制边界，必须引入 OS 级 sandbox 或 Phase 2 的 hooks 机制。

### 2. 用户路径解析的鲁棒性

`resolveUserRoot()` 函数必须处理各种边界情况：
- [ ] `WORKER_CWD` 为 `undefined` 或 `null`
- [ ] `CLAUDE_HOME` 为 `undefined` 或 `null`
- [ ] 路径格式不符合预期
- [ ] Windows 路径（虽然生产环境是 Linux）

**路径规范化要求**：
- [ ] 相对路径必须以 `workspace` 为基准 `path.resolve`
- [ ] 必须处理 `..` 路径穿越
- [ ] 对已存在路径，优先 `realpath` 去除符号链接
- [ ] 对不存在路径（Write/Edit），使用 `resolve` 结果做边界判断

**错误处理**：
```javascript
function resolveUserRoot(workerCwd, claudeHome) {
  try {
    // 方法 1: 从 CLAUDE_HOME 解析
    if (claudeHome && claudeHome.includes('/data/users/')) {
      return claudeHome;
    }

    // 方法 2: 从 WORKER_CWD 解析
    const match = workerCwd?.match(/^\/data\/users\/[^/]+\//);
    if (match) {
      return match[0];
    }

    // 方法 3: 回退
    const fallback = claudeHome || workerCwd || '/tmp';
    console.error(`[Security] Warning: Could not resolve userRoot, using fallback: ${fallback}`);
    return fallback;
  } catch (error) {
    console.error(`[Security] Error resolving userRoot:`, error);
    return '/tmp';  // 安全的回退值
  }
}
```

### 3. canUseTool 在 default 模式下的行为

**重要假设**：`canUseTool` 在 `permissionMode: 'default'` 下可用并能阻止工具执行。

**需要验证**：
- [ ] `canUseTool` 对 `Read/Write/Edit/Glob/Grep` 是否被调用？
- [ ] 返回 `{ behavior: 'deny' }` 是否能阻止工具执行？
- [ ] 错误信息是否正确显示给用户？

**如果 canUseTool 在 default 模式下不工作**，需要：
- 记录 SDK 行为与版本信息
- 评估 Phase 2（hooks 或 sandbox）作为替代方案

### 4. 错误信息的用户友好性

所有拒绝操作都应该有清晰的错误信息：

**好的错误信息**：
```
❌ Cannot write to /app (read-only)

Path: /app/src/lib/db.ts

The /app directory contains project source code and is read-only.

💡 Tip: Write files to your workspace instead:
   - Write("index.html", "...")
   - Write("src/component.tsx", "...")
```

**不好的错误信息**：
```
Error: Access denied
```

---

## 🚀 开始执行

**任务优先级**：
1. 🔴 P0 - 任务 1.1（跨用户隔离）
2. 🔴 P0 - 任务 1.2（系统路径阻止）
3. 🔴 P0 - 任务 1.3（/app 只读保护）

**预计工作量**：2-3 小时

**下一步**：请开始实施任务 1.1，完成后进入任务 1.2，最后完成任务 1.3。

**遇到问题**：如果发现 `canUseTool` 不生效或工具输入缺少路径信息，请记录在完成报告中，并提出替代方案。

---

**请开始执行，并在每个任务完成后报告进度。**
