# OxyGenie Agent Harness — English

The series' navigation lives in the **bilingual reading map**: [`../reading-map.md`](../reading-map.md) (it carries both the Chinese and English tables of contents, the reverse index, and the OxyGenie-vs-HarWork comparison).

## Status of English bodies

The full Chinese set (19 articles) is complete in [`../zh/`](../zh/) — two flagship full articles plus 17 code-grounded outlines.

On the English side, the two **flagship full articles** are translated here:

- 🌟 [Part 03 — The Per-Message Worker Model](./03-per-message-worker-model.md)
- 🌟 [Part 15 — Real Preview](./15-real-preview.md)

The remaining 17 English bodies are a mechanical translation pass over their Chinese counterparts in [`../zh/`](../zh/), tracked as a follow-up. Until then, the reading map's English column + the two flagships give an English reader the full architecture narrative and the two deepest dives.

## What this series is

An engineering teardown of **OxyGenie** — a self-hosted, multi-tenant, billable web Agent platform built **on top of the Claude Agent SDK** (not a from-scratch loop). Modeled on [building-an-agent-harness](https://github.com/sky54laozhu/building-an-agent-harness) (HarWork), but re-derived from OxyGenie's actual architecture: its defining thesis is that **OxyGenie doesn't write the loop — it wraps the SDK and builds the 15 layers around it** that make a bare `query()` multi-tenant, sandboxed, persistent, billable, and deployable.

All `file:line` references point to the OxyGenie `main` snapshot of 2026-06-07.
