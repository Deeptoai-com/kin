# Dokploy Compose Path 配置说明

> **目的**: 说明在 Dokploy 中如何填写 Compose Path

---

## 📍 Compose Path 是什么？

**Compose Path** 是 Docker Compose 文件在 Git 仓库中的相对路径。Dokploy 使用这个路径来定位和加载 Docker Compose 配置文件。

---

## ✅ 正确的 Compose Path

对于本项目，Compose Path 应该填写：

```
docker-compose.dokploy.yml
```

**原因**：
- `docker-compose.dokploy.yml` 文件位于项目根目录
- Compose Path 是相对于 Git 仓库根目录的路径
- 因此直接填写文件名即可

---

## 🔍 如何确认文件位置

在项目根目录执行：

```bash
ls -la docker-compose.dokploy.yml
```

如果文件存在，说明路径正确。

---

## 📝 在 Dokploy 中填写步骤

### 方法 1: Git 仓库部署（推荐）

1. 在 Dokploy 中创建新应用
2. 选择 "Git Repository" 作为部署源
3. 配置 Git 仓库 URL 和分支
4. 找到 **"Compose Path"** 或 **"Docker Compose File Path"** 字段
5. 填写：`docker-compose.dokploy.yml`
6. 保存配置

### 方法 2: 手动上传

如果使用手动上传方式，通常不需要填写 Compose Path，直接在 UI 中上传文件内容即可。

---

## ⚠️  常见错误

### ❌ 错误示例

```
# 错误 1: 包含绝对路径
/root/project/docker-compose.dokploy.yml

# 错误 2: 包含 ./ 前缀
./docker-compose.dokploy.yml

# 错误 3: 包含完整路径（如果文件在根目录）
infra/deploy/docker-compose.dokploy.yml  # 这是错误的，文件在根目录
```

### ✅ 正确示例

```
docker-compose.dokploy.yml
```

---

## 🔄 如果文件在其他位置

如果 Docker Compose 文件位于子目录中，需要填写相对路径：

**示例**：
- 文件位置：`infra/deploy/docker-compose.yml`
- Compose Path：`infra/deploy/docker-compose.yml`

**当前项目**：
- 文件位置：项目根目录的 `docker-compose.dokploy.yml`
- Compose Path：`docker-compose.dokploy.yml` ✅

---

## 📚 相关文档

- **完整部署指南**：`DOKPLOY_DEPLOYMENT.md`
- **环境变量配置**：`env.dokploy.example`
- **环境变量检查清单**：`DOKPLOY_ENV_CHECKLIST.md`

---

**状态**: 配置说明完成  
**最后更新**: 2026-01-13
