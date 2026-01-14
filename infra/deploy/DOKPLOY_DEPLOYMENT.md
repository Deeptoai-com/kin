# Dokploy 部署指南

> **日期**: 2025-12-31  
> **适用文件**: `docker-compose.dokploy.yml`  
> **目的**: 在 Dokploy 平台上部署 Claude Agent Chat 应用

---

## 📋 前提条件

1. ✅ 已安装并配置 Dokploy
2. ✅ Traefik 已启用（Dokploy 默认使用 Traefik）
3. ✅ 有可用的域名
4. ✅ 已准备好所有必需的环境变量

---

## 🚀 部署步骤

### Step 1: 在 Dokploy 中创建应用

1. 登录 Dokploy 控制台
2. 进入你的项目
3. 点击 "New Application" 或 "新建应用"
4. 选择 "Docker Compose" 或 "Docker Compose File"
5. 应用名称：`claude-agent-chat`（或你喜欢的名称）

---

### Step 2: 配置 Docker Compose 文件

Dokploy 支持两种方式配置 Docker Compose 文件：

#### 方式 1: 从 Git 仓库部署（推荐）⭐

如果 Dokploy 连接到 Git 仓库：

1. **在应用配置中，找到 "Compose Path" 或 "Docker Compose File Path" 字段**
2. **填写路径**：`docker-compose.dokploy.yml`
   - 这是相对于 Git 仓库根目录的路径
   - 文件位于项目根目录，所以直接填写文件名即可
3. **保存配置**

**示例**：
```
Compose Path: docker-compose.dokploy.yml
```

#### 方式 2: 手动上传文件

如果使用手动上传方式：

1. 在应用配置中，选择 "Use Docker Compose File" 或 "Upload Compose File"
2. 上传或粘贴 `docker-compose.dokploy.yml` 文件内容
3. 保存配置

**注意**：
- 如果文件在子目录中，Compose Path 需要包含相对路径，例如：`infra/deploy/docker-compose.dokploy.yml`
- 当前项目的 `docker-compose.dokploy.yml` 位于项目根目录，所以路径就是 `docker-compose.dokploy.yml`

---

### Step 3: 配置环境变量

**在 Dokploy 的 "Environment Variables" 中添加环境变量**：

#### 方法 1: 使用环境变量示例文件（推荐）⭐

1. **打开文件**：`infra/deploy/env.dokploy.example`
2. **复制所有变量**到 Dokploy 的 "Environment Variables" 配置中
3. **替换所有占位符值**（`your-xxx`）为实际值
4. **删除或注释掉不需要的可选变量**

#### 方法 2: 使用检查清单

1. **打开检查清单**：`infra/deploy/DOKPLOY_ENV_CHECKLIST.md`
2. **按照清单逐个添加环境变量**
3. **确认所有必需变量都已填写**

#### 快速参考：必需变量最小配置

**最少必需的变量**：

```bash
# 应用配置
APP_NAME=claude-agent-chat
APP_HOSTNAME=your-domain.com

# 数据库
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=claude_agent_chat
DATABASE_URL=postgresql://your_db_user:your_secure_password@db:5432/claude_agent_chat

# MinIO / S3
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=your_minio_password
MINIO_BUCKET=constructa-files

# Redis
REDIS_URL=redis://redis:6379

# Meilisearch
MEILI_MASTER_KEY=your_meili_master_key

# 认证
BETTER_AUTH_SECRET=your_random_secret_key_here_minimum_32_characters
BETTER_AUTH_URL=https://your-domain.com
BETTER_AUTH_INTERNAL_URL=http://localhost:5000

# AI 服务
ANTHROPIC_API_KEY=your_anthropic_api_key
ZHIPU_API_KEY=your_zhipu_api_key

# WebSocket URL
VITE_WS_URL=wss://your-domain.com/ws/agent

# 节点环境
NODE_ENV=production
```

**完整变量列表**：参见 `infra/deploy/env.dokploy.example`

**检查清单**：参见 `infra/deploy/DOKPLOY_ENV_CHECKLIST.md`

---

### Step 4: 配置 Traefik Labels（可选）

**注意**：`docker-compose.dokploy.yml` 已经包含了 Traefik labels。如果你的 Dokploy 环境需要额外的配置，可以在 Dokploy UI 中添加或修改 labels。

**参考配置**：见 `infra/deploy/dokploy-traefik-labels.yml`

**关键 Labels**：
- `traefik.enable=true`
- HTTP 路由：端口 5000
- WebSocket 路由：端口 3001，优先级 10

---

### Step 5: 配置端口暴露

**注意**：`docker-compose.dokploy.yml` 使用 `expose` 而不是 `ports`，因为 Traefik 会处理外部访问。

如果 Dokploy 要求配置端口，可以忽略或设置为内部端口：
- 5000 (HTTP)
- 3001 (WebSocket)

---

### Step 6: 部署应用

1. 点击 "Deploy" 或 "部署"
2. 等待所有服务启动
3. 查看日志确认服务正常运行

---

### Step 7: 验证部署

#### 1. 检查服务状态

在 Dokploy 中查看应用状态，确认所有服务都是 "Running"：
- ✅ db
- ✅ minio
- ✅ redis
- ✅ meilisearch
- ✅ migrate (completed)
- ✅ provision-minio (completed)
- ✅ app
- ✅ worker (如果启用)

#### 2. 检查 HTTP 访问

```bash
curl https://your-domain.com/health
```

应该返回健康状态。

#### 3. 检查 WebSocket 连接

**浏览器控制台**：
```javascript
const ws = new WebSocket('wss://your-domain.com/ws/agent');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (e) => console.error('❌ WebSocket error:', e);
ws.onclose = (e) => console.log('WebSocket closed:', e.code, e.reason);
```

#### 4. 访问应用

打开浏览器访问：`https://your-domain.com`

---

## 🔧 常见问题

### 问题 1: WebSocket 连接失败

**症状**：WebSocket 连接返回 426 或立即断开

**解决方案**：
1. 检查 Traefik 版本（建议 3.3.1+）
2. 确认 WebSocket 路由优先级设置为 10
3. 检查应用日志：`docker logs app`
4. 检查 Traefik 日志：`docker logs traefik`

**调试**：
```bash
# 在 Dokploy 中查看应用日志
# 或在服务器上：
docker logs claude-agent-chat-app
```

---

### 问题 2: 数据库连接失败

**症状**：应用无法连接到数据库

**解决方案**：
1. 检查 `DATABASE_URL` 环境变量是否正确
2. 确认数据库服务健康状态
3. 检查网络连接（服务应在同一 Docker 网络）

**验证**：
```bash
# 检查数据库服务
docker exec -it claude-agent-chat-db psql -U your_db_user -d claude_agent_chat
```

---

### 问题 3: MinIO 无法访问

**症状**：文件上传失败或 S3 错误

**解决方案**：
1. 检查 `provision-minio` 服务是否完成
2. 确认 MinIO 凭证正确
3. 检查 S3 环境变量配置

---

### 问题 4: Traefik 路由不工作

**症状**：无法通过域名访问应用

**解决方案**：
1. 检查 `APP_HOSTNAME` 环境变量
2. 确认 Traefik labels 正确配置
3. 检查 DNS 解析（域名应指向服务器 IP）
4. 确认 SSL 证书自动申请（Let's Encrypt）

---

### 问题 5: Docker Volume 名称错误

**症状**：部署时出现错误：
```
Error response from daemon: create "App Name-volume": "App Name-volume" includes invalid characters for a local volume name, only "[a-zA-Z0-9][a-zA-Z0-9_.-]" are allowed.
```

**原因**：
- `APP_NAME` 环境变量包含空格或特殊字符（如 `DeeptoAI Agents`）
- Docker volume 和 network 名称不允许包含空格，只能使用 `[a-zA-Z0-9][a-zA-Z0-9_.-]`

**解决方案**：

1. **设置 `APP_NAME_SANITIZED` 环境变量**：
   - 将 `APP_NAME` 中的空格替换为连字符（`-`）
   - 移除其他特殊字符
   
   **示例**：
   ```bash
   APP_NAME=DeeptoAI Agents
   APP_NAME_SANITIZED=DeeptoAI-Agents
   ```

2. **或者修改 `APP_NAME` 本身**：
   - 将应用名称改为不包含空格的版本
   - 例如：`DeeptoAI Agents` → `DeeptoAI-Agents`

**验证**：
- 确保 `APP_NAME_SANITIZED` 只包含允许的字符：字母、数字、连字符、下划线、点
- 不能包含空格或其他特殊字符

---

### 问题 6: 迁移失败

**症状**：`migrate` 服务失败

**解决方案**：
1. 检查数据库连接
2. 确认 `DATABASE_URL` 正确
3. 查看迁移日志
4. 手动运行迁移（如果需要）

**手动迁移**：
```bash
docker exec -it claude-agent-chat-app pnpm run db:migrate
```

**注意**：生产环境应用中的自动迁移已禁用（`AUTO_MIGRATE=false`），迁移由 Docker Compose 的 `migrate` 服务执行。这是为了：
- 避免双重迁移
- 确保迁移在应用启动前完成
- 迁移失败时应用不会启动

---

### 问题 7: 第三方登录（OAuth）不显示或无法使用

**症状**：登录页面没有显示 "Continue with GitHub" 或 "Continue with Google" 按钮

**可能原因**：
1. 环境变量未配置
2. 前端和后端的 CLIENT_ID 不一致
3. OAuth App 回调 URL 配置错误

**解决方案**：

1. **检查环境变量**：
   ```bash
   # 检查后端变量
   docker exec claude-agent-chat-app env | grep -E "GITHUB_CLIENT|GOOGLE_CLIENT"
   
   # 检查前端变量（构建时需要）
   # 注意：VITE_* 变量需要在构建时传入，运行时无法修改
   ```

2. **配置 GitHub OAuth**：
   - 访问：https://github.com/settings/developers
   - 创建 OAuth App
   - **Authorization callback URL**：`https://${APP_HOSTNAME}/api/auth/callback/github`
   - 复制 Client ID 和 Client Secret

3. **配置 Google OAuth**：
   - 访问：https://console.cloud.google.com/apis/credentials
   - 创建 OAuth 2.0 Client ID
   - **Authorized redirect URIs**：`https://${APP_HOSTNAME}/api/auth/callback/google`
   - 复制 Client ID 和 Client Secret

4. **配置环境变量**：
   - `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`（后端）
   - `VITE_GITHUB_CLIENT_ID`（前端，必须与 `GITHUB_CLIENT_ID` 相同）
   - `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`（后端）
   - `VITE_GOOGLE_CLIENT_ID`（前端，必须与 `GOOGLE_CLIENT_ID` 相同）

5. **重新构建镜像**（如果修改了 `VITE_*` 变量）：
   - `VITE_*` 变量在构建时注入，修改后需要重新构建镜像

**验证**：
- 登录页面应该显示对应的社交登录按钮
- 点击按钮应该能正常跳转到 OAuth 提供商

---

## 📊 服务架构

### 部署架构图

```
Internet
   ↓
Traefik (Dokploy)
   ├─ HTTP (Port 5000) → app
   └─ WebSocket (Port 3001) → app
         ↓
    Docker Network (private)
         ├─ app (Nitro + WebSocket)
         ├─ worker (Background jobs)
         ├─ db (PostgreSQL)
         ├─ redis (Cache/Queue)
         ├─ meilisearch (Search)
         └─ minio (Object Storage)
```

---

## 🔒 安全建议

1. ✅ **使用强密码**：所有密码应使用强随机字符串
2. ✅ **启用 HTTPS**：Traefik 自动配置 Let's Encrypt
3. ✅ **限制访问**：仅暴露必要的端口
4. ✅ **定期备份**：备份数据库和 MinIO 数据
5. ✅ **更新镜像**：定期更新应用镜像以获取安全补丁

---

## 📝 维护和更新

### 更新应用

1. 构建新镜像（CI/CD 或手动）
2. 在 Dokploy 中更新 `APP_TAG` 环境变量
3. 重新部署应用

### 备份数据

**数据库备份**：
```bash
docker exec claude-agent-chat-db pg_dump -U your_db_user claude_agent_chat > backup.sql
```

**MinIO 备份**：
```bash
docker exec claude-agent-chat-minio mc mirror /data /backup
```

### 查看日志

**应用日志**：
```bash
docker logs -f claude-agent-chat-app
```

**所有服务日志**：
在 Dokploy UI 中查看或使用：
```bash
docker compose -f docker-compose.dokploy.yml logs -f
```

---

## 📚 参考文档

### 环境变量配置

- **环境变量示例**：`infra/deploy/env.dokploy.example` - 完整的环境变量列表和说明
- **环境变量检查清单**：`infra/deploy/DOKPLOY_ENV_CHECKLIST.md` - 必需变量快速检查清单

### 部署配置

- **WebSocket 配置**：`docs/5. 研发实施/2. 研发过程/3. 任务中间态/12-31-Dokploy-Traefik-WebSocket配置指南.md`
- **快速配置**：`docs/5. 研发实施/2. 研发过程/3. 任务中间态/12-31-Dokploy-快速配置指南.md`
- **Traefik Labels**：`infra/deploy/dokploy-traefik-labels.yml`

---

**状态**: 部署指南完成  
**下一步**: 按照步骤部署应用
