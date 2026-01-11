# Skills 上传功能测试用例

**测试目标**：验证两种 zip 结构都能正确处理

---

## 测试用例

### 用例1：有根目录的 zip（最常见）

**文件名**: `ai-market-intelligence.zip`

**内部结构**:
```
ai-market-intelligence.zip
  └─ ai-market-intelligence/
      ├─ SKILL.md
      ├─ references/
      │   └─ doc.md
      └─ scripts/
          └─ run.sh
```

**预期日志**:
```json
{
  "level": "info",
  "msg": "[Skills] Zip structure detection:",
  "hasRootDir": true,
  "rootDir": "ai-market-intelligence",
  "fileCount": 4
}
```

**预期结果**:
```
/data/users/.../.claude/skills/user/ai-market-intelligence/
  ├─ .enabled
  ├─ SKILL.md              ← 不在子目录中
  ├─ references/
  │   └─ doc.md
  └─ scripts/
      └─ run.sh
```

---

### 用例2：扁平结构的 zip

**文件名**: `custom-skill.zip`

**内部结构**:
```
custom-skill.zip
  ├─ SKILL.md
  ├─ script.sh
  ├─ docs/
  │   └─ README.md
  └─ src/
      └─ index.ts
```

**预期日志**:
```json
{
  "level": "info",
  "msg": "[Skills] Zip structure detection:",
  "hasRootDir": false,
  "rootDir": "none",
  "fileCount": 5
}
```

**预期结果**:
```
/data/users/.../.claude/skills/user/custom-skill/
  ├─ .enabled
  ├─ SKILL.md              ← 直接在根目录
  ├─ script.sh             ← 保持原路径
  ├─ docs/
  │   └─ README.md
  └─ src/
      └─ index.ts
```

---

### 用例3：只有单个文件的 zip

**文件名**: `simple-skill.zip`

**内部结构**:
```
simple-skill.zip
  └─ SKILL.md
```

**预期日志**:
```json
{
  "level": "info",
  "msg": "[Skills] Zip structure detection:",
  "hasRootDir": false,
  "rootDir": "none",
  "fileCount": 1
}
```

**预期结果**:
```
/data/users/.../.claude/skills/user/simple-skill/
  ├─ .enabled
  └─ SKILL.md
```

---

## 测试步骤

### 1. 准备测试文件

**创建有根目录的 zip**:
```bash
# 创建临时目录
mkdir -p /tmp/test-skill-root/ai-market-intelligence
cd /tmp/test-skill-root/ai-market-intelligence

# 创建测试文件
cat > SKILL.md << 'EOF'
name: AI Market Intelligence
description: Test skill with root directory
category: analysis
EOF

mkdir -p references scripts
echo "# References" > references/doc.md
echo "#!/bin/bash" > scripts/run.sh

# 打包（注意在父目录打包）
cd /tmp/test-skill-root
zip -r ai-market-intelligence.zip ai-market-intelligence/
```

**创建扁平结构的 zip**:
```bash
# 创建临时目录
mkdir -p /tmp/test-skill-flat
cd /tmp/test-skill-flat

# 创建测试文件
cat > SKILL.md << 'EOF'
name: Custom Skill
description: Test skill without root directory
category: custom
EOF

mkdir -p docs src
echo "# README" > docs/README.md
echo "console.log('test');" > src/index.ts

# 打包
zip -r custom-skill.zip SKILL.md docs/ src/
```

### 2. 上传测试

1. 访问 `/agents/skills` 页面
2. 点击"上传新技能"
3. 分别上传两个测试 zip
4. 查看容器日志确认检测逻辑
5. 验证文件结构是否正确

### 3. 验证文件结构

```bash
# 查看容器日志
docker logs ex0-app | grep "Zip structure detection"

# 检查文件结构
docker exec ex0-app sh -c "find /data/users/<userId>/.claude/skills/user/ -type f -name SKILL.md"
```

**预期输出**:
```
/data/users/.../user/ai-market-intelligence/SKILL.md
/data/users/.../user/custom-skill/SKILL.md
/data/users/.../user/simple-skill/SKILL.md
```

### 4. 测试预览功能

1. 在技能列表中找到上传的技能
2. 点击"查看详情"按钮
3. ✅ 应该能正常显示技能内容和文件列表

---

## 调试技巧

### 查看上传日志

```bash
# 实时查看容器日志
docker logs -f ex0-app | grep -E "\[Skills\]|Zip structure"

# 查看最近的技能相关日志
docker logs ex0-app --tail 100 | grep "\[Skills\]"
```

### 检查文件结构

```bash
# 列出所有用户技能
docker exec ex0-app sh -c "ls -la /data/users/<userId>/.claude/skills/user/"

# 查看某个技能的详细结构
docker exec ex0-app sh -c "find /data/users/<userId>/.claude/skills/user/<skill-name> -type f"
```

### 手动测试路径逻辑

```typescript
// 在 Node.js REPL 中测试
const path = require('path');

// 模拟检测逻辑
function detectRootDir(files) {
  const firstLevelDirs = new Set();
  for (const file of files) {
    const firstPart = file.split(path.sep)[0];
    if (firstPart && !firstPart.includes('.')) {
      firstLevelDirs.add(firstPart);
    }
  }

  const shouldStrip = firstLevelDirs.size === 1 && files.every(f => {
    const firstPart = f.split(path.sep)[0];
    return firstPart === [...firstLevelDirs][0];
  });

  return { shouldStrip, rootDir: [...firstLevelDirs][0] };
}

// 测试用例1：有根目录
console.log(detectRootDir([
  'ai-market-intelligence/SKILL.md',
  'ai-market-intelligence/references/doc.md'
]));
// 输出: { shouldStrip: true, rootDir: 'ai-market-intelligence' }

// 测试用例2：扁平结构
console.log(detectRootDir([
  'SKILL.md',
  'docs/README.md',
  'src/index.ts'
]));
// 输出: { shouldStrip: false, rootDir: undefined }
```

---

## 常见问题

### Q1: 检测逻辑会不会误判？

**A**: 理论上可能，但概率很低。检测逻辑要求：
1. 只有一个唯一的第一层目录名
2. **所有**文件都以该目录开头

如果 zip 包含多个顶层文件（如 `SKILL.md` 和 `script.sh`），即使有目录，也不会被判定为根目录。

### Q2: 如果 zip 内有多个根目录怎么办？

**A**: 这种情况下检测逻辑会判定为扁平结构（`shouldStripRootDir = false`），保持所有路径不变。这是合理的行为，因为我们无法自动判断哪个根目录应该去除。

### Q3: 如何验证检测是否正确？

**A**:
1. 查看日志：`docker logs ex0-app | grep "Zip structure detection"`
2. 检查文件结构：`docker exec ex0-app find /data/users/.../.claude/skills/user/`
3. 测试预览功能：点击"查看详情"按钮

---

## 验收标准

- ✅ 有根目录的 zip 能正确提取，去除根目录层
- ✅ 扁平结构的 zip 能正确提取，保持路径不变
- ✅ 单文件 zip 能正确处理
- ✅ 容器日志显示正确的检测结果
- ✅ 技能预览功能正常工作
- ✅ 不会破坏已有的官方技能功能

---

**测试完成后，请更新本文档记录测试结果。**
