# 私有技能库 - 修正后的上传路径设计

**更新时间**: 2025-01-10
**关键发现**: Claude Agent SDK 递归扫描 `.claude/skills/`，发现所有 `SKILL.md`

---

## 🔍 Claude Agent SDK 如何发现 Skills

### 官方文档说明

根据 [Agent Skills in the SDK - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/skills)：

**关键机制**：
1. SDK 通过 `settingSources: ['project']` 配置启用技能加载
2. SDK **递归扫描** `{cwd}/.claude/skills/` 目录
3. 发现所有包含 `SKILL.md` 的子目录
4. **自动解析 YAML frontmatter**（name, description, category）
5. 无需注册文件，完全基于文件系统自动发现

**当前配置** (`ws-query-worker.mjs:129-131`):
```javascript
settingSources: ['project'],  // 从 workspace/.claude/ 加载
```

**扫描路径**：
```
workspace/                           # cwd (WORKER_CWD)
  └── .claude/                       # SDK 扫描起点
      └── skills/                    # 递归扫描
          ├── github-summary/
          │   └── SKILL.md          # ✅ 被发现
          ├── jira-integration/
          │   └── SKILL.md          # ✅ 被发现
          └── custom-analyzer/
              └── SKILL.md          # ✅ 被发现
```

### 关键发现

1. **SDK 递归扫描**: 子目录中的技能也会被发现
2. **Symlink 支持**: SDK 会跟随 symlink 发现技能
3. **无需配置**: 不需要注册文件或 manifest
4. **自动发现**: 任何 `SKILL.md` 都会被自动加载

---

## ❌ 原方案的问题

### 我之前的错误设计

```
/data/users/{userId}/
  ├── .claude/
  │   └── skills/
  │       ├── github-summary/        # 官方技能（从 src 复制）
  │       └── user-skills -> ../../user-skills  # ❌ Symlink 到外部
  │
  └── user-skills/                   # ❌ 在 .claude/ 外部
      ├── my-skill-1/
      └── my-skill-2/
```

**问题**：
1. ❌ **Symlink 可能失败**: Docker 容器中创建相对路径 symlink 可能有问题
2. ❌ **复杂度过高**: 需要管理 symlink 生命周期
3. ❌ **不必要**: SDK 已经支持子目录，不需要 symlink

---

## ✅ 修正方案：统一存储在 `.claude/skills/`

### 目录结构

```
/data/users/{userId}/
  └── .claude/
      └── skills/                              # SDK 扫描起点
          ├── github-summary/                  # 官方技能（从 src 复制）
          │   └── SKILL.md
          ├── jira-integration/
          │   └── SKILL.md
          │
          └── user/                            # ✨ 用户上传的技能（子目录）
              ├── my-github-analyzer/
              │   ├── .enabled                 # 启用标记
              │   ├── SKILL.md
              │   └── index.ts
              ├── custom-jira-tool/
              │   ├── .enabled
              │   ├── SKILL.md
              │   └── jira-client.ts
              └── personal-assistant/
                  ├── .enabled
                  └── SKILL.md
```

**优势**：
- ✅ **简单直接**: 所有技能在同一目录树下
- ✅ **无需 symlink**: 直接利用 SDK 的子目录扫描能力
- ✅ **易于管理**: 官方技能在根目录，用户技能在 `user/` 子目录
- ✅ **清晰隔离**: 通过目录结构区分来源

---

## 🔧 技术实现

### 1. 上传接口（修正版）

```typescript
// src/server/functions/skills-upload.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { promises as fs } from 'node:fs'
import path from 'node:path'

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
    const user = await requireUser()
    const normalizedName = normalizeSkillName(data.name)

    // ✅ 修正：直接放在 .claude/skills/user/ 下
    const userSkillsDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      '.claude',
      'skills',
      'user'  // ✨ 子目录
    )

    const skillDir = path.join(userSkillsDir, normalizedName)

    // 1. 创建目录
    await fs.mkdir(skillDir, { recursive: true })

    // 2. 写入文件
    for (const file of data.files) {
      const filePath = path.join(skillDir, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, file.content, 'utf-8')
    }

    // 3. 创建 SKILL.md（如果用户没有提供）
    const skillMdPath = path.join(skillDir, 'SKILL.md')
    try {
      await fs.access(skillMdPath)
    } catch {
      // 用户没有上传 SKILL.md，自动生成
      const metadata = {
        name: data.name,
        description: data.description || 'User custom skill',
        category: data.category || 'general',
      }
      const skillMdContent = `---
name: ${metadata.name}
description: ${metadata.description}
category: ${metadata.category}
---

# ${metadata.name}

${metadata.description}
`
      await fs.writeFile(skillMdPath, skillMdContent, 'utf-8')
    }

    // 4. ✨ 自动启用（创建 .enabled 标记）
    const enabledFlag = path.join(skillDir, '.enabled')
    await fs.writeFile(enabledFlag, new Date().toISOString())

    console.log(`[Skills] Uploaded user skill: ${normalizedName} for user: ${user.id}`)

    return {
      success: true,
      skillId: normalizedName,
      path: skillDir,
    }
  })
```

### 2. 列表接口（区分官方和用户技能）

```typescript
export const listAllSkills = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireUser()

    const skillsDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      '.claude',
      'skills'
    )

    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true })

      // 官方技能（根目录，排除 user/ 子目录）
      const officialSkills: SkillInfo[] = []
      // 用户技能（user/ 子目录）
      const userSkills: SkillInfo[] = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        // 跳过 user/ 子目录（单独处理）
        if (entry.name === 'user') continue

        // 处理官方技能
        const skillPath = path.join(skillsDir, entry.name)
        const skillMdPath = path.join(skillPath, 'SKILL.md')

        try {
          await fs.access(skillMdPath)
          const metadata = await parseSkillMetadata(skillPath, entry.name)
          officialSkills.push({
            ...metadata,
            store: 'official' as const,
          })
        } catch {
          // 不是有效的技能目录，跳过
        }
      }

      // 处理用户技能（user/ 子目录）
      const userSkillsDir = path.join(skillsDir, 'user')
      try {
        const userEntries = await fs.readdir(userSkillsDir, { withFileTypes: true })

        for (const entry of userEntries) {
          if (!entry.isDirectory()) continue

          const skillPath = path.join(userSkillsDir, entry.name)
          const skillMdPath = path.join(skillPath, 'SKILL.md')

          try {
            await fs.access(skillMdPath)

            // 检查是否启用
            const enabledFlag = path.join(skillPath, '.enabled')
            const isEnabled = await checkFileExists(enabledFlag)

            const metadata = await parseSkillMetadata(skillPath, entry.name)
            userSkills.push({
              ...metadata,
              store: 'user' as const,
              enabled: isEnabled,
            })
          } catch {
            // 不是有效的技能目录，跳过
          }
        }
      } catch {
        // user/ 目录不存在，还没有用户上传技能
      }

      return {
        official: officialSkills,
        user: userSkills,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        // .claude/skills/ 目录不存在
        return { official: [], user: [] }
      }
      throw error
    }
  })
```

### 3. 删除用户技能

```typescript
export const deleteUserSkill = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    skillName: z.string(),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const normalizedName = normalizeSkillName(data.skillName)

    // ✅ 修正：从 .claude/skills/user/ 删除
    const skillDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      '.claude',
      'skills',
      'user',
      normalizedName
    )

    // 删除整个技能目录
    await fs.rm(skillDir, { recursive: true, force: true })

    console.log(`[Skills] Deleted user skill: ${normalizedName} for user: ${user.id}`)

    return { success: true }
  })
```

### 4. 启用/禁用用户技能

```typescript
export const enableUserSkill = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    skillName: z.string(),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const normalizedName = normalizeSkillName(data.skillName)

    const skillDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      '.claude',
      'skills',
      'user',
      normalizedName
    )

    const enabledFlag = path.join(skillDir, '.enabled')

    // 创建 .enabled 标记
    await fs.writeFile(enabledFlag, new Date().toISOString())

    console.log(`[Skills] Enabled user skill: ${normalizedName}`)

    return { success: true }
  })

export const disableUserSkill = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    skillName: z.string(),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const normalizedName = normalizeSkillName(data.skillName)

    const skillDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      '.claude',
      'skills',
      'user',
      normalizedName
    )

    const enabledFlag = path.join(skillDir, '.enabled')

    // 删除 .enabled 标记
    await fs.rm(enabledFlag, { force: true })

    console.log(`[Skills] Disabled user skill: ${normalizedName}`)

    return { success: true }
  })
```

---

## 📊 SDK 如何发现用户技能

### 自动发现流程

```
1. SDK 启动
   ↓
2. 配置 settingSources: ['project']
   ↓
3. 扫描 workspace/.claude/skills/
   ↓
4. 递归扫描子目录
   ↓
5. 发现所有 SKILL.md
   ├─ .claude/skills/github-summary/SKILL.md      ✅ 官方技能
   ├─ .claude/skills/jira-integration/SKILL.md    ✅ 官方技能
   └─ .claude/skills/user/my-analyzer/SKILL.md    ✅ 用户技能
   └─ .claude/skills/user/custom-tool/SKILL.md    ✅ 用户技能
   ↓
6. 解析 YAML frontmatter
   ↓
7. 加载到内存（元数据）
   ↓
8. Claude 决定使用哪个技能
   ↓
9. 动态加载完整 SKILL.md 内容
```

### 关键点

- ✅ **无需修改 SDK 配置**: `settingSources: ['project']` 已经足够
- ✅ **无需创建 symlink**: SDK 自动递归扫描子目录
- ✅ **无需注册文件**: 任何 `SKILL.md` 都会被自动发现
- ✅ **支持子目录**: 用户技能放在 `user/` 子目录下完全没问题

---

## 🎯 最终方案总结

### 目录结构

```
/data/users/{userId}/
  └── .claude/
      └── skills/                          # SDK 扫描起点
          ├── github-summary/              # 官方技能（从 src 复制）
          ├── jira-integration/            # 官方技能
          └── user/                        # ✨ 用户上传的技能
              ├── my-analyzer/
              │   ├── .enabled             # 启用标记
              │   ├── SKILL.md             # 技能定义
              │   └── index.ts             # 代码文件
              └── custom-tool/
                  ├── .enabled
                  └── SKILL.md
```

### 核心机制

| 维度 | 官方 Skills | 用户上传 Skills |
|------|------------|----------------|
| **存储位置** | `.claude/skills/{name}/` | `.claude/skills/user/{name}/` |
| **上传方式** | 从 `src/skills-store/` 复制 | 用户上传 |
| **启用方式** | 物理存在 = 已启用 | `.enabled` 标记 |
| **禁用方式** | 删除目录 | 删除 `.enabled` 标记 |
| **删除方式** | 禁用即可 | 删除整个目录 |
| **SDK 发现** | ✅ 自动 | ✅ 自动 |

### 技术要点

1. ✅ **无需修改 ws-query-worker.mjs**
2. ✅ **利用 SDK 的子目录扫描能力**
3. ✅ **通过目录结构隔离官方和用户技能**
4. ✅ **通过 `.enabled` 标记管理用户技能状态**

---

## 🔒 安全措施（不变）

- 文件名验证（防止路径遍历）
- 资源限制（10MB per skill, 50 skills per user）
- 沙盒隔离（用户技能只能访问自己的目录）

---

## ✅ 实施清单

### Phase 1: 基础功能（2-3 周）

- [ ] **1.1 后端接口**
  - [ ] `uploadUserSkill` - 上传到 `.claude/skills/user/`
  - [ ] `listAllSkills` - 区分官方和用户技能
  - [ ] `deleteUserSkill` - 删除用户技能
  - [ ] `enableUserSkill` / `disableUserSkill` - 管理启用状态

- [ ] **1.2 前端 UI**
  - [ ] 上传页面（`/agents/skills/upload`）
  - [ ] 我的技能列表（显示在 `/agents/skills`）
  - [ ] 启用/禁用/删除操作

- [ ] **1.3 类型定义**
  - [ ] 更新 `SkillInfo` 接口（添加 `store: 'official' | 'user'`）
  - [ ] 添加 Zod 验证 schemas

---

## 🔗 相关文档

- [Agent Skills in the SDK - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/skills)
- [Claude Agent SDK GitHub](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Skills 上传路径设计（原方案）](./SKILLS_UPLOAD_PATH_DESIGN.md)
- [Skills 自用风险分析](./SKILLS_SELF_USE_ANALYSIS.md)

---

## 总结

### ✅ 修正要点

1. **简化设计**: 去掉 symlink，直接放在 `.claude/skills/user/` 下
2. **利用现有机制**: SDK 已经支持递归扫描子目录
3. **清晰隔离**: 通过目录结构区分官方和用户技能
4. **无需修改**: WS Server 和 Worker 无需改动

### 🎯 关键优势

- ✅ **简单直接**: 所有技能在同一目录树下
- ✅ **自动发现**: SDK 自动发现所有 `SKILL.md`
- ✅ **易于管理**: 通过子目录和 `.enabled` 标记管理
- ✅ **安全隔离**: 用户技能在独立的 `user/` 子目录

### 📌 核心答案

**Q: 用户上传的技能放在哪里？**
**A: `.claude/skills/user/{skillName}/`**

**Q: SDK 如何发现？**
**A: SDK 递归扫描 `.claude/skills/`，自动发现所有子目录中的 `SKILL.md`**

**Q: 需要修改配置吗？**
**A: 不需要，`settingSources: ['project']` 已经足够**

**Q: 上传后需要手动启用吗？**
**A: 不需要，上传时自动创建 `.enabled` 标记**
