# Skills 上传嵌套目录修复

**修复时间**: 2025-01-10
**问题**: 用户上传技能后无法预览，提示 "Skill not found"
**根本原因**: zip 文件解压后产生嵌套目录结构

---

## 🐛 问题分析

### 文件结构错误

**用户上传**: `ai-market-intelligence.zip`，内部结构：
```
ai-market-intelligence.zip
  └─ ai-market-intelligence/      ← zip 内的根目录
      ├─ SKILL.md
      ├─ references/
      └─ scripts/
```

**实际存储**（错误）：
```
/data/users/.../.claude/skills/user/ai-market-intelligence/
  └─ ai-market-intelligence/      ← 多了一层嵌套！
      ├─ SKILL.md
      ├─ references/
      └─ scripts/
```

**期望存储**（正确）：
```
/data/users/.../.claude/skills/user/ai-market-intelligence/
  ├─ SKILL.md       ← 直接在技能目录下
  ├─ references/
  └─ scripts/
```

### 查找失败原因

`getSkillDetail` 函数查找路径：
```
/data/users/.../.claude/skills/user/ai-market-intelligence/SKILL.md
```

但实际文件在：
```
/data/users/.../.claude/skills/user/ai-market-intelligence/ai-market-intelligence/SKILL.md
```

因此找不到文件，抛出 `Error: Skill not found: ai-market-intelligence`

---

## ✅ 修复方案

### 修改 `uploadUserSkill` 函数

**文件**: `src/claude/skills/manager.ts`

**核心逻辑**：智能检测 zip 结构，自动处理有根目录和扁平结构两种情况

### 检测逻辑

```typescript
// 1. 收集所有第一层目录名
const firstLevelDirs = new Set<string>()
for (const file of files) {
  const firstPart = file.path.split(path.sep)[0]
  if (firstPart && !firstPart.includes('.')) {
    firstLevelDirs.add(firstPart)
  }
}

// 2. 判断是否有共同的根目录
const shouldStripRootDir = firstLevelDirs.size === 1 && files.every(f => {
  const firstPart = f.path.split(path.sep)[0]
  return firstPart === [...firstLevelDirs][0]
})
```

### 处理逻辑

```typescript
// 如果检测到根目录，去除第一层
let finalPath = normalizedPath
if (shouldStripRootDir) {
  const pathParts = normalizedPath.split(path.sep)
  finalPath = pathParts.slice(1).join(path.sep)
  // 边界情况：处理后为空，保留原路径
  if (!finalPath) {
    finalPath = pathParts[0]
  }
}
```

### 两种 zip 结构支持

#### 情况1：有根目录（自动去除）

**zip 内部结构**：
```
ai-market-intelligence.zip
  └─ ai-market-intelligence/
      ├─ SKILL.md
      ├─ references/
      │   └─ doc.md
      └─ scripts/
          └─ run.sh
```

**处理结果**：
```
user/ai-market-intelligence/
  ├─ SKILL.md              ← SKILL.md (去除了 ai-market-intelligence/)
  ├─ references/
  │   └─ doc.md            ← references/doc.md
  └─ scripts/
      └─ run.sh            ← scripts/run.sh
```

#### 情况2：扁平结构（保持原样）

**zip 内部结构**：
```
custom-skill.zip
  ├─ SKILL.md
  ├─ script.sh
  └─ docs/
      └─ README.md
```

**处理结果**：
```
user/custom-skill/
  ├─ SKILL.md              ← SKILL.md (保持不变)
  ├─ script.sh             ← script.sh (保持不变)
  └─ docs/
      └─ README.md         ← docs/README.md (保持不变)
```

### 示例对照表

| Zip 结构 | 文件路径 | 检测结果 | 处理后路径 |
|---------|---------|---------|-----------|
| **有根目录** | `skill/SKILL.md` | ✅ 检测到根目录 `skill` | `SKILL.md` |
| **有根目录** | `skill/docs/readme.md` | ✅ 检测到根目录 `skill` | `docs/readme.md` |
| **扁平结构** | `SKILL.md` | ❌ 无共同根目录 | `SKILL.md` |
| **扁平结构** | `docs/readme.md` | ❌ 无共同根目录 | `docs/readme.md` |
| **扁平结构** | `script.sh` | ❌ 无共同根目录 | `script.sh` |

### 检测算法说明

1. **收集第一层路径**：遍历所有文件，提取每条路径的第一部分
2. **判断是否为目录**：排除包含 `.` 的路径（如 `SKILL.md`）
3. **检测共同根目录**：
   - 如果只有一个唯一的第一层目录名
   - 且所有文件都以该目录开头
   - 则判定为有根目录的 zip，需要去除
4. **边界情况处理**：去除后路径为空时，保留原路径

---

## 🧪 验证步骤

### 1. 删除旧的错误文件结构

```bash
docker exec <container> rm -rf /data/users/<userId>/.claude/skills/user/ai-market-intelligence
```

### 2. 重新上传技能

1. 进入 `/agents/skills` 页面
2. 点击"上传新技能"
3. 选择 `ai-market-intelligence.zip`
4. 等待上传成功

### 3. 验证文件结构

```bash
docker exec <container> ls -la /data/users/<userId>/.claude/skills/user/ai-market-intelligence/
```

**期望输出**：
```
drwxr-xr-x    - .enabled
drwxr-xr-x    - references/
drwxr-xr-x    - scripts/
-rw-r--r--    - SKILL.md       ← 直接在这里，不是在子目录中
```

### 4. 测试预览功能

1. 找到 `ai-market-intelligence` 技能卡片
2. 点击"查看详情"按钮
3. ✅ 应该能正常显示技能内容和文件列表

---

## 📊 影响范围

### 修改的文件

1. **`src/claude/skills/manager.ts`**
   - 修改 `uploadUserSkill` 函数
   - 添加路径处理逻辑（去除第一层目录）

### 兼容性

✅ **向后兼容**：
- 已上传的技能：需要删除后重新上传
- 新上传的技能：自动使用正确的路径结构
- 官方技能：不受影响（使用不同的上传路径）

---

## 💡 为什么选择智能检测而非固定处理？

### 可能的其他方案

**方案A：总是去除第一层**（❌ 不可行）
- 问题：破坏扁平结构的 zip
- 示例：`SKILL.md` → 处理后为空 → 导致错误

**方案B：前端处理**（❌ 不推荐）
- 问题：
  - 前端需要检测 zip 结构，增加复杂度
  - 如果有其他上传方式（如 API），需要重复实现
  - 路径逻辑分散，难以维护

**方案C：后端智能检测**（✅ 推荐）
- 优势：
  - 统一处理所有上传来源
  - 自动适配两种 zip 结构
  - 有日志记录，便于调试
  - 集中维护路径逻辑

---

## 🎓 经验教训

### zip 文件处理的常见陷阱

1. **根目录问题**：zip 通常包含一个根目录，需要剥离
2. **路径分隔符**：Windows (`\`) 和 Unix (`/`) 不同
3. **安全检查**：防止路径遍历攻击 (`../`)
4. **文件计数**：限制解压后的文件数量

### 最佳实践

```typescript
// 1. 标准化路径
const normalizedPath = path.normalize(file.path)

// 2. 安全检查
if (normalizedPath.includes('..')) {
  throw new Error('Invalid file path')
}

// 3. 去除根目录（如果需要）
const pathParts = normalizedPath.split(path.sep)
const strippedPath = pathParts.slice(1).join(path.sep)

// 4. 构建最终路径
const filePath = path.join(baseDir, strippedPath)
```

---

## ✅ 验收

- [x] 修改 `uploadUserSkill` 函数，实现智能检测
- [x] 支持有根目录的 zip 结构（自动去除）
- [x] 支持扁平结构的 zip（保持原样）
- [x] 添加日志记录，便于调试
- [x] 删除容器内旧的错误文件结构
- [x] 文档更新（本文档 + 测试用例）
- [ ] 用户重新上传技能并验证
- [ ] 确认技能预览功能正常

---

**修复完成！** ✅

请用户重新上传 `ai-market-intelligence.zip` 文件，这次应该能正常预览了。
