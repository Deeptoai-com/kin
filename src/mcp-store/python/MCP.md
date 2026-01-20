---
name: python
description: Python 代码执行器，在会话工作区内安全运行 Python 代码
category: code
tags: ["python", "code", "execution", "sandbox"]
icon: code
defaultEnabled: true

mcp:
  type: sdk
  name: python

allowedTools:
  - "mcp__python__run"
---

# Python 代码执行器

在会话工作区内安全执行 Python 代码，无需 shell 权限。

## 可用工具

| 工具 | 描述 |
|------|------|
| run | 执行 Python 代码并返回结果 |

## 工具参数

### run

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `code` | string | 是 | 要执行的 Python 代码 |
| `timeoutMs` | number | 否 | 执行超时时间（毫秒，默认: 10000） |
| `maxOutputBytes` | number | 否 | 最大输出字节数（默认: 512000） |

## 返回数据

```json
{
  "stdout": "输出内容",
  "stderr": "错误输出",
  "exitCode": 0,
  "signal": null,
  "durationMs": 123,
  "timedOut": false,
  "truncated": false,
  "killedByLimit": false,
  "filesCreated": ["output.txt"],
  "filesUpdated": ["data.json"]
}
```

## 使用示例

- "用 Python 计算斐波那契数列前 20 项"
- "分析这个 CSV 文件的数据"
- "生成一个饼图并保存为 chart.png"
- "运行这段 Python 代码"

## 安全特性

- 代码在独立子进程中执行
- 自动超时保护（默认 10 秒）
- 输出大小限制
- 代码大小限制
- 不使用 shell，减少攻击面
- 自动跟踪文件变更

## 注意事项

- 代码在会话工作区目录中执行
- 临时文件保存在 `__python__/` 目录
- 支持 matplotlib 等图形库（使用 Agg 后端）
- 执行完成后自动清理临时脚本文件
