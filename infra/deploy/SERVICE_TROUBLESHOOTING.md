# 服务不可用排查指南

> **问题**: Dokploy 启动成功，但服务不可用

---

## 🔍 排查步骤

### Step 1: 检查服务状态

在 Dokploy 中查看所有服务的状态：

**应该运行的服务**：
- ✅ `db` - PostgreSQL 数据库（已启动）
- ✅ `minio` - 对象存储
- ✅ `redis` - 缓存
- ✅ `meilisearch` - 搜索
- ✅ `migrate` - 数据库迁移（应该已完成）
- ✅ `provision-minio` - MinIO 初始化（应该已完成）
- ✅ `app` - 主应用（**关键**）
- ✅ `worker` - 后台任务（可选）

**重点关注**：
- `app` 服务的状态和日志
- `migrate` 服务的日志（是否成功）

---

### Step 2: 检查应用服务日志

查看 `app` 服务的日志，查找：
1. **启动错误**
2. **数据库连接错误**
3. **端口监听错误**
4. **环境变量缺失**

常见错误：
```
❌ Error: DATABASE_URL is not defined
❌ Error: Failed to connect to database
❌ Error: EADDRINUSE: address already in use :::5000
❌ Error: Cannot find module 'xxx'
```

---

### Step 3: 检查迁移是否成功

查看 `migrate` 服务的日志，确认：
- ✅ 迁移成功执行
- ✅ 没有错误信息
- ✅ 状态为 `completed` 或 `success`

如果迁移失败，应用可能无法启动。

---

### Step 4: 检查 Traefik 路由

确认 Traefik labels 配置正确：

**必需的 Labels**：
```yaml
traefik.enable: "true"
traefik.http.routers.app.rule: "Host(`your-domain.com`) && !PathPrefix(`/ws`)"
traefik.http.routers.app.entrypoints: "websecure"
traefik.http.routers.app.tls.certresolver: "letsencrypt"
traefik.http.services.app-service.loadbalancer.server.port: "5000"
```

**WebSocket 路由**：
```yaml
traefik.http.routers.ws.rule: "Host(`your-domain.com`) && PathPrefix(`/ws`)"
traefik.http.routers.ws.entrypoints: "websecure"
traefik.http.routers.ws.service: "ws-service"
traefik.http.services.ws-service.loadbalancer.server.port: "3001"
traefik.http.routers.ws.priority: "10"
```

---

### Step 5: 检查端口暴露

确认服务端口正确暴露：
- ✅ 应用 HTTP 端口：5000
- ✅ WebSocket 端口：3001

在 `docker-compose.dokploy.yml` 中应该使用 `expose` 而不是 `ports`。

---

### Step 6: 检查健康检查

查看应用服务的健康检查：
- ✅ 健康检查端点：`/health`
- ✅ 健康检查间隔和超时设置
- ✅ 服务是否通过健康检查

---

## 🔧 常见问题解决方案

### 问题 1: 应用服务无法启动

**症状**：`app` 服务状态为 `restarting` 或 `failed`

**排查**：
1. 查看应用日志
2. 检查环境变量是否完整
3. 检查依赖服务是否就绪（db, redis, minio 等）

**解决**：
```bash
# 在 Dokploy 中查看应用日志
# 根据错误信息修复问题
```

---

### 问题 2: 迁移失败导致应用无法启动

**症状**：`migrate` 服务失败，应用无法连接数据库

**排查**：
1. 查看 migrate 服务日志
2. 检查数据库连接配置
3. 确认迁移文件存在

**解决**：
- 修复迁移错误
- 手动运行迁移
- 检查数据库权限

---

### 问题 3: Traefik 路由不工作

**症状**：服务运行正常，但无法通过域名访问

**排查**：
1. 检查 Traefik labels 配置
2. 确认域名 DNS 解析正确
3. 检查 SSL 证书是否申请成功

**解决**：
- 验证 Traefik labels 配置
- 检查 Traefik 日志
- 确认域名指向正确的 IP

---

### 问题 4: 端口冲突

**症状**：应用启动失败，提示端口被占用

**排查**：
1. 检查是否有其他服务占用端口
2. 确认 `expose` vs `ports` 配置

**解决**：
- 修改端口配置
- 停止冲突的服务

---

### 问题 5: 环境变量缺失

**症状**：应用启动失败，提示环境变量未定义

**排查**：
1. 检查 Dokploy 环境变量配置
2. 确认所有必需变量都已设置

**解决**：
- 参考 `env.dokploy.example` 设置环境变量
- 检查变量名拼写

---

## 📋 快速检查清单

- [ ] 所有服务状态为 `running`
- [ ] `migrate` 服务成功完成
- [ ] `app` 服务日志无错误
- [ ] Traefik labels 配置正确
- [ ] 端口正确暴露（5000, 3001）
- [ ] 环境变量完整设置
- [ ] 健康检查通过
- [ ] 域名 DNS 解析正确
- [ ] SSL 证书已申请

---

## 🆘 获取更多信息

### 查看服务日志
在 Dokploy 中查看各服务的日志

### 检查服务状态
```bash
# 在 Dokploy 中或服务器上
docker ps | grep <app-name>
docker logs <app-container-name>
```

### 测试连接
```bash
# 测试数据库连接
docker exec -it <db-container> psql -U deeptoai -d deeptoai_agents

# 测试应用健康检查
curl http://localhost:5000/health
```

---

**状态**: 排查指南完成  
**最后更新**: 2026-01-14
