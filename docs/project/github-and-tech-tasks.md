# Kin — GitHub & 技术任务清单（给技术"先试试"）

> 日期：2026-06-14。从 `GTM-execution-runsheet.md` 抽出**仅 GitHub + 技术**的活。
> CMO 只验收，不执行。标 🟢 的**不依赖域名/品牌定稿，现在就能开干**；标 🔒 的有前置依赖。
> 部署细节见 `docs/deployment/mac-mini-optimization-plan.md`，不在此重复。

---

## A · 仓库与改名 rollout（P0）
- [ ] 🔒 **建仓**：在 `github.com/deeptoai` 下建 `kin`（公开）。*依赖 W0 org 就绪；repo 名 `kin` 已定，不依赖域名。*
- [ ] 🟢 **OxyGenie→Kin 全量改名**：代码/配置/文档里的品牌、镜像名、仓库链接统一替换。
  - 关键点：`ghcr.io/foreveryh/oxygenie/*` → `ghcr.io/deeptoai/kin/*`；`foreveryh/oxygenie` → `deeptoai/kin`；env/容器名/`*.local` 域名；nav `Header.tsx` logo；CSS 注释。
  - **验收**：`grep -ri "oxygenie\|foreveryh" .` 仅剩历史 changelog；`pnpm build` 通过；镜像名已换。
- [ ] 🟢 **决定迁移方式**：是 rename 现有 repo（保 star/history）还是新建 + 推代码。给 CMO 一句话方案。
  - **验收**：方案确认，history/star 处置清楚。

## B · CI / 多架构镜像（P0｜最大单点收益）
- [ ] 🟢 **buildx 多架构镜像**：CI 出 `linux/arm64 + linux/amd64`，推 GHCR。
  - 参考：`docker buildx build --platform linux/arm64,linux/amd64 -t ghcr.io/deeptoai/kin/app:<tag> --push`
  - tag：`latest` + 语义版本 + git sha。
- [ ] 🟢 **compose 默认 pull 不 build**：`docker-compose.*.yml` 默认用预构建 arm64 镜像，`build:` 降为可选。
  - **验收**：干净 **base M4 16GB Mac mini** 从 `pull` 到 `/health=ok` **无需本地构建**、≤10 分钟（QA 出报告）。
- [ ] 🟢 **现有 CI 保绿**：typecheck / lint / validate-routes / test 在改名后全过。
  - **验收**：CI 全绿，README 挂 CI badge。

## C · 部署产品化（P0/P1｜见 mac-mini-optimization-plan）
- [ ] 🟢 **一键 `install.sh`**：检测/装 OrbStack → 拉镜像 → 交互生成 `.env`（密钥自动生成、模型 key 引导）→ 起栈 → 迁移 → 健康检查。
- [ ] 🟢 **launchd 自启**：`~/Library/LaunchAgents/cc.kin.*.plist`，开机自启 + 断电自恢复；无头机 `pmset` 禁睡眠引导。
- [ ] 🟢 **`mac-mini` 瘦身 profile**：本地 FS 替 MinIO、Meilisearch 可选、各容器内存上限。
- [ ] 🔒 **Cloudflare Tunnel 自动化**进装机（*依赖域名做公网；本机 `*.local` 部分可先试*）。
- [ ] 🟢 **VPS 一键部署**：Railway/Render "Deploy" 模板/按钮。
- [ ] 🟢 **备份 + 一键更新**：Postgres dump + 数据快照；`kin update`（拉新镜像+迁移+失败回滚提示）。
  - **验收**：干净 **Mac mini** 与干净 **VPS** 各跑一次，pull→团队可访问 ≤15 分钟、重启自恢复、备份可还原（QA 报告）。

## D · 在线 Demo 实例（P0｜#1 转化杠杆）
- [ ] 🔒 **托管公开 Demo**：限额/可重置/防滥用的公共实例 + 官网"Try live demo"按钮。Google 登录已✅。
  - 要点：匿名或一键登录即玩；定时重置/清数据；并发与滥用护栏（限速、容量上限沿用 `MAX_ACTIVE_PREVIEWS` 思路）。
  - *依赖域名做公网入口；实例本身可先在测试域名跑通。*
  - **验收**：匿名用户 <30s 进到能玩；压测不崩；自动重置生效。

## E · 功能演示就绪（P1｜claims = 事实）
> 首页/README 写的 4 个核心功能必须在 Demo 里**真能演**，否则 CMO 不放行。
- [ ] 🟢 **co-work 共享 Project**：和团队分享一个 project（对位 ChatGPT Shared Projects），邀请/权限可演。
- [ ] 🟢 **RAG**：独立向量库 + 文档库，上传文档→检索作答可演。
- [ ] 🟢 **插件 / OCR**：复杂 PDF + 表格识别组件可演。
- [ ] 🟢 **沙盒起服务 + 公网分享**：React+Vite 在沙盒跑起 → 一键公网 URL。
- [ ] 🟢 **截图/录屏支撑**：把 `/agents/c` 跑成可录制状态（含示例数据/种子），供设计录 GIF/视频、出真实截图替换首页占位。
  - **验收**：每个功能现场演通；首页 6 个 `.shot` 占位有真图可换。

## F · License / CLA / 仓库治理（P0/P1）
- [ ] 🟢 **LICENSE = AGPLv3 全文** 放进仓库根。
- [ ] 🟢 **CLA**：接 CLA Assistant，PR 触发签署闸（双授权前置）。
- [ ] 🟢 **NOTICE / 第三方许可** 核对（Claude Agent SDK 等）。
  - **验收**：LICENSE 正确；外部 PR 必须签 CLA 才能合；NOTICE 完整。

## G · 仓库门面（P1｜star 转化）
- [ ] 🟢 repo **description + topics**：`claude-cowork-alternative` `self-hosted` `ai-agent` `claude` `mcp` `rag` `agpl`。
- [ ] 🔒 **social preview / OG 图**（依赖设计 W1 出图）。
- [ ] 🟢 **CONTRIBUTING / SECURITY / CODE_OF_CONDUCT** 改名同步（oxygenie 已有）。
- [ ] 🟢 **Issue/PR 模板** + 3–5 个 `good first issue`。
- [ ] 🟢 开 **GitHub Discussions**；首个 **Release + changelog**。
  - **验收**：topics 命中搜索；模板生效；Discussions 开；有首个 Release。

---

## "现在就能开干"的子集（不等域名/品牌定稿）
B（多架构镜像/CI）、C（install.sh / launchd / 瘦身 profile / VPS 模板 / 备份更新的本机部分）、
E（4 功能演示就绪 + 录屏种子数据）、F（LICENSE/CLA/NOTICE）、A（改名 rollout）、G（topics/模板/Discussions）。
→ **这些可立刻让技术并行试起来。** 卡域名的只有：Cloudflare 公网 Tunnel、在线 Demo 公网入口、OG 图。

## 技术验收闸（QA + CMO 签收）
⬜ 改名后 `pnpm build` + CI 全绿、无 oxygenie 残留
⬜ arm64 镜像：干净 Mac mini 仅 pull 即跑（≤10 min）
⬜ Mac mini + VPS 部署各跑通（≤15 min、重启自恢复、备份可还原）
⬜ 在线 Demo 匿名 <30s 可玩、压测不崩
⬜ co-work / RAG / OCR / 沙盒分享 现场各演通一次
⬜ LICENSE=AGPLv3 + CLA 闸生效
