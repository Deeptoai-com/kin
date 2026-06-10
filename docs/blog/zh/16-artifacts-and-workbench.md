---
title: "第 16 篇：Artifact 检测与会话 UI/Workbench —— 启发式检测、为什么关掉 structured outputs、seq 排序"
slug: 16-artifacts-and-workbench
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 16
keywords: [artifact, workbench, structured outputs, seq, 会话 UI, turn card]
prev: 15-real-preview
next: 17-billing-and-observability
---

# 第 16 篇：Artifact 检测与会话 UI/Workbench —— 启发式检测、为什么关掉 structured outputs、seq 排序

> 预览容器有了（第 15 篇），但前端怎么知道"这一回合产出了一个 App、该弹一张卡"？OxyGenie 当前靠**启发式**扫工具调用，而不是 SDK 的 structured outputs（被关了）。这一篇讲 artifact 检测、为什么一回合该收敛成一张卡、以及会话 UI 那个乱序难题——事件没有 seq，历史和实时拼不齐。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案启发式检测--seq-排序--turn-card-折叠) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

第 15 篇把"运行环境"准备好了：per-session 容器能 install、能 build、能反代。但运行环境只是后端的一半，前端还有一道更细碎的活——**怎么把一团 agent 事件，翻译成用户看得懂的一次交付。**

具体要同时做对四件事，每一件都有它自己的坑：

1. **识别产物**：agent 一回合里可能 Write 了 `index.html`、`App.tsx`、`logo.svg`、`data.csv`。哪些是"可预览的产物"，哪些只是过程文件？没有谁来打标签——SDK 只告诉你"工具被调了、返回了一个文件路径"。
2. **收敛成一张卡**：一个多文件 App 是**一次交付**，不是四次。如果每个 Write 都弹一张卡，用户看到的是四张几乎一样的卡，像是系统抽风了。
3. **拼出有序时间线**：WebSocket 帧会乱序到达，更要命的是 **resume 时历史事件和实时事件混在一起**——历史是从 transcript 灌进来的、实时是 worker 现吐的，两股流要拼成一条不重不漏的时间线。
4. **填满右侧 Workbench**：进度（agent 现在做到第几步）、子 Agent（有没有 spawn 出 Task）、文件（工作区里有什么）、上下文（这次用了哪个模型、烧了多少 token、挂了哪些 Skill/MCP）——四个面板的数据都得有来源。

把这四件事摆一起，"显示一次 AI 回答"就从一个渲染问题，变成了一个**事件流解释问题**：你要在没有结构化契约的前提下，从一串松散的工具调用里，反推出"这一回合到底交付了什么"。

## 朴素方案为什么不行

**方案一：每个 Write 弹一张 artifact 卡。** 最直接——看到工具结果里有文件路径就建卡。但 agent 写一个 Vite 工程要 `package.json` + `src/main.tsx` + `src/App.tsx` + `index.html`，四五次 Write 就是四五张卡。用户滚动半屏全是几乎一样的"文件卡"，根本看不出这是**一个** App。**"一次交付 = 多次写入"这个事实，让 per-Write 建卡从根上就错了。**

**方案二：用 SDK 的 structured outputs 让模型自报产物。** 这是最"正确"的方案——给 `query()` 配 `outputFormat` 的 JSON Schema，让模型在回合结束时结构化声明"我产出了哪些文件、它们组成一个什么类型的 App"。前端拿着结构化清单建卡，干净、可靠、不用猜。但真接上才发现：SDK 的 `outputFormat` 背后挂了一个 **Stop-hook 强制机制**——模型没调 `StructuredOutput` 工具时，它会多跑一轮，并把 `You MUST call the StructuredOutput tool` 这句内部指令**漏进对话上下文**。结果是污染：用户能在 transcript 里看到这句莫名其妙的系统话，模型的后续行为也被带偏。**SDK 的高级特性，把自己的实现细节漏进了我们的产品。**

**方案三：纯靠工具名 scrape 填 Workbench。** Workbench 的进度面板想知道"agent 做到哪步"，最省事的办法是扫工具调用名：看到 `TodoWrite` 就更新进度、看到 `Task` 就记一个子 Agent。能跑，但脆——SDK 一改工具名或事件形状，整个面板就空了；而且它要等**整条消息存完**才能更新，实时性差，滞后肉眼可见。

**方案四：靠到达顺序给消息排序。** WebSocket 帧按收到的顺序往时间线上拼。单看实时流也许还行，但 resume 一介入就崩：历史事件批量灌入、实时事件穿插到达，两股流没有共同的排序键，去重只能靠"内容看起来一样就算重复"这种拍脑袋逻辑——错位、重影、丢帧全来了。

四个方案的共同教训：**会话 UI 的难点不在"渲染一条消息"，在"从无结构的事件流里，稳定地重建出『一次交付』和『一条有序时间线』"。** per-Write 建卡误解了交付粒度；structured outputs 用 SDK 的内部机制污染了上下文；scrape 工具名脆且滞后；到达顺序排序在 resume 下必然错位。OxyGenie 当前的答案，是把这几件事拆成"启发式检测 + seq 排序 + turn card 折叠"三件套——其中一部分已落地，一部分还在 Phase A/B 规划里（这是诚实的现状）。

## 核心方案：启发式检测 + seq 排序 + turn card 折叠

OxyGenie 当前的策略可以一句话概括：

> **不依赖 SDK 的结构化契约，改用"扫工具结果 + 文件后缀 + manifest 清单"的启发式推断产物；给事件加 `seq` 做有序合并；把一回合的多次写入折叠成一张交付卡。** 已落地的是启发式检测，seq 排序与 turn card 折叠在 Phase A 规划中。

四条逐一看它怎么对应上面的四个坑：

**① 启发式 artifact 检测（已落地，`use-artifact-detection.ts`）—— 扫后缀，不等模型自报。** 检测器扫工具结果里的文件路径，按后缀映射判断是不是可预览产物：`.html` / `.svg` / `.md` / `.jsx` / `.tsx` / 图片 / `.json` / `.csv`。Write/Edit 命中就建卡。这是"自己看文件"，不依赖任何 SDK 结构化输出——脆在它要维护一张后缀映射表，但胜在 SDK 怎么变它都不受影响。

**② 为什么关掉 structured outputs（`ENABLE_STRUCTURED_OUTPUTS=false`）—— 上下文干净优先。** 这是本篇最反直觉的一笔。我们本想用 structured outputs 替掉脆弱的启发式，但它的 Stop-hook 会把 `You MUST call StructuredOutput` 漏进对话——为了一个"更结构化的产物清单"，污染了整段对话上下文，得不偿失。于是当前默认关闭，改用启发式 + 第 15 篇那个 `.oxygenie/app.json` 清单来推断"哪些文件组成一个 App"。这个根因和真预览的 manifest 策略**耦合在一起**：manifest 怎么定，决定了 structured outputs 还要不要——没定死之前，不强行解。

**③ seq 排序（Phase A 规划）—— 给乱序流一个共同排序键。** 给每个事件加一个单调递增的 `seq`（worker 那一侧第 04 篇已经在 NDJSON 帧上带了 `seq`，这里指的是把它一路贯通到前端的会话 store）。UI 不再按到达顺序拼，而是按 `seq` 合并 + 去重，历史和实时用同一把尺子对齐。**当前前端 store 还没用上 seq，这是已知缺陷**——resume 后队列偶发卡住、消息重影，根子都在这。

**④ turn card 折叠（Phase A2/A3 规划）—— 一回合一张卡。** 把一回合聚成一张卡：文本答案 + 可选的预览卡 + 一个可折叠的"过程 · N 步 · 改了 3 个文件"，回合一完成就自动折叠。artifact 也跟着收敛——同一回合的多次写入收进**同一张交付卡**（A3），彻底解决方案一那个"四张重复卡"的问题。

**⑤ Workbench 真数据（Phase B 规划）—— 从硬编码空态换成真来源。** Files 面板改成 server function 直接读会话工作区目录；Context 面板用第 17 篇已经算好的 usage / model / skills / MCP 元数据。当前 Files/Context 还是**硬编码空态**，Progress/Sub-agents 还在扫工具名——这是 Workbench 当前最实在的债。

这五条里，真正已经在生产里跑的是 ①②，③④⑤ 是 Phase A/B 的规划。把现状和规划分清楚，是这篇该有的诚实——OxyGenie 的会话 UI 还在演进，不是已经收口的成品。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/lib/hooks/use-artifact-detection.ts` | L49–75 / L97–121 / L243–256 | 扩展映射 / 抽取产物 / 逐文件建卡 |
| `src/lib/artifacts/artifact-registry.ts` | L43–50 / L52,59 | 内容 hash / `MAX_VERSIONS=10`（暂停 `ENABLE_VERSION_RECORDING=false`） |
| `src/lib/chat-session-store.ts` | L401–538 | `mergeMessagesIntoThread` + tool_result 回填 |
| `src/claude/adapters/ws-adapter.ts` | L524–531 | `messages_loaded` 双处理隐患 |
| `src/components/claude-chat/workbench-panel.tsx` | L248–259 / L57–84 / L109–140 | Files/Context 空态硬编码 / Progress 扫 TodoWrite / Sub-agents 扫 Task |

检测链的核心在 `use-artifact-detection.ts`：L49–75 是那张**后缀 → 产物类型**的扩展映射表（决定哪些文件值得建卡），L97–121 从工具结果里抽出文件路径和内容，L243–256 逐文件建卡。建出来的卡进 `artifact-registry.ts`：它用**内容 hash**给同一文件的多次写入去重、做版本（L43–50），`MAX_VERSIONS=10` 是版本上限——但注意 `ENABLE_VERSION_RECORDING=false`，**版本记录当前是停用的**（L52,59），跟 structured outputs 一样属于"机制就位、策略未定、先关着"。

会话 store 这一侧，`mergeMessagesIntoThread`（`chat-session-store.ts` L401–538）负责把历史消息灌进线程并回填 tool_result——这正是 resume 时历史/实时两股流相遇的地方，也是 seq 缺位时最容易错位的代码。而 `ws-adapter.ts` L524–531 的 `messages_loaded` 是一个**已知隐患**：它在 adapter 和事件队列里被双处理（见坑一）。Workbench 这一侧，`workbench-panel.tsx` 把现状写得很白：Files/Context 是硬编码空态（L248–259），Progress 靠扫 `TodoWrite`（L57–84），Sub-agents 靠扫 `Task`（L109–140）——三块都是临时实现，等 Phase B 换真数据。

## 反直觉结论

> [!IMPORTANT]
> **当 SDK 的结构化输出会污染上下文，"退回启发式"反而是更干净的工程选择。**
>
> OxyGenie 本想用 structured outputs 让模型自报产物，却发现它的 Stop-hook 把 `You MUST call StructuredOutput` 漏进了对话——于是宁可关掉它、用文件后缀 + manifest 启发式推断。这听起来像倒退："放着 SDK 的结构化能力不用，去手写一张后缀映射表？"但工程上它是进步：启发式虽然脆，**脆得局部、脆得可见**——某个后缀没覆盖，加一行映射就好；而 structured outputs 的污染是**全局的、隐性的**，它改变的是模型看到的上下文本身，你很难一眼看出哪句回答被那条注入指令带偏了。

这提醒一件系列反复出现的事：**SDK 的高级特性不是白用的，它可能把自己的实现细节漏进你的产品。** OxyGenie 的主线是"包住 SDK、不重写它的 Loop"——但"包住"不等于"全盘照单全收"。`query()` 的核心循环值得信任，因为它的边界干净；可一旦某个特性（这里是 `outputFormat` 的 Stop-hook）把内部机制顶到了你的对话表面，它就从"能力"变成了"耦合"。**成熟的用法是分清这两类：核心循环交给 SDK，会漏内部细节的特性自己兜底。** 退回启发式不是认输，是把控制权从一个会漏的黑盒手里收回来。

## 三个生产坑

> [!WARNING]
> **坑一 —— `messages_loaded` 在 adapter 和事件队列被双处理，`queue.switch()` 没有它的分支。**
> `messages_loaded`（`ws-adapter.ts` L524–531）这一类事件，在 adapter 层处理了一遍，又进了事件队列再被处理一遍；而队列的 `queue.switch()` 偏偏**没有它的分支**——于是它变成一个"死事件"，落进队列后没人正确消费。后果是 resume 之后队列可能卡住：历史灌完了，实时流却接不上。根治要靠 seq 排序把"历史/实时合并"这件事收口到一处，在那之前只能靠在 adapter 和队列两侧小心对账。这是会话 UI 当前最真实的结构债。

> [!WARNING]
> **坑二 —— 启发式会把解释文字里的代码块误判成产物。**
> 检测器扫的是"看起来像文件/产物的东西"，但 agent 经常在文本回答里贴一段 ```` ```html ```` 来解释思路——这段说明性的代码块，会被启发式当成一个真产物建出一张预览卡。这正是 structured outputs 本该解决、却因为污染上下文而被关掉的那类问题：没有模型自报的结构化清单，前端就分不清"这是我要交付的 App"还是"这是我顺手举的例子"。当前**暂无更好的兜底**——只能靠后缀映射 + manifest 尽量收窄，误判率压不到零。这是关掉 structured outputs 付出的直接代价，诚实地记在这里。

> [!WARNING]
> **坑三 —— Workbench 的 Files/Context 是硬编码空态，Progress/Sub-agents 靠扫工具名且滞后。**
> 右侧 Workbench 四个面板，当前只有两个有"半真"的数据：Progress 扫 `TodoWrite`、Sub-agents 扫 `Task`（`workbench-panel.tsx` L57–84 / L109–140），而 Files/Context 干脆是硬编码空态（L248–259）。扫工具名这条路**SDK 改版即脆**——工具一改名面板就空；而且它要等事件流过，滞后约 200ms，进度更新总比实际慢半拍。Phase B 的修法是：Files 走 server function 直读工作区，Context 用已算好的 usage 元数据，把"扫工具名"换成"读真来源"。在那之前，Workbench 是个"看起来在工作、实际数据半真"的占位实现，别拿它当可靠监控。

这三个坑的共同根源是：**会话 UI 当前是在用启发式和占位实现，去逼近一个本该由结构化契约提供的东西。** seq 缺位、structured outputs 关闭、Workbench 硬编码——每一个都是"机制还没完全长好"的临时态。它们不是设计失误，是一个还在 Phase A/B 演进中的前端的真实切片。把它们如实标出来，比假装会话 UI 已经收口更有价值——因为下一篇开始，我们要转向后端那些**已经收口**的系统了。

## 配图

1. ![artifact 检测：工具结果 → 后缀映射 → 建卡](../assets/img/16-artifact-detection.svg)
2. ![会话 UI 乱序难题与 seq 排序（规划）](../assets/img/16-seq-ordering.svg)

## 下一篇

→ [第 17 篇：计费与可观测](./17-billing-and-observability.md)

前端的事先告一段落。下一篇转向一个"还没开始收钱"的计费系统怎么设计：为什么 SDK 报的 `costUsd` 在包月 ¥200 的 ARK plan 下毫无意义、为什么一个计费系统该先建"观测"而不是"扣费"、以及审计表为什么故意不外键到 user——把不可变性看得比引用完整性更重。

---

📌 [reading-map.md](../reading-map.md)
