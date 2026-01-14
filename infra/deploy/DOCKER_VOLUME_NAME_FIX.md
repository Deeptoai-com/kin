# Docker Volume 名称错误修复指南

> **问题**: Docker volume 名称包含无效字符（空格）  
> **错误信息**: `"App Name-volume" includes invalid characters for a local volume name`

---

## 🔍 问题原因

Docker volume 和 network 名称有严格的命名规则：
- **允许的字符**：`[a-zA-Z0-9][a-zA-Z0-9_.-]`
- **不允许**：空格、特殊字符（如 `!`, `@`, `#` 等）

如果你的 `APP_NAME` 环境变量包含空格（如 `DeeptoAI Agents`），生成的 volume 名称也会包含空格，导致错误。

---

## ✅ 快速修复

### 方法 1: 设置 APP_NAME_SANITIZED（推荐）⭐

在 Dokploy 的 "Environment Variables" 中添加：

```bash
APP_NAME=DeeptoAI Agents
APP_NAME_SANITIZED=DeeptoAI-Agents
```

**规则**：
- 将空格替换为连字符（`-`）
- 移除其他特殊字符
- 只保留字母、数字、连字符、下划线、点

**示例**：
| APP_NAME | APP_NAME_SANITIZED |
|----------|-------------------|
| `DeeptoAI Agents` | `DeeptoAI-Agents` |
| `My App!` | `My-App` |
| `Test App 123` | `Test-App-123` |
| `App-Name` | `App-Name`（无需修改）|

---

### 方法 2: 修改 APP_NAME 本身

如果不想使用 `APP_NAME_SANITIZED`，可以直接修改 `APP_NAME`：

```bash
# 修改前
APP_NAME=DeeptoAI Agents

# 修改后
APP_NAME=DeeptoAI-Agents
```

**注意**：这会影响容器名称，但通常不影响功能。

---

## 📝 在 Dokploy 中操作步骤

1. **进入应用配置**
   - 登录 Dokploy
   - 选择你的应用
   - 进入 "Environment Variables" 或 "环境变量"

2. **添加或修改变量**
   - 如果 `APP_NAME` 包含空格，添加 `APP_NAME_SANITIZED`
   - 或者直接修改 `APP_NAME`，移除空格

3. **保存并重新部署**
   - 保存环境变量
   - 重新部署应用

---

## 🔍 验证修复

部署后，检查 volume 是否创建成功：

```bash
# 查看所有 volume
docker volume ls | grep deeptoai

# 应该看到类似输出（没有空格）：
# deeptoai-agents-data
# deeptoai-agents-minio-data
# deeptoai-agents-redis-data
# deeptoai-agents-meili-data
# deeptoai-agents-claude-sessions
```

---

## ⚠️  注意事项

1. **容器名称**：`APP_NAME` 仍用于容器名称，可能包含空格（Docker 允许，但不推荐）
2. **Volume 名称**：`APP_NAME_SANITIZED` 用于 volume 和 network 名称，不能包含空格
3. **一致性**：确保所有环境中的 `APP_NAME_SANITIZED` 值一致，否则可能导致数据丢失

---

## 📚 相关文档

- **环境变量示例**：`env.dokploy.example`
- **完整部署指南**：`DOKPLOY_DEPLOYMENT.md`
- **Docker Compose 配置**：`docker-compose.dokploy.yml`

---

## 🆘 如果问题仍然存在

1. **检查环境变量**：
   ```bash
   # 在 Dokploy 中查看环境变量
   # 确认 APP_NAME_SANITIZED 已设置且不包含空格
   ```

2. **清理旧的 volume**（谨慎操作）：
   ```bash
   # 列出所有 volume
   docker volume ls
   
   # 删除包含空格的 volume（如果存在）
   docker volume rm "DeeptoAI Agents-minio-data"
   ```

3. **重新部署**：
   - 在 Dokploy 中停止应用
   - 清理旧的 volume（如果需要）
   - 重新部署应用

---

**状态**: 修复指南完成  
**最后更新**: 2026-01-13
