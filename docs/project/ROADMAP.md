# OxyGenie — Roadmap

Phased plan from foundation to surpassing Deep Agents. Each phase lists its goal
and **exit criteria**. Track live progress in [`STATUS.md`](./STATUS.md).

> Sequencing principle: *make parallel multi-contributor work safe first
> (foundation), then close security gaps, then make capabilities measurable,
> then catch up to Deep Agents.* Don't build features on an unsafe/untestable base.

---

## Phase 0 — Foundation (enable safe, parallel contribution)

**Goal:** anyone of any skill level can contribute safely, in parallel, with
guardrails.

- [x] Split product into its own repo (`oxygenie`), history + tags preserved.
- [x] Hygiene: untrack `.env.docker` (+ template), ignore runtime data dirs.
- [x] Secret-leak audit of full history (clean).
- [x] CI gates on `main`: build check + **gitleaks** secret scan + PR template + CODEOWNERS.
- [x] Branch protection on `main` (required checks + CODEOWNER review, no direct push).
- [ ] **Isolated, reproducible dev environment** (devcontainer / compose dev
      profile; secrets separated; one-command boot of web + ws-server + services).
- [ ] **TS-ify the agent runtime** (`ws-server.mjs`/`ws-query-worker.mjs`) with a
      typed WebSocket message protocol — prerequisite for safely adding harness features.
- [ ] Make the test suite CI-runnable (split unit vs e2e; provision Postgres/services)
      → re-enable `test` as a hard gate.
- [ ] Fix TS errors → re-enable `typecheck` as a hard gate.
- [ ] Migrate 15 REST routes → Server Functions → re-enable `validate-routes` as a hard gate.

**Exit criteria:** green, meaningful CI as a hard gate; a contributor can boot the
full stack locally in one command without touching real secrets.

---

## Phase 1 — Security hardening (gate before real/multi-tenant use)

**Goal:** close the high-severity risks from the architecture review so the
product is safe to run with real data / real tenants.

- [ ] **Sandbox the exec tools** (Python/Bash) — run under `bubblewrap`
      (already installed) with `--unshare-net` + workspace-only binds; **strip
      secrets** from the worker/python env to an explicit allowlist. *(Risk #1)*
- [ ] Keep `canUseTool` active even in `bypassPermissions` mode. *(Risk #2)*
- [ ] Add owner predicates to fix **cross-tenant file/attachment access**. *(Risks #3,#4)*
- [ ] Add `maxTurns` / `maxBudgetUsd` + a server watchdog (turn/cost bounds). *(Risk #5)*
- [ ] Fix deploy so the WS server actually boots; reconcile ports. *(Risk #8)*
- [ ] Cooperative abort (AbortController) + remove dead `ws.abortController`. 
- [ ] Client liveness: heartbeat/timeout + surface worker-crash to UI. *(Risk #10)*

**Exit criteria:** every "high"/"critical" review risk has a fix + a regression test.

---

## Phase 2 — Observability & accounting (make "production" measurable)

**Goal:** you can tell whether the system is healthy and what it costs.

- [ ] Actually meter usage (`spendOneCredit` is currently never called).
- [ ] Persist token/cost/turns per run server-side (from the SDK `result` event).
- [ ] Audit log table for security-relevant actions.
- [ ] Stop logging raw message content unconditionally (PII).

**Exit criteria:** per-run cost + usage visible and billable; an audit trail exists.

---

## Phase 3 — Catch up to (and pass) Deep Agents (capabilities)

**Goal:** match Deep Agents' harness strengths, on top of our platform advantages.

- [ ] **Todo / plan panel** (surface `TodoWrite` as structured UI).
- [ ] **First-class sub-agent panel** (nested input/output, not regex-detected).
- [ ] **Human-in-the-loop tool approval** (approve / reject / edit round-trip).
- [ ] **Checkpointing / durable run resume** (resume an interrupted run, not just reload history).
- [ ] **Context management** (summarization / compaction; memory layer).
- [ ] Unify shared logic so the two runtimes can't fork (skill-sync, path guards).

**Exit criteria:** parity-or-better with `deep-agents-ui` on todo/sub-agent/HITL,
plus durable resume — while keeping our isolation + multi-tenant + web edge.

---

## Phase 4 — Multi-model & scale maturity

**Goal:** real provider abstraction and horizontal scale.

- [ ] Model registry / capability catalog / provider routing + failover.
- [ ] Split shared credentials per capability (remove single-key blast radius).
- [ ] Concurrency caps / backpressure / horizontal scale story for ws-server.

**Exit criteria:** swap/route models without code changes; bounded resource use under load.
