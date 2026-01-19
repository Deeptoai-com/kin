---
name: zhipu-zread
description: 智谱代码仓库阅读服务，浏览 GitHub 代码、文档和 Issue/PR
category: code
tags: ["github", "code", "repository", "documentation", "zhipu"]
icon: code
defaultEnabled: true

mcp:
  type: http
  name: zhipu-zread
  url: https://open.bigmodel.cn/api/mcp/zread/mcp
  headers:
    Authorization: "Bearer ${ZHIPU_API_KEY}"

allowedTools:
  - "mcp__zhipu-zread__*"

credentials:
  - key: ZHIPU_API_KEY
    label: 智谱 API Key
    type: password
    required: false
    description: 留空则使用系统默认 API Key
    envFallback: ZHIPU_API_KEY
---

# 智谱代码阅读 MCP (ZRead)

基于智谱 AI 的代码仓库阅读服务，提供 GitHub 代码库的智能浏览和分析能力。

## 可用工具

| 工具 | 描述 |
|------|------|
| search_doc | 搜索知识文档，查找最近的 Issue/PR |
| get_repo_structure | 获取项目目录结构和文件列表 |
| read_file | 读取指定文件的完整代码内容 |

## 使用示例

- "帮我查看 facebook/react 仓库的目录结构"
- "读取这个仓库的 README 文件"
- "搜索这个项目中关于 authentication 的文档"
- "查找这个仓库最近的 Issue 和 PR"

## 凭证说明

此 MCP 使用智谱 API Key。如果不填写，将使用系统配置的默认 API Key。
