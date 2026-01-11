# Skills 开发者指南

**更新时间**: 2025-01-10
**目标读者**: 技能开发者、AI 工具构建者

---

## 目录

- [架构概览](#架构概览)
- [SKILL.md 格式规范](#skillmd-格式规范)
- [最佳实践](#最佳实践)
- [代码示例](#代码示例)
- [调试技巧](#调试技巧)
- [高级用法](#高级用法)

---

## 架构概览

### Claude Agent SDK 如何识别 Skills？

SDK 使用递归扫描机制发现技能：

```typescript
// SDK 配置
const sdk = new AnthropicBetaClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  settingSources: ['project'], // 扫描 .claude/skills/
});

// 自动发现所有 SKILL.md
.claude/
└── skills/
    ├── official/
    │   └── example-skill/
    │       └── SKILL.md  ✅ 自动发现
    └── user/
        └── my-skill/
            ├── SKILL.md   ✅ 自动发现
            ├── src/
            │   └── utils.ts
            └── README.md
```

### 技能加载流程

```
1. SDK 启动
   ↓
2. 扫描 .claude/skills/
   ↓
3. 递归查找所有 SKILL.md
   ↓
4. 解析 frontmatter 元数据
   ↓
5. 检查 .enabled 标记
   ↓
6. 加载启用的技能到上下文
```

---

## SKILL.md 格式规范

### 基本结构

```markdown
---
name: skill-name
description: Brief description
category: development
---

# Skill Name

Detailed instructions for Claude.

## Usage

When and how to use this skill.

## Examples

Example scenarios.
```

### Frontmatter 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 技能唯一标识符 |
| `description` | string | ✅ | 简短描述（建议 50 字符以内） |
| `category` | string | ❌ | 分类：development/productivity/design/integration |

### 内容部分

SKILL.md 的正文是**自然语言指令**，告诉 Claude：

1. **技能的功能**
2. **何时使用**
3. **如何使用**
4. **注意事项**

#### 示例：代码审查技能

```markdown
---
name: code-reviewer
description: Perform comprehensive code reviews
category: development
---

# Code Reviewer Skill

You are an expert code reviewer. When asked to review code:

## Review Checklist

- [ ] Code correctness and logic
- [ ] Performance considerations
- [ ] Security vulnerabilities
- [ ] Error handling
- [ ] Code style and consistency
- [ ] Documentation completeness

## Review Format

Provide feedback in this format:

### 🟢 Strengths
- What the code does well

### 🟡 Suggestions
- Potential improvements

### 🔴 Issues
- Bugs or problems that must be fixed

## Examples

User: "Review this function"
```typescript
function processData(data: any[]) {
  return data.map(x => x * 2);
}
```

Your response:
### 🟢 Strengths
- Clear, concise implementation
- Proper use of map for transformation

### 🟡 Suggestions
- Add type annotation for parameter instead of `any`
- Consider adding input validation

### 🔴 Issues
- None
```

---

## 最佳实践

### 1. 清晰的技能名称

✅ **好**:
- `code-reviewer`
- `api-client-generator`
- `document-summarizer`

❌ **差**:
- `my-skill`
- `helper`
- `tool`

**原则**：使用描述性名称，反映技能功能。

### 2. 结构化指令

使用 Markdown 标题组织内容：

```markdown
## When to Use
Use this skill when...

## How to Use
Follow these steps...

## Output Format
Provide results in...
```

### 3. 具体示例

提供真实的使用示例：

```markdown
## Examples

### Example 1: Simple case
User: "..."
Assistant: "..."

### Example 2: Advanced case
User: "..."
Assistant: "..."
```

### 4. 边界和限制

明确说明技能的限制：

```markdown
## Limitations

- Only supports JSON files up to 1MB
- Does not handle nested arrays
- Requires specific input format
```

### 5. 错误处理

指导 Claude 如何处理错误：

```markdown
## Error Handling

If you encounter:
- Invalid input: Ask user to correct format
- Missing data: Request required fields
- API errors: Suggest retry or alternative approach
```

---

## 代码示例

### 示例 1：简单文本处理技能

**SKILL.md**:
```markdown
---
name: text-formatter
description: Format and clean text content
category: productivity
---

# Text Formatter

You are a text formatting expert. When asked to format text:

## Formatting Rules

1. Remove extra whitespace
2. Fix common punctuation errors
3. Standardize quotation marks
4. Fix capitalization
5. Preserve paragraph structure

## Example

Input:
```text
hello    world!!
this is  a test.
```

Output:
```text
Hello world!!
This is a test.
```
```

### 示例 2：带代码文件的技能

**SKILL.md**:
```markdown
---
name: api-helper
description: Generate API client code
category: development
---

# API Helper

Generate TypeScript API client code from OpenAPI specs.

Refer to `src/templates/client.ts` for the code template.
Use `src/utils/types.ts` for type generation utilities.
```

**src/templates/client.ts**:
```typescript
export function generateApiClient(baseUrl: string): string {
  return `// Generated API Client
class APIClient {
  private baseUrl = '${baseUrl}';

  async request(endpoint: string, options?: RequestInit) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, options);
    return response.json();
  }
}

export default new APIClient();
`;
}
```

**src/utils/types.ts**:
```typescript
export function generateType(schema: any): string {
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number') return 'number';
  // ... more logic
}
```

### 示例 3：配置驱动技能

**SKILL.md**:
```markdown
---
name: translator
description: Multi-language text translator
category: productivity
---

# Translator

Translate text between languages.

See `config/languages.json` for supported languages.
Use `src/utils/translate.ts` for translation logic.
```

**config/languages.json**:
```json
{
  "supported": ["en", "zh", "es", "fr", "de"],
  "default": "en"
}
```

**src/utils/translate.ts**:
```typescript
export function detectLanguage(text: string): string {
  // Language detection logic
}

export function translateText(text: string, targetLang: string): string {
  // Translation logic
}
```

---

## 调试技巧

### 1. 本地测试

上传技能前，在本地测试：

```bash
# 1. 创建技能目录
mkdir -p .claude/skills/user/my-skill

# 2. 创建 SKILL.md
cat > .claude/skills/user/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: Test skill
category: development
---

# Test Skill

This is a test skill.
EOF

# 3. 创建 .enabled 标记
echo "$(date)" > .claude/skills/user/my-skill/.enabled

# 4. 重启 Claude Agent SDK
```

### 2. 验证格式

使用 YAML 验证器检查 frontmatter：

```bash
# 安装 yamllint
pip install yamllint

# 验证 SKILL.md
yamllint -d relaxed .claude/skills/user/my-skill/SKILL.md
```

### 3. 测试技能功能

在对话中测试：

```
User: "Use the my-skill to help me with..."
Assistant: "[Should use the skill instructions]"
```

### 4. 查看日志

检查 SDK 日志确认技能加载：

```
[INFO] Loading skills from .claude/skills/
[INFO] Found 1 user skill: my-skill
[INFO] Skill my-skill is enabled
```

---

## 高级用法

### 1. 技能组合

多个技能可以协同工作：

```markdown
---
name: full-stack-generator
description: Generate full-stack application code
category: development
---

# Full Stack Generator

This skill combines:
- `frontend-generator` - UI components
- `backend-generator` - API endpoints
- `database-schema-generator` - Database models

Workflow:
1. Use database-schema-generator to design models
2. Use backend-generator to create APIs
3. Use frontend-generator to build UI
```

### 2. 条件逻辑

在指令中使用条件：

```markdown
## When to Use

Use this skill when:
- User asks to "generate API client"
- User mentions "OpenAPI" or "Swagger"
- User provides API specification

## When NOT to Use

Do NOT use this skill when:
- User asks for manual implementation
- API is too simple (less than 3 endpoints)
```

### 3. 输出模板

提供结构化输出模板：

```markdown
## Output Format

Provide results in this markdown format:

```markdown
# API Client: {API Name}

## Setup
\`\`\`bash
npm install {package-name}
\`\`\`

## Usage
\`\`\`typescript
import { APIClient } from '{package-name}';

const client = new APIClient();
\`\`\`

## Available Methods
| Method | Endpoint | Description |
|--------|----------|-------------|
| ... | ... | ... |
```
```

### 4. 引用外部资源

在技能中引用其他文件：

```markdown
# Code Generator

Generate code based on templates.

## Templates

- `src/templates/basic.ts` - Simple template
- `src/templates/advanced.ts` - Complex template
- `src/config/options.json` - Configuration options

## Usage

When generating code:
1. Read the appropriate template
2. Apply user specifications
3. Output the generated code
```

---

## 性能优化

### 1. 精简指令

保持指令简洁高效：

❌ **冗长**:
```markdown
## Very Detailed Section

You should do this, and then you should do that, and then...
(repeat 20 times)
```

✅ **简洁**:
```markdown
## Quick Reference

1. Do this
2. Do that
3. Done
```

### 2. 限制文件数量

保持技能文件最小化：

```
my-skill/
├── SKILL.md          # 必需
├── template.ts       # 核心模板
└── README.md         # 文档
```

避免：
```
my-skill/
├── SKILL.md
├── src/
│   ├── utils/
│   │   ├── helpers.ts
│   │   ├── validators.ts
│   │   └── transformers.ts
│   └── ...
├── tests/
│   └── ...
├── examples/
│   └── ...
└── docs/
    └── ...
```

### 3. 使用代码片段

将代码内联到 SKILL.md：

```markdown
## Code Template

\`\`\`typescript
function {name}({params}): {returnType} {
  // Implementation
  return {value};
}
\`\`\`
```

而不是引用外部文件。

---

## 安全建议

### 1. 输入验证

在指令中包含验证逻辑：

```markdown
## Validation

Before generating code, verify:
- Input is valid JSON/YAML
- Required fields are present
- No malicious code patterns
```

### 2. 沙盒执行

建议用户在沙盒中测试：

```markdown
## Testing

Always test generated code in a sandbox environment first:
- Use Docker containers
- Run isolated Node.js processes
- Never test in production
```

### 3. 数据保护

提醒用户保护敏感数据：

```markdown
## Security

⚠️ **Never**:
- Hardcode API keys or secrets
- Include passwords in generated code
- Log sensitive information

✅ **Always**:
- Use environment variables
- Implement proper authentication
- Follow security best practices
```

---

## 发布和维护

### 版本管理

在 SKILL.md 中包含版本信息：

```markdown
---
name: my-skill
description: My awesome skill
category: development
version: 1.0.0
---

# My Skill v1.0.0

## Changelog

### v1.0.0 (2025-01-10)
- Initial release
```

### 文档

为技能提供 README：

```markdown
# My Skill

## Overview
Brief description

## Installation
Upload to .claude/skills/user/

## Usage
Example usage

## Contributing
How to contribute
```

---

## 常见问题

### Q: 技能指令太长怎么办？

**A**: 拆分为多个技能，或使用引用外部文件。

### Q: 如何处理复杂的代码生成？

**A**: 提供模板和工具函数，让 Claude 基于模板生成。

### Q: 技能之间的冲突？

**A**: 使用明确的命名空间和条件逻辑避免冲突。

### Q: 如何测试技能？

**A**:
1. 本地上传到 `.claude/skills/user/`
2. 创建 `.enabled` 标记
3. 在对话中测试
4. 根据结果调整

---

## 资源链接

- [用户指南](./SKILLS_USER_GUIDE.md) - 如何使用技能
- [实施计划](./SKILLS_UPLOAD_IMPLEMENTATION_PLAN.md) - 技术实现
- [Claude Agent SDK 文档](https://docs.anthropic.com/) - 官方 SDK 文档

---

**Happy Coding! 🚀**
