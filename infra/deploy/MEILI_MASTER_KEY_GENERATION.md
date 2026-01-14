# MEILI_MASTER_KEY 生成指南

> **目的**: 说明如何生成 Meilisearch 主密钥（Master Key）

---

## 🔑 什么是 MEILI_MASTER_KEY？

`MEILI_MASTER_KEY` 是 Meilisearch 的主密钥，用于：
- 保护 Meilisearch API 访问
- 控制索引和搜索操作
- 管理 Meilisearch 实例的安全性

**重要**：这是生产环境必需的密钥，必须使用强随机字符串。

---

## ✅ 生成方法

### 方法 1: 使用 OpenSSL（推荐）⭐

**生成 64 字符的十六进制字符串**（推荐）：

```bash
openssl rand -hex 32
```

**输出示例**：
```
938b718e8cb87a4f6da709c62bcb8977306a99f252593f0b3448c30b88426deb
```

**优点**：
- 纯十六进制字符，易于复制和传输
- 64 个字符，安全性高
- 不包含特殊字符，避免转义问题

---

### 方法 2: 使用 OpenSSL Base64 编码

**生成 Base64 编码字符串**：

```bash
openssl rand -base64 32
```

**输出示例**：
```
vmoMgw+sCwfXowIWmPwab1nflDkEc0Ys0J+UZOiFc7w=
```

**注意**：
- 可能包含特殊字符（`+`, `/`, `=`）
- 在某些环境中可能需要转义

---

### 方法 3: 使用 OpenSSL 生成较短密钥

**生成 32 字符的十六进制字符串**（最小推荐长度）：

```bash
openssl rand -hex 16
```

**输出示例**：
```
1f0085b9b38b4f9e5fb83e5ad387eb2f
```

---

## 📝 使用步骤

### 1. 生成密钥

在终端执行：

```bash
openssl rand -hex 32
```

### 2. 复制生成的密钥

复制完整的输出字符串（不包含换行符）。

### 3. 配置到环境变量

在 Dokploy 的 "Environment Variables" 中添加：

```bash
MEILI_MASTER_KEY=你刚才生成的密钥
```

**示例**：
```bash
MEILI_MASTER_KEY=938b718e8cb87a4f6da709c62bcb8977306a99f252593f0b3448c30b88426deb
```

---

## ⚠️  安全建议

1. **使用强随机字符串**：至少 32 个字符，推荐 64 个字符
2. **不要使用弱密码**：避免使用字典词汇、常见密码
3. **妥善保管**：密钥一旦丢失，需要重新配置 Meilisearch
4. **不要提交到版本控制**：确保 `.env` 文件在 `.gitignore` 中
5. **定期轮换**：建议定期更换密钥（需要重新配置 Meilisearch）

---

## 🔍 验证密钥

生成后，可以通过以下方式验证：

```bash
# 检查长度（应该至少 32 个字符）
echo "你的密钥" | wc -c

# 检查是否包含特殊字符（Base64 可能包含）
echo "你的密钥" | grep -E '[^a-zA-Z0-9]'
```

---

## 📚 相关文档

- **环境变量示例**：`env.dokploy.example`
- **环境变量检查清单**：`DOKPLOY_ENV_CHECKLIST.md`
- **完整部署指南**：`DOKPLOY_DEPLOYMENT.md`

---

## 🆘 常见问题

### Q: 密钥可以包含哪些字符？

A: Meilisearch 的 Master Key 可以是任意字符串，但建议使用：
- 十六进制字符（0-9, a-f）：最安全，无特殊字符
- Base64 字符（A-Z, a-z, 0-9, +, /, =）：可能包含特殊字符

### Q: 密钥长度有要求吗？

A: 建议至少 32 个字符，推荐 64 个字符。更长的密钥提供更高的安全性。

### Q: 如果密钥丢失了怎么办？

A: 需要重新生成密钥并更新 Meilisearch 配置。如果 Meilisearch 已经启动，需要：
1. 停止 Meilisearch 服务
2. 更新 `MEILI_MASTER_KEY` 环境变量
3. 重新启动 Meilisearch 服务

### Q: 可以在运行时更改密钥吗？

A: 不可以。Master Key 在 Meilisearch 启动时读取，更改后需要重启服务。

---

**状态**: 生成指南完成  
**最后更新**: 2026-01-13
