---
title: "第 15 篇：真预览 —— 让 AI 生成的多文件 App 在 per-session Docker 里真正跑起来"
slug: 15-real-preview
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 15
keywords: [AI artifact, real preview, per-session Docker, Traefik, 子域反代, bootstrap JWT, iframe sandbox]
prev: 14-multi-model-routing
next: 16-artifacts-and-workbench
---

# 第 15 篇：真预览 —— 让 AI 生成的多文件 App 在 per-session Docker 里真正跑起来

> 蓝本 HarWork 第 14 篇用 iframe overlay + postMessage 渲染**单文件** HTML。OxyGenie 的目标更狠：AI 生成的是一个**多文件 Vite/React 工程**，要 `npm install`、要 `npm run build`、要起一个真实的 dev/preview server——然后让用户在浏览器里看到它**真的在跑**，而不是把 HTML 塞进 Sandpack 假装在跑。本文回答：怎么在"单机 16GB、50 并发"的预算里，给每个会话一个真实的运行环境，还不被它吃垮、不让它越权？

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案四段管线) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

"真预览"要同时成立四件互相打架的事：

1. **多文件、真构建**：AI 产出的是 `package.json` + `src/**` 的完整工程，不是一段 HTML。要真 `install` + `build`/`dev`，才能暴露真实的构建错误、真实的依赖、真实的路由。
2. **资源有上限**：50 个会话，如果每个都常驻一个 dev server，就是 50 × 300MB+ 的 Node 进程——16GB 机器秒 OOM。
3. **安全**：这是**用户（经由 LLM）生成的代码**在你的服务器上执行 + 联网。不能让它读到别的租户的文件、不能让它把你的密钥外带、不能让它当跳板打内网。
4. **能在浏览器里嵌**：预览要在聊天界面的 iframe 里显示，意味着要有一个可访问的 URL、要有鉴权（别人不能凭 URL 偷看你的预览）、HMR 的 websocket 要能连上。

把这四件事摆一起，"渲染一段 AI 输出"就从一个前端问题，变成了一个**微型 PaaS** 问题：你要在自己机器上，按需为不可信代码提供"构建 + 运行 + 反代 + 鉴权 + 回收"的全套基础设施。

## 朴素方案为什么不行

**方案一：Sandpack / WebContainers（浏览器内运行）。** 当前 OxyGenie 的旧路径，也是大多数 AI 产品的做法。优点是零服务器成本，全在浏览器里。但它**撑不起多文件真工程**：跑不了真实的 `npm install`（依赖只能是预打包的子集）、抓不到真实构建错误、Node-only 的后端代码根本跑不了。AI 生成一个能 `pnpm build` 的 Vite 应用，Sandpack 只能干瞪眼。

**方案二：每个 artifact 起一个常驻 dev server。** 直觉方案，但账立刻爆：50 个会话 × 平均 3 个产物 = 150+ 个常驻 Node 进程，每个 300MB，光发呆就把 16GB 吃光几倍。**资源上限（约束 2）直接破产。**

**方案三：子路径反代（`/preview/<sid>/...`）而不是子域。** 想用一个域名 + 路径前缀区分不同预览。但 Vite 的 HMR websocket 和**相对路径 import** 会因为 base 前缀全部错位——`/src/main.tsx` 变成 `/preview/abc/src/main.tsx`，一改 base 就一堆边界情况，HMR 还连不上。

**方案四：每个预览按需签 TLS 证书（Let's Encrypt）。** 想给 `<previewId>.oxygenie.cc` 动态签证。但两个现实拦路：① Cloudflare 免费版的通配证书**只覆盖一级**（`*.oxygenie.cc` 行，`*.preview.oxygenie.cc` 不行）；② CF 的 Full(Strict) 模式会挡掉 HTTP-01 校验。按需签证这条路在这个部署形态下走不通。

四个方案的共同教训：**真预览的难点不在"渲染"，在"以可控成本、安全地、按需地，为不可信代码提供一个能从公网访问的运行环境"。** 浏览器内方案能力不够；常驻进程成本爆炸；子路径反代技术上别扭；动态签证被 CDN 卡死。OxyGenie v1（2026-06-04 架构评审通过）的答案是把这几件事拆成一条四段管线。

## 核心方案：四段管线

> **per-session 持久 Docker（不是 per-message，不是 per-artifact）＋ build-first 静态托管（dev/HMR 尽力而为）＋ Traefik 子域反代（一级通配 + Origin CA）＋ bootstrap JWT 换不透明 cookie 鉴权＋ idle reaper 回收。**

```
① 检测与清单                ② 构建与托管               ③ 反代与暴露            ④ 鉴权与嵌入
manifest.js                 preview controller         Traefik                 auth.js
扫 package.json             （唯一持 Docker socket）    *.oxygenie.cc 一级通配   /preview?t=<JWT 90s>
→ .oxygenie/app.json        per-session 容器           HostRegexp 路由          → /__oxy/auth 换
  install/build/dev/port    install→build→serve        Origin CA 证书(签一次)    oxy_preview cookie(15min)
  entryFiles                idle 5~10min 回收           label 动态注册            → iframe sanddbox 嵌入
                            MAX_ACTIVE_PREVIEWS=4
```

逐段看它怎么把四个约束各个击破：

**① 清单检测（`manifest.js`）—— 不给自由 shell，只认 package.json 脚本。** 启发式扫工程：识别框架、入口、端口，生成 `.oxygenie/app.json`（`installCommand` / `buildCommand` / `devCommand` / `port` / `entryFiles`）。关键安全取舍：**只执行 `package.json` 里声明的脚本，不给 LLM 一个自由 shell**——这把"任意命令执行"收敛成"跑这个工程声明的构建命令"。

**② 构建托管（`controller.mjs` + `runtime.js`）—— per-session 持久容器 + build-first。** 这是整套设计的重心，三个决定：
- **per-session，不是 per-message**：预览容器跨消息存活（暖文件系统 + node_modules 缓存），这样同一个会话里改一版、再看一次不用每次重装。注意这跟 Agent 执行的 per-message worker（第 03 篇）是**两套不同生命周期的运行时**——这是 OxyGenie 当前最大的架构张力（见生产坑一）。
- **build-first，dev 尽力而为**：优先 `npm run build` 出静态产物再静态托管（稳、可验证、抓得到构建错误），HMR/dev server 作为 best-effort。
- **有界并发 + idle 回收**：`MAX_ACTIVE_PREVIEWS=4`（含 installing 阶段）、`PREVIEW_IDLE_TIMEOUT_MS` 5～10 分钟空闲即杀容器。**50 个会话可以都有预览，但同时真在跑的 ≤ 4 个**——跟第 03 篇"并发会话 ≠ 并发执行"是同一招。

**③ 反代暴露（Traefik）—— 一级子域 + 签一次的 Origin CA。** 用 `<previewId>.oxygenie.cc` 子域（不是子路径，HMR 和相对 import 才不会错位）。证书不动态签，而是用 **Cloudflare Origin CA 证书签一次、所有路由复用**，绕开 CF Full(Strict) 对 HTTP-01 的封锁和"通配只覆盖一级"的限制。controller 给容器贴 Traefik label，路由动态注册。

**④ 鉴权嵌入（`auth.js`）—— 一次性 JWT 换短命不透明 cookie。** 预览 URL 不能裸奔（凭 URL 谁都能看）。流程：主站签发一个 **60～120 秒的一次性 bootstrap JWT**，用户首次访问 `<previewId>.oxygenie.cc/preview?t=<JWT>`，预览侧的 `/__oxy/auth` 校验后换发一个 **10～15 分钟、httpOnly 的 `oxy_preview` 不透明 cookie**，之后滑动续期。最后用 `<iframe sandbox="allow-scripts allow-forms allow-downloads">`（**不给 `allow-same-origin`**）嵌进聊天界面——源隔离，预览页拿不到主站的 cookie/storage。

## 关键实现要点

**1. PreviewRuntime：稳定 ID + 信号量 + idle 追踪（`src/preview/runtime.js`）**

```javascript
// runtime.js L5–10：配置即上限
const MAX_ACTIVE_PREVIEWS    = +(process.env.MAX_ACTIVE_PREVIEWS    ?? 4)
const PREVIEW_IDLE_TIMEOUT_MS = +(process.env.PREVIEW_IDLE_TIMEOUT_MS ?? 600_000)  // 10min

// L33–40：同一会话同一工程 → 同一个稳定 previewId（hash），避免重复起容器
const stablePreviewId = (sessionId, appKey) => hash(`${sessionId}:${appKey}`).slice(0, 12)

// L91–100：构造时建信号量 + in-flight 表，install 阶段就占名额
this.sem = new Semaphore(MAX_ACTIVE_PREVIEWS)
```

`MAX_ACTIVE_PREVIEWS` 把"同时在 install/build/serve 的容器数"焊死，这是预览不吃垮机器的总闸。

**2. controller 是唯一持有 Docker socket 的组件（`src/preview/controller.mjs`）**

预览 sidecar 独立成进程，**只有它能碰 `/var/run/docker.sock`**——把"能起容器"这个高危能力收敛到一个组件里，ws-server / worker 都碰不到 Docker socket。2026-06 这版加固了"detached serve + 容器内 pid 追踪"，避免 dev server 变僵尸。

**3. 鉴权：90 秒 JWT → 15 分钟 cookie（`src/preview/auth.js`）**

```javascript
// auth.js L3,5：两条 TTL
const DEFAULT_BOOTSTRAP_TTL_MS = 90_000          // 一次性 JWT，90s
const DEFAULT_COOKIE_TTL_MS    = 15 * 60 * 1000   // 不透明 cookie，15min

// L44–79：issueBootstrapToken() 签发一次性令牌；/__oxy/auth 校验后 set-cookie oxy_preview(httpOnly)
```

**短命一次性 JWT** 负责"首跳"，**httpOnly 不透明 cookie** 负责"会话期"——JWT 不进 cookie、cookie 不带信息，URL 泄漏的窗口被压到 90 秒。

**4. 关键数字一览**

| 参数 | 值 | 作用 |
|------|----|------|
| `MAX_ACTIVE_PREVIEWS` | 4（可调 4~6） | 同时活跃预览容器上限（含 installing） |
| `PREVIEW_IDLE_TIMEOUT_MS` | 5~10 min | 空闲即杀容器回收资源 |
| `PREVIEW_MEMORY` | 512MB~1GB | 单预览容器内存 |
| bootstrap JWT TTL | 90s | 一次性首跳令牌 |
| `oxy_preview` cookie TTL | 15min | 会话期不透明 cookie，滑动续期 |
| iframe sandbox | `allow-scripts allow-forms allow-downloads` | **无 `allow-same-origin`**，源隔离 |
| egress | install 放行 npm registry / run 默认拒绝 | 出网最小化 |

## 反直觉结论

> [!IMPORTANT]
> **"渲染 AI 生成的 App"不是前端问题，是一个微型 PaaS 问题。**
>
> 你以为难在"把产物显示出来"，实际难在"安全地、有上限地、按需地，为不可信代码提供 构建 + 运行 + 公网反代 + 鉴权 + 回收 的全套基础设施"。真正的工程量在 Docker 生命周期、Traefik 路由、证书、cookie 鉴权、idle 回收里——iframe 那一下是最后的 1%。

再点破一层：**真预览复用的全是 OxyGenie 已有的隔离哲学。** "有界并发 + idle 回收"是第 13 篇 semaphore + reaper 的翻版；"用进程/容器边界做隔离"是第 03 篇 per-message worker 的翻版；"build-first 而非常驻 dev"是"无状态执行单元"的翻版。**一个平台一旦把"隔离 / 限流 / 回收"做成了肌肉记忆，再难的新功能（真预览）也只是把同一套肌肉再用一遍。** 这就是分层架构的复利。

## 三个生产坑

> [!WARNING]
> **坑一 —— per-message worker 与 per-session 预览容器是两套运行时，目前没合并。**
> Agent 执行是"每条消息 spawn、跑完即死"（第 03 篇）；预览需要"per-session 持久容器、暖 node_modules"。两套生命周期、两个管理器，**当前是并行的两条线**（Phase C 正在设计统一）。后果：会话的工作区文件要在 worker 和预览容器之间共享/同步，边界没理清就会出现"Agent 写了文件、预览没看到"。

> [!WARNING]
> **坑二 —— structured outputs 被关掉了，artifact 元数据只能靠启发式。**
> 本想用 SDK 的 `outputFormat` 让模型结构化声明产物（哪些文件是一个 App）。但它的 Stop-hook 会往对话里注入"You MUST call StructuredOutput"，污染上下文。**当前 `ENABLE_STRUCTURED_OUTPUTS=false`**（CLAUDE.md 有注），改用启发式 + `.oxygenie/app.json` 清单推断。根因和真预览的 manifest 策略耦合，没定下来之前不解。详见第 16 篇。

> [!WARNING]
> **坑三 —— Traefik v3 的 HostRegexp 语法 + YAML/compose 转义，错了就静默 404。**
> 子域路由用 `HostRegexp(\`^[a-z0-9-]+\.oxygenie\.cc$\`)`，v3 的正则语法跟 v2 命名组不同；YAML 里 `\.` 的转义、compose 里 `$` 要写成 `$$`——**任何一处错，路由不报错，直接不匹配 → 404**，极难排查。修复：拿一个固定子域先验证路由通了，再放开通配。

三个坑的共同根源：**真预览是把"不可信代码执行"和"公网可访问"这两件最危险的事，按需拼在一起。** 运行时边界、上下文污染、CDN/反代语法——每一个接缝都是新的攻击面或故障点。这也是为什么它被排在系列靠后：它把前面所有层（沙箱、并发、会话、上线）的能力都借了一遍。

## 配图

1. ![真预览四段管线：检测→构建→反代→鉴权](../assets/img/15-preview-pipeline.svg)
2. ![bootstrap JWT(90s) → oxy_preview cookie(15min) 鉴权时序](../assets/img/15-preview-auth.svg)
3. ![per-message worker vs per-session 预览容器：两套运行时](../assets/img/15-two-runtimes.svg)

## 下一篇

→ [第 16 篇：Artifact 检测与会话 UI/Workbench —— 启发式检测、为什么关掉 structured outputs、seq 排序](./16-artifacts-and-workbench.md)

预览容器有了，但前端怎么知道"这一回合产出了一个 App、该弹一张预览卡"？下一篇钻进 artifact 检测（为什么是启发式、为什么一回合该收敛成一张卡而不是每个文件一张）、会话 UI 的乱序难题（事件为什么要 seq 排序），以及右侧 Workbench 四面板的数据从哪来。

---

📌 系列阅读地图：[reading-map.md](../reading-map.md)
🔗 English version: [en/15-real-preview.md](../en/15-real-preview.md)
