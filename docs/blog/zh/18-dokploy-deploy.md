---
title: "第 18 篇：Dokploy 上线 —— 多阶段 Docker、GHCR、Traefik 子域与 Cloudflare Origin CA"
slug: 18-dokploy-deploy
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 18
keywords: [Dokploy, Docker, GHCR, Traefik, Cloudflare Origin CA, CI/CD]
prev: 17-billing-and-observability
next: 19-retrospective
---

# 第 18 篇：Dokploy 上线 —— 多阶段 Docker、GHCR、Traefik 子域与 Cloudflare Origin CA

> 把"双进程 + worker + preview sidecar"（第 02 篇）这套东西真正搬上一台 16GB VPS，靠的是：多阶段 Dockerfile（瘦身后 ~1.5GB）、GitHub Actions 在 amd64 上预构建推 GHCR、Dokploy 用 Compose 编排、Traefik 做子域反代、Cloudflare Origin CA 签一次证。这一篇讲这条上线链和它的几个静默坑。

**章节跳转：**[问题](#问题陈述) · [朴素方案](#朴素方案为什么不行) · [核心方案](#核心方案预构建-ghcr--compose--traefik--origin-ca) · [实现要点](#关键实现要点) · [反直觉结论](#反直觉结论) · [生产坑](#三个生产坑)

## 问题陈述

前面 17 篇造的所有东西——双进程拓扑、per-message worker、Python/Bash 工具栈、bubblewrap 沙箱、per-session 预览容器、计费观测——最终都得落到一件事上：**在一台 16GB 的 VPS 上，能一键 redeploy 地跑起来，并且有人在公网用 HTTPS 访问得到。** 这件事要同时满足五个约束：

1. **能一键 redeploy**：改了代码，希望"推一下 → 线上自动更新到新版本"，不是每次手动 SSH 上去敲一串命令。
2. **不在 CI 上 OOM**：SSR 打包的内存峰值很大，而标准的免费 CI runner 只有约 7G 内存——构建一不小心就被 OOM 杀掉。
3. **架构必须对**：Dokploy 服务器是 **amd64 (x86_64)**，而开发机是 Apple Silicon 的 **ARM64**。别人在 Mac 上 `docker build` 出来的是 ARM64 镜像，推上去生产根本起不来——构建产物的 CPU 架构必须和生产对齐。
4. **HTTPS 子域可用**：主站走 apex 域名，**每个预览**走一级子域 `<previewId>.oxygenie.cc`（第 15 篇定下的设计）。这些子域都得有有效证书，浏览器才不会拦。
5. **多进程同框编排**：Traefik、postgres、redis、minio、meili、app、ws-server、migrate、worker、preview-controller——十来个服务要在一份编排文件里立起来、连起来、按对的顺序起来。

把这五件事摆一起，"上线"就不再是"写个 Dockerfile + `docker compose up`"。它变成了一道**在他人的基础设施（CDN、CI runner、单机编排器）的约束之间穿针引线**的工程题——而这些约束，没有一个写在 Dockerfile 的教程里。

## 朴素方案为什么不行

**方案一：每次提交都在 Dokploy 机器上本地构建。** 最直觉——把 `build:` 写进 compose，让 Dokploy 拉代码、本地构建、起容器，一步到位。但 SSR 打包的内存峰值很大，Dokploy 主机本身要同时跑十来个服务，再叠一个吃内存的 Vite build，**主机直接 OOM**；而且每次部署都重新构建一遍，慢、烧服务器资源。更糟的是如果让贡献者在 Mac 上本地 `docker build`，产出的是 **ARM64 镜像**，推上 amd64 的生产机直接架构不匹配。**"在哪构建"这件事，被内存预算和 CPU 架构两面夹击。**

**方案二：用 Let's Encrypt 给预览子域动态签证。** 标准做法——Traefik 配个 `certresolver=letsencrypt`，每个子域自动签。但两道现实拦路（第 15 篇已经撞过一次）：① 我们在 Cloudflare 橙云后面，CF 的 **Full(Strict)** 模式会挡掉 Let's Encrypt 的 HTTP-01 校验；② CF 免费版的通配证书**只覆盖一级**。动态签证这条路在"CF 橙云 + 免费档"这个部署形态下走不通。

**方案三：保留 Playwright + LibreOffice 在镜像里。** 它们是早期为某些工具能力装的，加起来约 2.2GB。问题是镜像越胖，CI 构建时的内存和磁盘压力越大——在只有约 7G 的 CI runner 上，胖镜像 + SSR build 的组合很容易把预算撑爆。**为了几个边缘能力，背着 2GB+ 的依赖去挤 7G 的 CI，账算不过来。**

**方案四：上 Kubernetes。** "多服务编排"听起来就该上 k8s。但 OxyGenie 的目标是"单机 16GB、~50 并发会话、团队自托管"。在这个规模下，k8s 的控制平面开销、运维复杂度、学习成本，全是**过度工程**——单机一份 Docker Compose 就能把十来个服务编排清楚，不需要一个集群调度器。

四个方案的共同教训：**自托管 Agent 上线的难点，全在"别人的基础设施有脾气"。** CI 内存有限、生产架构和开发机不同、CDN 不让你用标准签证流程、依赖太胖挤爆构建——这些约束没有一条是"写 Dockerfile"教得会的，全是部署时一个个撞出来的。OxyGenie 的答案是把构建挪到能控制架构和内存的地方（GitHub Actions amd64）、用 CDN 接受的方式签证（Origin CA）、把镜像瘦下来、用单机 Compose 编排。

## 核心方案：预构建 GHCR + Compose + Traefik + Origin CA

OxyGenie 当前的上线链可以一句话概括：

> **镜像在 GitHub Actions 的 amd64 上预构建、推 GHCR，Dokploy 只拉取不构建；多阶段 Dockerfile 瘦身到 ~1.5GB；Dokploy 用一份 Compose 编排十来个服务；Traefik 做一级子域反代，证书用 Cloudflare Origin CA 签一次、所有路由复用。**

逐段看它怎么把上面四个坑各个击破：

**① 多阶段 Dockerfile（~1.5GB）—— builder 重、runner 轻。** builder 阶段用 `node:24-bookworm-slim` + pnpm 跑 Vite build，构建时挂 `NODE_OPTIONS=8GB` 防 OOM；runner 阶段只装运行期要的 Python3 + bubblewrap + socat + pandoc，并以**非 root 用户 `nodejs:1001`** 运行。关键一刀：**移除 Playwright/LibreOffice**，镜像从约 3.5GB 瘦到约 1.5GB——这直接回应方案三，把 CI 的构建压力降下来。

**② CI 分级闸 + amd64 预构建 —— 在能控架构和内存的地方构建。** `ci.yml` 把检查分级：typecheck（`continue-on-error`，不阻塞）/ lint（硬闸）/ unit tests（硬闸）/ integration（非阻塞）/ build（挂 8GB）。`build.yml` 在 **linux/amd64** 上构建镜像、推到 `ghcr.io/.../app:{SHA}` + `:latest`。这一段同时解了方案一的两个死穴：构建在 GitHub Actions 上跑（不挤 Dokploy 主机的内存），平台显式钉 amd64（不会因为谁在 Mac 上构建就污染生产）。

**③ Dokploy Compose + `pull_policy: always` —— 单机编排、强制拉新。** `docker-compose.dokploy.yml` 一份文件编排 Traefik + postgres + redis + minio + meili + app + ws-server + migrate + worker + **preview-controller** 十来个服务。所有用应用镜像的服务都标 `pull_policy: always`——这是因为 Compose 默认 `pull_policy: missing` 只在镜像不存在时拉，导致更新镜像后 Dokploy 仍用旧的本地缓存。强制 always，每次 redeploy 都拉最新 digest，这就是"一键 redeploy"真正生效的那个开关。

**④ Traefik 子域 + Cloudflare Origin CA —— 签一次，所有路由复用。** 预览走一级子域 `<previewId>.oxygenie.cc`（不是子路径，HMR 和相对 import 才不会错位）。证书不动态签，而是用 **Cloudflare Origin CA 证书签一次、所有路由复用**——这一刀同时绕开了方案二的两道墙：CF Full(Strict) 对 HTTP-01 的封锁，和"免费通配只覆盖一级"的限制。compose 路由用 `tls=true`（走默认 Origin 证书），不用 `certresolver=letsencrypt`。

**⑤ 统一启动 —— 同容器拉起 Nitro + ws-server。** `start-production.mjs` 在同一个容器里把 Nitro（`:5000`，SSR）和 ws-server（`:3001`，WebSocket）作为兄弟进程拉起来。把两个进程收进一个启动脚本，是为了让 Compose 那一层只管"一个 app 服务"，不必为双进程拆两个容器、再处理它们之间的协调。

这五段拼起来，就是一条"推代码 → GitHub Actions amd64 构建 → 推 GHCR → Dokploy 拉新 → Compose 编排 → Traefik + Origin CA 暴露"的可重复上线链。它的价值不在任何单点的技术新颖，而在于**把那些撞出来的约束，固化进了 Compose 和 workflow**——让下一次上线不用再撞一遍。

## 关键实现要点

| 文件 | 行号 | 机制 |
|------|------|------|
| `Dockerfile` | L2–54 / L55–148 | builder（Vite build 8GB）/ runner（Python + 非 root） |
| `.github/workflows/ci.yml` | L43–72 | lint/unit 硬闸，integration 非阻塞，build 8GB |
| `.github/workflows/build.yml` | L21–44 | amd64 构建 → GHCR `:SHA` + `:latest` |
| `docker-compose.dokploy.yml` | L20–21 / L117 / L396–421 | `pull_policy: always` / `ANTHROPIC_AUTH_TOKEN` / preview-controller |
| `start-production.mjs` | — | Nitro + ws-server 兄弟进程 |

`Dockerfile` 的两段分得很清：L2–54 是 builder，跑 Vite build 时挂 8GB 防 OOM；L55–148 是 runner，装 Python + 沙箱工具链、切非 root `nodejs:1001`。CI 侧，`ci.yml` L43–72 是那张分级闸——lint/unit 是硬闸（挂了就拦 PR），integration 非阻塞（环境敏感，不让它卡住主流程），build 挂 8GB；`build.yml` L21–44 在 amd64 上构建并打两个 tag 推 GHCR（`:SHA` 用于精确回滚，`:latest` 用于常规拉取）。

`docker-compose.dokploy.yml` 有三个要盯死的点：L20–21 的 `pull_policy: always`（不加就拉不到新镜像），L117 的 `ANTHROPIC_AUTH_TOKEN`（ARK 走 Bearer 鉴权，**不能**设成 `ANTHROPIC_API_KEY`，否则 SDK 改走 x-api-key、ARK 会失败），L396–421 的 preview-controller（唯一持 Docker socket 的组件，第 15 篇那个高危能力收敛点）。`start-production.mjs` 没标行号——它就是那个把 Nitro 和 ws-server 在同容器拉起的统一入口。这张表里没有一处是"为了好看"加的，每一行都对应一个踩过会出血的点。

## 反直觉结论

> [!IMPORTANT]
> **自托管 Agent 的上线，一半工程在"绕过 CDN 和构建环境的脾气"。**
>
> 真正难的不是写 Dockerfile——多阶段构建、装依赖、设 entrypoint，这些都是查文档就能办的。难的是那一串没人提前告诉你的约束：CF Full(Strict) 不让你用 HTTP-01，于是改 Origin CA；免费通配只覆盖一级，于是子域设计就得迁就成单层；Mac 构建出 ARM64，于是必须把构建挪到 GitHub Actions 上钉 amd64；CI 只有约 7G，于是砍掉 Playwright/LibreOffice 给构建腾内存。**这四个约束，没有一个写在任何上线教程里，全是你部署时一个个撞出来、撞到流血才记住的。**

把这层再点透：**部署的真正产物，不是那个跑起来的容器，而是那份把约束固化下来的 Compose + workflow。** 第一次上线时，你是在和别人的基础设施搏斗——CDN 的证书策略、CI 的内存上限、编排器的拉取策略、平台的 CPU 架构。每搏赢一次，就把那个解法写进 `docker-compose.dokploy.yml` 或 `.github/workflows/`。等到第 N 次 redeploy，这些约束都已经被代码记住了，你只需要推一下。**"可重复上线"的全部价值，就是把一次性的、痛苦的、撞出来的隐性知识，沉淀成下一个人不用再撞的显性配置。** 这和系列的主线一脉相承：OxyGenie 不重写 Agent Loop，但它必须亲自把"上线"这件 SDK 管不到的脏活，一刀一刀理清楚——因为没有谁会替你和 Cloudflare 的脾气和解。

## 三个生产坑

> [!WARNING]
> **坑一 —— Docker 模式下若在 `.env` 设了 `DATABASE_URL`，迁移会去 localhost 而非 `db` service。**
> 这是 env 级联的经典陷阱。compose 内部本应从 `POSTGRES_*` 变量拼出 `DATABASE_URL`，让它指向 compose 网络里的 `db` 服务别名。但如果有人图省事在 `.env` 里手写了一个 `DATABASE_URL`，它会**覆盖**拼出来的那个——而手写的往往指向 `localhost`，在容器网络里 `localhost` 不是数据库。结果是 `migrate` 连不上库、整个栈起不来。文档明确写了"Docker 模式别设 `DATABASE_URL`"，让它从 `POSTGRES_*` 单一来源拼。这种坑不报"配置错误"，只报一个莫名其妙的连接失败，排查起来格外费时间。

> [!WARNING]
> **坑二 —— Traefik v3 的 `HostRegexp` 语法 + YAML/compose 转义，错一处静默 404。**
> 子域路由用 `HostRegexp`，但 Traefik **v3** 的正则语法和 **v2** 的命名组完全不同（v2 的 `{name:regexp}` 在 v3 里静默永不匹配）；再叠上 YAML 里 `\.` 的转义、compose 插值里 `$` 要写成 `$$`——这三层转义任何一处写错，**路由不报错，直接不匹配 → 404**。最阴的是它静默：你看不到任何"路由配置错误"的日志，只看到预览页打不开，一度被误判成是 Dokploy 的 Swarm 路由问题。修复的笨办法也是唯一可靠的办法：拿一个**固定子域**先把路由验证通了，再放开通配——别一上来就调通配正则，那是在三层转义的迷宫里盲猜。

> [!WARNING]
> **坑三 —— ARK 模型别名缺一即回退硬编码 Anthropic 模型、GHCR 私有未授权拉取静默失败、migrate 与 db 的 DNS 时序。**
> 三个上线时容易同时中招的静默故障。其一，ARK 的模型别名（sonnet/opus/haiku 等映射）只要**任一未定义**，SDK 就回退到硬编码的 Anthropic 模型名，而 ARK 网关上"不存在这个模型"——表现为 run 直接报模型不存在，但根因在一个没填的环境变量。其二，**GHCR 包如果设成私有**而 Dokploy 没配 registry 凭据，拉取会 403 失败——而且失败得很安静，看着像"没更新"。其三，Dokploy 上 `db` 服务别名有 **DNS 时序**问题，`depends_on: healthy` 也挡不住偶发的 `EAI_AGAIN`，所以 `migrate` 必须**重试直到 `db` 可解析**，不能假设一次就连上。

这三个坑的共同根源是：**上线链上的故障，绝大多数是"静默"的。** env 覆盖不报错、路由不匹配不报错、私有包拉不到不报错、DNS 没就绪只是偶发——它们都不会给你一行清晰的"配置错误"，只会让某个东西"就是不工作"。这是部署区别于写代码的地方：代码错了编译器会喊你，上线错了只有一个沉默的 404 或一个连不上的库等你自己去刨。把这些静默坑写进文档和 compose 注释，就是不让下一个人在沉默里耗掉一个下午。

## 配图

1. ![上线链：CI → GHCR → Dokploy → Traefik](../assets/img/18-deploy-pipeline.svg)
2. ![Cloudflare Origin CA + 一级通配子域](../assets/img/18-cf-origin-ca.svg)

## 下一篇

→ [第 19 篇：复盘](./19-retrospective.md)

上线链通了，OxyGenie 就真正从"一个基于 starter 的项目"长成了"一个在 oxygenie.cc 上跑着的自托管平台"。最后一篇收尾：从官方 AI SDK starter 出发包住 Claude Agent SDK 这条路上，哪些决策回头看是对的、哪些是债、哪些已经在反悔——以及那个最深的点，为什么 OxyGenie 最好的决策和最大的债，是同一枚硬币的两面。

---

📌 [reading-map.md](../reading-map.md)
