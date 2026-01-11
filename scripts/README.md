# 路由验证工具使用指南

## 快速开始

### 运行验证

```bash
pnpm validate-routes
```

## 验证结果解读

验证脚本会扫描 `src/routes/` 目录下的所有路由文件，检查是否符合 TanStack Start 最佳实践。

### 输出示例

```
扫描路由文件...
找到 48 个路由文件

=== TanStack Start 路由验证报告 ===

src/routes/agents/skills/route.tsx
  ✓ 所有检查通过！

src/routes/api/agent-sessions/index.ts
  ✗ 禁止 REST API 路由
    检测到 REST API 路由（使用 server handlers），应使用 Server Functions
    ➜ 将路由逻辑移到 src/server/function/*.server.ts，使用 createServerFn()

=== 统计 ===
  通过: 21
  警告: 4
  错误: 25
```

## 检查规则

### 错误级别（必须修复）

| 规则 ID | 名称 | 说明 |
|--------|------|------|
| `no-rest-api-routes` | 禁止 REST API 路由 | 不使用 `server: { handlers: { GET } }` 模式 |
| `no-fetch-in-loader` | Loader 中禁止 fetch | Loader 应使用 Server Functions |
| `no-zustand-data-fetching` | 禁止在 zustand 中获取数据 | 数据应在 loader 中获取 |

### 警告级别（建议优化）

| 规则 ID | 名称 | 说明 |
|--------|------|------|
| `use-server-functions` | 推荐使用 Server Functions | 使用 `createServerFn()` 替代 `fetch()` |
| `useuseffect-for-data` | 避免 useEffect 获取数据 | 数据应在 loader 或 `useQuery` 中获取 |
| `loader-not-optimized` | Loader 应并行加载数据 | 使用 `Promise.all()` 并行加载 |

## 集成到开发流程

### 1. 提交前检查

在 `package.json` 中添加 Git hooks（可选）：

```json
{
  "scripts": {
    "precommit": "pnpm validate-routes && pnpm lint"
  }
}
```

### 2. CI/CD 集成

在 CI 流程中运行验证：

```yaml
# .github/workflows/pr.yml
- name: Validate Routes
  run: pnpm validate-routes
```

### 3. 代码审查清单

PR 描述中包含：
- [ ] 运行 `pnpm validate-routes` 无错误
- [ ] 路由数据在 loader 中获取
- [ ] 使用 Server Functions 而不是 REST API
- [ ] Loader 使用 Promise.all 并行加载数据

## 当前项目状态

运行 `pnpm validate-routes` 的结果：

```
通过: 21 个文件
警告: 4 个文件
错误: 25 个文件
```

**主要问题**：
- 25 个 `/routes/api/*` 文件使用了 REST API 模式
- 这些是旧代码，需要逐步迁移到 Server Functions

**迁移优先级**：
1. **P0 - Skills 相关**：已重构完成 ✅
2. **P1 - Agent Sessions**：`/api/agent-sessions/*`
3. **P2 - Workspace**：`/api/workspace/*`
4. **P3 - 其他 API**：`/api/chat`, `/api/threads` 等

## 常见问题

### Q: 某些 API 路由必须使用 REST 怎么办？

A: 对于外部 webhook（如 `/api/auth/polar/webhooks`），可以继续使用 REST 模式。在验证脚本中标记为例外：

```javascript
// 在规则检查中添加例外
if (filePath.includes('webhooks')) return null;
```

### Q: 健康检查接口需要保留吗？

A: 是的，健康检查、监控接口可以保留 REST 模式。验证脚本已自动排除 `fetch('/api/health')`。

### Q: 如何忽略特定文件的警告？

A: 有两种方式：
1. 修改验证脚本，在规则中添加例外
2. 修复代码，符合最佳实践

## 参考文档

- [TanStack Start 官方文档](https://tanstack.com/start/latest)
- [手动检查清单](../docs/ROUTE_VALIDATION_CHECKLIST.md)
- [CLAUDE.md - Server Functions 最佳实践](../CLAUDE.md)

## 维护说明

### 添加新规则

编辑 `scripts/validate-routes.mjs`，在 `rules.errors` 或 `rules.warnings` 中添加：

```javascript
{
  id: 'my-new-rule',
  name: '规则名称',
  check: (filePath, content) => {
    // 返回 null 表示通过
    // 返回对象表示发现问题
    return {
      message: '问题描述',
      suggestion: '修复建议'
    };
  },
}
```

### 调试规则

```bash
# 查看某个文件的详细检查过程
node scripts/validate-routes.mjs 2>&1 | grep "src/routes/example"
```

## 更新日志

- 2025-01-10: 创建路由验证工具
  - 自动扫描 48 个路由文件
  - 检测 25 个 REST API 反模式
  - 集成到 npm scripts
