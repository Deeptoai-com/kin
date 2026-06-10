---
title: "第 09 篇：Ask/Act 两模式 + HITL —— canUseTool → approval_request → stdin 回灌"
slug: 09-ask-act-hitl
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 9
keywords: [HITL, canUseTool, 权限模式, Ask Act, 人工审批]
prev: 08-skills-system
next: 10-bash-sandbox
---

# 第 09 篇：Ask/Act 两模式 + HITL —— canUseTool → approval_request → stdin 回灌

> "Agent 自动干活" 和 "每一步都问我" 是两种用户期待。OxyGenie 把它收敛成两个交互模式：**Ask**（每个动作工具人工审批）和 **Act**（自主执行，默认）。审批怎么实现？不是另起一个 RPC 通道，而是借 worker 已经打开的 **stdin**：`canUseTool` 发出 `approval_request` 帧，挂起等待浏览器把 `approval_response` 写回 stdin。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案两模式映射-sdk--审批走-stdin) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

模型要 `Write`/`Edit`/`Bash`/`Python` 这种**有副作用**的动作时，Ask 模式要先停下来问用户："这一步要不要做？"用户点了"允许"才继续，点了"拒绝"就把这步否掉。听起来像一个普通的前端确认弹窗，但放进 OxyGenie 的执行模型里就棘手了。

难点在于这是一个**异步往返**：worker 想执行工具 → 弹给浏览器 → 用户决定 → 决定送回 worker → worker 才能继续或放弃。而 worker 是个**一次性子进程**（第 03 篇）——它被 `spawn` 出来跑这一条消息，跑完即死。SDK 的 `query()` 此刻正卡在那个 tool_use 上等一个 allow/deny 的答复，整个 Agent Loop 都悬着。这个跨进程、跨网络的往返，要怎么穿过"主进程 ws-server ↔ 子进程 worker ↔ 浏览器"这三段边界，**又不破坏 SDK 自己的权限模型**？

更要命的是：审批必须发生在动作**之前**。`Write` 一旦执行，文件就写下去了；`Bash rm` 一旦跑了，东西就没了。这不是"事后能回滚"的场景，必须是"事前能拦截"。

## 朴素方案为什么不行

**方案一：在 SDK 外面自己写一套权限引擎。** 拦下模型的 tool_use，自己维护一个待审批队列、自己判断哪些工具要问、自己做 allow/deny。问题是：SDK 的 `query()` 已经内置了 `canUseTool` 这个异步回调——每次模型要用工具，SDK 都会 `await` 你的 `canUseTool(toolName, input)`，你返回 `{behavior:'allow'}` 或 `{behavior:'deny'}`，SDK 据此决定执行还是跳过。**你在外面写的那套，本质是把 SDK 已经给你的扩展点重新造一遍**——还造得更差，因为你拦不到 SDK 内部真正的执行时机，只能在事件流里猜，迟早跟 SDK 的工具调度对不齐。

**方案二：另起一个 HTTP 端点让 worker 轮询审批。** worker 想审批时，往一个 `/approval` 端点轮询"用户决定了吗"。这等于在已有的 stdin/stdout 通道之外，**再开一条通道、再维护一份状态、再叠一截轮询延迟**。worker 跟主进程之间本来就有一条干净的双工管道（stdin 进、stdout 出），凭空多一条 HTTP，纯属给自己加故障面。

**方案三：先执行、事后让用户否决。** 让模型先跑，把动作的结果摆给用户看，不满意再撤销。但 `Write`/`Bash` 是**不可逆副作用**——文件写了、命令跑了、磁盘改了，"否决"的时候木已成舟。Ask 模式的全部价值就是"动手之前先问"，事后否决等于没有 Ask。

三个方案的共同教训：**审批不是一个要新建的子系统，而是 SDK 已经留好的一个钩子的填充**。SDK 给了 `canUseTool` 这个事前异步回调；worker 跟外界本来就有 stdin/stdout 双工管道。正确的做法是把这两样**接起来**，而不是在旁边另搭一套。

## 核心方案：两模式映射 SDK + 审批走 stdin

OxyGenie 的 HITL 可以一句话概括：

> **两个交互模式各自映射到 SDK 的一个 permissionMode；审批的异步往返复用 worker 已经打开的 stdin/stdout —— 请求是 stdout 上的一帧，回应是 stdin 上的一行。**

四个要点串起来：

**1. 两模式 → SDK permissionMode。** `ask` 映射到 SDK 的 `'default'`（启用 `canUseTool` 逐工具回调），`act` 映射到 SDK 的 `'acceptEdits'`（自动放行，不打断）。系统默认是 `act`（`DEFAULT_MODE='act'`）——大多数时候用户要的是"自动干完"，Ask 是显式切换出来的"盯紧每一步"模式。这个映射本身就是站在 SDK 上的：我们不发明权限语义，只是把两个面向用户的词，翻译成 SDK 已有的两档。

**2. 只读工具自动放行。** Ask 模式下，如果对**每一个** tool_use 都弹审批，用户会被 `Read`/`Glob`/`Grep`/`LS` 这些纯读取操作淹没——模型看十个文件就是十次弹窗。所以 `canUseTool` 里对只读工具直接 `allow`，**只有动作工具（Write/Edit/Bash/Python/MCP）才弹审批**。审批的对象是"会改变世界的动作"，不是"看一眼"。

**3. 审批走 stdin。** 这是整套设计的核心：`canUseTool` 命中一个需审批的动作时，往 stdout 写一帧 `approval_request`（带 `toolUseID`），然后 `await` 一个以 `toolUseID` 为键存进 pending Map 的 Promise——`canUseTool` 是 async 的，这一 await 就让 SDK 的 Loop 干净地挂起，**不占 CPU、不轮询、不超时（这正是坑一）**。浏览器收到请求、用户点了决定，决定经 ws-server 写回 worker 的 stdin；worker 按行读 stdin，读到 `approval_response`，用 `toolUseID` 在 pending Map 里找到那个 Promise 并 resolve，`canUseTool` 随即返回 `allow`/`deny`，SDK 继续。

```
worker.canUseTool(动作工具)
   │  stdout ── { type:'approval_request', toolUseID, tool, input } ──▶ ws-server ──▶ 浏览器
   │  await pending.get(toolUseID).promise          ← Loop 在这里挂起，无超时
   ▼
浏览器（用户点 允许/拒绝）
   │  ──▶ ws-server ── 写一行 { type:'approval_response', toolUseID, decision } ──▶ worker.stdin
   ▼
worker 按行读 stdin → pending.get(toolUseID).resolve(decision)
   │
   ▼
canUseTool 返回 { behavior: 'allow' | 'deny' } → SDK 执行 / 跳过该工具
```

**4. 组织级权限上限。** `permissions.server.ts` 读 org 元数据：组织可以锁定一个权限模式天花板（比如"本组织所有人最高只能到 ask，不许自动放行"），用户在前端切模式时不能越过这个上限。这跟产品定位一致——OxyGenie 是组织内多用户的自托管工作台，权限策略由组织策展。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `src/lib/permission-tier.js` | L25–63 | InteractionMode ask/act → SDK permissionMode；`DEFAULT_MODE='act'` |
| `ws-query-worker.mjs` | L296–320 | `canUseTool`：Ask + 动作 → 发 `approval_request` 并 await |
| `ws-query-worker.mjs` | L305 | 自动放行：Read/Glob/Grep/LS |
| `ws-query-worker.mjs` | L185–200, L342 | stdin pending Map + `approval_response` 时 resolve |
| `ws-server.mjs` | L1605–1680 | `approval_response` → 写 worker stdin |
| `src/server/permissions.server.ts` | L39–256 | org 权限上限，用户不可越权 |

`canUseTool` 的骨架就是"读工具自动放行、动作工具挂起等回灌"这一对分支：

```javascript
// ws-query-worker.mjs ~L296
const canUseTool = async (toolName, input) => {
  if (mode === 'act') return { behavior: 'allow' }              // Act：全自动放行
  if (READONLY.has(toolName)) return { behavior: 'allow' }       // Ask：只读直接放行（L305）
  // Ask + 动作工具：发请求帧，挂起等 stdin 回灌
  const id = input.toolUseID
  writeFrame({ type: 'approval_request', toolUseID: id, tool: toolName, input })
  const decision = await new Promise((resolve) => pending.set(id, resolve))  // 无超时
  return decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny' }
}
```

而 stdin 那一端只做一件事：按行解析，读到 `approval_response` 就 `pending.get(toolUseID)?.(decision)` 把对应的 Promise resolve 掉。请求和回应共用同一对 `toolUseID`——这就是整个往返的"对账凭证"。

## 反直觉结论

> [!IMPORTANT]
> **HITL 不需要新通道——worker 的 stdin 已经是一条双工管道。**
>
> 审批的异步往返复用"worker 读 stdin"这条既有路径：请求是 stdout 上的一帧，回应是 stdin 上的一行，靠 `toolUseID` 对账。把"人工审批"实现成"对 SDK `canUseTool` 异步回调的**填充**"，而不是另造一套权限引擎，既是最小改动，也是最稳的对齐方式——因为审批拦截的时机，正好是 SDK 决定执行工具的那一刻，分毫不差。**能复用 SDK 的扩展点，就别在 SDK 外面再搭一层影子系统。** 这正是本系列反复强调的那条线：OxyGenie 包的是 SDK，不是自己的 Loop；HITL 也一样，包的是 SDK 的 `canUseTool`，不是自己的权限机。

## 三个生产坑

> [!WARNING]
> **坑一 —— 审批无超时，worker 会永远挂着。**
> `canUseTool` 里那个 `await pending.get(toolUseID)` 没有任何超时。一旦浏览器崩了、`approval_response` 帧在网络里丢了、或者用户切走标签页再没回来，这个 Promise 永远不会 resolve——worker 就一直停在那个动作工具上傻等，**还占着一个 semaphore 名额**（第 03 篇坑三）。这两个坑同源：per-message 模型把"进程生命周期"变成了你必须显式管理的资源，而审批引入了一个"无限期等待人类"的状态。修复方向：给审批加可配置超时 + 到点自动 deny，让 worker 能从挂起里自己走出来。

> [!WARNING]
> **坑二 —— worker stdin 不能提前关闭。**
> 整个审批回灌依赖 worker 的 stdin 一直开着——回应是从 stdin 写进来的。如果在 abort/cleanup 的时候手滑把 worker 的 stdin 先关了，那么之后任何 `approval_response` 都再也送不进去，pending 的 Promise 永远悬空，效果跟坑一一样。所以 abort 清理的顺序要格外小心：要么 `worker.kill()` 整个进程一刀切（推荐，操作系统连同它 fork 的子进程一起回收），要么保证 stdin 在进程存活期间始终可写，**绝不能"半关闭"——进程还活着、stdin 却没了**。

> [!WARNING]
> **坑三 —— 审批是串行的，同一 worker 同时只有一个待审批。**
> SDK 是逐工具问的：`canUseTool` 一次只为一个 tool_use 触发，前一个没 resolve，Loop 就卡在那不会往下走到第二个。所以同一个 worker 在任一时刻**最多只有一个待审批动作**，不存在"一次弹三个让你批"的并行场景。这在 UX 上其实是好事——用户一次只面对一个决定，不会被一堆审批轰炸；但要清楚它的边界：你不能指望把一回合里的多个动作攒成一批让用户一次性勾选，模型每走一步、批一步，是线性推进的。

这三个坑的共同根源是：**HITL 在 per-message 模型里引入了一个"无限期等待人类"的暂停态**。进程会因为人不回应而挂死、会因为通道被提前关掉而失联、会因为 SDK 的串行调度而无法并行——主进程对每一个进入审批的 worker，都要有"等多久、谁来兜底、怎么干净退出"的明确答案。这是把"人"塞进自动循环里所要付的税。

## 配图

1. ![Ask/Act → SDK 权限模式映射](../assets/img/09-mode-mapping.svg)
2. ![HITL 时序：canUseTool→approval_request→stdin→resolve](../assets/img/09-hitl-roundtrip.svg)

## 下一篇

→ [第 10 篇：Bash 沙箱](./10-bash-sandbox.md)

审批解决了"该不该做"，但动作真要落地时——尤其是 Bash 这种能跑任意命令的工具——光有"用户点了允许"远远不够。下一篇钻进 OxyGenie 自己包的 Bash 沙箱：为什么黑名单拦不住 `rm -rf`、资源耗尽靠 `prlimit` 硬上限而非超时、以及那条铁律——沙箱可以失败到"拒绝执行"，但绝不会失败到"裸跑且带着密钥"。

---

📌 [reading-map.md](../reading-map.md)
