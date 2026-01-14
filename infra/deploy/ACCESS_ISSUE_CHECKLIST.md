# 服务访问问题排查清单

> **状态**: 应用已正常启动，但可能无法通过域名访问

---

## ✅ 已确认正常

- ✅ 应用服务（app）已正常启动
- ✅ WebSocket 服务器运行在 3001
- ✅ Nitro 服务器运行在 5000
- ✅ 数据库迁移成功完成
- ✅ 所有服务状态正常

---

## 🔍 需要检查的配置

### 1. Traefik Labels 配置

在 Dokploy 中检查 `app` 服务的 Labels：

**必需的 Labels**：
```yaml
traefik.enable: "true"
traefik.http.routers.app.rule: "Host(`your-domain.com`) && !PathPrefix(`/ws`)"
traefik.http.routers.app.entrypoints: "websecure"
traefik.http.routers.app.tls.certresolver: "letsencrypt"
traefik.http.services.app-service.loadbalancer.server.port: "5000"
traefik.http.routers.ws.rule: "Host(`your-domain.com`) && PathPrefix(`/ws`)"
traefik.http.routers.ws.entrypoints: "websecure"
traefik.http.routers.ws.service: "ws-service"
traefik.http.services.ws-service.loadbalancer.server.port: "3001"
traefik.http.routers.ws.priority: "10"
```

**替换 `your-domain.com` 为实际域名**。

---

### 2. 环境变量配置

确认以下环境变量：
```bash
APP_HOSTNAME=deeptoai.com  # 你的实际域名
VITE_WS_URL=wss://deeptoai.com/ws/agent  # WebSocket URL
```

---

### 3. 端口暴露

在 Dokploy 中确认端口暴露：
- ✅ 5000 (HTTP - Nitro 服务器)
- ✅ 3001 (WebSocket - WebSocket 服务器)

**注意**：`docker-compose.dokploy.yml` 中使用 `expose`，Traefik 应该能访问这些端口。

---

### 4. DNS 配置

确认域名 DNS 记录：
- A 记录指向 Dokploy 服务器的 IP 地址
- 或 CNAME 记录指向 Dokploy 提供的域名

**验证 DNS**：
```bash
nslookup your-domain.com
# 或
dig your-domain.com
```

---

### 5. SSL 证书

检查 Let's Encrypt 证书是否申请成功：
- 查看 Traefik 日志
- 确认证书已颁发
- 检查证书是否过期

---

## 🧪 测试步骤

### 步骤 1: 内部访问测试

在 Dokploy 服务器上测试：

```bash
# 测试应用健康检查
curl http://localhost:5000/health

# 或从容器内部测试
docker exec -it <app-container-name> wget -qO- http://localhost:5000/health
```

**预期结果**：返回健康状态 JSON

---

### 步骤 2: 通过 Traefik 访问

```bash
# 如果 Traefik 在本地运行
curl -H "Host: your-domain.com" http://localhost/health

# 或直接访问域名
curl https://your-domain.com/health
```

---

### 步骤 3: 检查 Traefik 日志

查看 Traefik 容器的日志：
```bash
docker logs <traefik-container-name>
```

查找：
- 路由匹配信息
- SSL 证书申请日志
- 错误信息

---

## 🆘 常见问题

### 问题 1: 502 Bad Gateway

**可能原因**：
- Traefik 无法连接到应用服务
- 端口配置错误
- 服务名称不匹配

**解决**：
1. 检查 Traefik labels 中的服务端口（应该是 5000）
2. 确认应用服务名称正确
3. 检查 Docker 网络配置

---

### 问题 2: 连接超时

**可能原因**：
- DNS 解析错误
- 防火墙阻止访问
- Traefik 未正确配置

**解决**：
1. 检查 DNS 配置
2. 检查防火墙规则
3. 确认 Traefik 正在运行

---

### 问题 3: SSL 证书错误

**可能原因**：
- Let's Encrypt 证书申请失败
- 域名验证失败
- 证书过期

**解决**：
1. 检查 Traefik 日志中的证书申请信息
2. 确认域名 DNS 正确配置
3. 检查端口 80 和 443 是否开放

---

### 问题 4: 404 Not Found

**可能原因**：
- Traefik 路由规则不匹配
- 域名配置错误

**解决**：
1. 检查 Traefik labels 中的 Host 规则
2. 确认 `APP_HOSTNAME` 环境变量正确
3. 验证域名与 Traefik 配置一致

---

## 📋 快速验证清单

- [ ] 应用服务正常运行
- [ ] Traefik labels 正确配置
- [ ] `APP_HOSTNAME` 环境变量设置正确
- [ ] 端口 5000 和 3001 正确暴露
- [ ] DNS 记录正确配置
- [ ] SSL 证书申请成功
- [ ] 防火墙规则允许访问
- [ ] 内部访问测试通过

---

**下一步**: 根据具体的错误信息进行针对性排查

**状态**: 排查清单完成  
**最后更新**: 2026-01-14
