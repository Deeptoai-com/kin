# SSR 错误分析 - SignedOut/useSession 和中间件错误

> **日期**: 2026-01-14  
> **问题**: `Cannot read properties of undefined (reading 'useSession')` 和 `/health` 端点中间件错误

---

## 🔍 问题分析

### 问题 1: SignedOut/useSession 错误

**错误信息**：
```
TypeError: Cannot read properties of undefined (reading 'useSession')
at SignedOut (file:///app/.output/server/chunks/_/index-Fu4z3niS.mjs:16265:14)
```

**原因**：
- `SignedOut` 和 `SignedIn` 组件在 SSR 渲染时尝试访问 Better Auth 的 context
- 在 `Header.tsx` 中使用这些组件时，SSR 渲染期间 context 可能还没有完全初始化
- Better Auth 的 context 需要在客户端 hydration 后才能访问

**解决方案**：
将 `SignedOut` 和 `SignedIn` 组件包装在 `ClientOnly` 组件中，避免 SSR 渲染：

```tsx
<ClientOnly fallback={null}>
  <SignedOut>...</SignedOut>
  <SignedIn>...</SignedIn>
</ClientOnly>
```

---

### 问题 2: /health 端点中间件错误

**错误信息**：
```
TypeError: middleware(...).catch is not a function
error: 'TypeError: middleware(...).catch is not a function'
```

**原因**：
- `/health` 路由的 handler 返回同步的 `Response.json()`
- 全局中间件 `requestLoggerMiddleware` 期望 handler 返回 Promise
- TanStack Start 的中间件系统需要所有 handler 返回 Promise

**解决方案**：
将 handler 改为 async 函数，确保返回 Promise：

```tsx
const jsonOk = async () =>
  Response.json({ status: 'ok' }, { status: 200 });
```

---

## ✅ 已实施的修复

### 1. 修复 `Header.tsx`

**修改前**：
```tsx
<SignedOut>
  <Link to="/auth/$pathname" params={{ pathname: 'sign-in' }}>
    <Button>Sign In</Button>
  </Link>
</SignedOut>
<SignedIn>
  <Link to="/agents/claude-chat">
    <Button>Agent Chat</Button>
  </Link>
</SignedIn>
```

**修改后**：
```tsx
<ClientOnly fallback={null}>
  <SignedOut>
    <Link to="/auth/$pathname" params={{ pathname: 'sign-in' }}>
      <Button>Sign In</Button>
    </Link>
  </SignedOut>
  <SignedIn>
    <Link to="/agents/claude-chat">
      <Button>Agent Chat</Button>
    </Link>
  </SignedIn>
</ClientOnly>
```

### 2. 修复 `/health` 路由

**修改前**：
```tsx
const jsonOk = () =>
  Response.json({ status: 'ok' }, { status: 200 });
```

**修改后**：
```tsx
const jsonOk = async () =>
  Response.json({ status: 'ok' }, { status: 200 });
```

---

## 📋 验证修复

修复后，重新部署并验证：

1. **检查 SSR 错误是否消失**：
   - 查看应用日志，不应该再有 `useSession` 相关的错误
   - `Header` 组件应该能正常渲染

2. **检查 `/health` 端点**：
   ```bash
   # 应该返回 200 而不是 500
   curl http://localhost:5000/health
   ```

3. **检查应用访问**：
   - 通过域名访问应用
   - 检查是否还有其他错误

---

## ⚠️  注意事项

### 其他使用 SignedOut/SignedIn 的地方

其他路由中的 `SignedIn` 组件通常不会有问题，因为：
- 它们在受保护的路由中（有 `beforeLoad` 认证检查）
- 它们不在根布局中，SSR 渲染时可能已经通过认证检查

但如果出现问题，也可以使用相同的 `ClientOnly` 包装。

---

## 📚 相关文档

- **ClientOnly 组件**: `src/components/client-only.tsx`
- **中间件配置**: `src/utils/loggingMiddleware.tsx`
- **路由配置**: `src/routes/health.ts`

---

## 🎯 预期结果

修复后：
- ✅ 不再有 SSR hydration 错误
- ✅ `/health` 端点正常返回 200
- ✅ 应用可以正常访问
- ✅ Header 中的登录/登出按钮正常显示

---

**状态**: 问题分析和修复完成  
**最后更新**: 2026-01-14
