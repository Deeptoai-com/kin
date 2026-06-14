# Kin — 发布作战清单 / GTM Launch Kit

> 日期：2026-06-14。目标：让一个陌生人从"在某平台刷到 Kin"走到"star / 部署 / 联系你"。
> 配套：`POSITIONING.md`（对外说什么）、`mac-mini-optimization-plan.md`（部署产品化）、`/kin/README.md`（v1 草稿）。

---

## 0. 大师判断（先看这个）

1. **生死资产只有两件，且基本还没做：**
   - **Demo 动图/视频**——"看一眼就懂 Kin 在干活"。README 首屏的 GIF + 官网的 ≤90s 视频。**没有它，所有平台的流量都死在第 1 屏。**
   - **在线 Demo（不部署就能玩）**——第 3 步"体验"如果要求陌生人先部署，99% 流失。一个公开试用实例能把转化率抬一个量级。
2. **只能发一次，别浪费火力。** HN / Product Hunt / Reddit 的首发是一次性的。**README+GIF+官网+视频+在线Demo+一键部署 没全部就绪前，不要点 PH/HN 的发布按钮。**
3. **两套受众、两套渠道，别混。** 采用引擎（研究/开发者）走 GitHub/HN/Reddit/X；营收 ICP（律所/基金/家办）走 LinkedIn/微信/邮件/约 Demo。同一产品，落地页 CTA 和话术要分。
4. **诚实是护城河，不是束缚。** HN/Reddit 会逐字挑刺——我们"非 air-gap、provider 中立"的诚实口径正好经得起扒，别让任何文案吹回"数据绝对不出门"。

---

## 1. 按你的 5 步漏斗：每步要什么资产 · 缺什么 · 优先级

### 第 1 步 · 看 README + GIF
**要：** 顶部一句话定位 + **自动播放 Demo GIF**（10–30s：输入需求→agent 调工具→产出 artifact/预览）+ badges（stars/AGPLv3/Discord/CI）+ 是什么/为谁/为何 + **一键 quickstart** + 截图 + 对比表 + 社交/联系链接 + star 召唤。
**现状：** README v1 已写（`/kin/README.md`），但**缺 GIF、badges 全套、对比表、"试用 Demo"按钮、联系方式**。
**缺口（P0）：** ⬜ Demo GIF ⬜ README 升级到发布级 ⬜ 顶部"⭐ Star / 🚀 Live Demo / 💬 Discord"三连按钮。

### 第 2 步 · 看官网 + 视频（Cursor 式）
**要：** 落地页（结构已建）+ **真实截图替换占位** + **hero 视频（≤90s，有旁白/字幕）** + 域名。
**现状：** 首页结构 + 视觉已做（`src/routes/(marketing)`），**占位截图未替换、无视频、无域名**。
**缺口（P0/P1）：** ⬜ 录真实 `/agents/c` 截图 ⬜ 90s 产品视频（官网+X+PH+YouTube 复用）⬜ 域名（依赖命名最终化）。

### 第 3 步 · 体验（部署 + Google 登录✅）
**要：** **最短体验路径**。理想是**在线 Demo（零部署先玩）**；其次一键部署。
**现状：** Google 登录已实现；**无公开在线 Demo**；部署仍偏技术。
**缺口（P0）：** ⬜ **托管一个公开 Demo 实例**（限额/可重置/防滥用）+ 落地页"Try live demo"按钮。**这是转化最大杠杆。**

### 第 4 步 · 收藏 / fork / 部署测试（Mac / VPS 最快path）
**要：** 部署摩擦降到地板。
**现状：** 见 `mac-mini-optimization-plan.md`——**镜像还是 amd64、要本地构建**。
**缺口（P0）：** ⬜ **发布 arm64+amd64 预构建镜像**（Mac 直接 pull）⬜ 一条命令安装脚本 ⬜ **VPS 一键部署**（Railway/Render "Deploy" 按钮模板）⬜ README/官网把"Mac mini / VPS 5 分钟部署"放显眼处。

### 第 5 步 · 反馈 / 加 X / 微信 / 邮件
**要：** 渠道**发布前就备好**，且按受众分。
**现状：** 基本未备。
**缺口（P0）：** ⬜ Discord（社区+支持，OSS 受众）⬜ 邮箱（hello@ / sales@deeptoai）⬜ **Cal.com 约 Demo 链接**（给律所/基金/家办）⬜ 微信/X 联系（国内+founder）⬜ in-app + README 的反馈 CTA ⬜ GitHub Discussions 开启。

---

## 2. 按平台：每个平台要准备什么

### 🐙 GitHub（主场，star 是货币）
- ⬜ 发布级 README（含 GIF、对比表、quickstart、CTA）
- ⬜ repo description + **topics**（`claude-cowork-alternative` `self-hosted` `ai-agent` `claude` `mcp` `agpl`）
- ⬜ **social preview 图**（og image，被分享时显示）
- ⬜ Logo（OxyGenie→Kin）、Discord 链接、CI badge
- ⬜ CONTRIBUTING / SECURITY / CODE_OF_CONDUCT（oxygenie 已有，改名同步）
- ⬜ **CLA**（AGPL 双授权前置，见 license 决策）
- ⬜ Issue/PR 模板、3–5 个 `good first issue`
- ⬜ 首个 Release + 简短 changelog
- 🎯 目标：冲 **GitHub Trending**

### 🟠 Hacker News（Show HN，OSS 爆发力最强）
- ⬜ "Show HN: Kin – open-source, self-hostable team AI workspace（Cowork alternative）"
- ⬜ 站点/README 要扛得住技术扒（诚实口径在此是加分）
- ⬜ 发布即在评论区放 **maker 自述**（为什么做、架构、不是什么）
- ⚠️ 周二—周四 上午（美西）效果好；只发一次

### 🐦 X / Twitter
- ⬜ **发布 thread**：钩子→痛点→Demo 视频→"为谁"→CTA（≤6 条）
- ⬜ 复用 90s 视频/GIF
- ⬜ founder 账号提前预热（build in public）
- ⬜ 置顶推 + 简介带官网/GitHub

### 👽 Reddit（厌恶硬广，要故事+价值）
- ⬜ r/selfhosted（最对味：docker、截图、"一台 Mac mini 跑得起"）
- ⬜ r/LocalLLaMA、r/opensource、r/SideProject、r/artificial
- ⬜ 帖子用**第一人称故事**："我们没法把客户数据丢进 ChatGPT，所以做了个开源自托管的团队 AI 工作台"
- ⬜ 诚实写明"是什么/不是什么"，泡在评论区回

### 🦄 Product Hunt
- ⬜ tagline + **gallery（4–6 张截图）** + Demo 视频 + 缩略图/logo
- ⬜ maker 首评（讲故事）、找 hunter、预约一批首发支持者
- ⬜ 选好发布日（避开大牌撞车）

### 💼 LinkedIn（营收 ICP 在这，不在 Reddit）
- ⬜ founder 长帖：面向律所/基金/家办的"数据主权"叙事 + 约 Demo CTA
- ⬜ 公司页 + 案例（有标杆后）

### 🇨🇳 中文平台（国内是主战场）
- ⬜ **V2EX**（创意/分享节点，自托管受众）⬜ 即刻 ⬜ 少数派 ⬜ 掘金 ⬜ **公众号**长文（用 `article-writer` 的标准）⬜ 微信私域/群
- ⬜ 国内叙事换锚点（"可私有化的团队 AI 工作台"，不硬提 Cowork）

### 📚 长尾 / 持久曝光
- ⬜ 提 PR 进 **awesome-selfhosted / awesome-ai-agents / awesome-claude**（长期被搜到）
- ⬜ YouTube 放 Demo + "5 分钟部署"教程
- ⬜ Dev.to / Medium 同步 build 故事

---

## 3. 关键路径（按依赖排，先做这些才解锁发布）

1. ⬜ **最终化品牌名 + 域名**（Kin 域名/商标可用性）→ 解锁一切带品牌的物料
2. ⬜ **Demo GIF + 90s 视频**（#1 转化资产）
3. ⬜ **README 升级到发布级**（含 GIF + CTA + 对比 + 联系）
4. ⬜ **官网真实截图 + 视频 + 域名上线**
5. ⬜ **在线 Demo 实例**（零部署体验，#1 转化杠杆）
6. ⬜ **arm64 镜像 + 一键/VPS 部署**（第 4 步摩擦）
7. ⬜ **渠道就位**：Discord / 邮箱 / Cal.com / 微信 / X
8. ⬜ **各平台发布文案**：Show HN / X thread / Reddit / PH gallery / LinkedIn / 公众号
9. ⬜ repo 收尾：logo / og 图 / topics / CLA / 模板

> **发布顺序建议：** 先"软发布"（GitHub + X + Reddit r/selfhosted 收集首批反馈、修坑、攒早期 star），
> 稳定后再"硬发布"（Show HN + Product Hunt 集中火力）。**软→硬，别一次性全押。**

---

## 4. 两套受众 × 渠道 × CTA（别混）

| | 🌱 采用引擎（研究/开发者） | 💰 营收 ICP（律所/基金/家办） |
|---|---|---|
| 平台 | GitHub · HN · Reddit · X · V2EX/即刻 | LinkedIn · 微信 · 邮件 · 行业社群 |
| 钩子 | 开源/自托管/不锁模型/省钱 | 数据主权/可审计/合规/私有一体机 |
| 资产 | README · GIF · 在线Demo · 一键部署 | 垂直落地页 · 案例 · 约Demo · 一体机SKU |
| CTA | ⭐ Star · 🚀 自部署 · 💬 Discord | 📅 Book a demo · ✉️ 邮件 |

---

## 5. 发布前 T-0 检查（全绿才点发布）
⬜ README GIF 自动播放正常 ⬜ 官网视频可放 ⬜ 在线 Demo 可访问且不崩 ⬜ 一键部署在干净机器上跑通（Mac + VPS 各一次）⬜ Google 登录正常 ⬜ Discord/邮箱/约Demo 链接都活 ⬜ 各平台文案/图就位 ⬜ 诚实口径复查（无 air-gap 夸大）⬜ 首批支持者已约好（PH/HN 发布日互动）
