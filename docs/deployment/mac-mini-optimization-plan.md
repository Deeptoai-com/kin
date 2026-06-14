# Kin on Mac mini — 一体机优化 Plan / 任务清单

> 日期：2026-06-14。配套现有部署指南 [`mac-mini.md`](./mac-mini.md) 与 [`tunnel.md`](./tunnel.md)。
> 本文件是**产品化任务清单**（给总指挥 A 派活用），不是部署教程。

---

## 0. 目标与北极星

**北极星：把现在那份"30 分钟、要 brew/git clone/自己构建镜像/手改 .env 的技术recipe"，
收敛成一个无 IT 团队也能完成的「插上电 → 一条命令/一次点击 → 全团队浏览器访问」的一体机体验。**

**为什么重要：** 这是定位「数据敏感小团队的 AI 私有一体机」的**实体兑现**，也是没有任何一个
Cowork 替代品在做的差异化——它不只是运维，是护城河（见 `docs/project/POSITIONING.md`）。

**关键约束（决定优化方向）：**
- **只用模型 API、不跑本地推理** → Mac mini 只扛 App+编排+RAG+向量库+Web，**base M4 16GB 足够**，
  不需要 GPU/MLX/大内存。"一台 599 刀 Mac mini 跑全团队私有 AI" 是卖点。
- **操作者无 IT 背景**（律所/家办）→ 命令行步骤越少越好，最好图形化 + 自动恢复。
- **常驻、无头、断电要自恢复** → 必须是后台服务，不是"开着终端窗口"。
- **在办公室 NAT 后面** → 走 Cloudflare Tunnel，不碰端口转发。

---

## 1. 现状（已有的地基，别重复造）

- ✅ `mac-mini.md`：Apple-Silicon 单机 + Cloudflare Tunnel 的完整线性 recipe。
- ✅ 已推荐 **OrbStack**（比 Docker Desktop 轻）。
- ✅ compose `--profile selfhost`，运行期footprint ~2–3GB（16GB 宽裕）。
- ✅ tunnel.md / dokploy.md 多部署路径。
- ⚠️ **痛点（待解）**：发布镜像是 `linux/amd64`，Mac mini 要 native arm64 → 现在只能"本机构建
  （≥16GB，Vite 构建峰值 >8GB，易 OOM）或换台 Mac 构建"。这是体验上最大的坎。

---

## 2. 工作流与任务清单（按优先级）

### W1 · 发布多架构 arm64 预构建镜像（P0｜最大单点收益）

**问题：** 让律所在 Mac mini 上现场 `docker build`（峰值 >8GB）既慢又 OOM。
**目标：** Mac mini 只 `docker pull` 不构建。

- [ ] CI 用 `docker buildx` 出 **`linux/arm64` + `linux/amd64`** 多架构镜像，推 GHCR（`ghcr.io/deeptoai/kin/*`）。
- [ ] 镜像打 tag：`latest` + 语义化版本 + git sha。
- [ ] `docker-compose.*.yml` 默认改为**拉取 `arm64` 预构建镜像**（而非 `build:`），保留 `build` 作为可选。
- [ ] `mac-mini.md` 删掉"必须本机/换台 Mac 构建"的整段，改为"直接 pull"。
- [ ] **8GB Mac mini 路径作废**（不再需要为构建而备第二台 Mac）→ 最低门槛降到 base 16GB（甚至 8GB 可跑）。

**验收：** 一台**全新 base M4 16GB** Mac mini，从 `pull` 到 `/health=ok` **无需任何本地构建**，≤10 分钟。
**估工：** 中（CI 改造 + 镜像体积优化）。**建议负责人：** 后端 E/F + 架构 B。

---

### W2 · 一键装机 + 开机自启（P0/P1｜"插上电就能用"的核心）

**问题：** 当前需 brew/git/编辑 .env/起 compose/配 tunnel 多步，无 IT 团队做不动；且关机/断电不自恢复。
**目标：** 一条命令（或一个 `.pkg`/菜单栏 App）装好并常驻。

- [ ] `install.sh` 一键脚本：检测/安装 OrbStack → 拉镜像 → 交互式生成 `.env`（密钥自动生成、模型 key 引导填）
      → 起栈 → 跑迁移 → 健康检查 → 打印访问地址。
- [ ] 注册 **launchd** 服务（`~/Library/LaunchAgents/cc.kin.*.plist`）：**开机自启 + 崩溃/断电后自恢复**。
- [ ] 无头机预设：引导开启**自动登录**、`sudo pmset -a sleep 0 disablesleep 1`（禁睡眠）、关闭自动更新打扰。
- [ ] （进阶 P2）菜单栏小程序：显示运行状态、启停、查看日志、"打开 Kin"按钮——给彻底非技术用户。
- [ ] （进阶 P2）签名 `.pkg`/`.dmg` 安装包（绕过 Gatekeeper 警告）。

**验收：** 非技术用户照着一页图文，从开箱到"团队能用"≤15 分钟；**重启 Mac 后服务自动恢复**。
**估工：** 中（脚本+launchd）/ 大（菜单栏 App、签名包）。**建议负责人：** 后端 E/F。

---

### W3 · 瘦身 + `mac-mini` 专用 compose profile（P1）

**问题：** Postgres+Redis+MinIO+Meilisearch+app+worker+preview+traefik+cloudflared 对 16GB 偏满，
组件对单机/小团队偏重。
**目标：** 单机档更轻、可选组件可关。

- [ ] 新增 `--profile mac-mini`（或 `appliance`）：精简默认、合理内存上限。
- [ ] **本地文件系统替代 MinIO**（单机不必跑对象存储）；MinIO 仅在需要时启用。
- [ ] **Meilisearch 设为可选**（小数据量可用 Postgres 全文检索兜底）。
- [ ] 各容器 `mem_limit`/`deploy.resources` 设默认，避免某服务吃爆。
- [ ] 文档给"组件取舍表"：哪些是核心、哪些可关、各省多少内存。

**验收：** `mac-mini` profile 在 **8GB** 上可跑轻量单团队；16GB 跑得宽裕（含多 preview）。
**估工：** 中。**建议负责人：** 架构 B + 后端 E/F。**QA：** G 做内存/并发回归。

---

### W4 · 默认化 OrbStack（P2｜低工）

- [ ] 安装脚本默认装/用 OrbStack；文档把 Docker Desktop 降为备选。
- [ ] 验证 `dockerproxy` shim 在 OrbStack 下正常（tunnel.md 已有）。

**验收：** 默认路径不依赖 Docker Desktop。**负责人：** 后端 E/F。

---

### W5 · Cloudflare Tunnel 自动化进装机（P1）

**问题：** 现在 tunnel 是手动配置；非技术用户最容易卡在 DNS/tunnel 这步。
**目标：** 把"给团队一个 HTTPS 域名访问"做成装机流程里的引导步骤。

- [ ] `install.sh` 集成 `cloudflared` 登录 + 自动创建 tunnel + 写 DNS（或给最短手动引导）。
- [ ] 支持"先本机 `*.local` 自签试用 → 再接公网域名"两段式（降低首次门槛）。
- [ ] 文档：把域名/Tunnel 从"前置要求"降级为"装机过程中按引导完成"。

**验收：** 用户不懂 Cloudflare 也能在引导下拿到 `https://<域名>` 团队访问。
**估工：** 中。**负责人：** 后端 E/F。

---

### W6 · 备份 + 一键更新（P2｜律所/家办的durability刚需）

- [ ] 定时备份：Postgres dump + 数据目录快照 → 本地/外置/Time Machine/可选 S3；保留策略可配。
- [ ] 一条命令恢复（演练过的 restore）。
- [ ] `kin update`：拉新镜像 + 跑迁移 + 健康检查 + 失败回滚提示。
- [ ] 文档：数据放在哪、怎么备份、怎么迁移到新机。

**验收：** 误删/换机后能在文档指引下 30 分钟内恢复全部数据。
**估工：** 中。**负责人：** 后端 E/F。**QA：** G 验份恢复演练。

---

### W7 · 把 `mac-mini.md` 重写成"傻瓜版" + 硬件选型矩阵（P1）

- [ ] 在 W1/W2 落地后，重写 `mac-mini.md`：从"技术 recipe"改为"开箱 3 步图文"。
- [ ] 硬件选型矩阵：base M4 16GB（推荐起步）/ 24–32GB（更多并发或多 preview）/ 何时上 Mac Studio（基本不需要，因 API-only）。
- [ ] 明确写"为什么 base Mac mini 就够"（API-only、不跑推理）——既是说明也是卖点。

**验收：** 非技术读者照着能独立装成。**负责人：** 架构 B 主笔 + H 整理。

---

## 3. 里程碑（建议顺序）

- **M1 · Pull-and-run**（W1）：Mac mini 不再本地构建，直接拉 arm64 镜像跑起来。← 先做这个，收益最大。
- **M2 · One-command appliance**（W2 + W5 + W3）：一条命令装好、自启、团队能 HTTPS 访问、内存够。
- **M3 · Durable & updatable**（W6 + W7 + W2 进阶）：备份/更新/菜单栏 App/傻瓜文档，成"家电"。

---

## 4. 待决策（需 A 拍板）

1. **分发形态走到哪一档**：一键 `install.sh`（够用、省事）vs 菜单栏 App vs 签名 `.pkg`（体验最好、工最大）。建议先 `install.sh`，验证后再升级。
2. **是否预装/出售硬件**：只给软件装在客户自购 Mac mini，还是提供"预装好的 Mac mini 一体机"作为高端 SKU（软硬一体，律所/家办可能更买账）。
3. **默认对象存储**：单机默认本地 FS 还是仍 MinIO（影响 W3 与备份方案）。

---

## 5. Definition of Done（整体）

一台**全新 base M4 16GB Mac mini**，由一名**无 IT 背景**的用户，照一页图文：
**≤15 分钟**完成安装 → 服务**开机自启/断电自恢复** → 全团队通过 **HTTPS 域名**访问 →
数据有**自动备份** → 能**一键更新**。届时"私有一体机"从 positioning 文案变成可交付产品。
