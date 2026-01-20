---
name: glm-image
description: 智谱图像生成服务，使用 cogview 系列模型生成图片
category: image
tags: ["image", "generation", "cogview", "zhipu", "ai"]
icon: image
defaultEnabled: true

mcp:
  type: sdk
  name: glm-image

allowedTools:
  - "mcp__glm-image__generate"

credentials:
  - key: ZHIPU_API_KEY
    label: 智谱 API Key
    type: password
    required: false
    description: 留空则使用系统默认 API Key
    envFallback: ZHIPU_API_KEY
---

# 智谱图像生成 MCP

基于智谱 AI cogview 系列模型的图像生成服务。

## 可用工具

| 工具 | 描述 |
|------|------|
| generate | 根据文本提示生成图片 |

## 工具参数

### generate

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `prompt` | string | 是 | 图片生成提示词 |
| `imagePath` | string | 否 | 输出路径（相对于工作区，默认: generated.png） |
| `model` | string | 否 | 模型: glm-image (唯一支持) |
| `size` | string | 否 | 尺寸: 1024x1024 (默认), 1280x720, 768x1344 等 |
| `quality` | string | 否 | 质量: hd (默认), standard |
| `watermark` | boolean | 否 | 启用水印 (默认: false) |

## 支持的尺寸

- `1024x1024` - 正方形 (默认)
- `1280x1280` - 大正方形
- `768x1344` - 竖版 4:7
- `1344x768` - 横版 7:4
- `864x1152` - 竖版 3:4
- `1152x864` - 横版 4:3
- `1440x720` - 超宽 2:1
- `720x1440` - 超高 1:2
- `1280x720` - 横版 16:9
- `720x1280` - 竖版 9:16
- `1280x960` - 横版 4:3
- `960x1280` - 竖版 3:4

## 使用示例

- "生成一张可爱的猫咪图片"
- "创建一个现代科技风格的封面"
- "画一幅山水画，保存为 landscape.png"

## 返回数据

```json
{
  "success": true,
  "savedImage": "path/to/output.png",
  "model": "cogview-4",
  "size": "1024x1024",
  "quality": "hd",
  "watermark": false,
  "url": "https://...",
  "created": 1234567890
}
```

## 凭证说明

此 MCP 使用智谱 API Key。如果不填写，将使用系统配置的默认 API Key。

## 注意事项

- 图片生成通常需要 10-30 秒
- 失败时会自动重试一次
- 生成的图片保存在会话工作区中
