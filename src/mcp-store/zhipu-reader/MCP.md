---
name: zhipu-reader
description: 智谱网页阅读服务，抓取并解析网页内容
category: web
tags: ["reader", "web", "scraper", "content", "zhipu"]
icon: book-open
defaultEnabled: true

mcp:
  type: http
  name: zhipu-reader
  url: https://open.bigmodel.cn/api/mcp/web_reader/mcp
  headers:
    Authorization: "Bearer ${ZHIPU_API_KEY}"

allowedTools:
  - "mcp__zhipu-reader__*"

credentials:
  - key: ZHIPU_API_KEY
    label: 智谱 API Key
    type: password
    required: false
    description: 留空则使用系统默认 API Key
    envFallback: ZHIPU_API_KEY
---

# 智谱网页阅读 MCP

基于智谱 AI 的网页阅读服务，抓取指定 URL 的网页内容并进行结构化解析。

## 可用工具

| 工具 | 描述 |
|------|------|
| webReader | 抓取网页内容，返回结构化数据 |

## 返回数据

- 网页标题
- 正文内容
- 元数据
- 链接列表

## 使用示例

- "帮我阅读这个网页的内容：https://example.com"
- "提取这篇文章的主要内容"
- "获取这个页面上的所有链接"
- "总结这个网页讲了什么"

## 凭证说明

此 MCP 使用智谱 API Key。如果不填写，将使用系统配置的默认 API Key。
