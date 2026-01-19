---
name: zhipu-vision
description: 智谱视觉理解服务，支持图像分析、OCR、UI转代码、视频解析等
category: ai
tags: ["vision", "ocr", "image", "video", "zhipu"]
icon: eye
defaultEnabled: true

mcp:
  type: stdio
  name: zhipu-vision
  command: npx
  args: ["-y", "@z_ai/mcp-server"]
  env:
    Z_AI_API_KEY: "${ZHIPU_API_KEY}"
    Z_AI_MODE: "ZHIPU"

allowedTools:
  - "mcp__zhipu-vision__*"

credentials:
  - key: ZHIPU_API_KEY
    label: 智谱 API Key
    type: password
    required: false
    description: 留空则使用系统默认 API Key
    envFallback: ZHIPU_API_KEY
---

# 智谱视觉理解 MCP

基于智谱 AI 的视觉理解服务，提供强大的图像和视频分析能力。

## 可用工具

| 工具 | 描述 |
|------|------|
| ui_to_artifact | 将 UI 截图转换为代码 |
| extract_text_from_screenshot | OCR 文字提取 |
| diagnose_error_screenshot | 错误日志分析 |
| understand_technical_diagram | 技术图表理解 |
| analyze_data_visualization | 图表和仪表盘分析 |
| ui_diff_check | UI 视觉对比（QA） |
| image_analysis | 通用图像理解 |
| video_analysis | 视频解析（MP4/MOV/M4V） |

## 使用示例

- "分析这张截图中的 UI 布局"
- "提取这张图片中的文字"
- "帮我把这个 UI 设计转成代码"
- "分析这个错误截图，找出问题"
- "解读这张架构图"

## 凭证说明

此 MCP 使用智谱 API Key。如果不填写，将使用系统配置的默认 API Key。
