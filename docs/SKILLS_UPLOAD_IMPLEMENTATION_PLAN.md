# 私有技能库功能 - 完整实施计划

**创建时间**: 2025-01-10
**预计工期**: 2-3 周
**状态**: 🚀 开始实施

---

## 📋 总览

**目标**: 实现用户上传自定义技能功能，仅用户自己可见和使用

**核心特性**：
- ✅ 用户上传技能到 `.claude/skills/user/{name}/`
- ✅ 上传后自动启用（创建 `.enabled` 标记）
- ✅ 完全隔离（每个用户独立的目录）
- ✅ 自动被 SDK 发现（无需修改配置）

**技术方案**：
- **后端**: Server Functions (`createServerFn`)
- **前端**: TanStack Start + React
- **存储**: `/data/users/{userId}/.claude/skills/user/{name}/`
- **隔离**: 三层隔离（文件系统 + Symlink + 进程）

---

## 🎯 Phase 1: 后端接口（Week 1）

### Task 1.1: 创建上传接口
**文件**: `src/server/functions/skills-upload.server.ts`

```typescript
// 上传用户技能
export const uploadUserSkill = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    category: z.string().optional(),
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })),
  }))
  .handler(async ({ data }) => {
    // 1. 验证和清理
    // 2. 创建目录
    // 3. 写入文件
    // 4. 生成 SKILL.md
    // 5. 创建 .enabled 标记
    // 6. 返回结果
  })
```

**验收标准**:
- [ ] 接收上传文件
- [ ] 存储到正确路径 `.claude/skills/user/{name}/`
- [ ] 自动生成 SKILL.md
- [ ] 自动创建 .enabled 标记
- [ ] 文件名验证（防止路径遍历）
- [ ] 资源限制检查（大小、数量）

---

### Task 1.2: 创建列表接口
**文件**: `src/server/functions/skills-list.server.ts`

```typescript
// 获取所有技能（官方 + 用户）
export const listAllSkills = createServerFn({ method: 'GET' })
  .handler(async () => {
    // 1. 扫描官方技能（.claude/skills/*，排除 user/）
    // 2. 扫描用户技能（.claude/skills/user/*）
    // 3. 检查用户技能的 .enabled 状态
    // 4. 返回合并结果
  })

// 辅助函数
async function scanOfficialSkills(userId: string): Promise<SkillInfo[]>
async function scanUserSkills(userId: string): Promise<SkillInfo[]>
async function checkSkillEnabled(skillPath: string): Promise<boolean>
```

**验收标准**:
- [ ] 区分官方技能和用户技能
- [ ] 检查用户技能的启用状态（.enabled）
- [ ] 返回完整的 SkillInfo 对象
- [ ] 处理目录不存在的情况

---

### Task 1.3: 创建管理接口
**文件**: `src/server/functions/skills-manage.server.ts`

```typescript
// 启用用户技能
export const enableUserSkill = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // 创建 .enabled 标记
  })

// 禁用用户技能
export const disableUserSkill = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // 删除 .enabled 标记
  })

// 删除用户技能
export const deleteUserSkill = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // 删除整个技能目录
  })

// 获取单个用户技能详情
export const getUserSkillDetail = createServerFn({ method: 'GET' })
  .handler(async ({ data }) => {
    // 读取技能目录结构和文件内容
  })
```

**验收标准**:
- [ ] enableUserSkill 创建 .enabled 文件
- [ ] disableUserSkill 删除 .enabled 文件
- [ ] deleteUserSkill 删除整个目录
- [ ] getUserSkillDetail 返回文件列表和内容

---

## 🎨 Phase 2: 前端 UI（Week 1-2）

### Task 2.1: 更新类型定义
**文件**: `src/claude/skills/types.ts`

```typescript
export interface SkillInfo {
  slug: string
  name: string
  description: string | null
  category: string
  store: 'official' | 'user'  // 新增
  enabled?: boolean           // 新增（仅用户技能）
  author?: string             // 新增（仅用户技能）
  createdAt?: string          // 新增（仅用户技能）
  fileCount?: number          // 新增（仅用户技能）
}

export interface UserSkillFiles {
  [path: string]: string  // 文件路径 -> 内容
}
```

**验收标准**:
- [ ] 添加 `store` 字段区分官方和用户技能
- [ ] 添加 `enabled` 字段表示启用状态
- [ ] 添加用户技能特有字段（author, createdAt）

---

### Task 2.2: 更新技能列表页面
**文件**: `src/routes/agents/skills/route.tsx`

```typescript
// 修改 loader
export const Route = createFileRoute('/agents/skills')({
  loader: async () => {
    const [official, user] = await listAllSkills()
    return { official, user }
  },
  component: SkillsPageComponent,
})

// 修改组件
function SkillsPageComponent() {
  const { official, user } = Route.useLoaderData()

  return (
    <div>
      <section>
        <h2>官方 Skills</h2>
        <SkillsGrid skills={official} type="official" />
      </section>

      <section>
        <h2>我的 Skills</h2>
        <Button onClick={() => navigate({ to: '/agents/skills/upload' })}>
          上传新技能
        </Button>
        <SkillsGrid skills={user} type="user" />
      </section>
    </div>
  )
}
```

**验收标准**:
- [ ] 使用新的 listAllSkills 接口
- [ ] 分别展示官方技能和用户技能
- [ ] 添加"上传新技能"按钮

---

### Task 2.3: 创建技能上传页面
**文件**: `src/routes/agents/skills/upload/route.tsx`

```typescript
export const Route = createFileRoute('/agents/skills/upload')({
  component: SkillUploadPage,
})

function SkillUploadPage() {
  const uploadSkill = useServerFn(uploadUserSkill)

  const handleUpload = async (metadata, files) => {
    const result = await uploadSkill({ data: { ...metadata, files }})
    if (result.data?.success) {
      toast.success('技能上传成功')
      navigate({ to: '/agents/skills' })
    }
  }

  return (
    <div>
      <h1>上传自定义技能</h1>
      <SkillUploadForm onUpload={handleUpload} />
    </div>
  )
}
```

**验收标准**:
- [ ] 表单输入（名称、描述、分类）
- [ ] 文件上传（支持多文件）
- [ ] 文件路径编辑
- [ ] 上传进度提示
- [ ] 成功后跳转到技能列表

---

### Task 2.4: 更新技能卡片组件
**文件**: `src/components/skills/skill-card.tsx`

```typescript
export function SkillCard({ skill, type }: { skill: SkillInfo, type: 'official' | 'user' }) {
  const enableSkill = useServerFn(enableOfficialSkill)
  const disableSkill = useServerFn(disableOfficialSkill)
  const enableUserSkill = useServerFn(enableUserSkill)
  const disableUserSkill = useServerFn(disableUserSkill)
  const deleteUserSkill = useServerFn(deleteUserSkill)

  return (
    <Card>
      <SkillHeader skill={skill} />
      <SkillDescription skill={skill} />

      {type === 'official' && (
        <Button onClick={() => skill.enabled ? disableSkill() : enableSkill()}>
          {skill.enabled ? '禁用' : '启用'}
        </Button>
      )}

      {type === 'user' && (
        <div className="flex gap-2">
          <Button onClick={() => skill.enabled ? disableUserSkill() : enableUserSkill()}>
            {skill.enabled ? '禁用' : '启用'}
          </Button>
          <Button onClick={() => deleteUserSkill()} variant="destructive">
            删除
          </Button>
        </div>
      )}
    </Card>
  )
}
```

**验收标准**:
- [ ] 根据 type 显示不同操作按钮
- [ ] 官方技能：启用/禁用
- [ ] 用户技能：启用/禁用/删除
- [ ] 显示技能来源标识

---

### Task 2.5: 创建上传表单组件
**文件**: `src/components/skills/skill-upload-form.tsx`

```typescript
interface SkillUploadFormProps {
  onUpload: (metadata: SkillMetadata, files: SkillFile[]) => Promise<void>
}

function SkillUploadForm({ onUpload }: SkillUploadFormProps) {
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    category: 'general',
  })
  const [files, setFiles] = useState<SkillFile[]>([])

  const handleFileAdd = () => {
    // 添加文件
  }

  const handleFileContentChange = (path, content) => {
    // 更新文件内容
  }

  const handleSubmit = async () => {
    await onUpload(metadata, files)
  }

  return (
    <form onSubmit={handleSubmit}>
      <MetadataInput metadata={metadata} onChange={setMetadata} />
      <FileEditor files={files} onAdd={handleFileAdd} onChange={handleFileContentChange} />
      <Button type="submit">上传技能</Button>
    </form>
  )
}
```

**验收标准**:
- [ ] 元数据输入（名称、描述、分类）
- [ ] 文件列表管理
- [ ] 文件内容编辑
- [ ] 表单验证
- [ ] 上传提示

---

## 🔒 Phase 3: 安全措施（Week 2）

### Task 3.1: 文件名验证
**文件**: `src/claude/skills/validation.ts`

```typescript
export function normalizeSkillName(skillName: string): string {
  // 只允许字母、数字、连字符、下划线
  return skillName.replace(/[^A-Za-z0-9-_]/g, '_')
}

export function validateFilePath(filePath: string): boolean {
  // 防止路径遍历攻击
  const normalized = path.normalize(filePath)
  return !normalized.includes('..')
}

export function validateSkillFiles(files: SkillFile[]): ValidationResult {
  const errors: string[] = []

  for (const file of files) {
    if (!validateFilePath(file.path)) {
      errors.push(`Invalid file path: ${file.path}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

**验收标准**:
- [ ] normalizeSkillName 清理技能名称
- [ ] validateFilePath 防止路径遍历
- [ ] validateSkillFiles 批量验证

---

### Task 3.2: 资源限制
**文件**: `src/server/constants/skills-limits.ts`

```typescript
export const SKILL_LIMITS = {
  maxSkillSize: 10 * 1024 * 1024,     // 10 MB per skill
  maxFileSize: 1024 * 1024,            // 1 MB per file
  maxFiles: 100,                        // Max 100 files per skill
  maxSkillsPerUser: 50,                 // Max 50 skills per user
  maxExecutionTime: 30 * 1000,          // 30 秒
  maxMemory: 512 * 1024 * 1024,         // 512 MB
} as const

export function validateSkillSize(files: SkillFile[]): ValidationResult {
  const totalSize = files.reduce((sum, f) => sum + f.content.length, 0)

  if (totalSize > SKILL_LIMITS.maxSkillSize) {
    return {
      valid: false,
      errors: [`Skill size exceeds limit (${totalSize} > ${SKILL_LIMITS.maxSkillSize})`],
    }
  }

  return { valid: true, errors: [] }
}
```

**验收标准**:
- [ ] 定义资源限制常量
- [ ] 验证技能大小
- [ ] 验证文件数量
- [ ] 在上传接口中应用限制

---

## 📚 Phase 4: 文档和测试（Week 2-3）

### Task 4.1: 用户文档
**文件**: `docs/SKILLS_UPLOAD_USER_GUIDE.md`

```markdown
# 上传自定义技能指南

## 技能结构
- SKILL.md（必需）
- index.ts（可选）
- 其他文件（可选）

## 上传步骤
1. 填写元数据
2. 上传文件
3. 自动启用
4. 立即可用

## SKILL.md 格式
\`\`\`yaml
---
name: 技能名称
description: 技能描述
category: 分类
---
\`\`\`

## 安全提示
- ⚠️ 技能代码完全由您负责
- ⚠️ 请勿上传包含敏感信息的代码
- ⚠️ 技能仅限您自己使用
\`\`\``

**验收标准**:
- [ ] 技能结构说明
- [ ] 上传步骤指南
- [ ] SKILL.md 格式示例
- [ ] 安全风险提示

---

### Task 4.2: 开发者文档
**文件**: `docs/SKILLS_UPLOAD_DEV_GUIDE.md`

```markdown
# 技能开发指南

## 技能目录结构
\`\`\`
my-skill/
├── SKILL.md       # 元数据（必需）
├── index.ts       # 代码文件（可选）
└── utils.ts       # 辅助文件（可选）
\`\`\`

## 技能元数据
\`\`\`yaml
---
name: GitHub Summary
description: 分析 GitHub 仓库
category: development
---
\`\`\`

## 代码示例
\`\`\`typescript
export const tools = {
  analyzeRepo: {
    description: '分析 GitHub 仓库',
    parameters: {
      url: { type: 'string', description: '仓库 URL' }
    },
    execute: async ({ url }) => {
      // 实现代码
    }
  }
}
\`\`\`
\`\`\``

**验收标准**:
- [ ] 技能开发指南
- [ ] 代码示例
- [ ] 最佳实践
- [ ] 调试技巧

---

### Task 4.3: 测试文件
**文件**: `test-skills-upload.mjs`

```javascript
// 测试上传接口
async function testUpload() {
  const result = await uploadUserSkill({
    name: 'test-skill',
    files: [
      { path: 'SKILL.md', content: '...' },
      { path: 'index.ts', content: '...' },
    ],
  })

  console.log('Upload result:', result)
}

// 测试列表接口
async function testList() {
  const { official, user } = await listAllSkills()
  console.log('Official skills:', official)
  console.log('User skills:', user)
}

// 测试隔离
async function testIsolation() {
  // 上传到用户 A
  await uploadAsUser('userA', { name: 'skill-a' })

  // 检查用户 B 是否能看到
  const userB = await listSkills('userB')
  console.log('User B should not see skill-a:', !userB.includes('skill-a'))
}

// 运行测试
await testUpload()
await testList()
await testIsolation()
```

**验收标准**:
- [ ] 上传功能测试
- [ ] 列表功能测试
- [ ] 用户隔离测试
- [ ] 安全限制测试

---

## 📅 实施时间表

### Week 1: 核心功能
- Day 1-2: 后端接口（Task 1.1, 1.2, 1.3）
- Day 3-4: 前端 UI（Task 2.1, 2.2, 2.4）
- Day 5: 上传页面（Task 2.3, 2.5）

### Week 2: 安全和文档
- Day 1-2: 安全措施（Task 3.1, 3.2）
- Day 3-4: 文档编写（Task 4.1, 4.2）
- Day 5: 测试和修复（Task 4.3）

### Week 3: 优化和发布
- Day 1-2: UI 优化
- Day 3-4: 性能优化
- Day 5: 最终测试和发布

---

## ✅ 验收标准

### 功能完整性
- [ ] 用户可以上传技能
- [ ] 上传后自动启用
- [ ] 用户可以禁用技能
- [ ] 用户可以删除技能
- [ ] 技能列表正确展示

### 安全性
- [ ] 用户间完全隔离
- [ ] 路径遍历防护
- [ ] 资源限制生效
- [ ] 文件名验证生效

### 用户体验
- [ ] 界面友好
- [ ] 错误提示清晰
- [ ] 操作流畅
- [ ] 响应及时

### 文档完整性
- [ ] 用户指南
- [ ] 开发者指南
- [ ] 安全提示
- [ ] 测试文件

---

## 🚀 开始实施

**第一步**: 创建后端接口（Task 1.1）
**文件**: `src/server/functions/skills-upload.server.ts`

**优先级**: P0（最高）
**预计时间**: 2-3 小时
