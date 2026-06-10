---
title: "第 05 篇：ExecutionRuntime 双后端 —— local-process / per-session Docker 与 FAIL-CLOSED"
slug: 05-execution-runtime
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 5
keywords: [ExecutionRuntime, Docker backend, srt, sandbox, 后端抽象]
prev: 04-streaming-protocol
next: 06-tool-system
---

# 第 05 篇：ExecutionRuntime 双后端 —— local-process / per-session Docker 与 FAIL-CLOSED

> 工具要执行命令（Python、Bash），命令必须落在沙箱里。但"沙箱"在 Mac 开发机和 Linux 生产机上根本不是一回事。OxyGenie 的做法是把"在哪执行、怎么隔离"抽象成一个 `ExecutionRuntime` 接口，下面挂两个可换的后端——本地进程（srt 包裹）和 per-session Docker——业务层只认接口。这一篇讲这个抽象，和它最重要的一条铁律：**FAIL-CLOSED**。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案一个接口--两个后端--fail-closed) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

第 03 篇把 Agent Loop 关进一次性子进程，第 04 篇把它的输出稳稳流给浏览器。但 worker 里那行 `query()` 一旦让模型调用 Bash 或 Python，就要在你的机器上**真的执行一条命令**——而执行命令的地方必须是个沙箱。问题是，沙箱在不同环境里压根不是同一种东西：

- **Linux 生产机**：有 `srt`（基于 bubblewrap 的轻量沙箱）可用，能用 namespace + seccomp 给命令套一层隔离，开销极小。
- **Mac 开发机**：bubblewrap 是 Linux-only 的，`srt` 在 macOS 上根本不适用——开发者本地跑工具时无沙箱可用。
- **需要更强隔离时**：一层进程沙箱不够，要把整个执行环境装进 per-session 容器，要完整的文件系统/网络隔离。

一份工具执行代码，要在这三种环境下都安全。这逼出两个必须同时回答的问题：其一，**怎么让上层（worker、工具系统）不关心自己跑在哪种沙箱上**，否则每加一个后端就要改一片调用点；其二——也是更要命的那个——**当沙箱因任何原因没就位（Mac 上没 srt、srt 初始化失败、Docker 没起来），系统该怎么办？** 第二个问题的答案，决定了这套设计是真安全还是假安全。

## 朴素方案为什么不行

**方案一：硬编码 `spawn('python', ...)` / `spawn('bash', ...)`。** 哪里要执行就地起一个子进程，最直接。但它把业务逻辑跟"某一种执行方式"焊死了：想换 Docker 后端，得把散落在工具系统各处的 spawn 逐个改掉；想加内存/网络限制，没有统一的地方挂。更致命的是 Mac 上——srt 不可用，硬编码的 spawn 直接**裸跑在宿主机上**，模型生成的任意命令以开发者权限执行，读得到 `~/.ssh`、连得通内网。**它死在"把执行方式和隔离策略混在了一起"**：没有一个统一的地方能回答"这次该不该跑、跑在哪"。

**方案二：优雅降级到裸 host。** 这是最危险的"方便"，也最容易被合理化。逻辑听起来很顺：沙箱初始化失败了？退回不受保护的执行，至少功能不中断、用户不报错。但这等于说"安全机制失效时就当它不存在"。一次 srt 初始化失败、一次 Docker daemon 没连上，本应告警的故障被"优雅降级"悄悄抹平，然后模型的下一条 `rm -rf` 或 `curl 内网` 就在裸宿主上执行了。**它死在把"可用性"凌驾于"安全性"之上**：在沙箱语境里，"降级到裸跑"不是容错，是把所有防线一夜清零，而且是**静默**清零——没人会注意到保护已经没了。

两个方案的共同教训：**沙箱设计的核心矛盾不在"用哪种隔离技术"，在"隔离不可用时的默认行为"。** 硬编码把这个决策分散到无数调用点，各处行为不一致；优雅降级则给出一个最舒服也最致命的默认值——"没沙箱就裸跑"。正确的设计必须做两件事：把"在哪执行"收敛成一个能替换的抽象，再把"没就位就拒绝"焊成这个抽象不可绕过的契约。

## 核心方案：一个接口 + 两个后端 + FAIL-CLOSED

OxyGenie 的执行隔离可以一句话概括：

> **一个 `ExecutionRuntime` 接口，下挂两个可换后端（本地进程 srt 包裹 / per-session Docker），由 factory 按环境变量选择；接口契约里焊死一条 FAIL-CLOSED——沙箱未就位就拒绝执行，绝不裸跑；外加一条贯穿两个后端的底线——密钥永远剥离。**

```
            getExecutionRuntime()           ← src/claude/execution/index.js (factory)
                    │
      ┌─────────────┴──────────────┐
LocalProcessBackend            DockerBackend
(srt 包裹, Linux)              (per-session 容器, EXEC_RUNTIME=docker)
      │                            │
      └──── buildSafeEnv() 永远剥离密钥 ────┘   ← sandbox.js
      └──── FAIL-CLOSED：sandbox 未就位 → 拒绝执行（不裸跑）
```

逐条看它怎么把上面两个问题各个击破：

**① factory 选后端——上层只认接口。** `getExecutionRuntime()` 是唯一入口：`EXEC_RUNTIME=docker` 时返回 Docker 后端，否则返回本地进程后端。两个后端实现同一组方法（`exec()` 等），工具系统调用时根本不知道、也不需要知道命令最终落在 srt 包裹的子进程里还是 per-session 容器里。**接口稳定，后端可换**——这正是分层抽象的价值：换隔离技术不动业务，加新后端不改调用点。

**② srt 默认 Linux 开、Mac/Win 关——按平台诚实判定。** `isEnabled()` 按平台决定 srt 是否可用：Linux 默认开，Mac/Win 默认关。它不假装 Mac 上有沙箱，而是诚实报告"这里 srt 不可用"。于是 Mac 开发者要跑 Bash，唯一正确的路是显式 `EXEC_RUNTIME=docker` 切到容器后端——而不是被"优雅降级"偷偷放到裸宿主上跑。

**③ FAIL-CLOSED——没就位就拒绝，这是全篇的承重墙。** `ensureSandbox()` 只有一种放行条件：**要么 srt active、要么后端是 docker**。两者皆无（Mac 上没设 docker、或 srt 初始化抛错），它**抛错拒绝执行**，绝不退回裸跑。这一条不是写在某个 if 分支里的策略，而是接口契约——任何后端、任何调用路径，想执行命令都必须先过这道闸。"宁可这次执行失败，绝不无保护执行"被提升成了系统级不变量。

**④ 密钥永远剥离——独立于沙箱开关的第二道底线。** `buildSafeEnv()` 用白名单构建子进程环境，**无论沙箱开关都执行**。这是关键的纵深设计：即便某天 srt 初始化失败、即便有人误配绕过了 FAIL-CLOSED，被执行的命令也**永远看不到 `ANTHROPIC_API_KEY`**——只放行 PATH/HOME/LANG 等白名单变量。隔离失效和密钥泄露是两件事，OxyGenie 用两道独立防线分别挡住，不让一道的失效连带另一道。

把这四条拼起来，FAIL-CLOSED 之所以能成立，恰恰因为有了"一个接口"。若执行方式像方案一那样散在各处，"没就位就拒绝"就得在每个调用点重复实现，漏一个就开一个裸跑的口子。正是把后端抽象成单一接口，才让 `ensureSandbox()` 这道闸有了**唯一一个所有执行都必经的位置**——抽象的副产品，是让 FAIL-CLOSED 从"散落的检查"变成"无法绕过的单一闸门"。

## 关键实现要点

整套抽象的代码量小得惊人——factory 只有 49 行，两个后端加起来三百行出头，真正的安全逻辑集中在 `sandbox.js` 的两个函数里。下表是落点：

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/claude/execution/index.js` | 全 49 行 | ExecutionRuntime factory，按 `EXEC_RUNTIME` 选后端 |
| `src/claude/execution/local-process-backend.js` | 139 行 | 子进程执行 + 密钥剥离 + srt 包裹（Linux） |
| `src/claude/execution/docker-backend.js` | 175 行 | per-session Docker 容器后端（opt-in） |
| `src/claude/execution/sandbox.js` | L43–49 / L86–115 | `buildSafeEnv()` 白名单剥离 / `ensureSandbox()` 一次性 init |
| `src/claude/execution/sandbox.js` | L51–62 | `isEnabled()`：Linux 默认开、Mac/Win 默认关 |

最该盯住的是 `sandbox.js` 里的两个函数，它们承载了整篇的安全语义。`ensureSandbox()`（L86–115）是 FAIL-CLOSED 的物理实现——做一次性初始化，判定"srt active 或后端为 docker"是否成立，不成立就抛错；它一次性 init，但每条执行路径都要先确认它通过，这就是那道"无法绕过的单一闸门"在代码里的样子。与它配对的 `buildSafeEnv()`（L43–49）是第二道底线，逻辑朴素到只是按白名单过滤环境变量，但承重点在于**调用位置**：它在两个后端里都被无条件执行，不挂在任何"沙箱是否开启"的判断下。`isEnabled()`（L51–62）只做平台判定，不掺"失败了怎么办"的逻辑——把"能不能用"和"用不了怎么办"拆成两个函数，正是为了让 FAIL-CLOSED 的决策只有一个出处。两个后端文件则纯粹是"怎么执行"的实现细节，对上层完全等价——这正是 factory 抽象想要的结果。

## 反直觉结论

> [!IMPORTANT]
> **沙箱设计里最重要的不是"怎么隔离"，是"隔离没就位时默认拒绝"。优雅降级在别处是美德，在沙箱里是漏洞——一次 srt 初始化失败若退回裸跑，等于把所有防线一夜清零。**
>
> OxyGenie 把这条焊进 `ExecutionRuntime` 接口的 FAIL-CLOSED 契约里：**宁可这次执行失败，绝不无保护执行。** 这是一个刻意的价值排序——在工具执行这个语境里，安全性高于可用性，一次拒绝是可以接受的代价，一次裸跑不是。容错的常识"尽量让功能不中断"在这里被反过来用：沙箱缺位时，最该中断的就是功能本身。

再点破一层：**把后端抽象出来，最大的红利不是"以后好换 Docker"，而是让 FAIL-CLOSED 有了唯一一个落脚点。** 一个分散在各处的安全检查迟早漏掉一处——而漏掉的那一处就是整条防线的缺口，因为一条失控的模型命令只需要找到那一个裸跑的入口。OxyGenie 反过来：先把"在哪执行"收敛成单一接口，于是"该不该执行"也只剩一个必经的闸门。**抽象在这里不是为了优雅，是为了让"绝不裸跑"从一个愿望变成结构上无法绕过的事实**——这正是"工程是 SDK 外面那一圈"的另一种体现：SDK 负责跑命令，OxyGenie 负责确保命令只能在沙箱里跑，而且没有后门。

## 三个生产坑

> [!WARNING]
> **坑一 —— Mac 开发机不设 `EXEC_RUNTIME=docker` 时，Bash 工具直接被 FAIL-CLOSED 拒绝。**
> 这是 FAIL-CLOSED 设计正确时**必然**带来的"坑"：Mac 上 srt 不可用，`ensureSandbox()` 判定不通过，任何要执行命令的工具都会抛错而不是裸跑。第一次在本地撞上的开发者往往以为是 bug——其实是契约在生效。正确做法不是注释掉那道检查，而是显式 `EXEC_RUNTIME=docker` 切到容器后端。**这里的"报错"是特性不是故障**，一旦你想"绕过去先跑起来"，就在亲手打开那个裸跑的口子。

> [!WARNING]
> **坑二 —— 密钥剥离的白名单是"默认拒绝"，新增工具依赖的环境变量会被悄悄吞掉。**
> `buildSafeEnv()` 用白名单（只放行 PATH/HOME/LANG 等）而非黑名单——安全上是对的（黑名单总会漏剥某个新密钥），但代价是：某工具合理地需要一个新环境变量（比如某 CLI 要读 `HTTP_PROXY`），它会被白名单默默剥掉，工具行为异常却没有任何"变量被剥离"的提示，排查时容易往工具本身找，其实是环境被剥干净了。新增依赖外部环境变量的工具时，必须同步往白名单里加，并想清楚这个变量是否敏感。

> [!WARNING]
> **坑三 —— Docker 后端是 opt-in 的，生产 Linux 上误以为"开了 Docker 就更安全"反而可能两头落空。**
> 两个后端隔离模型不同：Linux 生产默认走本地进程后端 + srt（轻量、够用）；Docker 后端是 `EXEC_RUNTIME=docker` 显式开启的更强隔离。坑在中间地带——若在 Linux 上设了 `EXEC_RUNTIME=docker` 却没把 Docker daemon、镜像、per-session 容器生命周期都配妥，FAIL-CLOSED 会因为"后端是 docker"而放行，但容器若没真正起隔离作用，你得到的是"以为有强隔离、实际配置半截"的最坏状态。切后端要确认目标后端整套前置条件都就位——FAIL-CLOSED 只保证"沙箱声明就位才放行"，不保证"声明的沙箱真的隔离到位"。

这三个坑的共同根源是：**FAIL-CLOSED 和白名单都是"默认拒绝"哲学的体现，而"默认拒绝"的代价永远是"合法用例也要显式声明"。** Mac 要跑命令得显式选 Docker（坑一），新工具要用环境变量得显式进白名单（坑二），换后端得显式把整套前置配齐（坑三）。这不是设计缺陷，是这套哲学的标价——它把"出错时偏向不安全"换成"出错时偏向不可用"，于是每个合法需求都得自己举手报到。对一个会替用户执行任意命令的系统，这笔交易划得来：让开发者多配一个变量，远胜过让一条失控的模型命令在裸宿主上找到出口。

## 配图

1. ![ExecutionRuntime 接口 + 双后端](../assets/img/05-execution-runtime.svg)
2. ![FAIL-CLOSED 决策树：srt? docker? → 执行 or 拒绝](../assets/img/05-fail-closed.svg)

## 下一篇

→ [第 06 篇：工具系统 —— SDK preset 与自定义 MCP 工具](./06-tool-system.md)

执行落在哪个沙箱里解决了，但模型手上到底有哪些工具、这些工具从哪来？下一篇拆工具系统：哪些直接用 SDK 的 `claude_code` preset、哪些靠 `createSdkMcpServer` 自己注册（Python、GLM 出图、Bash），以及"用 SDK 内置 + 自定义 MCP 补缺"这个分工背后的取舍。

---

📌 [reading-map.md](../reading-map.md)
