---
title: "第 11 篇：多租户隔离 —— per-session workspace、跨租户 path guard 与系统前缀封锁"
slug: 11-multi-tenant-isolation
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 11
keywords: [多租户, 路径隔离, path security, 跨租户, workspace]
prev: 10-bash-sandbox
next: 12-session-persistence
---

# 第 11 篇：多租户隔离 —— per-session workspace、跨租户 path guard 与系统前缀封锁

> 沙箱（第 10 篇）挡住了"够不到系统目录"，但多租户还有一道题：**用户 A 不能读写用户 B 的会话目录**。OxyGenie 的隔离是两层叠加——文件系统上每个会话一个独立 workspace；逻辑上每个文件工具调用前过 `path-security` 的跨租户校验。这一篇讲这两层怎么配合，以及为什么"逻辑校验"要先于"沙箱围栏"。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案per-session-workspace--path-guard逻辑层先拦) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

OxyGenie 是组织内多用户的自托管工作台：几十个用户共享同一台机器、同一套 `/data/users` 目录树。沙箱（第 10 篇）已经把命令关进文件系统围栏、挡住了系统目录，但它解决的是"用户 vs 宿主机"。多租户还剩一道正交的题：**用户 vs 用户**。

要保证的是：任意一个文件工具（`Read`/`Write`/`Edit`/`Glob`）都不能逃出当前用户的领地，去碰**别人**的会话目录。注意这里的威胁模型——按产品定位，租户是"半可信的同事"，不是匿名攻击者。所以隔离的目标不是抵御精心构造的攻击链，而是**纵深防御**：防误操作（模型把路径拼错、跨会话引用了别人的文件）、防共享宿主上的相互越界、保证组织内用户彼此的领地清晰。同时还得防住一个老问题：碰系统目录（`/etc`、`/proc`、`/root` 这类）。

## 朴素方案为什么不行

**方案一：只靠沙箱 FS 围栏防跨租户。** "沙箱不是已经把命令关进 workspace 围栏了吗？那跨租户自然也防住了，何必再加一层？"——这话对一半。srt 的围栏确实是硬边界，但它是**最后一道**：等到沙箱把越界操作拦下来，攻击/误操作已经一路穿过了 API 层、走到了执行的最底层。问题在于：如果只有这一道，那么**一旦沙箱配置有任何一条缝**（allowWrite 范围设宽了、某个工具没走沙箱、Mac 上 srt 没生效），跨租户就直接漏过去了，而且漏的时候你只会看到一个底层的文件系统报错，分不清是 bug 还是越权。纵深防御的要义就是**别把所有鸡蛋放在最后一道防线上**——逻辑层要先拦一遍。

**方案二：全局用户注册表查权限。** 每次文件工具调用，都去查一张"谁能访问哪些路径"的全局表来鉴权。这在小规模能跑，但扩展性差：每个工具调用都多一次（可能跨进程/跨网络的）全局查询，热路径上叠延迟；这张表还成了一个集中式的状态和单点。多租户隔离这种**高频、确定性**的判断，不该依赖一个需要查询的全局服务——它应该是一个纯函数：给定路径和当前用户根目录，立刻能算出"在不在领地内"。

两个方案的教训：**跨租户隔离既不能只押注在最底层的沙箱上（太晚、缝一开就漏），也不该建一个集中式注册表（太重、热路径上拖慢）**。正确形态是两层：文件系统给每个会话一个物理上独立的工作区作为天然边界，逻辑层用一个不需查表的纯路径判断，在工具真正动手之前先拦一遍。

## 核心方案：per-session workspace + path guard（逻辑层先拦）

OxyGenie 的多租户隔离由两层叠成，关键在它们的**先后顺序**：

> **物理层：每个会话一个独立 workspace 目录，天然隔离。逻辑层：每个文件工具调用前，在 `canUseTool` 里过一遍跨租户 + 系统前缀校验——这一层排在 srt 的 FS 围栏之前。两层都要，不是二选一。**

**1. per-session workspace —— 物理隔离的地基。** 每个会话有自己独立的目录：`/data/users/{userId}/sessions/{sessionId}/workspace/`，会话清理时整个删掉。这个布局一举两得：`{userId}` 这一层天然把不同用户的领地隔开（用户 A 的路径里永远有 A 的 userId），`{sessionId}` 这一层给 SDK 一个稳定的 per-session 工作区（SDK 的 `cwd`、transcript 都期望一个固定工作目录）。物理布局本身就编码了"谁的东西在哪"。

**2. allow/block 前缀表 —— 系统目录封锁。** `createPathSecurity()` 为每次会话构建三张表：`readAllowed`、`writeAllowed`、`blockedPrefixes`。系统前缀封锁列表写死在 `path-security.js:8–19`，包含 `/etc`、`/proc`、`/sys`、`/root`、`/var`、`/bin`、`/usr`、`/sbin`、`/boot`、`/lib` 等——任何文件工具想碰这些前缀，逻辑层直接拒。这跟沙箱的系统目录防护是**冗余的两层**：沙箱让你够不到，逻辑层在你伸手之前就拍掉。

**3. 跨租户硬拒 —— 逻辑层先于沙箱。** 这是整层设计的核心判断，发生在 `canUseTool`（`path-security.js` L289–295）：把目标路径解析出来，如果它**落在 `sessionsRoot` 下、却不在当前用户的 `userRoot` 下**——也就是"在会话区里，但属于别的用户"——直接 **hard deny**（interrupt，没有 fallback、没有降级）。这个判断纯靠路径前缀比较，不查任何表，O(1) 完成。它跑在 srt 的 FS 围栏**之前**：攻击/误操作还没触达硬边界，就在逻辑层被掐掉，并给出一个清晰的"跨租户拒绝"语义，而不是一个底层文件系统的 EACCES。

**4. 符号链接解析后再判。** 一个经典逃逸：在 workspace 里建一个 symlink 指向别人的目录，然后让工具去读这个 symlink。所以校验前先 `realpath` 把 symlink 全解开，**对解析后的真实目标判边界**——你软链指向哪，我就按哪里的真实路径来判。这样 symlink 骗不过去（但它带来一个竞态窗口，见坑二）。

```
文件工具调用（Read/Write/Edit/Glob）
        │
        ▼  ① 逻辑层：canUseTool（path-security）—— 先拦
   realpath 解开 symlink → 拿到真实目标路径
        │
        ├─ 命中 blockedPrefixes（/etc /proc /root …）   → hard deny
        ├─ 在 sessionsRoot 下、却不在当前 userRoot 下     → hard deny（跨租户，无 fallback）
        └─ 在当前 userRoot / workspace 内                → allow
        │
        ▼  ② 物理层：srt FS 围栏 —— 兜底硬边界（第 10 篇）
   即便逻辑层放行，命令也只能在 workspace 围栏里动
```

两层的分工很清楚：逻辑层**早、准、可解释**（在 API 入口、纯路径判断、deny 语义清晰），物理层**晚、硬、不可绕**（在执行底层、操作系统级、配置对了就铁打）。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/claude/path-security.js` | L1–331 | `createPathSecurity()` 构建 allow/block；`canUseTool` 校验 |
| `src/claude/path-security.js` | L8–19 | 系统前缀封锁列表 |
| `src/claude/path-security.js` | L267–331 | 逐文件工具的工作区/租户边界校验 |
| `src/claude/path-security.js` | L289–295 | 跨租户硬拒（先于沙箱） |
| `ws-server.mjs` | L591–595 | `getSessionWorkspace()` 解析 per-session 目录 |

跨租户硬拒那段的判断骨架，本质就是两个前缀比较：

```javascript
// path-security.js ~L289
const real = realpathSync(targetPath)          // 先解 symlink，对真实目标判边界
if (real.startsWith(sessionsRoot) && !real.startsWith(userRoot)) {
  return hardDeny('cross-tenant access denied')  // 在会话区、却不在自己领地 → 硬拒，无 fallback
}
```

注意 `getSessionWorkspace()`（`ws-server.mjs` L591–595）解析出的 per-session 目录必须是**绝对路径**——它既是物理隔离的根，也是逻辑校验里 `userRoot`/`workspace` 前缀比较的基准。基准一旦是相对路径，整个前缀判断和 resume 都会错位（坑三）。

## 反直觉结论

> [!IMPORTANT]
> **沙箱是硬边界，但隔离要在"够到沙箱之前"先拦一遍。**
>
> OxyGenie 把跨租户校验放在 `canUseTool`（API 层），**先于** srt 的 FS 围栏——不是因为不信任沙箱，恰恰相反，沙箱依然是兜底的硬边界。逻辑层先拦的价值在两点：一是**早**——在攻击/误操作触达硬边界之前就掐掉，缝再小也轮不到它发作；二是**可解释**——逻辑层能给出"跨租户拒绝"这样清晰的语义，而不是把一个底层 EACCES 抛给用户，让人分不清是越权还是程序 bug。说到底，**"沙箱兜底"和"逻辑层先拦"不是二选一，是两层都要**：一层让你够不到，一层让你伸手就被拍掉。少了逻辑层，沙箱的每一条配置缝都成了跨租户漏洞；少了沙箱，逻辑层的每一个判断 bug 都成了越权。纵深防御的全部意义，就是让任何单层的失误都不至于直接酿成事故。

## 三个生产坑

> [!WARNING]
> **坑一 —— 写前缀包含整个 userRoot，不止当前 session。**
> `writeAllowed` 的范围是当前用户的**整个 `userRoot`**，而不是仅限当前 session 的 workspace——这是有意为之，为的是支持同一用户跨会话共享文件（A 在会话 1 写的东西，会话 2 能用到）。代价是：写边界比"严格按 session 隔离"要宽一档。这个风险被明确标注为"低"——它扩大的只是**同一用户内部**的跨会话写入面，并不跨用户；真正卡住越界的是系统前缀封锁 + 跨租户校验这两道，它们仍然把"碰别人的目录"和"碰系统目录"焊死了。知道这个取舍在哪，比假装它不存在更安全。

> [!WARNING]
> **坑二 —— symlink 解析后判边界，但目标在执行中被换存在竞态窗口。**
> 校验做的是 `realpath` 解开 symlink、对解析后的真实目标判边界——这挡住了"建个软链指向别人目录"的静态逃逸。但这里有一个经典的 TOCTOU（check-time-to-use-time）竞态：**校验那一刻 symlink 指向的是合法目标，校验通过之后、工具真正读写之前，symlink 被换成指向别人的目录**，那么实际操作的就是被换后的目标。这个窗口很窄、在半可信同事的威胁模型下风险有限，但它是 symlink 这类间接引用固有的难题——真要堵死，得让"解析"和"使用"原子化（比如解析后用文件描述符而非路径再操作）。当前把它记在账上，作为已知的纵深缺口。

> [!WARNING]
> **坑三 —— 会话根目录配相对路径会引发 resume 找不到 transcript。**
> 这是个跨多篇的同源坑（第 03 篇坑二、第 12 篇）。per-session workspace 的解析、逻辑层的前缀比较、以及 SDK transcript 路径的落盘，全都以会话根目录为基准。worker 的 cwd 跟 ws-server 的 cwd 并不相同——如果 `CLAUDE_SESSIONS_ROOT` 配成相对路径，worker 解析出的真实路径就跟 ws-server 写进 DB 的对不上：轻则前缀比较把合法路径误判成越界，重则 resume 时按错误路径找 transcript、历史归零。修复只有一句话：**会话根目录、DB 里存的路径，一律绝对路径**，没有例外。

三个坑的共同根源：**多租户隔离的正确性，全押在"路径"这个字符串上**。写边界划到哪、symlink 解到哪、根目录是绝对还是相对——每一个都是路径语义上的细节，错一点，要么把领地划宽了，要么把判断基准搞偏了。这就是为什么 OxyGenie 把"绝对路径"当成不可商量的铁律，把 symlink 必须先 `realpath` 当成硬规矩：在一个靠路径前缀做隔离的系统里，路径本身的每一处含糊都是一道潜在的缝。

## 配图

1. ![两层隔离：per-session workspace + path guard](../assets/img/11-two-layer-isolation.svg)
2. ![跨租户硬拒判定（sessionsRoot 下且不在 userRoot 下）](../assets/img/11-cross-tenant.svg)

## 下一篇

→ [第 12 篇：会话持久化](./12-session-persistence.md)

隔离把"谁能碰什么"划清了，但会话本身的状态——历史消息、SDK transcript、那个绝对路径——是怎么活过 worker 的"用完即死"、让用户下次回来还能 resume 的？下一篇钻进会话持久化：workspaceSessionId 和 sdkSessionId 的双 ID 映射、transcript 落在哪、以及那个困扰到 2026-06-02 的 resume bug 到底栽在哪个路径上。

---

📌 [reading-map.md](../reading-map.md)
