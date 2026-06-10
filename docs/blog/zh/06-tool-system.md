---
title: "第 06 篇：工具系统 —— SDK preset `claude_code` 与自定义 MCP 工具的分工"
slug: 06-tool-system
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 6
keywords: [工具系统, createSdkMcpServer, claude_code preset, Python tool, Bash tool]
prev: 05-execution-runtime
next: 07-mcp-capability-center
---

# 第 06 篇：工具系统 —— SDK preset `claude_code` 与自定义 MCP 工具的分工

> OxyGenie 的工具分两类：一类是 SDK 内置的 `claude_code` preset（Read/Write/Edit/Grep/Glob/...），白给；另一类是 OxyGenie 自己用 `createSdkMcpServer` 注册的——Python、GLM-Image、Bash。这一篇讲：哪些用 SDK 的、哪些自己造、为什么 **Bash 偏偏不用 SDK 自带的而要自己包一遍**。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案preset-给安全的自定义包危险的) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

模型要能读写文件、跑代码、生成图、执行命令，才能真正干活。但 OxyGenie 站在 Claude Agent SDK 之上——SDK 已经自带一整套工具（`claude_code` preset：Read/Write/Edit/Grep/Glob/Ls/...，约 15 个），白给、免维护、还跟着 SDK 升级。直觉上应该全用它。

可一旦把每个工具都摆进 OxyGenie 的真实部署语境，问题就分叉了：这是个**自托管、组织内多用户**的平台，模型跑出来的代码要落在共享宿主上、要联网、要碰文件系统。于是同一个"给模型一个工具"的动作，背后藏着两个截然不同的需求：

1. **读写类**（Read/Edit/Grep）：危险的是"越界"——读到别的租户的文件、写出工作区之外。这类只要有**路径边界校验**就够了，执行本身不需要我们插手。
2. **执行类**（Bash/Python）：危险的是"执行本身"——一段失控代码可以吃满内存、可以把 `ANTHROPIC_AUTH_TOKEN` 打印出来外带、可以 `curl` 内网当跳板。这类光有边界校验不够，**执行的那一刻**就得套上沙箱、剥掉密钥、压上资源上限。

所以真正的问题不是"用不用 SDK 的工具"，而是：**哪些工具我能放心交给 SDK，哪些我必须在它执行前夺回控制权？**

## 朴素方案为什么不行

**方案一：全用 SDK 自带工具，含原生 Bash。** 最省事——`tools:{preset:'claude_code'}` 一行，Bash、Read、Edit 全有了。但 SDK 的原生 Bash 是个**黑盒执行器**：它在 agent loop 内部直接 `spawn` 命令，整个过程**没有一个我们能插手的拦截点**。我们没法把命令塞进 `ExecutionRuntime` 的沙箱（第 05 篇），没法在 spawn 前用 `buildSafeEnv()` 剥掉 `ANTHROPIC_AUTH_TOKEN`，没法套 `prlimit` 限内存/进程数。等于把平台上最危险的能力，交给一个你完全管不到的执行器——这跟"半可信同事 + 共享宿主"的威胁模型直接冲突。

**方案二：禁用 Bash，只留文件工具，让模型用 Python 间接执行命令。** 看似回避了风险，实际更糟：模型会用 `subprocess.run(...)` 在 Python 里绕回 shell，你既没堵住命令执行，又丢了"Bash"这个语义清晰、能单独门控的工具入口。把危险藏进另一个工具里，不等于消除危险。

**方案三：自己从零写一套工具协议，绕开 SDK preset。** 那就回到了"自研 Agent Harness"的老路——Read/Edit/Grep 这些 SDK 已经做好边界校验、还跟着升级的工具，重写一遍纯属重复劳动，而且会和 SDK 的工具调用格式打架。本系列的主线恰恰是**不重写 SDK 已经做对的部分**。

三个方案的共同教训：**安全工具（已有边界校验）和危险工具（需要执行时拦截）不能一刀切。** 全用 SDK = 危险工具失控；全自研 = 安全工具白白重写。正确的切法在中间，分界线只有一条——**这条调用，我需不需要在它执行前插一只手？**

## 核心方案：preset 给安全的、自定义包危险的

OxyGenie 的工具系统就两层，分界清晰：

- **SDK preset `claude_code`**：约 15 个内置工具（Read/Write/Edit/Grep/Glob/Ls/...），直接用。它们不需要执行时拦截，但每次调用仍会过 `path-security` 的工作区/租户边界校验，以及权限模式 + HITL（`canUseTool`，第 09 篇）。SDK 做对的，我们不动。
- **自定义 MCP 工具**（`createSdkMcpServer`）：Python（`run`）、GLM-Image（`generate`）、Bash（仅当沙箱就位时注册）。这三个的共同点是**都把执行收进 `ExecutionRuntime`**，于是沙箱、密钥剥离、prlimit 这些拦截点全都有了着落。
- **Bash 走自定义、不走 SDK 原生**：每条命令都包进 `getExecutionRuntime().exec()`，沙箱/密钥剥离/prlimit 才有插手点。**SDK 原生 Bash 永远禁用**——这是整套设计最关键的一刀。
- **统一门控**：无论 preset 还是自定义，每个工具调用前都过 path 安全 + 权限模式 + HITL（`canUseTool`，第 09 篇）。

```javascript
// ws-query-worker.mjs L383–629（节选）
const pythonMcp = createSdkMcpServer({ name:'python',    tools:[ tool('run', ...) ] })
const glmImage  = createSdkMcpServer({ name:'glm-image', tools:[ tool('generate', ...) ] })
const bashMcp   = sandboxReady ? createSdkMcpServer({ name:'bash', tools:[ bashTool ] }) : null
query({ options:{ tools:{type:'preset',preset:'claude_code'},
                  mcpServers:[pythonMcp, glmImage, ...(bashMcp?[bashMcp]:[]), ...userMcp] } })
```

注意 `bashMcp` 的三元判断：**沙箱没就位（`sandboxReady` 为假），Bash 工具根本不进 `mcpServers`**。这不是省事，而是原则——Bash 的安全性完全依赖 `ExecutionRuntime`，沙箱不在，宁可不给模型这个工具，也绝不退回到无拦截的原生 Bash。preset 这一侧则始终在线：哪怕沙箱挂了，Read/Edit/Grep 仍可用，因为它们的安全只依赖路径校验，不依赖执行沙箱。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `ws-query-worker.mjs` | L383–629 | 注册 Python / GLM-Image / Bash MCP + 接 user MCP |
| `src/claude/python/runner.js` | 187 行 | Python 经 ExecutionRuntime 执行 + 工作区快照 |
| `src/claude/bash/runner.js` | 241 行 | Bash + 校验 + prlimit（第 10 篇） |
| `src/claude/path-security.js` | L267–331 | 每个文件工具的工作区/租户边界校验 |

把这张表读成两条平行的执行路径：文件工具（preset）走 `path-security.js`，校验过了就交给 SDK 自己跑；执行工具（Python/Bash）走各自的 `runner.js`，而 runner 内部一律调 `ExecutionRuntime`——这就是"拦截点"落地的地方。Python 的 runner 还多做一件事：执行后给工作区拍一张文件快照，把变更 diff 反馈给模型（详见生产坑三）。

这套设计里所有的"上限"都是写死的常量，构成执行类工具的硬边界：**Python 超时 10s、Bash 超时 300s、输出帽 512KB、Python 代码上限 200KB、工作区文件快照截断 2000 个**。这些数字本身就是安全策略——它们不是性能调优，而是"一段失控代码最多能消耗多少"的契约。能写下这些常量，正是因为执行收进了 `ExecutionRuntime`；如果用 SDK 原生 Bash，这些上限根本无处安放。

## 反直觉结论

> [!IMPORTANT]
> **"用官方工具" 和 "自己造工具" 的分界线，不是功能，是"有没有拦截点"。** 凡是需要落进沙箱、剥密钥、上资源上限的（Bash/Python），就必须自己用 MCP 包一层，把执行收进 `ExecutionRuntime`；凡是 SDK 已经做了边界校验的（Read/Edit），就直接用 preset。**判断标准只有一个：这条调用，我需不需要在它执行前插一只手？**
>
> 这条标准之所以好用，是因为它把一个模糊的"安全设计"问题，变成了一个非黑即白的工程问句。Bash 需要拦截，所以即便 SDK 自带，也得自己包——这不是不信任 SDK，而是 SDK 的原生 Bash**没有为我们留拦截点**。整个系列反复说"不重写 SDK 做对的事"，但这一篇给出了它的边界：**当 SDK 的实现里没有你需要的那只手，你就得自己造一个有那只手的版本。** preset 与自定义 MCP 的分工，本质是"信任边界"在工具层面的投影。

## 三个生产坑

> [!WARNING]
> **坑一 —— 沙箱失败时 Bash 工具不注册，静默缺失。**
> `bashMcp` 是 `sandboxReady ? ... : null`，沙箱初始化失败时它就是 `null`，根本不进 `mcpServers`。`query()` 照样成功启动、对话照常进行，但**模型的工具清单里没有 Bash**——它要么改用 Python 绕路，要么直接告诉用户"我没有执行命令的能力"。整个过程没有任何报错，ws-server 日志里也只是 Bash 静悄悄消失了。排查时极易误判成"模型不会用 Bash"，实则是沙箱没起来。这是"宁可不给、绝不退回原生"原则的代价：安全换来的是一个需要主动监控 `sandboxReady` 的盲区。

> [!WARNING]
> **坑二 —— Python 输出超 512KB 是直接 SIGKILL，不是截断。**
> 直觉以为输出超限会像日志一样被截成前 512KB 然后接着跑——不是。一旦 Python 进程的输出突破 512KB 帽，`ExecutionRuntime` 直接 `SIGKILL` 整个进程。后果是：模型拿到的是"进程被杀"，而不是"前 512KB 输出 + 截断标记"。如果模型写了个 `print` 大循环、或者 dump 了一个大 DataFrame，它会看到任务直接死掉，却不知道是输出太多撑死的，往往会重试同样的代码再死一遍。这个上限是为了挡住"无限输出吃爆 stdout pipe"的内存风险，但它的"杀"而非"截"的语义，对模型不友好，需要在提示里提醒它分页输出。

> [!WARNING]
> **坑三 —— 工作区超 2000 文件，diff 快照关闭，大工程拿不到文件变更反馈。**
> Python runner 执行后会给工作区拍快照、把文件变更 diff 喂回模型，让它知道自己的代码改动了哪些文件。但快照有个 2000 文件的截断上限：一旦工作区文件数超过 2000（比如 `node_modules` 没被忽略、或者生成了一个大工程），快照机制直接关闭，模型这一轮的文件变更反馈就归零了。后果是模型"写了文件却不知道写成了什么"，下一步决策失去依据，容易重复操作或误判失败。根因是全量快照在大目录上太贵，但 2000 这个硬截断在真实工程里很容易撞到——这也是为什么工作区卫生（及时清理、忽略 `node_modules`）在 OxyGenie 里不是洁癖，而是功能正确性的前提。

三个坑的共同根源是：**把执行收进 `ExecutionRuntime` 换来了拦截能力，但每个拦截点都是一道可能"静默失败"的闸门。** 沙箱没起来、输出撑爆、文件太多——这些都不会抛异常给用户看，而是悄悄改变了模型能看到的世界。自己包工具的代价，就是这些闸门的可观测性得自己补。

## 配图

1. ![工具两分：preset vs 自定义 MCP](../assets/img/06-tool-split.svg)

## 下一篇

→ [第 07 篇：MCP 能力中心](./07-mcp-capability-center.md)

工具系统里那串 `...userMcp` 是怎么来的？下一篇钻进 MCP 能力中心：7 个内置 MCP、每个用户自己决定开哪些、为什么启用状态存在文件系统的 JSON 里而不是数据库、凭据和工具覆写怎么管，以及为什么连接生命周期整个交给 SDK 而不是自己写。

---

📌 [reading-map.md](../reading-map.md)
