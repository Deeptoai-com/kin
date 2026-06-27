# Kin 上市执行总表（CMO Run-sheet）

> 日期：2026-06-14。整合本轮所有策略产出：`POSITIONING.md` · `COMPETITIVE-LANDSCAPE.md` ·
> `research/2026-06-beachhead-and-positioning-research.md` · `mac-mini-optimization-plan.md` ·
> `GTM-launch-plan.md`。本表是**分活清单**，A/各负责人据此拆单执行。

## 0. 规则（先读）
- **CMO（我）只管质量与验收**，不执行。每条任务列了**负责人**和**验收口径**——做完由 CMO 签收才算 `done`。
- **不派时间**（按 CLAUDE.md：指派不给时间建议），用 **优先级 P0/P1/P2 + 依赖** 排序。
- **两道发布闸**：① 软发布闸（GitHub+X+r/selfhosted）② 硬发布闸（Show HN+Product Hunt）。闸前 CMO 逐项验收，全绿才放行。
- 负责人代号：**创始人**=你 · **设计** · **前端**(C/D) · **后端**(E/F) · **运维** · **内容**(H+你) · **QA**(G) · **CMO**=验收。

---

## W0 · 品牌定稿（P0｜阻塞一切带品牌物料）
- [ ] **创始人**：敲定 `Kin` 域名（`.com`/`.ai` + 限定词如 trykin/kinhq/getkin）、查商标冲突、锁 GitHub org `deeptoai` + repo `kin` + X/Discord handle。
  - **CMO 验收**：域名已注册可访问；handle 已占；无阻塞性商标冲突书面确认。

## W1 · 视觉与品牌资产（P0）
- [ ] **设计**：Kin Logo（替换 OxyGenie）、favicon、social-preview / OG 图、PH 缩略图。
- [ ] **前端**：`Header.tsx` 顶部导航 OxyGenie→Kin；全站 grep 清掉残留 `OxyGenie/MIT/Mastra`。
  - **CMO 验收**：分享任意链接 OG 图正常显示；导航是 Kin；`grep -ri oxygenie src/` 仅剩注释级；暗色模式无破图。

## W2 · 首页 / 官网（P0｜依赖 W0 域名、W3 截图视频）
- [ ] **前端+设计**：把首页 6 个 `.shot` 占位换成**真实 `/agents/c` 截图**；hero 嵌入 90s 视频；移动端 QA。
- [ ] **运维**：官网上线到正式域名（W0）。
  - **CMO 验收**：**无任何占位块**；每区块一图一意、低密度；移动端不溢出；Lighthouse ≥90；诚实口径（无 air-gap 夸大）。

## W3 · Demo 资产（P0｜#1 转化资产，生死）
- [ ] **内容+设计**：写 Demo 分镜 → 录 `/agents/c` → 剪 **① 10–30s GIF（README 顶）② 90s 视频（官网/X/PH/YouTube）**，加字幕。
  - **CMO 验收**：GIF 一眼看懂"Kin 在干活"（输入→调工具→产出）；视频 ≤90s、有声/字幕、画质达标；README 顶部自动播放。

## W4 · README 发布级（P0｜依赖 W3 GIF）
- [ ] **内容**：升级 `README.md`（含 GIF、badges:AGPLv3/stars/Discord、对比表、一键 quickstart、⭐Star/🚀Demo/💬Discord 三连 CTA、联系方式、截图）；出 `README_CN`。
  - **CMO 验收**：GitHub 渲染正常、GIF 在顶、所有链接可点、claims 诚实、中英两版一致。

## W5 · 在线 Demo 实例（P0｜#1 转化杠杆）
- [ ] **后端+运维**：托管一个公开 Demo（限额/可重置/防滥用）+ 官网"Try live demo"按钮；Google 登录已✅。
  - **CMO 验收**：匿名用户 <30s 进到能玩；压一压不崩；自动重置/清理生效。

## W6 · 部署产品化（P0/P1｜见 `mac-mini-optimization-plan.md`）
- [ ] **后端**：发布 **arm64+amd64 预构建镜像**（GHCR），compose 默认改 pull 不 build。
- [ ] **后端**：一键 `install.sh` + launchd 开机自启/断电自恢复；`mac-mini` 瘦身 profile（本地FS替MinIO、Meili可选）。
- [ ] **运维**：Cloudflare Tunnel 自动化进装机；**VPS 一键部署**（Railway/Render 模板）；备份 + 一键更新。
  - **CMO 验收**：干净 **Mac mini** 与干净 **VPS** 各跑一次，从 pull 到团队可访问 ≤15 分钟、重启自恢复（QA 出报告）。

## W7 · License & 合规（P0）
- [ ] **创始人+后端**：放 `LICENSE`=AGPLv3 全文；接 **CLA**（CLA Assistant）；商业授权说明页 + 销售联系方式；核对第三方 NOTICE。
  - **CMO 验收**：LICENSE 存在且正确；PR 触发 CLA 签署闸；商业授权邮箱/`Cal.com` 链接可用。

## W8 · 渠道搭建（P0｜软发布前必须就位）
- [ ] **创始人+内容**：建 **Discord**；`hello@/sales@deeptoai`；**Cal.com 约 Demo**；X 账号预热；微信/私域；开 GitHub Discussions。
  - **CMO 验收**：所有渠道可达，且在 README/官网/in-app 都有入口；约 Demo 链接能预约成功。

## W9 · 平台首发文案（P1｜依赖 W2-W5 就绪）
- [ ] **内容+创始人**：草拟并 CMO 过稿——**Show HN** 标题+正文+maker 首评；**X** 发布 thread；**Reddit** r/selfhosted（故事体）；**Product Hunt** tagline+gallery+首评+hunter；**LinkedIn** 创始人帖（ICP/数据主权）；**公众号/V2EX/即刻**；**awesome-selfhosted/ai-agents** PR。
  - **CMO 验收**：每篇受众正确（开发者 vs 律所/家办两套 CTA 不混）、claims 诚实、视觉齐备、首发支持者已约。

## W10 · 文档一致性（P1｜对外叙事统一）
- [ ] **内容**：把 4 个核心功能（co-work / RAG / 插件OCR / 沙盒起服务）同步进 README + `POSITIONING.md` 竞争格局；清掉公开面所有 OxyGenie/MIT/Mastra/ARK-only 残留。
  - **CMO 验收**：README、官网、定位文档三处叙事一致；`grep` 公开文件无旧品牌/旧许可/旧模型口径。

## W11 · 发布编排（P0｜CMO 主持）
- [ ] **CMO+创始人**：**软发布**（GitHub+X+r/selfhosted）收反馈修坑攒 star → 稳定后**硬发布**（Show HN+PH 集中火力）。
  - **CMO 验收**：见下两道闸。

---

## 发布闸（CMO 逐项签收）

**🟢 软发布闸（全绿才发 GitHub/X/Reddit）**
⬜ README+GIF 顶部自动播放 ⬜ 官网上线+真实截图+视频 ⬜ 在线 Demo 可玩不崩 ⬜ Mac+VPS 部署各跑通一次 ⬜ Google 登录正常 ⬜ Discord/邮箱/约Demo 链接活 ⬜ 品牌/许可/模型口径全站一致 ⬜ 诚实口径复查（无 air-gap）

**🔴 硬发布闸（软发布稳定后才发 HN/PH）**
⬜ 软发布反馈的坑已修 ⬜ 站点/Demo 扛得住流量峰值 ⬜ PH gallery+首评+hunter 就位 ⬜ Show HN 正文+maker 首评就位 ⬜ 首批支持者已约好发布日互动 ⬜ 客服/反馈通道有人值守

---

## CMO 亲自把关的 5 件（不下放）
1. **诚实口径**：全站杜绝"数据绝对不出门/air-gap"，统一为"系统记录留你服务器 + 模型走你选定端点"。
2. **两套受众不混**：开发者（开源/省钱/Star/自部署）vs 律所家办（数据主权/可审计/约Demo）。
3. **#1 资产质量**：Demo GIF/视频 + 在线 Demo——不达标不放行。
4. **一次性弹药**：HN/PH 只发一次，软发布没稳不碰硬发布。
5. **claims 与事实一致**：功能页写的（co-work/RAG/OCR/沙盒分享）必须 Demo 里真能演。
