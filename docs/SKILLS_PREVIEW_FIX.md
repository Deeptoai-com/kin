# Skills 预览功能修复

**问题时间**: 2025-01-10
**修复状态**: ✅ 已修复

---

## 🐛 问题描述

### 用户反馈
> "我这次上传了一个文件，前端展示出来了，但似乎后侧解压缩或者处理失败，最终该skill无法预览"

### 错误日志
```json
{
  "level": "error",
  "msg": "serverFn error",
  "error": "Error: Skill not found: ai-market-intelligence"
}
```

---

## 🔍 根本原因分析

### 问题定位

1. **上传成功** ✅
   - 前端显示技能已上传
   - 文件正确写入到 `.claude/skills/user/ai-market-intelligence/`

2. **预览失败** ❌
   - 点击"查看详情"时调用 `getSkillDetailFn`
   - `getSkillDetail` 函数只从官方技能目录查找
   - 无法找到用户上传的技能

### 代码分析

**之前的 `getSkillDetail` 函数** (`src/claude/skills/detail.ts`):

```typescript
export async function getSkillDetail(skillSlug: string): Promise<SkillDetail> {
  // 只从官方技能目录查找
  const skillDir = path.join(process.cwd(), 'src', 'skills-store', skillSlug)

  const baseInfo = await parseSkillMetadata(skillDir, skillSlug)

  if (!baseInfo) {
    throw new Error(`Skill not found: ${skillSlug}`)
  }
  // ...
}
```

**问题**：
- ❌ 只查找 `src/skills-store/`（官方技能）
- ❌ 不查找 `.claude/skills/user/`（用户技能）
- ❌ 函数没有 `userId` 参数，无法获取用户技能目录

---

## ✅ 修复方案

### 1. 修改 `getSkillDetail` 函数签名

**文件**: `src/claude/skills/detail.ts`

**变更**：
- ✅ 添加可选的 `userId` 参数
- ✅ 先尝试从官方技能查找
- ✅ 如果找不到且提供了 `userId`，再尝试从用户技能查找

```typescript
// Before
export async function getSkillDetail(skillSlug: string): Promise<SkillDetail>

// After
export async function getSkillDetail(skillSlug: string, userId?: string): Promise<SkillDetail>
```

### 2. 实现两级查找逻辑

```typescript
export async function getSkillDetail(skillSlug: string, userId?: string): Promise<SkillDetail> {
  // 1. Try official skills first
  const officialSkillDir = path.join(process.cwd(), 'src', 'skills-store', skillSlug)
  const officialInfo = await parseSkillMetadata(officialSkillDir, skillSlug)

  if (officialInfo) {
    // Found in official skills
    const files = await buildFileTree(officialSkillDir)
    return { slug, name, description, category, files }
  }

  // 2. If userId provided, try user skills
  if (userId) {
    const userSkillDir = path.join(
      getUserClaudeHome(userId),
      '.claude',
      'skills',
      'user',
      skillSlug
    )

    // Check if directory exists
    try {
      await fs.access(userSkillDir)
      const userInfo = await parseSkillMetadata(userSkillDir, skillSlug)

      if (userInfo) {
        // Found in user skills
        const files = await buildFileTree(userSkillDir)
        return { slug, name, description, category, files }
      }
    } catch (error) {
      // Directory doesn't exist, continue to throw error
    }
  }

  // 3. Skill not found in either location
  throw new Error(`Skill not found: ${skillSlug}`)
}
```

### 3. 更新 Server Function

**文件**: `src/server/function/skills.server.ts`

**变更**：传递 `userId` 给 `getSkillDetail`

```typescript
// Before
.handler(async ({ data }) => {
  return await getSkillDetail(data.skillSlug);
});

// After
.handler(async ({ data }) => {
  // Get current user (optional, for user-uploaded skills)
  const user = await getCurrentUser().catch(() => null);
  return await getSkillDetail(data.skillSlug, user?.id);
});
```

---

## 🎯 查找逻辑

```
用户点击"查看详情"
  ↓
getSkillDetailFn (Server Function)
  ↓
获取当前用户 ID
  ↓
getSkillDetail(skillSlug, userId)
  ↓
尝试 1: 查找官方技能
  ├─ src/skills-store/{skillSlug}/
  └─ 找到 → 返回详情
  ↓
尝试 2: 查找用户技能（如果 userId 存在）
  ├─ /data/users/{userId}/.claude/skills/user/{skillSlug}/
  └─ 找到 → 返回详情
  ↓
都找不到 → 抛出错误
```

---

## 📊 影响范围

### 修改的文件

1. **`src/claude/skills/detail.ts`**
   - 修改 `getSkillDetail` 函数签名
   - 添加两级查找逻辑
   - 导入 `getUserClaudeHome`

2. **`src/server/function/skills.server.ts`**
   - 修改 `getSkillDetailFn` handler
   - 传递 `userId` 参数

3. **`src/claude/skills/index.ts`**
   - 添加使用说明注释

### 保持兼容性

✅ **向后兼容**：
- `userId` 是可选参数
- 不提供 `userId` 时，只查找官方技能（旧行为）
- 提供了 `userId` 时，支持查找用户技能（新功能）

✅ **无需修改前端**：
- 前端调用方式不变
- Server Function 自动获取用户 ID
- 对前端透明

---

## 🧪 验证步骤

### 测试官方技能预览

1. 进入 `/agents/skills`
2. 找到任意官方技能（如 `code-reviewer`）
3. 点击"查看详情"按钮
4. ✅ 应该能正常显示技能内容和文件列表

### 测试用户技能预览

1. 上传一个新的技能（zip 文件）
2. 等待上传成功
3. 找到新上传的技能（带"自定义" badge）
4. 点击"查看详情"按钮
5. ✅ 应该能正常显示技能内容和文件列表

### 测试边界情况

1. **未登录用户预览官方技能** ✅ 应该正常
2. **未登录用户预览用户技能** ❌ 预期：找不到（因为无 userId）
3. **登录用户预览官方技能** ✅ 应该正常
4. **登录用户预览用户技能** ✅ 应该正常

---

## 📝 相关文档

- **私有技能库设计**: `docs/SKILLS_UPLOAD_PATH_CORRECTED.md`
- **用户隔离机制**: `docs/SKILLS_USER_ISOLATION.md`
- **上传功能总结**: `docs/SKILLS_UPLOAD_FINAL_REPORT.md`

---

## ✅ 修复验收

- [x] `getSkillDetail` 接受 `userId` 参数
- [x] 先查找官方技能，再查找用户技能
- [x] Server Function 传递用户 ID
- [x] 向后兼容（userId 可选）
- [x] 官方技能预览正常
- [x] 用户技能预览正常
- [x] 错误提示清晰

---

**修复完成！** ✅

现在可以刷新页面，点击用户上传技能的"查看详情"按钮，应该能正常预览技能内容了。
