# OxyGenie — 开源 Cowork 替代品 竞品全景

> 调研日期：2026-06-13。来源：GitHub topic `claude-cowork-alternative`、各项目 README、
> 2026 年多篇 "best open-source Cowork alternative" 评测。star 数为调研当日抓取，会变动。

## 0. 一句话结论（先看这个）

**整个品类几乎全是「桌面 / 单机 / 单人」形态。** 头部两家（OpenWork 14.6k★、
Eigent 14.3k★）和一长串小项目，无一例外都是**桌面 App、local-first、个人 BYOK**。
**「Web/服务器优先 + 团队原生多用户 + 组织私有化部署」这条轴上几乎是空的——这正是 OxyGenie 的白地。**
再叠加「国内性价比模型 + 合规」，竞争对手更稀。**别去桌面单机赛道拼，守住团队私有化这块没人占的地。**

---

## 1. 头部（14k★ 级，直接定义品类）

### 🔴 different-ai/openwork — 14.6k★
- **引擎/形态：** opencode 驱动；**桌面优先**（Tauri），local-first，单人起步，再 "opt into" 远程分享/服务器。
- **商业：** MIT + 企业版（`ee/`，SSO/SLA/LTS，openworklabs.com）；YC 项目。Windows 走付费支持。
- **市场：** 西方为主；有中文 README，但无国内模型/合规/私有化落地。
- **对 OxyGenie：** 海外认知最强的对手，已占住 "open-source Cowork alternative" 这句话。**别正面拼 star。**

### 🔴 eigent-ai/eigent — 14.3k★
- **引擎/形态：** CAMEL 多智能体框架；**桌面 Cowork**，local-first；主打 **multi-agent 工作流 + 200+ MCP 工具**。
- **商业：** Apache 2.0；企业功能 **SSO / RBAC**——这家是唯一认真做企业/团队治理的，要重点盯。
- **市场：** 西方为主。
- **对 OxyGenie：** 功能最"全"、最像平台的对手；但**仍是桌面 App 内核**，不是 Web 多租户服务器。
  OxyGenie 的差异仍在"Web/服务器原生团队 + 私有化部署 + 国内模型"。

---

## 2. 国内 / 中文相关（OxyGenie 主场里的潜在对手）

### imjszhang/Deepseek-Cowork — 204★
- DeepSeek 驱动，浏览器自动化 + AI 助手，单人项目，JS。**国内开发者做的**，但偏"浏览器自动化"而非团队工作台，量级小。
- **对 OxyGenie：** 国内目前唯一有点声量的同类，但形态/定位不同（个人浏览器自动化 vs 团队私有化工作台），不直接抢。

> ⚠️ 国内目前**没有**一个"团队原生 + Web + 私有化部署 + 国内模型"的成熟开源 Cowork 替代品。这就是窗口。

---

## 3. 长尾（<50★，验证品类热度，暂不构成威胁）

| 项目 | star | 引擎/形态 | 备注 |
|---|---|---|---|
| **Xerus-ai/openwork** | 31 | Claude Agent SDK + Electron **桌面** | **和 OxyGenie 同引擎**；OpenRouter 多模型（含 GLM/Kimi/Qwen）；MIT；很早期 |
| **coasty-ai/open-cowork** | 33 | computer-use agents（浏览器/桌面控制） | TS，偏 computer-use 方向 |
| **OpenCoworkAI/open-codesign** | — | 多模型(Claude/GPT/Gemini/Kimi/GLM/Ollama)，BYOK local-first MIT | 其实是 Claude **Design** 替代品（prompt→原型/PPT/PDF），品类相邻 |
| **kuse-ai/kuse_cowork** | 低 | BYOK 桌面，本地优先，跨平台 | 主打隐私/本地/模型自由 |
| **DevAgentForge/Open-Claude-Cowork** | 低 | 桌面 AI 助手 | 编程/文件管理 |
| **halukerenozlu/bolt-cowork** | 0 | 终端原生 TUI，Go | Terminal-native file agent |

**评测文章另提到（多为闭源或边缘）：** Eigent（见上）、Composio（SaaS 集成型）、
OpenClaw（服务器 24/7 执行）、AionUI（可视化 dashboard）、Kilo、Manus 类。

---

## 4. 形态分布图（关键洞察）

```
                    单人 / 个人 BYOK  ←————————————→  团队 / 组织
   桌面 / 本地   │  OpenWork(14.6k)              │  Eigent(部分, SSO/RBAC)
   local-first  │  Eigent(14.3k) Kuse Xerus     │
                │  open-codesign coasty bolt    │
   ─────────────┼───────────────────────────────┼──────────────────────
   Web / 服务器  │  (几乎没有)                    │  ⭐ OxyGenie  ← 白地
   self-hosted  │                               │  (国内模型+合规 更空)
```

> **结论可视化：** 左上角挤爆，右下角（Web 服务器 × 团队组织）几乎只有 OxyGenie，
> 国内市场的这个格子更是空的。

---

## 5. 对 OxyGenie 定位的三条硬启示

1. **不要进桌面单机赛道。** 那里有 OpenWork + Eigent 两个 14k★ 巨头和一堆小项目，红海。
   OxyGenie 是 Web/服务器/团队，本就不在那个格子——**对外叙事要把这点钉死，避免被归类成"又一个桌面 Cowork"。**

2. **唯一要认真盯的是 Eigent。** 它是唯一往"企业/团队治理（SSO/RBAC）"走的，未来可能从桌面延伸到团队。
   但它内核仍是桌面多智能体 App，**没有 OxyGenie 的 Web 多租户/进程隔离/私有化部署底座**。
   盯紧它会不会出 Web/服务器版。

3. **国内 + 团队私有化 = 当前几乎无人的格子。** 把主战场押这里（呼应 `POSITIONING.md` §7-1），
   是基于竞品分布的理性选择，不只是偏好。**差异化一句话可升级为：**
   > "别人都是给个人的桌面 Cowork；OxyGenie 是**给团队的、能私有化部署的 Web 版 Cowork**，还能跑国内性价比模型。"

---

## 6. 待办 / 持续监控

- 每月重抓一次 star 与 release，重点盯 **Eigent 是否推出团队/服务器版**、OpenWork 企业版进展。
- 关注国内是否冒出"团队私有化 Web Cowork"——一旦出现，是直接对手，需第一时间应对。
- 把本文件与 `POSITIONING.md` 的竞争格局表保持同步。
