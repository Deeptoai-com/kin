# Claude Agent SDK 权限控制与沙盒实现分析

**文档创建日期**: 2025-01-11
**分析目标**: 对比 Claude Agent SDK 官方文档与项目实际实现，评估权限控制和沙盒机制的实施质量

---

## 📋 目录

1. [Claude Agent SDK 官方文档研究](#1-claude-agent-sdk-官方文档研究)
2. [项目当前实现分析](#2-项目当前实现分析)
3. [匹配度对比分析](#3-匹配度对比分析)
4. [当前问题诊断](#4-当前问题诊断)
5. [安全风险评估](#5-安全风险评估)
6. [改进建议](#6-改进建议)
7. [总结](#7-总结)

---

## 1. Claude Agent SDK 官方文档研究

### 1.1 权限控制系统 (Permission Control)

#### 官方文档来源
- [Configure permissions - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Agent SDK reference - TypeScript - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/typescript)

#### 权限模式 (Permission Modes)

SDK 提供 4 种权限模式：

| 模式 | 行为 | 使用场景 |
|------|------|----------|
| `default` | 所有工具调用都需要通过权限回调 | 交互式开发，需要完全控制 |
| `accept_edits` | 自动允许编辑操作，其他需要批准 | 减少编辑操作的确认提示 |
| `plan` | Claude 创建执行计划，需要用户批准 | 需要审查和验证执行步骤 |
| `bypassPermissions` | **自动批准所有工具调用**（hooks 仍可阻止） | CI/CD、容器化环境等受控场景 |

#### 重要：bypassPermissions 的安全要求

**官方文档明确指出**：

> "The bypassPermissions mode auto-approves all tool uses without prompts (though hooks still execute and can block operations if needed), and should be used with extreme caution as Claude has full system access in this mode, only in controlled environments where you trust all possible operations."

**强制配置要求**：

使用 `bypassPermissions` 模式时，**必须**同时设置：

```typescript
{
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true  // ← 安全开关，防止误用
}
```

这个双重检查机制的设计目的是：
1. 防止开发者无意中绕过权限控制
2. 明确标识"我知道这是危险操作"

#### 权限规则 (Permission Rules)

在 `settings.json` 中可以定义规则，按顺序检查：

1. **Deny rules**：阻止匹配的操作（优先级最高）
2. **Allow rules**：允许匹配的操作
3. **Ask rules**：要求用户批准

**示例配置**：
```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": [
      {
        "tool": "bash",
        "commands": ["ls", "cat", "echo"]
      }
    ],
    "deny": [
      {
        "tool": "bash",
        "commands": ["rm -rf", "dd"]
      }
    ]
  }
}
```

**注意**：
- 官方文档说明 `bypassPermissions` 会绕过权限检查
- 因此 allow/deny 规则不应作为共享容器的唯一安全边界

### 1.2 沙盒机制 (Sandboxing)

#### 官方文档来源
- [Sandboxing - Claude Code Docs](https://code.claude.com/docs/en/sandboxing)
- [Securely deploying AI agents - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)
- [GitHub - anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)

#### 沙盒设计目标

**传统权限控制的问题**：
- **审批疲劳**：频繁点击"批准"会让用户降低警惕
- **生产力降低**：频繁打断开发流程
- **自主性受限**：Claude 无法高效独立工作

**沙盒的解决方案**：
1. **明确边界**：预先定义可访问的目录和网络主机
2. **减少权限提示**：沙盒内的安全命令无需批准
3. **保持安全性**：超出沙盒的访问尝试会立即通知
4. **增强自主性**：Claude 在限制内可以更自由地工作

#### 技术实现

**OS 级别隔离**：

| 平台 | 技术 | 说明 |
|------|------|------|
| **Linux** | bubblewrap (bwrap) | 使用 namespace 隔离 + seccomp BPF 过滤系统调用 |
| **macOS** | sandbox-exec | 使用 Seatbelt 沙盒机制 |

**网络隔离**：
- 使用独立的 network namespace（Linux）
- 通过 Unix socket 和 socat 路由流量
- 内置代理服务器过滤域名

**文件系统隔离**：
- 默认：只能读写当前工作目录及其子目录
- 默认：可读取整个计算机（除拒绝的目录）
- 可配置：自定义允许/拒绝路径

#### 官方沙盒运行时

**NPM 包**：`@anthropic-ai/sandbox-runtime`

**安装和使用**：
```bash
# 全局安装
npm install -g @anthropic-ai/sandbox-runtime

# 沙盒化运行命令
npx @anthropic-ai/sandbox-runtime <command-to-sandbox>
```

**系统依赖（Linux）**：
- bubblewrap (bwrap)
- socat
- ripgrep

**集成到 Agent SDK**：
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = await query({
  prompt: userMessage,
  options: {
    tools: { type: 'preset', preset: 'claude_code' },
    // 启用官方 sandbox（SDK 使用 sandbox 配置，而不是 tools.sandbox）
    sandbox: { enabled: true },
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
  },
});
```

#### 安全收益

**防护能力**：
- ✅ 防止修改系统文件（`/bin/`, `~/.bashrc` 等）
- ✅ 防止数据外泄到未授权域名
- ✅ 防止下载恶意脚本
- ✅ 防止权限提升攻击
- ✅ 所有越界尝试都会被 OS 级别阻止并通知

**安全局限性（官方承认）**：

1. **网络沙盒限制**：
   - 只过滤域名，不解密 HTTPS 流量
   - 用户需要确保只允许信任的域名

2. **Unix Socket 权限提升**：
   - 允许访问 `/var/run/docker.sock` 会暴露宿主机
   - 需要谨慎配置 unix socket 权限

3. **文件系统权限提升**：
   - 过度宽松的写权限可能导致攻击
   - 允许写入 `$PATH` 中的目录或配置文件很危险

4. **Linux 嵌套沙盒**：
   - `enableWeakerNestedSandbox` 模式在 Docker 内运行时会**显著削弱安全性**
   - 只应在有其他隔离机制时使用

---

## 2. 项目当前实现分析

> **状态更新**：当前阶段仅修复工具可用性（bash/rg + 路径说明）。安全边界（canUseTool/hooks、egress、sandbox）暂未启用。

### 2.1 Dockerfile 分析

**文件路径**: `constructa-starter/Dockerfile`

#### 阶段 1：构建 (Build)

```dockerfile
FROM node:22-alpine AS builder

# 安装基础依赖
RUN apk add --no-cache libc6-compat ca-certificates

# 设置 CLAUDE_SESSIONS_ROOT
ENV CLAUDE_SESSIONS_ROOT=/data/users

# 构建应用
RUN pnpm run build
```

**关键发现**：
- ✅ 使用 Alpine Linux 基础镜像（轻量级）
- ✅ 提前设置 `CLAUDE_SESSIONS_ROOT` 环境变量
- ⚠️ **未安装 bubblewrap 或其他沙盒依赖**

#### 阶段 2：运行时 (Runtime)

```dockerfile
FROM node:22-alpine AS runner

# ⭐ 关键：安装 bubblewrap + bash + ripgrep
RUN apk add --no-cache libc6-compat ca-certificates bubblewrap bash ripgrep

# 创建用户会话目录
RUN mkdir -p /data/users && chown -R nodejs:nodejs /data/users

# 非root用户运行
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# 暴露端口
EXPOSE 5000 3001

# 环境变量
ENV CLAUDE_SESSIONS_ROOT=/data/users
```

**关键发现**：
- ✅ **已安装 bubblewrap**（第 42 行）
- ✅ 创建独立的用户会话目录（`/data/users`）
- ✅ 使用非 root 用户运行（nodejs:1001）
- ✅ 设置 `CLAUDE_SESSIONS_ROOT` 环境变量
- ✅ **已安装 bash 与 ripgrep**（修复 Bash/Grep 工具依赖）

### 2.2 docker-compose.yml 分析

**文件路径**: `constructa-starter/docker-compose.yml`

#### 环境变量配置

```yaml
environment:
  # Claude Agent SDK 配置
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:?}
  ANTHROPIC_BASE_URL: ${ANTHROPIC_BASE_URL:-}
  ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-}
  CLAUDE_SESSIONS_ROOT: /data/users

  # ⭐ 关键配置：沙盒开关（默认关闭）
  SANDBOX_ENABLED: ${SANDBOX_ENABLED:-false}

  # 结构化输出开关（默认关闭）
  ENABLE_STRUCTURED_OUTPUTS: ${ENABLE_STRUCTURED_OUTPUTS:-false}
```

**关键发现**：
- ✅ 正确配置 `CLAUDE_SESSIONS_ROOT`
- ⚠️ **`SANDBOX_ENABLED` 默认为 `false`**（当前未接线使用）
- ⚠️ **没有使用官方的 `@anthropic-ai/sandbox-runtime` 包**

#### Volume 持久化

```yaml
volumes:
  claude-sessions:  # Claude Agent session storage (persists across container restarts)
```

**关键发现**：
- ✅ 会话数据持久化（容器重启不丢失）
- ✅ 使用 Docker volume 管理数据

### 2.3 ws-query-worker.mjs 分析

**文件路径**: `constructa-starter/ws-query-worker.mjs`

#### SDK 调用配置

```javascript
const stream = query({
  prompt,
  options: {
    cwd: config.cwd,
    model: config.model,

    // ⭐ 关键配置：权限模式
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,

    // 启用项目 skills 加载
    settingSources: ['project'],

    // 使用 claude_code 预设工具集
    tools: { type: 'preset', preset: 'claude_code' },

    // 自定义 system prompt
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: workspaceInstructions,
    },

    // 结构化输出（可选）
    ...(useStructuredOutputs && {
      outputFormat: {
        type: 'json_schema',
        schema: artifactJsonSchema,
      },
    }),

    // 会话恢复
    ...(sdkResumeId && { resume: sdkResumeId }),
  },
});
```

**关键发现**：
- ✅ 正确使用 `permissionMode: 'bypassPermissions'`
- ✅ 正确设置 `allowDangerouslySkipPermissions: true`
- ✅ 使用 `claude_code` 工具预设（包含 Bash、Glob、Read、Write 等）
- ❌ **未配置 `sandbox: { enabled: true }`**
- ❌ **未使用官方的 `@anthropic-ai/sandbox-runtime`**
- ⚠️ **依赖 Docker 容器本身作为隔离机制**（而非 OS 级沙盒）

#### 工作目录配置

```javascript
const config = {
  model: process.env.ANTHROPIC_MODEL,
  cwd: process.env.WORKER_CWD || process.cwd(),
};
```

**关键发现**：
- ✅ **WebSocket 模式下，`WORKER_CWD` 由 ws-server 设置为会话级工作目录**
  - 实际路径：`/data/users/{userId}/sessions/{sessionId}/workspace`
- ⚠️ **只有在“单独运行 worker 进程”时才会回落到 `/app`**
- ✅ **通过工作目录下的 `.claude` 软链接，`settingSources: ['project']` 能读取用户技能**

### 2.4 ws-server.mjs 分析

**文件路径**: `constructa-starter/ws-server.mjs`

#### 会话管理

```javascript
const SESSIONS_ROOT = process.env.CLAUDE_SESSIONS_ROOT || '/data/users';

// 获取用户级 CLAUDE_HOME
const claudeHome = getClaudeHome(ws.userId);
await ensureDirExists(claudeHome);

// 获取会话级工作目录
const workspacePath = getSessionWorkspace(ws.userId, workspaceSessionId);
await ensureDirExists(workspacePath);

// 建立 .claude 软链接，确保技能/配置可被 SDK 读取
await ensureClaudeSymlink(workspacePath, claudeHome);
```

**关键发现**：
- ✅ 正确实现用户隔离（每个用户独立的 `CLAUDE_HOME`）
- ✅ 会话级工作目录隔离（每个会话独立 `workspace`）
- ✅ 使用 `.claude` 软链接让 `settingSources: ['project']` 生效

#### Worker 进程环境变量传递

```javascript
const workerEnv = {
  ...process.env,
  WORKER_CWD: workspacePath,  // 会话级工作目录
  CLAUDE_HOME: claudeHome,
  HOME: claudeHome,           // 让 SDK 内部 homedir() 指向用户目录
  // ... 其他配置
};

const worker = spawn('node', [WORKER_PATH], {
  env: workerEnv,
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

**关键发现**：
- ✅ `WORKER_CWD` 明确传递为会话级工作目录
- ✅ `CLAUDE_HOME` 与 `HOME` 同步为用户目录
- ⚠️ 若直接运行 `ws-query-worker.mjs`（绕过 ws-server），仍会回落到 `/app`

---

## 3. 匹配度对比分析

### 3.1 权限控制实现对比

| 维度 | 官方推荐 | 项目实现 | 匹配度 | 说明 |
|------|---------|---------|--------|------|
| **权限模式** | `bypassPermissions` + `allowDangerouslySkipPermissions: true` | ✅ 已实现 | 100% | 完全符合官方要求 |
| **使用场景** | 仅限受控环境（容器、CI/CD） | ✅ Docker 容器 | 100% | 符合官方要求 |
| **权限规则** | 在 `settings.json` 中定义 allow/deny/ask 规则 | ❌ 未实现 | 0% | **缺少细粒度控制** |
| **权限回调** | 可通过 `canUseTool` 回调自定义 | ❌ 未实现 | 0% | **缺少动态权限控制** |

**结论**：
- ✅ 基础权限模式配置正确
- ❌ **缺少细粒度的权限规则定义**
- ❌ **所有工具调用都被无差别批准**（没有 allow/deny 规则）

### 3.2 沙盒实现对比

| 维度 | 官方推荐 | 项目实现 | 匹配度 | 说明 |
|------|---------|---------|--------|------|
| **沙盒运行时** | 使用 `@anthropic-ai/sandbox-runtime` | ❌ 未使用 | 0% | **未使用官方沙盒** |
| **系统依赖** | 安装 bubblewrap、socat、ripgrep | ⚠️ bubblewrap + ripgrep + bash | 67% | 缺少 socat |
| **bash 工具** | 需要标准 POSIX shell（/bin/bash） | ✅ /bin/bash | 100% | bash 工具可用 |
| **网络隔离** | 使用内置代理 + Unix socket | ❌ 未实现 | 0% | **无网络隔离** |
| **文件系统隔离** | bubblewrap namespace 隔离 | ⚠️ Docker 容器级别 | 50% | 使用 Docker 容器而非 OS 级沙盒 |
| **配置选项** | `sandbox: { enabled: true }` | ❌ 未配置 | 0% | **未启用 SDK 沙盒** |

**结论**：
- ❌ **项目没有使用官方的沙盒机制**
- ⚠️ 依赖 Docker 容器作为唯一的隔离层
- ❌ **缺少网络隔离**
- ✅ bash 工具已可运行（/bin/bash 已安装）

### 3.3 隔离机制对比

| 维度 | 官方沙盒 | 项目实现（Docker） | 对比 |
|------|----------|-------------------|------|
| **文件系统隔离** | bubblewrap namespace（进程级） | Docker 容器（容器级） | Docker 更强，但粒度更粗 |
| **网络隔离** | 独立 network namespace + 代理 | 无特殊网络隔离 | **官方方案更细粒度** |
| **进程隔离** | 沙盒进程可被限制 | 容器内所有进程共享限制 | **官方方案更灵活** |
| **越界检测** | OS 级别阻止 + 通知 | 依赖容器边界 | 官方方案更实时 |
| **嵌套沙盒** | 支持（但会削弱安全性） | Docker 内运行应用 | **两者都适用，但官方有警告** |

**结论**：
- ✅ Docker 容器提供了**基础的**隔离
- ❌ **缺少细粒度的、进程级别的隔离**
- ❌ **无法实现"沙盒内自动批准，沙盒外需批准"的差异化权限策略**

### 3.4 工作目录和 CLAUDE_HOME 对比

| 概念 | 官方文档 | 项目实现 | 匹配度 |
|------|---------|---------|--------|
| **CLAUDE_HOME** | 存储用户配置、会话数据、skills | `/data/users/{userId}`（用户根目录，`.claude/` 在其下） | ✅ 正确 |
| **cwd (工作目录)** | 执行命令的目录，通常是项目根目录 | `/data/users/{userId}/sessions/{sessionId}/workspace`（WS 模式）；单独启动 worker 才会回落到 `/app` | ✅/⚠️ |
| **会话隔离** | 每个会话独立的工作目录 | ✅ 会话级 `workspace` 已实现 | ✅ 正确 |
| **工作空间隔离** | 每个会话独立的工作目录 | ✅ 逻辑隔离存在，但 `bypassPermissions` 下可用绝对路径越界 | ⚠️ 需补权限边界 |

**关键问题**：
- **默认工作目录是会话级 workspace，而非项目根目录**
  - 若预期检索项目源码，需要显式使用绝对路径 `/app` 或传入 `path` 参数
- **共享容器 + bypassPermissions 会让绝对路径访问变成“跨租户通道”**
  - 需要额外的路径白名单、网络 egress 控制或更强的隔离层

---

## 4. 当前问题诊断

### 4.1 Bash 工具失败分析

**错误信息**：
```
No suitable shell found.
Claude CLI requires a Posix shell environment.
```

**根本原因**：

1. **容器中没有 `/bin/bash`（已修复）**
   ```
   /bin/sh -> /bin/busybox    # ✅ 存在
   /bin/bash                  # ✅ 已安装
   ```

2. **Claude Agent SDK 的 Bash 工具硬编码要求 `/bin/bash`**
   - 这可能是因为 bash 的功能比 sh 更丰富
   - 或者 SDK 依赖 bash 特有的语法

3. **Alpine Linux 默认使用 busybox sh**
   - Alpine 为轻量级，不包含完整的 bash
   - 项目此前未安装 bash（已修复）

**是否是预期行为？**

- ❌ **不是预期行为**
- 官方的 `claude_code` 工具预设包含 Bash 工具
- 项目配置了 `tools: { preset: 'claude_code' }`，说明**期望使用 Bash 工具**

**为什么之前没发现？**

可能的原因：
1. 测试时主要使用 Glob、Read、Write 等工具
2. Bash 工具失败后，Claude 会尝试其他工具完成任务
3. 错误信息被忽略或未详细查看日志

### 4.2 Glob 工具 "No files found" 分析

**观察到的行为**：
```
Glob: .claude/skills/**/*
Result: No files found
```

**根本原因分析**：

#### 原因A：默认工作目录是会话级 workspace（而非项目根目录）

**Worker 当前工作目录**：
```
/data/users/{userId}/sessions/{sessionId}/workspace/
```

**结果**：
- 会话 workspace 初始通常是空目录
- 在 workspace 内执行 `glob` 会得到 “No files found”

**解决方式**：
- 如果要查找项目源码，使用 `glob` 的 `path` 参数指向 `/app`
- 或在 system prompt 中提示使用绝对路径

#### 原因B：`.claude` 软链接目标尚未创建

**软链接结构**：
```
{workspace}/.claude -> /data/users/{userId}/.claude
```

**常见情况**：
- 如果用户还未启用技能，`/data/users/{userId}/.claude/skills` 可能不存在
- `glob .claude/skills/**/*` 会返回空

**验证**：
```bash
ls -la /data/users/{userId}/.claude
ls -la /data/users/{userId}/.claude/skills
```

#### 原因C：误以为 cwd=项目根目录

**常见误用**：
- 在 workspace 内直接执行 `glob **/*.ts`，期待扫描 `/app`
- 实际只会扫描当前会话 workspace

**建议**：
- 明确区分 “会话 workspace” 与 “项目源码目录”
- 需要扫描项目源码时，显式指定 `path: /app`

### 4.3 Grep 工具不可用分析（已修复）

**关键事实**：
- SDK 的 Grep 工具底层调用 `ripgrep (rg)`，不是 `/bin/grep`
- `sdk-tools.d.ts` 中明确标注了 `rg PATH`、`rg --glob` 等参数语义

**最可能原因**：
1. **容器内没有可用的 `rg`**
   - Alpine 默认不带 `ripgrep`
2. **SDK 内置 ripgrep 与 Alpine (musl) 不兼容**
   - SDK 打包的是 glibc 版本二进制或 native addon，可能无法在 musl 上运行

**验证方法**：
```bash
# 1) 验证 SDK 自带 ripgrep 是否可执行
node node_modules/@anthropic-ai/claude-agent-sdk/cli.js --ripgrep --version

# 2) 验证系统 rg（如果安装）
rg --version
```

**修复方向**：
- ✅ 已修复：在镜像中安装 `ripgrep`（Alpine: `apk add --no-cache ripgrep`）
- 稳妥修复：使用 Debian/Ubuntu 基础镜像（避免 musl 兼容问题）
- 如果启用官方 sandbox：可在 sandbox 配置中指定 `ripgrep.command`

---

## 5. 安全风险评估

### 5.1 权限控制风险

| 风险项 | 描述 | 严重性 | 缓解措施 |
|--------|------|--------|----------|
| **bypassPermissions 全开** | 官方文档说明会“bypass all permission checks”，共享容器下等价于全量工具权限 | 🔴 高 | `canUseTool`/hooks 做强制拦截 + 路径白名单 + egress 控制 |
| **缺少权限回调** | 无法在运行时动态检查权限 | 🟡 中 | 实现 `canUseTool` 回调 |
| **无网络访问控制** | 可访问任何域名 | 🔴 高 | 配置沙盒网络代理或 Docker 网络隔离 |
| **跨租户文件访问** | 共享容器内可用绝对路径访问其他用户目录 | 🔴 高 | 路径白名单 + 进程级/容器级隔离 |

### 5.2 沙盒隔离风险

| 风险项 | 描述 | 严重性 | 缓解措施 |
|--------|------|--------|----------|
| **缺少 OS 级沙盒** | 只有 Docker 容器隔离，没有进程级隔离 | 🟡 中 | 使用官方 `@anthropic-ai/sandbox-runtime` |
| **无网络隔离** | 可访问容器网络内的任何服务 | 🟡 中 | 配置 Docker 网络限制或使用沙盒代理 |
| **工作目录可越界** | 已有会话级 workspace，但可用绝对路径越界访问 | 🟠 低-中 | 结合 `canUseTool`/hooks 限制路径 |
| **bash 工具不可用** | 限制了 Claude 的能力 | ✅ 已缓解 | 已安装 bash |

### 5.3 Docker 容器风险

| 风险项 | 描述 | 严重性 | 缓解措施 |
|--------|------|--------|----------|
| **以 nodejs 用户运行** | ✅ 非 root，降低权限 | ✅ 已缓解 | - |
| **bubblewrap 已安装** | ✅ 可以使用沙盒 | ✅ 已缓解 | - |
| **缺少 bash** | ✅ Bash 工具可用 | ✅ 已缓解 | 已安装 bash |
| **容器间网络未隔离** | 容器可互相访问 | 🟡 中 | 使用 Docker network 隔离 |

---

## 6. 基于 Docker 的“最小改动”方案（仅修复工具可用性）

> **本章目标**: 针对已在 Docker 中运行的项目，用最小改动恢复 bash/grep/glob 工具可用性。
>
> **注意**: 这是“工具可用性修复”，不是“安全隔离方案”。共享容器场景下仍需额外权限边界与网络控制。

### 6.1 方案概述

**背景**：
- 项目运行在 Dokploy 管理的 Docker 容器中（多租户共享容器）
- Docker 不是租户边界，不能替代权限与网络隔离
- 当前问题（已修复）：bash/grep/glob 工具不可用或表现异常

**核心思路**：
1. ✅ 安装 bash（恢复 Bash 工具）
2. ✅ 确保 ripgrep 可用（恢复 Grep 工具）
3. ✅ 明确 workspace vs 项目目录的路径边界（避免 Glob 误判）

**方案复杂度对比**：

| 方案 | 复杂度 | 代码改动 | 说明 |
|------|--------|----------|------|
| **安装 bash + ripgrep**（推荐） | 🟢 极简 | 1-2 行 | 只需改 Dockerfile |
| 使用官方沙盒 | 🔴 复杂 | 大幅改动 | 需安装 socat、ripgrep，修改 SDK 配置 |
| 禁用 Bash/Grep 工具 | 🟡 中等 | 修改工具配置 | 限制 Claude 能力，不推荐 |
| 会话级工作目录 | 🟡 中等 | 修改 ws-server | **项目已实现**（可作为基线） |

### 6.2 具体实施步骤

#### 步骤 1：修改 Dockerfile 安装 bash + ripgrep

**文件**: `constructa-starter/Dockerfile`

**位置**: 第 42 行（Runtime 阶段）

**修改前**：
```dockerfile
# Install runtime dependencies including bubblewrap for sandbox-runtime
RUN apk add --no-cache libc6-compat ca-certificates bubblewrap
```

**修改后**：
```dockerfile
# Install runtime dependencies including bubblewrap for sandbox-runtime
# ⭐ 添加 bash + ripgrep（恢复 Bash/Grep 工具）
RUN apk add --no-cache libc6-compat ca-certificates bubblewrap bash ripgrep
```

**改动**: 添加 `bash` 与 `ripgrep`

**补充说明**：
- 若 Alpine + musl 仍无法运行 SDK 自带 ripgrep，建议改用 Debian/Ubuntu 基础镜像

#### 步骤 2：调整 system prompt（可选，推荐）

**文件**: `constructa-starter/ws-query-worker.mjs`

**位置**: 第 100-120 行（workspaceInstructions 定义）

**修改目的**：告诉 Claude 用户数据的位置，避免 Glob 找不到文件

**修改前**：
```javascript
const workspaceInstructions = `

IMPORTANT - Workspace File Operations:
You are working in an isolated workspace directory at: ${config.cwd}

When creating, writing, or editing files:
- ALWAYS use relative paths (e.g., "index.html", "styles.css", "src/App.jsx")
- NEVER use absolute paths like "/tmp/file.html" or "/home/user/file.html"
- Files will be created relative to the current working directory
- The workspace is isolated for this conversation session

Example good file paths:
- "index.html" (creates in workspace root)
- "src/components/Header.tsx" (creates in subdirectory)
- "styles/main.css" (creates in subdirectory)

Example bad file paths:
- "/tmp/index.html" (DON'T use /tmp)
- "/home/user/index.html" (DON'T use absolute paths)
- "../outside/file.html" (DON'T go outside workspace)`;
```

**修改后**（添加用户数据路径说明）：
```javascript
const workspaceInstructions = `

IMPORTANT - Workspace File Operations:
You are working in an isolated workspace directory at: ${config.cwd}

When creating, writing, or editing files:
- ALWAYS use relative paths (e.g., "index.html", "styles.css", "src/App.jsx")
- NEVER use absolute paths like "/tmp/file.html" or "/home/user/file.html"
- Files will be created relative to the current working directory
- The workspace is isolated for this conversation session

⭐ NEW: Accessing User Skills and Data:
- User skills are located in: ${process.env.CLAUDE_HOME}/.claude/skills/
- To search for skills, use absolute paths, e.g., "${process.env.CLAUDE_HOME}/.claude/skills/**/*"
- Project source is in: /app (read-only unless explicitly allowed)
- Workspace is in: ${config.cwd}

Example good file paths:
- "index.html" (creates in workspace root)
- "src/components/Header.tsx" (creates in subdirectory)
- "styles/main.css" (creates in subdirectory)
- "${process.env.CLAUDE_HOME}/.claude/skills/**/*.md" (search user skills)
- "${process.env.CLAUDE_HOME}/.claude/skills/user/**/*.md" (search user uploaded skills)
- "/app/src/**/*.ts" (search project source files)

Example bad file paths:
- "/tmp/index.html" (DON'T use /tmp)
- "/home/user/index.html" (DON'T write outside workspace)
- "../outside/file.html" (DON'T go outside workspace)
- ".claude/skills/**/*" (DON'T use relative path for skills - use absolute path)`;
```

**关键改动**：
1. 添加了 "Accessing User Skills and Data" 章节
2. 明确告诉 Claude 用户数据的位置：`${process.env.CLAUDE_HOME}/.claude/skills/`
3. 提供了使用绝对路径查找 skills 的示例

### 6.3 验证和部署

#### 验证 bash / ripgrep 可用

```bash
# 重新构建镜像
docker-compose down
docker-compose build app

# 启动服务
docker-compose up -d

# 验证 bash
docker exec ex0-app /bin/bash --version
# 预期输出: GNU bash version 5.x.x

# 验证 ripgrep（Grep 工具依赖 rg）
docker exec ex0-app rg --version
# 预期输出: ripgrep 13.x.x

# 验证 SDK 自带 ripgrep（可选）
docker exec ex0-app node /app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js --ripgrep --version

# 验证其他工具
docker exec ex0-app ls -la /bin/sh /bin/bash /bin/rg
# 预期输出:
# lrwxrwxrwx    1 root     root            12 ...  /bin/sh -> /bin/busybox
# -rwxr-xr-x    1 root     root        700KB ...  /bin/bash
# -rwxr-xr-x    1 root     root        1.5MB ...  /bin/rg
```

#### 测试工具可用性

在 Claude Agent UI 中测试：

**测试 Bash**：
```
使用 bash 工具列出当前目录的文件
```

**测试 Grep**：
```
使用 grep 在 package.json 中搜索 "version"
```

**测试 Glob**：
```
使用 glob 查找所有 .md 文件：*.md
```

**测试访问用户 Skills**（如果完成了步骤 2）：
```
使用 glob 查找用户上传的所有技能文件
```

### 6.4 为什么这个方案"最简单"

#### 不需要额外的改动

| 功能 | 是否需要改动 | 原因 |
|------|-------------|------|
| **Bash 工具** | ✅ 需要安装 bash | 容器只有 /bin/sh (busybox) |
| **Grep 工具** | ✅ 需要 ripgrep | SDK Grep 调用 `rg` |
| **Glob 工具** | ⚠️ 可能需要路径说明 | workspace 默认为空 |
| **权限控制** | ⚠️ 不能省略 | bypassPermissions 会绕过权限检查 |
| **沙盒隔离** | ⚠️ 视场景而定 | 共享容器场景仍建议 |
| **网络隔离** | ⚠️ 需要补 | Docker 网络不等于 egress 限制 |

#### Docker 隔离 vs OS 级沙盒

**Docker 容器隔离的边界**：
- ✅ 隔离宿主机资源
- ❌ 不是租户隔离：同一容器内的会话/用户仍共享文件系统与网络

**官方沙盒的额外收益**（共享容器时更有价值）：
- 进程级隔离（容器内更细粒度）
- 网络域名过滤（限制 egress）
- 越界访问即时拦截/告警

### 6.5 潜在问题和解决方案

#### 问题 1：Glob 仍然找不到文件

**原因**: Glob 默认在会话 workspace 查找，而不是 `/app`

**解决方案**: 使用 `path: /app` 或在 system prompt 中明确路径边界

#### 问题 2：Bash 工具执行权限错误

**原因**: 以 nodejs 用户运行，某些操作需要 root 权限

**解决方案**: 这是预期行为，不应给 Agent root 权限

#### 问题 3：Grep 工具仍不可用（已缓解）

**原因**: ripgrep 在 Alpine/musl 下不可执行或未安装

**解决方案**：
- ✅ 已安装 `ripgrep`，验证 `rg --version`
- 长期：使用 Debian/Ubuntu 基础镜像或启用 sandbox 并指定 `ripgrep.command`

#### 问题 4：跨租户绝对路径访问

**原因**: bypassPermissions + 共享容器允许访问 `/data/users/{otherUserId}` 或 `/app`

**解决方案**：
- 强制 `canUseTool`/hooks 做路径白名单
- 或提升隔离边界（每租户容器/VM）

### 6.6 方案总结

**最小改动清单**：
- ✅ 修改 Dockerfile（1-2 行代码）：添加 `bash` + `ripgrep`
- ⚠️ 修改 ws-query-worker.mjs（可选）：明确 workspace 与 `/app` 路径

**预期效果**：
- ✅ Bash 工具正常运行
- ✅ Grep 工具正常运行（依赖 `rg`）
- ✅ Glob 工具可用（依赖正确的 `path`/workspace）
- ✅ Claude 能访问用户 skills（依赖 `.claude` 软链接）

**不支持的特性**（预期行为）：
- ❌ 租户级安全隔离（共享容器仍需额外权限边界）
- ❌ 网络域名过滤（需额外配置）
- ❌ OS 级进程沙盒（未启用）

---

## 7. 其他改进建议（可选）

> **注意**: 本章包含的改进方案优先级低于第 6 章的"基于 Docker 隔离的最简单解决方案"。
>
> 建议先完成第 6 章的方案，再考虑本章的改进。

### 7.1 中期改进（优先级：中）

#### 建议 1：会话级工作目录隔离（✅ 已实现）

**目标**: 每个会话有独立的工作空间

**实现方案**：
```javascript
// ws-server.mjs
const sessionWorkspace = path.join(
  this.claudeHome,
  'sessions',
  workspaceSessionId,
  'workspace'
);
await mkdir(sessionWorkspace, { recursive: true });

// 传递给 Worker
workerEnv.WORKER_CWD = sessionWorkspace;
```

**目录结构**：
```
/data/users/
  └─ {userId}/
      ├─ .claude/
      │   ├─ skills/
      │   └─ settings.json
      └─ sessions/
          └─ {sessionId}/
              └─ workspace/
                  ├─ file1.html
                  └─ src/
                      └─ App.jsx
```

**补充**：
- 需在 `workspace/.claude` 建立软链接，指向 `{CLAUDE_HOME}/.claude`

#### 建议 2：添加权限规则

**注意**：
- 官方文档说明 `bypassPermissions` 会绕过权限检查
- 若继续使用 `bypassPermissions`，建议改用 `canUseTool`/hooks 做强制拦截

创建 `.claude/settings.json`：
```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": [
      {
        "tool": "bash",
        "commands": ["ls", "cat", "echo", "pwd", "cd"]
      },
      {
        "tool": "read",
        "paths": ["/app/**", "/data/users/**"]
      },
      {
        "tool": "write",
        "paths": ["/app/**", "/data/users/**"]
      }
    ],
    "deny": [
      {
        "tool": "bash",
        "commands": ["rm -rf /", "dd if=/dev/zero"]
      },
      {
        "tool": "write",
        "paths": ["/etc/**", "/bin/**", "/usr/**"]
      }
    ]
  }
}
```

#### 建议 3：修复 Glob 工作目录问题

**选项A：使用绝对路径**
```javascript
// 在前端或 SDK 调用时指定绝对路径
glob: {
  pattern: '**/*.ts',
  path: '/app'
}
```

**选项B：在 system prompt 中显式区分路径**
- workspace（相对路径）
- 项目源码（`/app/**`）
- 用户技能（`${CLAUDE_HOME}/.claude/skills/**`）

### 7.2 中期改进（优先级：中）

#### 建议 4：集成官方沙盒运行时

**步骤 1：安装依赖**
```dockerfile
# Dockerfile
RUN apk add --no-cache \
  libc6-compat \
  ca-certificates \
  bubblewrap \
  socat \
  ripgrep \
  bash
```

**步骤 2：在代码中启用沙盒**
```javascript
// ws-query-worker.mjs
const stream = query({
  prompt,
  options: {
    tools: { type: 'preset', preset: 'claude_code' },
    sandbox: { enabled: true },  // ← 启用官方沙盒
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
  },
});
```

**注意事项**：
- 沙盒在 Docker 内运行会触发嵌套沙盒模式
- 需要设置 `enableWeakerNestedSandbox: true`（会削弱安全性）
- 或使用 privileged Docker 容器（但会降低容器安全性）

#### 建议 5：添加网络隔离

**选项A：使用沙盒代理**
```javascript
// 配置允许的域名
const stream = query({
  options: {
    sandbox: {
      network: {
        allowedDomains: ['api.anthropic.com', 'github.com'],
      },
    },
  },
});
```

**选项B：使用 Docker 网络**
```yaml
# docker-compose.yml
services:
  app:
    networks:
      - isolated_network
    # 禁止访问外网（通过配置代理）
```

### 6.3 长期改进（优先级：低）

#### 建议 6：实现细粒度审计日志

```javascript
// ws-server.mjs
function logToolUsage(sessionId, tool, params, result) {
  await db.insert(toolUsageLogs).values({
    sessionId,
    userId: session.userId,
    tool,
    params: JSON.stringify(params),
    result: JSON.stringify(result),
    timestamp: new Date(),
  });
}
```

#### 建议 7：实现动态权限回调

```javascript
// ws-query-worker.mjs
const stream = query({
  options: {
    canUseTool: async (tool, params) => {
      // 检查用户权限
      const userPermissions = await getUserPermissions(userId);

      // 检查资源访问权限
      if (tool === 'read') {
        return checkReadPermission(userId, params.path);
      }

      // 动态决策
      return userPermissions.allowedTools.includes(tool);
    },
  },
});
```

---

## 7. 总结

### 7.1 当前实现的优点

✅ **正确的权限模式配置**
- 正确使用 `bypassPermissions` + `allowDangerouslySkipPermissions: true`
- 符合官方推荐做法

✅ **用户数据隔离**
- 每个用户有独立的 `CLAUDE_HOME`
- 使用 sanitizeUserId 防止路径遍历

✅ **Docker 容器隔离**
- 使用非 root 用户运行
- 持久化用户会话数据

✅ **bubblewrap 已安装**
- 为将来启用官方沙盒做好准备

### 7.2 当前实现的问题

✅ **Bash 工具已修复**
- 已安装 `/bin/bash`

✅ **Grep 工具已修复**
- 已安装 `ripgrep (rg)`；如遇 musl 兼容问题可换基础镜像

❌ **Glob 结果易误判**
- 默认 cwd 是会话 workspace（通常为空）
- 需要显式指定 `path: /app` 或确认 `.claude` 软链接目标存在

❌ **bypassPermissions 的安全边界缺失**
- 官方说明会 bypass 所有权限检查
- 共享容器场景需要额外拦截与 egress 控制

❌ **未使用官方沙盒**
- 缺少进程级隔离和网络隔离

### 7.3 官方推荐的实现 vs 项目实现

| 维度 | 官方推荐 | 项目实现 | 差距 |
|------|---------|---------|------|
| **权限模式** | bypassPermissions + 细粒度规则 | 只有 bypassPermissions | ⚠️ 缺少规则 |
| **沙盒** | @anthropic-ai/sandbox-runtime | Docker 容器 | ⚠️ 不同的隔离层级 |
| **bash 工具** | 需要 /bin/bash | 只有 /bin/sh | ❌ 不兼容 |
| **网络隔离** | 沙盒代理 | 无 | ❌ 缺失 |
| **工作目录** | 会话级隔离 | ✅ 已实现会话级 workspace | ✅ 基本一致 |

### 7.4 匹配度评分

| 维度 | 得分 | 满分 | 评价 |
|------|------|------|------|
| **权限控制基础** | 2/2 | 100% | ✅ 完全符合 |
| **权限规则** | 0/2 | 0% | ❌ 未实现 |
| **沙盒隔离** | 1/4 | 25% | ⚠️ 只有容器隔离 |
| **bash 工具** | 1/1 | 100% | ✅ 可运行 |
| **网络隔离** | 0/1 | 0% | ❌ 未实现 |
| **工作目录隔离** | 2/2 | 100% | ✅ 会话级 workspace |
| **总分** | 6/12 | 50% | ⚠️ **基础正确，但缺少安全边界** |

### 7.5 关键发现

1. **项目的隔离策略与官方推荐不同**
   - 官方：OS 级沙盒（bubblewrap）+ 进程隔离
   - 项目：Docker 容器隔离 + 用户数据隔离 + 会话 workspace

2. **这不是"错误"，而是不同的设计选择**
   - Docker 适合作为基础设施隔离，但不是共享容器内的租户边界

3. **当前的主要问题是实现不完整**
   - Bash/Grep 工具依赖已补齐（需持续验证兼容性）
   - Glob 依赖正确的路径边界与 `.claude` 软链接
   - 共享容器下缺少强制权限边界（bypassPermissions 无保护）

4. **改进方向**
   - 短期：修复 Bash/Grep 工具、明确 workspace 与 /app
   - 中期：加 `canUseTool`/hooks + egress 控制
   - 长期：评估 OS 级沙盒与更强隔离边界

### 7.6 最终建议

**推荐方案（分阶段）**：

**Phase 1：修复当前问题**（1-2天）
1. ✅ 安装 bash + ripgrep（或改用 Debian/Ubuntu 基础镜像）
2. ✅ 明确 workspace 与 /app 的路径边界（system prompt + 指引）
3. ⏳ 增加最小权限边界（canUseTool/hook）

**Phase 2：完善隔离**（1周）
1. 增加审计日志
2. 落实网络 egress 限制
3. 逐步完善权限策略与工具限制

**Phase 3：高级特性**（可选）
1. 评估是否需要 OS 级沙盒
2. 实现动态权限回调
3. 添加网络隔离

---

## 附录

### A. 参考文档

**官方文档**：
- [Configure permissions - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Sandboxing - Claude Code Docs](https://code.claude.com/docs/en/sandboxing)
- [Securely deploying AI agents - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)
- [Agent SDK reference - TypeScript - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [GitHub - anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)

**社区资源**：
- [Making Claude Code more secure and autonomous - Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Anthropic Sandbox Runtime - AI Engineer Guide](https://aiengineerguide.com/blog/anthropic-sandbox-runtime/)

### B. 关键代码位置

| 文件 | 路径 | 关键配置 |
|------|------|----------|
| **Dockerfile** | `/constructa-starter/Dockerfile` | Runtime 依赖（bubblewrap + bash + ripgrep） |
| **docker-compose.yml** | `/constructa-starter/docker-compose.yml` | 第 213 行：SANDBOX_ENABLED=false（当前未接线） |
| **ws-query-worker.mjs** | `/constructa-starter/ws-query-worker.mjs` | 第 122-151 行：SDK 配置 |
| **ws-server.mjs** | `/constructa-starter/ws-server.mjs` | 第 30 行：SESSIONS_ROOT |
| **session.ts** | `/constructa-starter/src/claude/agent/session.ts` | 第 54-59 行：用户隔离 |

### C. 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CLAUDE_SESSIONS_ROOT` | `/data/users` | 用户会话根目录 |
| `WORKER_CWD` | `/data/users/{userId}/sessions/{sessionId}/workspace` | WS 模式下的会话工作目录 |
| `SANDBOX_ENABLED` | `false` | 沙盒开关（当前未接线） |
| `ENABLE_STRUCTURED_OUTPUTS` | `false` | 结构化输出开关 |

---

**文档版本**: v1.0
**最后更新**: 2025-01-11
**作者**: Claude (Sonnet 4.5)
