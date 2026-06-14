# OxyGenie — 滩头人群 & 定位 深度调研（2026-06）

> 调研方法：三路并行 web 调研（同类产品定位 / 三类垂直 AI 现状 / 滩头打分 + Mac mini 技术核查）。
> 所有结论附来源（见文末）。拿不准处标"未确认"。本文是 `POSITIONING.md` 的论证支撑。

---

## 0. 一页结论（先看这个）

1. **品类白地确认**：私有 AI 现在两极分化——要么是**重 GPU 机柜一体机**（Go Abacus Go1、Zanus、
   LLM.co，quote-only、面向受监管大机构），要么是**纯软件开源自托管**（AnythingLLM、Onyx、Open WebUI，
   要客户自己搞硬件运维）。**"消费级 Apple Silicon 盒子 + 开箱即用 + <30 人小团队 + Web 访问"这个交点，
   没有人在做定位。这就是 OxyGenie 的护城河坐标。**

2. **滩头建议：精品/中小律所先打**（打分 25/30，三类最高）。原因：基数最厚、"不能上云"痛点既硬又普适
   （有联邦判例：用公开 AI 工具会刺破 attorney-client privilege）、工作流最同质（可做标准技能）、最易触达
   + 愿做公开背书。**基金（21）是高 ARPU 的第二滩头，家办（17）最封闭、留作后期。**

3. **但有一个必须正视的反转**：律所是"不能上云痛点最硬"和"对幻觉零容忍、最不原谅本地模型质量"
   **同时叠加**的人群。所以产品叙事**不能是"纯本地全包、媲美 Claude"**，必须是
   **"机密数据与文档一步不出你的办公室，律师全程在环；本地扛敏感重活，关键高风险结论可选调更强模型"**。

4. **硬件真相（叙事命门）**：基础 Mac mini 撑不起"团队 + 大模型 + 并发"。要兑现"推理不出盒子"，
   **真正的'盒子'是 Mac Studio M4 Max 128GB**（跑 70B/gpt-oss-120B，40–90 t/s）；Mac mini M4 Pro 64GB
   只够"小团队 + 轻并发 + 30B 偶发"。**"一台 Mac mini 全包高质量"这个强叙事 2026 年站不住，必须改成
   分层（本地敏感环节 + 关键步骤可选云兜底 + 清晰数据边界）。**

---

## 1. 同类产品白地 & 可偷的定位语言

### 1.1 市场结构：两极，中间是空的

| 极 | 代表 | 特征 | 给 OxyGenie 的意义 |
|---|---|---|---|
| 重硬件机柜一体机 | Go Abacus Go1、Zanus AI、LLM.co | 8×GPU、要机房、quote-only、数百~数千用户、监管大机构 | 太重太贵，小团队够不着 |
| 纯软件开源自托管 | AnythingLLM、Onyx(原 Danswer)、Open WebUI、LibreChat、Lobe Chat、Dify | 免费开源，但客户自己搞硬件+运维 | 小团队没 IT，搞不动 |
| **空白交点** | **（无人）** | **消费级 Apple Silicon 盒子 + 开箱即用 + <30 人 + Web** | **OxyGenie 的定位坐标** |

### 1.2 可偷的金句（原话）

- **"On-Prem AI. In one box."**（Go Abacus）— 七字讲完产品，画面感最强。
- **"The cloud made AI possible. The Go1 makes it controlled."** — 云→盒子的递进叙事。
- **"Your infrastructure. Your rules."**（Onyx）
- **"...so they stop pasting company data into ChatGPT. One front door for AI, fully under your control."**
  （Onyx）— 反 shadow-AI 钩子，对律所/基金合规负责人极有杀伤。
- **"Take Back Control of Your Data" / "data control is [the challenge]"**（Synology）— 把战场从"AI 强不强"
  挪到"谁掌控数据"，降维打法。
- **"No token billing. No variable usage exposure." / "No Daily Token Fees - Unlimited"**（Go1 / Zanus）—
  买断 + 不限量 vs 云 per-seat/按量，财务说服力。
- **"Local. Private. Powerful." / "No account needed. Not SaaS."**（AnythingLLM）

### 1.3 五条定位借鉴

1. **抢"装进一台盒子"的极简叙事，但绑定 Apple Silicon 做差异化**（别人都是机房级重硬件）。
2. **把战场挪到"数据主权/控制权"**，别和云比模型强弱（学 Synology）。
3. **用"别再往 ChatGPT 里粘机密"做最痛的钩子**（学 Onyx），单独做合规叙事落地页。
4. **"买断 + 不限用量、账单可预测"当卖点**，对位云的 per-seat 订阅。
5. **造一个品类词 +  按行业做垂直落地页**（律所/基金/家办各一页，hero 换行业语言）。

---

## 2. 三类垂直 AI 现状（决定切谁）

### 2.1 律所
- 在位者：Harvey（$150–300/seat/月，大所为主，云）、Legora（$5.55B 估值）、Spellbook（$99–199）、
  CoCounsel（TR）、Luminance（**有 on-prem 选项**）、**Clio Duo（+$49，明确主攻 1–50 人小所）**。
- **privilege 红线**：已有联邦判例——用**公开 AI 工具**生成的文档**不受 attorney-client privilege 保护**。
  市场已成型话术："self-hosted … client data never leaves your control / air-gapped / no third-party retention"。
  **这几乎就是为'私有部署一体机'量身定制的接口。**
- 中国：法律垂类 AI 最成熟（幂律×智谱 PowerLaw GLM、华宇元典万象、北大法宝、法院法研万法），市场已被教育。

### 2.2 基金
- 在位者锁定大客户且极贵：**AlphaSense $10–40K+/seat/年（大单>$1M）、Hebbia 首年 $80K–1.5M 且无试用、
  Rogo ~$3,300/seat、bespoke**。**→ 精品基金/小型 PE/VC/家族投资团队被高墙挡在门外，价格空档最大。**
- 痛点：MNPI + Reg S-P/Form PF，很多机构已封禁公共 ChatGPT，但多用"私有云/VPC"满足（不一定要"盒子"）。
- 中国：量化私募 AI 接受度最高（数据清洗、策略迭代、投研协同），约 1.93 万家私募管理人。

### 2.3 家族办公室
- 在位者几乎全是**数据聚合/报告/追踪**型（Canoe、Arch、Masttro、Asora $900/月起），
  **AI 多用于文档摘要，还没有"对话式 AI agent 工作台"的赢家**——产品形态有空档。
- 但：全球仅 8,000–20,000 家、极度封闭、一户一策、几乎拿不到公开标杆。**最不适合冷启动。**

### 2.4 空档小结
- **价格空档最大** → 基金（精品/小型被高价挡门外）。
- **"不能上云"叙事最成熟、最现成** → 律所（privilege 法理）。
- **工作流最同质、最易模板化** → 家办（但最封闭）；其次律所（合同/检索/判例摘要跨所同质）。

---

## 3. 滩头打分矩阵

| 维度 | 律所(中小/精品) | 基金(小型/精品) | 家办 |
|---|:--:|:--:|:--:|
| 市场规模/数量 | 5 | 3 | 2 |
| 付费意愿/预算 | 3 | 5 | 4 |
| 销售可达性/周期 | 4 | 3 | 2 |
| 数据敏感/"不能上云"痛点 | 5 | 4 | 5 |
| 工作流同质性(可模板) | 4 | 3 | 2 |
| 早期标杆可得性 | 4 | 3 | 2 |
| **总分(满分30)** | **25** | **21** | **17** |

- 律所：美国约 41.8 万家律所、中国执业律师 73 万+，长尾最厚；合伙人短决策链、渠道成熟、愿公开背书。
- 基金：ARPU 最高、合规驱动自建需求刚性，但渠道封闭、案例忌讳公开、工作流容错低 → **第二滩头/上探**。
- 家办：痛点+钱都在，但稀缺、封闭、一户一策、拿不到署名案例 → **后期高端定制**。

### 魔鬼代言人（反对先打律所）
1. 法律 AI 已是红海，Harvey/CoCounsel/Spellbook/Clio 重金占领，且多数已有私有部署选项——
   "私有化"在律所赛道**不再独特**。
2. 中小所价格敏感（$50–200/seat 天花板），一体机硬件+部署成本未必算得过账。
3. **律所对幻觉零容忍**，而本地中小模型在高风险法律判断上仍逊 Claude/GPT——
   **最敏感、最需要不上云的客户，恰恰对模型质量要求最高，正是本地推理叙事最易翻车处。**
4. 反论：基金 ARPU 高得多、单客户经济模型远好于中小所，"少而精打基金"也许更适合资源有限的早期团队。

> 第 3 点把决策交给了技术核查（见 §4）。结论：律所推荐成立，**但叙事必须"本地 + 混合兜底 + 清晰边界"，
> 而非"纯本地全包"**。

---

## 4. Mac mini / Apple Silicon 本地模型可行性（叙事命门）

### 4.1 实测性能
| 硬件 | 内存 | 可稳定跑 | 速度 |
|---|---|---|---|
| Mac mini M4（基础） | 16–24GB | 7B–13B | 数十 t/s（流畅） |
| Mac mini M4 Pro | 64GB | 30–32B (Q4/Q5) | ~12–18 t/s（贴近天花板） |
| Mac mini M4 Pro | 64GB | 70B (Q4) | ~4–5 t/s（偏慢） |
| **Mac Studio M4 Max** | **128GB** | **70B / gpt-oss-120B** | **~40–90 t/s** |

物理约束：推理受**内存带宽**限制；长上下文的 **KV cache 是隐形杀手**，多并发时统一内存易触顶滑入 swap。

### 4.2 质量够不够用
- **够用**：检索、RAG、摘要、信息抽取、分类、初稿、脱敏——本地 30B 类胜任，且这正是**数据最敏感、
  最该不出盒子**的环节。RAG 可再补 ~+10pp 准确率。
- **不够用**：最终合同结论、关键法律判断、零容忍幻觉场景——仍逊 Claude/GPT（GPT-5 法律基准 ~84.6%，
  Qwen3-32B/235B 未达专有第一梯队）。

### 4.3 并发（<30 人，实际同时 3–10）
- Ollama 支持并发（`OLLAMA_NUM_PARALLEL` 默认 4）+ 队列，但统一内存被权重+各会话 KV cache 共享。
- Mac mini M4 Pro 64GB：小团队轻并发可（配队列护栏）；3–10 人**同时跑 30B**会吃力。
- **Mac Studio M4 Max 128GB 才是"团队级 + 大模型 + 真并发"该买的型号**（~$3,500 起）。

### 4.4 结论
**"数据连推理都不出盒子"——有条件成立：**
- **盒子 = Mac Studio M4 Max 128GB**（真团队并发 + 可用质量）；基础 Mac mini 只够个人/极小团队轻任务。
- **任务分层**：本地跑敏感环节（检索/RAG/摘要/抽取/初稿/脱敏）；关键高风险推理"本地兜底 + 可选调前沿模型"，
  并对客户明确"哪些数据/步骤永不离盒"。
- **并发护栏**：队列 + 单会话上下文上限 + 小模型日常驱动 + 大模型按需加载。
- ❌ **不成立**：宣称"一台基础 Mac mini 让 <30 人全部任务（含高质量合同结论）本地完成、媲美 Claude"。

---

## 5. 落到定位的修订动作

1. **滩头锁定**：精品/中小律所先打 → 三类里再细分（建议有暖线索的子类，如交易所/合规小所）。
2. **品类词 & 金句**：造中文品类词（候选「AI 私有一体机」「团队 AI 保险箱」），主金句对位
   Go Abacus "On-Prem AI. In one box." → 例如「**整个团队的 AI，装进一台你自己的盒子**」。
3. **硬件口径修正**：从"一台 Mac mini"改为"**一台 Apple Silicon 盒子（Mac mini 起步，团队跑大模型上
   Mac Studio）**"，避免过度承诺。
4. **模型叙事修正（§4.5 已写，再强化）**：律所版主打"**机密不出办公室 + 律师在环 + 关键步骤可选更强模型**"，
   而非"纯本地媲美 Claude"。
5. **三张垂直落地页**：律所（privilege/保密）、基金（MNPI/持仓不出本地）、家办（家族隐私零外流）。
6. **战场叙事**：学 Synology 把核心 message 定在"数据主权/控制权"，学 Onyx 打"别再往 ChatGPT 粘机密"。

---

## 6. 待核实 / 下一步
- 用真实合同样本做**内部基准**，定"本地 vs 上云"任务边界（QA 主导）。
- 自测 gpt-oss-120B / Qwen3 在目标 Mac Studio 上的真实速度与并发上限。
- 核实 Harvey/Legora/Hebbia 是否真有 on-prem/单租户（本轮未取到官网原话级确认）。
- 中国"小所占比""家办总数"缺权威单一数据，引用需谨慎。

---

## 来源（节选）
同类产品：goabacus.co/go1 · zanusai.com · llm.co/box · onyx.app · anythingllm.com · openwebui.com ·
nvidia.com/dgx-spark · Synology（event.synology.com / tweaktown 数字主权报道）。
律所：harvey.ai · spellbook.com/learn/attorney-client-privilege-ai · perkinscoie（联邦判例）· clio.com ·
luminance.com。基金：hebbia.com · rogo.ai · alpha-sense.com · blueflame.ai · brightwave.io。
家办：canoeintelligence.com · institutionalinvestor(Arch) · masttro.com · asora.com。
Mac mini：like2byte.com(30B 实测) · willitrunai.com · news.ycombinator(120B 实测) · arxiv ContractEval/LEXam。
中国：pkulaw.com · 法院 data.court.gov.cn · AMAC 私募月报 · 清华五道口。
