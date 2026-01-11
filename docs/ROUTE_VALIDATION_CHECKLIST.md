# TanStack Start 路由验证清单

本文档提供 TanStack Start 路由的最佳实践检查清单，用于代码审查和自我检查。

## 自动化验证

### 运行验证脚本

```bash
# 使用 npm script
pnpm validate-routes

# 或直接运行
node scripts/validate-routes.mjs
```

**脚本检查内容**：
- ❌ 禁止 REST API 路由（使用 `server: { handlers }`）
- ❌ 禁止在 loader 中使用 `fetch()`
- ❌ 禁止在 zustand store 中获取数据
- ⚠️  推荐使用 Server Functions 而不是 `fetch()`
- ⚠️  避免在 `useEffect` 中获取数据
- ⚠️  Loader 应并行加载数据

---

## 手动检查清单

### 1. 路由结构

#### ✅ 正确示例

```typescript
// 数据在 loader 中获取
export const Route = createFileRoute('/posts')({
  loader: async () => {
    const posts = await getPosts();
    return { posts };
  },
  component: PostsComponent,
});
```

#### ❌ 错误示例

```typescript
// REST API 路由（已废弃）
export const Route = createFileRoute('/api/posts')({
  server: {
    handlers: {
      GET: async () => Response.json(await getPosts()),
    },
  },
});
```

**检查项**：
- [ ] 所有服务端操作使用 Server Functions (`createServerFn()`)
- [ ] 不使用 `server: { handlers: { GET/POST } }` 模式
- [ ] 不在 `/routes/api/` 下创建 REST 路由

---

### 2. 数据加载时机

#### ✅ 正确示例

```typescript
// SSR 预加载数据
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await getPost({ params });
    return { post };
  },
  component: PostDetail,
});
```

#### ❌ 错误示例

```typescript
// 在 useEffect 中获取数据（首次渲染慢）
function PostDetail() {
  const [post, setPost] = useState(null);

  useEffect(() => {
    fetch('/api/posts/123').then(r => r.json()).then(setPost);
  }, []);

  if (!post) return <Loading />;
  return <div>{post.title}</div>;
}
```

**检查项**：
- [ ] 页面初始数据在 `loader` 中获取（SSR + streaming）
- [ ] 客户端交互数据使用 `useQuery` + Server Functions
- [ ] `useEffect` 仅用于 DOM 操作/订阅，不用于数据获取

---

### 3. 并行数据加载

#### ✅ 正确示例

```typescript
loader: async () => {
  // 并行加载
  const [posts, user, categories] = await Promise.all([
    getPosts(),
    getUser(),
    getCategories(),
  ]);
  return { posts, user, categories };
}
```

#### ❌ 错误示例

```typescript
loader: async () => {
  // 串行加载（慢）
  const posts = await getPosts();
  const user = await getUser();
  const categories = await getCategories();
  return { posts, user, categories };
}
```

**检查项**：
- [ ] 多个独立数据源使用 `Promise.all()` 并行加载
- [ ] 有依赖关系的请求才串行

---

### 4. Server Functions 使用

#### ✅ 正确示例

```typescript
// src/server/function/posts.server.ts
export const getPosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    return await db.posts.findMany();
  });

export const createPost = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    title: z.string(),
    content: z.string(),
  }))
  .handler(async ({ data }) => {
    return await db.posts.create({ data });
  });
```

#### ❌ 错误示例

```typescript
// 前端直接调用 fetch
const posts = await fetch('/api/posts').then(r => r.json());
```

**检查项**：
- [ ] Server Functions 定义在 `src/server/function/*.server.ts`
- [ ] 使用 `inputValidator` 进行输入验证（Zod schemas）
- [ ] 前端使用 `useServerFn()` 或直接调用
- [ ] 不使用 `fetch('/api/...')`

---

### 5. 嵌套路由和 Outlet

#### ✅ 正确示例

```typescript
// routes/parent/route.tsx
export const Route = createFileRoute('/parent')({
  component: () => (
    <div>
      <h1>Parent Layout</h1>
      <Outlet />  {/* 渲染子路由 */}
    </div>
  ),
});

// routes/parent/child/route.tsx
export const Route = createFileRoute('/parent/child')({
  component: () => <div>Child Content</div>,
});
```

#### ❌ 错误示例

```typescript
// 父路由缺少 Outlet
export const Route = createFileRoute('/parent')({
  component: () => (
    <div>
      <h1>Parent Layout</h1>
      {/* 子路由无法显示！ */}
    </div>
  ),
});
```

**检查项**：
- [ ] 父路由包含 `<Outlet />` 渲染子路由
- [ ] 父路由自己的内容放在 `index.tsx`
- [ ] 不使用条件渲染来隐藏子路由（除非是特殊场景）

---

### 6. 类型安全

#### ✅ 正确示例

```typescript
// 类型自动推导
export const Route = createFileRoute('/posts')({
  loader: async () => {
    const posts = await getPosts();  // 返回类型: Post[]
    return { posts };
  },
  component: () => {
    const { posts } = Route.useLoaderData();  // posts: Post[]
  },
});
```

#### ❌ 错误示例

```typescript
// 手动类型定义（容易不同步）
interface PostsResponse {
  posts: Post[];
}

const response = await fetch('/api/posts');
const data: PostsResponse = await response.json();  // 运行时才能发现错误
```

**检查项**：
- [ ] 使用 Server Functions 的自动类型推导
- [ ] 不手动维护 API 类型定义
- [ ] 使用 `Route.useLoaderData()` 获取类型安全的数据

---

### 7. 认证和错误处理

#### ✅ 正确示例

```typescript
// Server Function 中统一认证
const requireUser = async () => {
  const { headers } = getRequest();
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new Error('UNAUTHORIZED');
  return session.user;
};

export const createPost = createServerFn({ method: 'POST' })
  .inputValidator(postSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();  // 统一认证
    return await db.posts.create({ data: { ...data, authorId: user.id } });
  });
```

#### ❌ 错误示例

```typescript
// 每个路由单独检查认证
export const Route = createFileRoute('/posts/create')({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: '/login' });
  },
  // ...
});
```

**检查项**：
- [ ] 认证逻辑在 Server Functions 中统一处理（`requireUser()`）
- [ ] 错误通过 `throw Error` 或 `throw redirect()` 处理
- [ ] 不在组件中手动检查认证状态

---

### 8. 环境变量安全

#### ✅ 正确示例

```typescript
// 安全：仅在服务端使用
const getApiKey = createServerOnlyFn(() => {
  return process.env.API_SECRET;
});
```

#### ❌ 错误示例

```typescript
// 危险：可能泄露到客户端 bundle
const apiKey = process.env.API_SECRET;
```

**检查项**：
- [ ] 环境变量在 Server Functions 中访问
- [ ] 不在组件中直接使用 `process.env.*`
- [ ] 敏感信息使用 `createServerOnlyFn()` 保护

---

## 常见反模式检测

### 检测命令

```bash
# 搜索可能的问题模式
grep -r "fetch('/api/" src/routes/
grep -r "server: {" src/routes/
grep -r "useEffect" src/components/ | grep "fetch"
```

### 常见问题

| 模式 | 问题 | 解决方案 |
|------|------|---------|
| `fetch('/api/...')` | 应使用 Server Functions | `createServerFn()` |
| `server: { handlers }` | 已废弃的 REST API 模式 | 移到 `server/function/*.ts` |
| `useEffect` + `fetch` | 应在 loader 中获取数据 | 使用 loader 或 `useQuery` + Server Functions |
| `await fn1(); await fn2()` | 串行加载慢 | `Promise.all([fn1(), fn2()])` |
| 手动类型定义 | 容易不同步 | 使用 Server Functions 自动推导 |

---

## 审查流程

### 新代码提交前

1. **运行自动化验证**
   ```bash
   pnpm validate-routes
   ```

2. **手动检查清单**
   - [ ] 使用 Server Functions
   - [ ] 数据在 loader 中获取
   - [ ] 并行加载数据
   - [ ] 类型安全
   - [ ] 认证统一处理

3. **代码审查**
   - PR 描述中说明路由设计
   - 标注与 PRD 的对应关系

### 现有代码重构

1. **识别反模式**
   ```bash
   pnpm validate-routes
   ```

2. **优先级**
   - P0: 修复所有错误（❌）
   - P1: 优化警告（⚠️）
   - P2: 改进性能和可维护性

3. **重构步骤**
   - 创建 REST API → Server Functions 迁移计划
   - 逐个路由重构并测试
   - 更新文档

---

## 参考资源

- [TanStack Start 官方文档](https://tanstack.com/start/latest)
- [Server Functions 指南](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Code Execution Patterns](https://tanstack.com/start/latest/docs/framework/react/guide/code-execution-patterns)
- 项目 `CLAUDE.md` - TanStack Start 核心规则章节

---

## 更新日志

- 2025-01-10: 创建验证清单和自动化脚本
- 对应 TanStack Start 最新最佳实践
