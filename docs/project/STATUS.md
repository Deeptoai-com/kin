# OxyGenie — Status (Living Memory)

> **This is the living memory of the project. Update it whenever state changes.**
> Last updated: **2026-05-29**

## Current position (one-paragraph snapshot)

We have finished the **research phase** (an adversarial architecture review +
Deep Agents comparison — see [`research/`](./research/2026-05-architecture-review.md))
and are now in **Phase 0: Foundation**. We are *laying the groundwork* (repo
split, CI gates, dev environment) **before** starting the actual tuning/hardening
work. No production tuning or security fixes have started yet — that begins in
Phase 1 once the foundation is solid.

## Phase tracker

| Phase | State |
|---|---|
| Research (architecture review + Deep Agents comparison) | ✅ Done |
| **Phase 0 — Foundation** | 🔵 In progress |
| Phase 1 — Security hardening | ⬜ Not started |
| Phase 2 — Observability & accounting | ⬜ Not started |
| Phase 3 — Catch up to Deep Agents | ⬜ Not started |
| Phase 4 — Multi-model & scale | ⬜ Not started |

## Done (most recent first)

- ✅ **main branch protection** on `oxygenie` (required checks: `Quality Checks (22.12)`
  + `gitleaks`; 1 review + CODEOWNER required; no direct/force push). *(2026-05-29)*
- ✅ Repo made **public** (it's an open-source product; history was already public via
  the old `constructa-starter` mirror, and verified secret-free). *(2026-05-29)*
- ✅ **CI gates merged to main** (PR #1): `pnpm build` check, **gitleaks** secret scan
  (full-history config + placeholder allowlist), PR template, CODEOWNERS. *(2026-05-29)*
- ✅ **Secret-leak audit** of full git history (incl. dangling objects): **clean** —
  no real keys; only placeholders in example/doc files; `data/` never committed. *(2026-05-29)*
- ✅ **Hygiene**: untracked `.env.docker` → `.env.docker.example`; ignored `/data/`,
  `/user-data/`. *(2026-05-29)*
- ✅ **Repo split**: product extracted to `github.com/foreveryh/oxygenie` (private→public),
  full 383-commit history + 4 tags; `origin`=oxygenie, `upstream`=constructa-starter. *(2026-05-29)*
- ✅ **Research**: adversarial architecture review + Deep Agents (py/js/ui) comparison
  + Claude Agent SDK alignment. See `research/2026-05-architecture-review.md`.

## In progress

- 🔵 Building out **project memory** (this `docs/project/` set). *(2026-05-29)*

## Next up (Phase 0 remainder, roughly ordered)

1. ⬜ **Isolated, reproducible dev environment** (devcontainer / compose dev profile;
   secrets separated; one-command boot of web + ws-server + Postgres/Redis/MinIO/Meili).
   *(Also the starting point for Phase 1 Risk #1.)*
2. ⬜ **TS-ify the agent runtime** + typed WS protocol (prerequisite for harness features).
3. ⬜ Make tests CI-runnable (unit/e2e split + service containers) → re-enable `test` gate.
4. ⬜ Fix TS errors → re-enable `typecheck` gate.
5. ⬜ Migrate 15 REST routes → Server Functions → re-enable `validate-routes` gate.

## Backlog (with difficulty tags)

| Item | Difficulty | Notes |
|---|---|---|
| Migrate 15 REST routes → Server Functions | M | Overlaps cross-tenant security fixes (Risks #3/#4) |
| Make tests CI-runnable (unit/e2e split + services) | M | Then make `test` a hard gate |
| Fix TS errors | S–M | Good starter task; then make `typecheck` a hard gate |
| Sandbox Python/Bash exec (bubblewrap) + env allowlist | M–L | **Critical** (Risk #1); highest security priority |
| `changedoc` (ai-pr-docs) needs `OPENAI_API_KEY` secret | S (chore) | Deferred by decision; or disable the AI workflows |
| Archive old public repo `constructa-starter` | S (chore) | Avoid two-public-repo confusion |
| Bump gitleaks/checkout actions off Node 20 | S (chore) | Deprecation forced ~2026-06-16 |

## Known weakened gates (intentionally non-blocking until backlog done)

- `typecheck` — non-blocking (pre-existing TS errors).
- `validate-routes` — non-blocking (15 pre-existing REST-route violations).
- `test` — non-blocking (suite is e2e/integration; needs DB + live server in CI).

## Decision log

- **2026-05-29** — Strategy: **harden + borrow from Deep Agents; do not migrate/integrate.**
  Rationale: Deep Agents is a single-process library with divergent goals; our
  platform/isolation/SDK investment is the asset. (See VISION §5.)
- **2026-05-29** — Repo topology: separate code repo (`oxygenie`) from the docs/PM
  repo; **no submodule** (friction for many contributors); keep old remote as `upstream`.
- **2026-05-29** — Make `oxygenie` **public** to unlock free branch protection and
  because it is intended to be open-source; verified safe (history already public + secret-free).
- **2026-05-29** — Phase-0 CI: keep `lint`/`build`/`gitleaks` as hard gates now;
  `typecheck`/`validate-routes`/`test` non-blocking until their backlog items land.

## How to use this file

- Update the **snapshot**, **Done/In progress/Next**, and **Decision log** as part of
  finishing any meaningful task.
- When a phase's exit criteria are met, flip its row in the Phase tracker and in `ROADMAP.md`.
- Keep difficulty tags on backlog items so work can be parcelled out by skill level.
