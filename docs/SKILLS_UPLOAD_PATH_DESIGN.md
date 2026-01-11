# 私有技能库 - 上传路径与持久化方案

**更新时间**: 2025-01-10
**状态**: ✅ 设计完成，待实施

---

## 📊 当前架构分析

### 现有 Skills 加载流程

```typescript
// 1. 官方 Skills Store（源代码）
src/skills-store/
  ├── github-summary/
  ├── jira-integration/
  └── custom-analyzer/

// 2. 用户启用 Skill 时（manager.ts:83-104）
async function enableSkill(userId: string, skillName: string) {
  const sourceDir = path.join(process.cwd(), 'src', 'skills-store', skillName)
  const targetDir = path.join(userHome, '.claude', 'skills', skillName)
  await fs.cp(sourceDir, targetDir, { recursive: true })  // 复制
}

// 3. 用户 CLAUDE_HOME
/data/users/{userId}/
  └── .claude/
      └── skills/
          ├── github-summary/      # 从 src 复制过来的
          ├── jira-integration/
          └── custom-analyzer/

// 4. Workspace Symlink（ws-server.mjs:341-374）
/data/users/{userId}/sessions/{sessionId}/workspace/
  └── .claude -> /data/users/{userId}/.claude

// 5. SDK 加载（ws-query-worker.mjs:131）
settingSources: ['project']  // 从 .claude/skills/ 加载
```

### 关键发现

1. **Skills 是物理复制的**：不是 symlink，是 `fs.cp()` 复制
2. **自动更新策略**：启用时会删除旧版本，重新复制（line 95）
3. **持久化位置**：`/data/users/{userId}/.claude/skills/`
4. **加载方式**：SDK 通过 `settingSources: ['project']` 自动加载

---

## 🎯 私有技能库方案

### 方案选择：独立目录 + 元数据区分

#### 目录结构

```
/data/users/{userId}/
  ├── .claude/
  │   └── skills/
  │       ├── github-summary/        # 官方 Skills（从 src 复制）
  │       ├── jira-integration/
  │       └── custom-analyzer/
  │
  └── user-skills/                   # ✨ 新增：用户私有 Skills
      ├── my-github-analyzer/
      │   ├── SKILL.md
      │   ├── package.json
      │   └── index.ts
      ├── custom-jira-tool/
      └── personal-assistant/
```

#### 技术实现

**优势**：
- ✅ **与官方 Skills 隔离**：不会覆盖官方技能
- ✅ **自动被 SDK 加载**：只需将 `user-skills/` symlink 到 `.claude/skills/`
- ✅ **持久化**：位于用户数据目录，重启不丢失
- ✅ **易于管理**：清晰的目录结构

**实现步骤**：

1. **创建 Symlink**（在用户首次上传时）：
```typescript
const userSkillsDir = path.join(userHome, 'user-skills')
const skillsLink = path.join(userHome, '.claude', 'skills', 'user-skills')

// 创建 symlink: .claude/skills/user-skills -> ../../user-skills
await fs.symlink('../../user-skills', skillsLink)
```

2. **最终目录结构**：
```
/data/users/{userId}/
  ├── .claude/
  │   └── skills/
  │       ├── github-summary/        # 官方
  │       ├── jira-integration/       # 官方
  │       └── user-skills -> ../../user-skills  # ✨ Symlink
  │
  └── user-skills/                   # 实际存储
      ├── skill-1/
      └── skill-2/
```

3. **SDK 自动加载**：
```javascript
// ws-query-worker.mjs (无需修改)
settingSources: ['project']  // SDK 会自动加载 .claude/skills/user-skills/
```

---

## 📋 上传接口设计

### 1. 上传接口

```typescript
// src/server/functions/skills-upload.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const uploadUserSkill = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    category: z.string().optional(),
    files: z.array(z.object({
      path: z.string(),  // 相对路径，如 "index.ts", "src/utils.ts"
      content: z.string(),  // 文件内容
    })),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const normalizedName = normalizeSkillName(data.name)

    // 1. 创建用户技能目录
    const userSkillsDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      'user-skills',
      normalizedName
    )

    await fs.mkdir(userSkillsDir, { recursive: true })

    // 2. 写入文件
    for (const file of data.files) {
      const filePath = path.join(userSkillsDir, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, file.content, 'utf-8')
    }

    // 3. 创建 SKILL.md 元数据
    const metadata = {
      name: data.name,
      description: data.description || 'User custom skill',
      category: data.category || 'general',
      version: '1.0.0',
      author: user.id,
      createdAt: new Date().toISOString(),
    }
    await fs.writeFile(
      path.join(userSkillsDir, 'SKILL.md'),
      `# ${data.name}\n\n${data.description}\n\n---\n\n${JSON.stringify(metadata, null, 2)}`
    )

    // 4. 确保 symlink 存在（仅需创建一次）
    await ensureUserSkillsSymlink(user.id)

    return {
      success: true,
      skillId: normalizedName,
      path: userSkillsDir,
    }
  })

// 辅助函数：创建用户 skills symlink
async function ensureUserSkillsSymlink(userId: string) {
  const userHome = path.join(
    process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
    userId
  )
  const skillsDir = path.join(userHome, '.claude', 'skills')
  const userSkillsDir = path.join(userHome, 'user-skills')
  const linkPath = path.join(skillsDir, 'user-skills')

  try {
    // 检查 symlink 是否已存在
    await fs.access(linkPath)
    return  // 已存在，无需创建
  } catch {
    // 不存在，创建 symlink
    await fs.mkdir(skillsDir, { recursive: true })
    await fs.symlink('../../user-skills', linkPath)
    console.log(`[Skills] Created symlink: ${linkPath} -> ../../user-skills`)
  }
}
```

### 2. 列表接口

```typescript
export const listUserSkills = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireUser()
    const userSkillsDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      'user-skills'
    )

    try {
      const entries = await fs.readdir(userSkillsDir, { withFileTypes: true })
      const skills = await Promise.all(
        entries
          .filter(e => e.isDirectory())
          .map(async (entry) => {
            const skillPath = path.join(userSkillsDir, entry.name)
            return parseUserSkillMetadata(skillPath, entry.name, user.id)
          })
      )

      return skills.filter(Boolean)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return []  // 用户还没有上传任何技能
      }
      throw error
    }
  })

async function parseUserSkillMetadata(
  skillPath: string,
  skillName: string,
  userId: string
): Promise<SkillInfo | null> {
  const metadataPath = path.join(skillPath, 'SKILL.md')

  try {
    const content = await fs.readFile(metadataPath, 'utf-8')
    const frontmatterMatch = content.match(/^---\n(.*?)\n---/s)

    if (frontmatterMatch) {
      const metadata = YAML.parse(frontmatterMatch[1])
      return {
        slug: skillName,
        name: metadata.name || skillName,
        description: metadata.description || null,
        category: metadata.category || 'general',
        store: 'user',  // ✨ 标记为用户技能
        author: userId,
        createdAt: metadata.createdAt,
      }
    }
  } catch {
    // SKILL.md 不存在或解析失败
  }

  // Fallback: 返回基本信息
  return {
    slug: skillName,
    name: skillName,
    description: null,
    category: 'general',
    store: 'user',  // ✨ 标记为用户技能
    author: userId,
  }
}
```

### 3. 删除接口

```typescript
export const deleteUserSkill = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    skillName: z.string(),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const normalizedName = normalizeSkillName(data.skillName)
    const skillPath = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      'user-skills',
      normalizedName
    )

    // 删除整个技能目录
    await fs.rm(skillPath, { recursive: true, force: true })

    return { success: true }
  })
```

---

## 🔒 安全措施

### 1. 资源限制（防止滥用）

```typescript
// 上传限制
const UPLOAD_LIMITS = {
  maxSkillSize: 10 * 1024 * 1024,  // 10 MB per skill
  maxFileSize: 1024 * 1024,        // 1 MB per file
  maxFiles: 100,                   // Max 100 files per skill
  maxSkillsPerUser: 50,            // Max 50 skills per user
}

// 运行时限制（ws-query-worker.mjs）
const EXECUTION_LIMITS = {
  maxExecutionTime: 30 * 1000,  // 30 秒
  maxMemory: 512 * 1024 * 1024, // 512 MB
}
```

### 2. 文件名验证

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
```

### 3. 沙盒隔离

```typescript
// 用户技能只能访问自己的目录
const userSkillSandbox = {
  rootPath: `/data/users/${userId}/user-skills/${skillName}`,
  allowPaths: [
    `/data/users/${userId}/user-skills/${skillName}/**`,
    `/tmp/${skillName}/**`,
  ],
  denyPaths: [
    `/etc/**`,
    `/home/**`,  // 防止访问其他用户数据
    `/root/**`,
  ],
}
```

---

## 📊 持久化方案

### 存储位置

```
/data/users/{userId}/user-skills/{skillName}/
```

### 持久化特性

| 特性 | 说明 |
|------|------|
| ✅ **持久化** | 存储在用户数据目录，重启不丢失 |
| ✅ **隔离** | 每个用户独立的 `user-skills/` 目录 |
| ✅ **自动加载** | 通过 symlink 被 SDK 自动加载 |
| ✅ **易于备份** | 可以直接复制整个目录 |
| ✅ **版本管理** | 用户可以上传多个版本（不同技能名） |

### Docker Volume 配置

```yaml
# docker-compose.yml
services:
  app:
    volumes:
      - user-data:/data/users

volumes:
  user-data:
    driver: local
```

### 备份策略

```bash
# 备份所有用户技能
tar -czf user-skills-backup-$(date +%Y%m%d).tar.gz /data/users/*/user-skills/

# 恢复
tar -xzf user-skills-backup-20250110.tar.gz -C /
```

---

## 🎨 前端 UI 设计

### 上传界面

```typescript
// src/routes/agents/skills/upload/route.tsx
export const Route = createFileRoute('/agents/skills/upload')({
  component: SkillUploadPage,
})

function SkillUploadPage() {
  const uploadSkill = useServerFn(uploadUserSkill)

  const handleUpload = async (files: File[], metadata: SkillMetadata) => {
    const result = await uploadSkill({
      data: {
        name: metadata.name,
        description: metadata.description,
        category: metadata.category,
        files: await Promise.all(
          files.map(async (file) => ({
            path: file.name,
            content: await file.text(),
          }))
        ),
      },
    })

    if (result.data?.success) {
      toast.success('技能上传成功')
      redirect({ to: '/agents/skills' })
    }
  }

  return <SkillUploadForm onUpload={handleUpload} />
}
```

### 我的技能列表

```
我的技能库
├── 已上传的技能 (3)
│   ├── 📦 My GitHub Analyzer [编辑] [删除] [测试]
│   ├── 📦 Custom Jira Tool [编辑] [删除] [测试]
│   └── 📦 Personal Assistant [编辑] [删除] [测试]
└── 上传新技能 [+]
```

---

## 📝 更新 SkillInfo 类型

```typescript
// src/claude/skills/types.ts
export interface SkillInfo {
  slug: string           // 目录名（唯一标识）
  name: string           // 显示名称
  description: string | null  // 描述
  category: string       // 分类
  store: 'official' | 'user'  // ✨ 新增：区分官方和用户技能
  author?: string        // ✨ 新增：作者 ID（仅用户技能）
  createdAt?: string     // ✨ 新增：创建时间（仅用户技能）
}
```

---

## ✅ 实施清单

### Phase 1: 基础功能（2-3 周）

- [ ] **1.1 后端接口**
  - [ ] `uploadUserSkill` Server Function
  - [ ] `listUserSkills` Server Function
  - [ ] `deleteUserSkill` Server Function
  - [ ] `ensureUserSkillsSymlink` 辅助函数
  - [ ] 文件名验证和资源限制

- [ ] **1.2 前端 UI**
  - [ ] 上传页面（`/agents/skills/upload`）
  - [ ] 我的技能列表（扩展现有 `/agents/skills`）
  - [ ] 技能编辑器（可选，基础版）
  - [ ] 删除确认对话框

- [ ] **1.3 类型定义**
  - [ ] 更新 `SkillInfo` 接口
  - [ ] 添加 Zod 验证 schemas
  - [ ] 添加资源限制常量

- [ ] **1.4 文档**
  - [ ] 用户上传指南
  - [ ] 技能开发指南（如何编写 SKILL.md）
  - [ ] 安全风险提示

### Phase 2: 增强功能（1-2 周，可选）

- [ ] **2.1 技能编辑器**
  - [ ] 在线代码编辑器（Monaco Editor）
  - [ ] 语法高亮
  - [ ] 实时预览

- [ ] **2.2 导入/导出**
  - [ ] 导出为 ZIP（备份）
  - [ ] 从 ZIP 导入
  - [ ] 从 GitHub URL 导入

- [ ] **2.3 版本管理**
  - [ ] 保存历史版本
  - [ ] 回滚到旧版本
  - [ ] 版本对比

---

## 🔗 相关文档

- [Skills 自用风险分析](./SKILLS_SELF_USE_ANALYSIS.md)
- [Skills 上传需求分析](./SKILLS_UPLOAD_REQUIREMENTS_ANALYSIS.md)
- [Claude Agent SDK 集成](../CLAUDE.md)

---

## 总结

### ✅ 设计要点

1. **上传路径**：`/data/users/{userId}/user-skills/{skillName}/`
2. **持久化**：✅ 是，存储在用户数据目录，Docker volume 持久化
3. **加载方式**：通过 symlink 被 SDK 自动加载（无需修改 WS Server）
4. **隔离性**：✅ 每用户独立目录，不会相互影响
5. **安全性**：资源限制、文件名验证、沙盒隔离

### 🎯 关键优势

- ✅ **无需修改现有架构**：官方 Skills 和用户 Skills 完全隔离
- ✅ **自动被 SDK 加载**：通过 `settingSources: ['project']` 自动发现
- ✅ **易于备份和恢复**：直接复制目录即可
- ✅ **支持跨设备同步**：通过同步 `/data/users/` 目录实现

### 🚀 下一步

1. 实施后端接口（Phase 1.1）
2. 实施前端 UI（Phase 1.2）
3. 编写用户文档（Phase 1.4）
4. 测试和验证
