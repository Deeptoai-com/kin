---
title: "Part 15: Real Preview — Running AI-generated multi-file apps for real in a per-session Docker"
slug: 15-real-preview
date: 2026-06-07
series: oxygenie-agent-harness
series_index: 15
keywords: [AI artifact, real preview, per-session Docker, Traefik, subdomain proxy, bootstrap JWT, iframe sandbox]
prev: 14-multi-model-routing
next: 16-artifacts-and-workbench
---

# Part 15: Real Preview — Running AI-generated multi-file apps for real in a per-session Docker

> HarWork's Part 14 renders **single-file** HTML with an iframe overlay + postMessage. OxyGenie's goal is harder: the AI produces a **multi-file Vite/React project** that needs `npm install`, `npm run build`, and a real dev/preview server — and the user should see it **actually running**, not stuffed into Sandpack pretending to run. This article answers: within a "single 16GB host, 50 concurrency" budget, how do you give each session a real runtime environment without it eating you alive or escaping its box?

**Jump to:** [Problem](#the-problem) · [Naive approaches](#why-the-naive-approaches-fail) · [Core solution](#core-solution-a-four-stage-pipeline) · [Implementation](#key-implementation-details) · [Counterintuitive](#the-counterintuitive-takeaway) · [Production traps](#three-production-traps)

## The Problem

"Real preview" must hold four conflicting things at once:

1. **Multi-file, real build**: the AI produces a full `package.json` + `src/**` project, not a snippet of HTML. You must really `install` + `build`/`dev` to surface real build errors, real dependencies, real routes.
2. **Bounded resources**: 50 sessions, and if each kept a resident dev server that's 50 × 300MB+ Node processes — an instant OOM on 16GB.
3. **Security**: this is **user-(via-LLM)-generated code** executing + networking on your server. It must not read other tenants' files, must not exfiltrate your secrets, must not become a pivot into your intranet.
4. **Embeddable in the browser**: the preview shows in an iframe in the chat UI, meaning a reachable URL, auth (others can't peek at your preview by guessing the URL), and the HMR websocket must connect.

Put those four together and "rendering AI output" stops being a frontend problem and becomes a **mini-PaaS** problem: on your own machine, on demand, you must provide untrusted code with the full "build + run + reverse-proxy + auth + reap" infrastructure.

## Why the Naive Approaches Fail

**Approach 1: Sandpack / WebContainers (run in-browser).** OxyGenie's old path, and what most AI products do. Zero server cost, all in-browser. But it **can't carry a multi-file real project**: it can't run a real `npm install` (deps are a pre-bundled subset), can't catch real build errors, and Node-only backend code won't run at all. An AI-generated Vite app that `pnpm build`s leaves Sandpack staring blankly.

**Approach 2: one resident dev server per artifact.** The intuitive move, but the budget explodes immediately: 50 sessions × ~3 artifacts each = 150+ resident Node processes at 300MB each, several times over 16GB just idling. **Resource ceiling (constraint 2) is bankrupt.**

**Approach 3: subpath reverse proxy (`/preview/<sid>/...`) instead of subdomain.** One domain, path prefix to distinguish previews. But Vite's HMR websocket and **relative-path imports** all misalign under a base prefix — `/src/main.tsx` becomes `/preview/abc/src/main.tsx`; tweaking the base spawns a swarm of edge cases and HMR still won't connect.

**Approach 4: sign a TLS cert per preview on demand (Let's Encrypt).** Two realities block it: ① Cloudflare's free wildcard cert **covers only one level** (`*.oxygenie.cc` works, `*.preview.oxygenie.cc` doesn't); ② CF's Full(Strict) mode blocks HTTP-01 validation. On-demand signing is a dead end in this deployment shape.

The shared lesson: **the hard part of real preview isn't "rendering", it's "providing, at controlled cost, securely, on demand, a publicly reachable runtime for untrusted code."** In-browser is too weak; resident processes explode in cost; subpath proxy is technically awkward; dynamic certs are blocked by the CDN. OxyGenie v1 (approved at the 2026-06-04 architecture review) answers by splitting these into a four-stage pipeline.

## Core Solution: A Four-Stage Pipeline

> **per-session persistent Docker (not per-message, not per-artifact) + build-first static hosting (dev/HMR best-effort) + Traefik subdomain proxy (one-level wildcard + Origin CA) + bootstrap-JWT-for-opaque-cookie auth + an idle reaper.**

```
① Detect & manifest        ② Build & host             ③ Proxy & expose       ④ Auth & embed
manifest.js                preview controller          Traefik                 auth.js
scan package.json          (sole holder of            *.oxygenie.cc wildcard   /preview?t=<JWT 90s>
→ .oxygenie/app.json        Docker socket)             HostRegexp routing       → /__oxy/auth swaps for
  install/build/dev/port    per-session container      Origin CA cert (1x)      oxy_preview cookie(15min)
  entryFiles                install→build→serve        label-driven routing     → iframe sandbox embed
                           idle 5~10min reap
                           MAX_ACTIVE_PREVIEWS=4
```

How each stage defeats one of the four constraints:

**① Manifest detection (`manifest.js`) — no free shell, only package.json scripts.** Heuristically scans the project: detects framework, entry, port, and writes `.oxygenie/app.json` (`installCommand` / `buildCommand` / `devCommand` / `port` / `entryFiles`). The key safety tradeoff: **only run scripts declared in `package.json`, never hand the LLM a free shell** — collapsing "arbitrary command execution" into "run this project's declared build commands."

**② Build & host (`controller.mjs` + `runtime.js`) — per-session persistent container + build-first.** The center of gravity, three decisions:
- **Per-session, not per-message**: the preview container outlives messages (warm filesystem + node_modules cache), so editing-and-re-viewing within a session doesn't reinstall each time. Note this is a **separate runtime lifecycle** from the per-message agent worker (Part 03) — OxyGenie's biggest current architectural tension (see Trap 1).
- **Build-first, dev best-effort**: prefer `npm run build` → static hosting (stable, verifiable, catches build errors); HMR/dev server is best-effort.
- **Bounded concurrency + idle reap**: `MAX_ACTIVE_PREVIEWS=4` (including the installing phase), `PREVIEW_IDLE_TIMEOUT_MS` 5–10 min idle then kill. **All 50 sessions may have previews, but ≤ 4 truly running at once** — the same trick as Part 03's "concurrent sessions ≠ concurrent executions."

**③ Proxy & expose (Traefik) — one-level subdomain + a cert signed once.** Use `<previewId>.oxygenie.cc` subdomains (not subpaths, so HMR and relative imports don't misalign). Certs aren't signed dynamically — a **Cloudflare Origin CA cert is signed once and reused for all routes**, sidestepping CF Full(Strict)'s HTTP-01 block and the "wildcard covers one level" limit. The controller attaches Traefik labels to containers; routes register dynamically.

**④ Auth & embed (`auth.js`) — a one-time JWT for a short-lived opaque cookie.** The preview URL can't run naked (anyone with the URL would see it). Flow: the main site issues a **60–120 second one-time bootstrap JWT**; the user first hits `<previewId>.oxygenie.cc/preview?t=<JWT>`; the preview side's `/__oxy/auth` validates it and issues a **10–15 minute, httpOnly `oxy_preview` opaque cookie**, sliding-renewed afterward. Finally an `<iframe sandbox="allow-scripts allow-forms allow-downloads">` (**no `allow-same-origin`**) embeds it into the chat UI — origin isolation, so the preview page can't reach the main site's cookies/storage.

## Key Implementation Details

**1. PreviewRuntime: stable ID + semaphore + idle tracking (`src/preview/runtime.js`)**

```javascript
// runtime.js L5–10: config is the ceiling
const MAX_ACTIVE_PREVIEWS    = +(process.env.MAX_ACTIVE_PREVIEWS    ?? 4)
const PREVIEW_IDLE_TIMEOUT_MS = +(process.env.PREVIEW_IDLE_TIMEOUT_MS ?? 600_000)  // 10min

// L33–40: same session + same project → same stable previewId (hash), avoids duplicate containers
const stablePreviewId = (sessionId, appKey) => hash(`${sessionId}:${appKey}`).slice(0, 12)

// L91–100: build a semaphore + in-flight map at construction; the install phase already takes a slot
this.sem = new Semaphore(MAX_ACTIVE_PREVIEWS)
```

`MAX_ACTIVE_PREVIEWS` welds shut the count of "containers in install/build/serve" — the master valve that keeps preview from eating the host.

**2. The controller is the sole holder of the Docker socket (`src/preview/controller.mjs`)**

The preview sidecar is a separate process, and **only it can touch `/var/run/docker.sock`** — collapsing the high-risk "can start containers" capability into one component that ws-server / worker can't reach. The 2026-06 hardening added "detached serve + in-container pid tracking" to keep dev servers from going zombie.

**3. Auth: 90-second JWT → 15-minute cookie (`src/preview/auth.js`)**

```javascript
// auth.js L3,5: two TTLs
const DEFAULT_BOOTSTRAP_TTL_MS = 90_000          // one-time JWT, 90s
const DEFAULT_COOKIE_TTL_MS    = 15 * 60 * 1000   // opaque cookie, 15min

// L44–79: issueBootstrapToken() mints the one-time token; /__oxy/auth validates then set-cookie oxy_preview(httpOnly)
```

The **short-lived one-time JWT** handles the "first hop", the **httpOnly opaque cookie** handles the "session window" — the JWT never enters a cookie, the cookie carries no information, and the URL-leak window is squeezed to 90 seconds.

**4. The numbers at a glance**

| Parameter | Value | Role |
|------|----|------|
| `MAX_ACTIVE_PREVIEWS` | 4 (tunable 4–6) | Cap on active preview containers (incl. installing) |
| `PREVIEW_IDLE_TIMEOUT_MS` | 5–10 min | Kill idle containers to reclaim resources |
| `PREVIEW_MEMORY` | 512MB–1GB | Per-preview container memory |
| bootstrap JWT TTL | 90s | One-time first-hop token |
| `oxy_preview` cookie TTL | 15min | Session-window opaque cookie, sliding renewal |
| iframe sandbox | `allow-scripts allow-forms allow-downloads` | **no `allow-same-origin`**, origin isolation |
| egress | install allows npm registry / run deny-by-default | minimized outbound |

## The Counterintuitive Takeaway

> [!IMPORTANT]
> **"Rendering an AI-generated app" is not a frontend problem — it's a mini-PaaS problem.**
>
> You think the hard part is "displaying the output"; the real hard part is "securely, boundedly, on demand, providing untrusted code with the full build + run + public reverse-proxy + auth + reap infrastructure." The real engineering lives in Docker lifecycle, Traefik routing, certificates, cookie auth, and idle reaping — the iframe is the last 1%.

One layer deeper: **real preview reuses all of OxyGenie's existing isolation philosophy.** "Bounded concurrency + idle reap" is Part 13's semaphore + reaper again; "isolate with a process/container boundary" is Part 03's per-message worker again; "build-first instead of resident dev" is "stateless execution unit" again. **Once a platform makes isolation / throttling / reaping into muscle memory, even the hardest new feature (real preview) is just flexing the same muscle once more.** That's the compounding interest of a layered architecture.

## Three Production Traps

> [!WARNING]
> **Trap 1 — the per-message worker and the per-session preview container are two runtimes, not yet merged.**
> Agent execution is "spawn per message, die on completion" (Part 03); preview needs "per-session persistent container, warm node_modules." Two lifecycles, two managers, **currently two parallel lines** (Phase C is designing a unification). Consequence: the session's workspace files must be shared/synced between worker and preview container, and an unsettled boundary produces "the agent wrote a file, the preview doesn't see it."

> [!WARNING]
> **Trap 2 — structured outputs are turned off, so artifact metadata is heuristic only.**
> The plan was to use the SDK's `outputFormat` to have the model structurally declare artifacts (which files form an App). But its Stop-hook injects "You MUST call StructuredOutput" into the conversation, polluting context. **Currently `ENABLE_STRUCTURED_OUTPUTS=false`** (noted in CLAUDE.md); inference falls back to heuristics + the `.oxygenie/app.json` manifest. The root cause is coupled to the preview manifest strategy and won't resolve until that's locked. See Part 16.

> [!WARNING]
> **Trap 3 — Traefik v3 HostRegexp syntax + YAML/compose escaping silently 404s if wrong.**
> Subdomain routing uses `HostRegexp(\`^[a-z0-9-]+\.oxygenie\.cc$\`)`; v3's regex syntax differs from v2 named groups; YAML's `\.` escaping and compose's `$$` for `$` — **any one mistake doesn't error, it just stops matching → 404**, brutally hard to debug. Fix: validate routing with a fixed subdomain first, then open the wildcard.

The shared root of these three traps: **real preview bolts together the two most dangerous things on demand — executing untrusted code and being publicly reachable.** Runtime boundaries, context pollution, CDN/proxy syntax — every seam is a new attack surface or failure point. That's why it sits late in the series: it borrows the capabilities of every prior layer (sandbox, concurrency, session, deploy).

## Diagrams

1. ![Real-preview four-stage pipeline: detect→build→proxy→auth](../assets/img/15-preview-pipeline.svg)
2. ![bootstrap JWT(90s) → oxy_preview cookie(15min) auth timeline](../assets/img/15-preview-auth.svg)
3. ![per-message worker vs per-session preview container: two runtimes](../assets/img/15-two-runtimes.svg)

## Next

→ [Part 16: Artifacts & workbench — heuristic detection, why structured outputs are off, seq ordering](./16-artifacts-and-workbench.md)

The preview container exists, but how does the frontend know "this turn produced an App, pop a preview card"? Next we dig into artifact detection (why heuristic, why a turn should collapse to one card rather than one per file), the chat UI's out-of-order problem (why events need seq ordering), and where the right-side Workbench's four panels get their data.

---

📌 Reading map: [reading-map.md](../reading-map.md)
🔗 中文版：[zh/15-real-preview.md](../zh/15-real-preview.md)
