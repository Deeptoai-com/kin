# 用户上传技能 - 启用流程设计

**更新时间**: 2025-01-10
**问题**: 用户上传的私有技能是否需要手动启用？

---

## 📊 当前官方 Skills 启用流程

```
用户操作                      系统行为                    最终位置
────────────────────────────────────────────────────────────────────
在 Skills Store 浏览          → 展示 src/skills-store/
                              → 未启用（灰色）
点击"启用"按钮                → enableSkill()
                              → 复制技能文件
                              → /data/users/{userId}/.claude/skills/{name}/
                              → SDK 自动加载
                              → 变为"已启用"（绿色）
点击"禁用"按钮                → disableSkill()
                              → 删除技能文件
                              → SDK 不再加载
                              → 变为"未启用"（灰色）
```

---

## 🎯 用户上传技能的两种方案

### 方案 1：上传后自动启用 ⭐ 推荐

**用户体验**：
```
上传技能
  ↓
自动可用（立即生效）
  ↓
可以在列表中"禁用"（可选）
```

**优势**：
- ✅ 用户体验好，符合直觉（"我上传的技能，应该立即能用"）
- ✅ 简化流程（一步到位）
- ✅ 类似于"本地开发"（用户自己写的代码，保存后就能用）

**实现**：
```typescript
// 上传后自动创建 .enabled 标记
async function uploadUserSkill(userId, skillName, files) {
  const skillDir = `/data/users/${userId}/user-skills/${skillName}`

  // 1. 写入文件
  await writeFiles(skillDir, files)

  // 2. ✨ 自动启用（创建 .enabled 标记）
  await fs.writeFile(
    path.join(skillDir, '.enabled'),
    new Date().toISOString()
  )

  return { success: true, enabled: true }
}
```

---

### 方案 2：上传后需要手动启用

**用户体验**：
```
上传技能
  ↓
上传成功，但处于"未启用"状态（灰色）
  ↓
需要手动点击"启用"按钮
  ↓
变为"已启用"（绿色），SDK 开始加载
```

**优势**：
- ✅ 用户可以选择何时启用
- ✅ 可以上传后先测试再启用
- ✅ 与官方 Skills 流程一致

**劣势**：
- ❌ 多一步操作，用户体验差
- ❌ 不符合直觉（"我上传的技能，为什么还要手动启用？"）

---

## 🔧 推荐方案：自动启用 + 可选禁用

### 完整流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 上传技能                                                 │
│    用户填写表单（名称、描述、文件）                          │
│    → 上传到 /data/users/{userId}/user-skills/{skillName}/  │
│    → ✨ 自动创建 .enabled 标记                               │
│    → 立即可用                                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 技能列表（统一展示）                                     │
│    ┌────────────────────────────────────────────┐          │
│    │ 官方 Skills (from src/skills-store)       │          │
│    │  ✅ github-summary       [已启用] [禁用]   │          │
│    │  ⚪ jira-integration     [未启用] [启用]   │          │
│    ├────────────────────────────────────────────┤          │
│    │ 我的 Skills (user-skills)                 │          │
│    │  ✅ my-github-analyzer  [已启用] [禁用] [删除]│      │
│    │  ✅ custom-jira-tool     [已启用] [禁用] [删除]│      │
│    │  ⚪ personal-assistant  [已启用] [禁用] [删除]│      │
│    └────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 禁用技能（可选）                                         │
│    点击"禁用" → 删除 .enabled 标记 → SDK 不再加载          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 重新启用                                                 │
│    点击"启用" → 创建 .enabled 标记 → SDK 重新加载          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 技术实现

### 1. 启用/禁用标记

```typescript
/**
 * 启用用户技能（创建 .enabled 标记）
 */
export async function enableUserSkill(userId: string, skillName: string) {
  const skillDir = path.join(
    process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
    userId,
    'user-skills',
    normalizeSkillName(skillName)
  )

  const enabledFlag = path.join(skillDir, '.enabled')

  // 创建 .enabled 文件（内容为启用时间）
  await fs.writeFile(enabledFlag, new Date().toISOString())

  console.log(`[Skills] Enabled user skill: ${skillName} for user: ${userId}`)
}

/**
 * 禁用用户技能（删除 .enabled 标记）
 */
export async function disableUserSkill(userId: string, skillName: string) {
  const skillDir = path.join(
    process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
    userId,
    'user-skills',
    normalizeSkillName(skillName)
  )

  const enabledFlag = path.join(skillDir, '.enabled')

  // 删除 .enabled 文件
  await fs.rm(enabledFlag, { force: true })

  console.log(`[Skills] Disabled user skill: ${skillName} for user: ${userId}`)
}

/**
 * 检查技能是否已启用
 */
export async function isUserSkillEnabled(userId: string, skillName: string): Promise<boolean> {
  const skillDir = path.join(
    process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
    userId,
    'user-skills',
    normalizeSkillName(skillName)
  )

  const enabledFlag = path.join(skillDir, '.enabled')

  try {
    await fs.access(enabledFlag)
    return true  // .enabled 文件存在
  } catch {
    return false  // .enabled 文件不存在
  }
}
```

### 2. SDK 加载前过滤（可选）

**方案 A：在 Worker 启动时复制已启用的技能**

```typescript
// ws-query-worker.mjs
import { readdir, readFile, stat, cp } from 'node:fs/promises'

/**
 * 获取用户已启用的技能列表
 */
async function getEnabledUserSkills() {
  const userId = process.env.USER_ID  // 从环境变量传入
  const userSkillsDir = `/data/users/${userId}/user-skills`

  try {
    const entries = await readdir(userSkillsDir, { withFileTypes: true })
    const enabledSkills = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillDir = path.join(userSkillsDir, entry.name)
      const enabledFlag = path.join(skillDir, '.enabled')

      try {
        await stat(enabledFlag)  // 检查 .enabled 是否存在
        enabledSkills.push(entry.name)
      } catch {
        // .enabled 不存在，跳过
      }
    }

    return enabledSkills
  } catch {
    return []  // 目录不存在或无权限
  }
}

/**
 * 复制已启用的用户技能到加载目录
 */
async function prepareUserSkills() {
  const userId = process.env.USER_ID
  const enabledSkills = await getEnabledUserSkills()

  if (enabledSkills.length === 0) {
    console.log('[Worker] No enabled user skills')
    return
  }

  const targetDir = path.join(process.env.CLAUDE_HOME, '.claude', 'skills', 'user-skills')

  for (const skillName of enabledSkills) {
    const sourceDir = `/data/users/${userId}/user-skills/${skillName}`
    const targetSkillDir = path.join(targetDir, skillName)

    await cp(sourceDir, targetSkillDir, { recursive: true })
    console.log(`[Worker] Copied user skill: ${skillName}`)
  }
}

// 在 query() 之前调用
await prepareUserSkills()
const result = await query({
  prompt: userMessage,
  settingSources: ['project'],
  // ...
})
```

**方案 B：直接使用 symlink（推荐，无需复制）**

```typescript
// 只需创建一次 symlink，SDK 会自动加载所有子目录
const userSkillsDir = `/data/users/${userId}/user-skills`
const skillsLink = path.join(process.env.CLAUDE_HOME, '.claude', 'skills', 'user-skills')

await fs.symlink(userSkillsDir, skillsLink)
```

**对比**：
| 方案 | 优势 | 劣势 |
|------|------|------|
| **A: 复制已启用技能** | 只复制启用的技能 | 需要在每次 query 前复制，性能差 |
| **B: 直接 symlink** | 性能好，SDK 自动加载 | 无法在 SDK 层面禁用技能 |

**推荐方案 B**，因为：
1. SDK 会自动加载 symlink 下的所有技能
2. 禁用通过 `.enabled` 标记管理（应用层逻辑）
3. 性能好，无需每次复制

---

### 3. 前端展示逻辑

```typescript
// src/server/functions/skills.server.ts

/**
 * 获取所有技能（官方 + 用户）
 */
export const listAllSkills = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireUser()

    // 1. 获取官方 Skills（从 src）
    const officialSkills = await getSkillsStore()
    const enabledOfficialSkills = await getUserEnabledSkills(user.id)

    // 2. 获取用户 Skills（从 user-skills）
    const userSkillsDir = path.join(
      process.env.CLAUDE_SESSIONS_ROOT || '/data/users',
      user.id,
      'user-skills'
    )

    let userSkills: SkillInfo[] = []

    try {
      const entries = await fs.readdir(userSkillsDir, { withFileTypes: true })

      userSkills = await Promise.all(
        entries
          .filter(e => e.isDirectory())
          .map(async (entry) => {
            const skillPath = path.join(userSkillsDir, entry.name)
            const enabledFlag = path.join(skillPath, '.enabled')

            // 检查是否启用
            const isEnabled = await fileExists(enabledFlag)

            return {
              slug: entry.name,
              name: entry.name,
              description: null,
              category: 'general',
              store: 'user',
              enabled: isEnabled,  // ✨ 添加启用状态
            }
          })
      )
    } catch {
      // 用户还没有上传任何技能
    }

    // 3. 合并结果
    return {
      official: officialSkills.map(skill => ({
        ...skill,
        enabled: enabledOfficialSkills.includes(skill.slug),
        store: 'official' as const,
      })),
      user: userSkills,
    }
  })
```

### 4. 前端 UI

```typescript
// src/components/skills/skills-page.tsx
export function SkillsPageComponent() {
  const { data } = useQuery({
    queryKey: ['skills'],
    queryFn: () => listAllSkills(),
  })

  return (
    <div>
      {/* 官方 Skills */}
      <section>
        <h2>官方 Skills</h2>
        {data?.official.map(skill => (
          <SkillCard
            key={skill.slug}
            skill={skill}
            onToggle={() => skill.enabled
              ? disableOfficialSkill({ data: { skillName: skill.slug } })
              : enableOfficialSkill({ data: { skillName: skill.slug } })
            }
          />
        ))}
      </section>

      {/* 用户 Skills */}
      <section>
        <h2>我的 Skills</h2>
        {data?.user.map(skill => (
          <UserSkillCard
            key={skill.slug}
            skill={skill}
            onToggle={() => skill.enabled
              ? disableUserSkill({ data: { skillName: skill.slug } })
              : enableUserSkill({ data: { skillName: skill.slug } })
            }
            onDelete={() => deleteUserSkill({ data: { skillName: skill.slug } })}
          />
        ))}
        <Button onClick={() => redirect({ to: '/agents/skills/upload' })}>
          上传新技能
        </Button>
      </section>
    </div>
  )
}
```

---

## 📊 完整流程对比

### 官方 Skills 流程

```
浏览官方技能库
  ↓
选择技能（如 github-summary）
  ↓
点击"启用"
  ↓
系统调用 enableSkill()
  ↓
从 src/skills-store/github-summary/ 复制
  ↓
到 /data/users/{userId}/.claude/skills/github-summary/
  ↓
SDK 通过 settingSources: ['project'] 加载
  ↓
变为"已启用"状态
```

### 用户上传 Skills 流程（推荐）

```
上传技能
  ↓
填写表单（名称、描述、文件）
  ↓
系统调用 uploadUserSkill()
  ↓
创建 /data/users/{userId}/user-skills/{skillName}/
  ↓
写入文件 + 创建 .enabled 标记（自动启用）
  ↓
创建 symlink（首次上传时）
  ↓
SDK 通过 settingSources: ['project'] 自动加载
  ↓
✨ 立即可用，无需手动启用
  ↓
可以点击"禁用"删除 .enabled 标记
```

---

## ✅ 最终建议

### 推荐方案：**上传后自动启用**

**理由**：
1. ✅ 用户体验好，符合直觉
2. ✅ 简化流程，一步到位
3. ✅ 类似于"本地开发"（保存即生效）
4. ✅ 可以通过"禁用"按钮临时关闭

**实现要点**：
- ✨ 上传时自动创建 `.enabled` 标记
- ✨ 创建 symlink（仅需一次）
- ✨ SDK 自动加载所有技能
- ✨ 应用层通过 `.enabled` 标记管理状态
- ✨ 前端统一展示官方技能和用户技能

---

## 🔗 相关文档

- [Skills 上传路径设计](./SKILLS_UPLOAD_PATH_DESIGN.md)
- [Skills 自用风险分析](./SKILLS_SELF_USE_ANALYSIS.md)
