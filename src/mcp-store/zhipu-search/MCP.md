---
name: zhipu-search
description: 智谱网页搜索服务，获取实时新闻、金融行情、天气等信息
category: search
tags: ["search", "web", "news", "realtime", "zhipu"]
icon: search
defaultEnabled: true

mcp:
  type: http
  name: zhipu-search
  url: https://open.bigmodel.cn/api/mcp/web_search_prime/mcp
  headers:
    Authorization: "Bearer ${ZHIPU_API_KEY}"

allowedTools:
  - "mcp__zhipu-search__*"

credentials:
  - key: ZHIPU_API_KEY
    label: 智谱 API Key
    type: password
    required: false
    description: 留空则使用系统默认 API Key
    envFallback: ZHIPU_API_KEY
---

# 智谱网页搜索 MCP

基于智谱 AI 的网页搜索服务，提供实时互联网信息检索能力。

## 可用工具

| 工具 | 描述 |
|------|------|
| webSearchPrime | 执行网页搜索，返回结构化结果 |

## 返回数据

- 网站标题
- 直接 URL
- 内容摘要
- 网站来源

## 使用示例

- "搜索最新的 AI 新闻"
- "查询今天的天气"
- "搜索某公司的股票行情"
- "查找某个技术问题的解决方案"

## 凭证说明

此 MCP 使用智谱 API Key。如果不填写，将使用系统配置的默认 API Key。
