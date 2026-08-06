# CNTKNW AI Project State

Updated: 2026-08-06
Repository: `HeisLazi/cntknw`
Authoritative checkout: `/home/lazi/Projects/personal/heisprojects/cntknw`
Branch: `main`
Local HEAD: `ecb3dd19d295e99a976eeb17429d03c065a72f68`
Origin/main: `ecb3dd19d295e99a976eeb17429d03c065a72f68`
Git relationship: local HEAD matches `origin/main`

## Model routing update (2026-08-06)

Hermes manager route was moved from the Ollama Cloud DeepSeek route to
OpenCode Zen `deepseek-v4-flash-free` (smoke-tested live; the direct DeepSeek
API route is not authenticated and stays dormant). Full live catalogs and a
micro-eval of the eight Zen free models were performed; results are recorded
in the routing policy in `AGENTS.md` and in the portable
`cntknw-orchestrator` skill. Aliases added: `manager-free`, `review-free`,
`code-free`, `free-overflow`, `go-fast`, `go-general`, `go-review`,
`go-review-plus`, `go-code`, `go-visual`, `go-escalation`, `ollama-fallback`.
Fallback chain: opencode-go (primary kimi-k2.7-code) -> opencode-zen
deepseek-v4-flash-free -> ollama-cloud deepseek-v4-flash:0731. Free Zen
models are NON-SENSITIVE ONLY; sensitive/work contexts route to Go, Ollama
Cloud, or Codex. No product source code changed; no Phase 3 work started.

## Current phase

- Phase 0 foundations: complete and verified.
- Phase 1 PDF core reliability through Milestone 3B: complete and verified.
- Phase 2 Infinite Journal: complete and verified; do not reopen without a demonstrated regression.
- Phase 3 annotation UI: not started in this orchestration bootstrap.

## Latest completed milestone

Milestone 3B — PDF Core Reliability, commit `ecb3dd1`.

Implemented and documented:

- hardened PDF search normalization, spacing, match counts, error/cancellation handling, and stale-result suppression;
- one-read PDF import path with deterministic 8 MiB duplicate-read probe;
- Findings 13 and 15 marked resolved;
- full project gate verified green on 2026-08-06.

Note: the one-time orchestration brief saying not to start Milestone 3B arrived after `ecb3dd1` had already been implemented and pushed. Public history was not rewritten.

## Current milestone

No product implementation milestone is currently authorized. The orchestration bootstrap is complete enough for future continuation; wait for explicit user approval before starting annotation UI or another product change.

## Remaining tracked findings

- Finding 16: Notes destination overstates its data coverage — TO DO.
- Finding 18: README architecture claim needs correction — TO DO.
- Finding 19: GitHub CI pipeline — TO DO.
- Finding 20: Firefox/WebKit browser coverage — DEFERRED.
- Annotation UI/editor and later roadmap work remain unimplemented.

## Verification

Latest uninterrupted gate in the authoritative checkout on 2026-08-06:

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test`: PASS — 27 files, 538 passed, 1 skipped
- `npm run test:e2e`: PASS — Chromium, 87 passed, 0 skipped
- `npm run build`: PASS
- `npm audit --omit=dev`: PASS — 0 vulnerabilities

## Orchestration files

`AGENTS.md`, `docs/AI_PROJECT_STATE.md`, and `cntknw-orchestrator/` are
versioned in the repository (AI-context housekeeping commit
`chore(ai): optimize model routing across Zen and Go`).

`docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` is a preserved
unrelated user file; never stage, modify, rename, or delete it.

## Next-session procedure

Load the global `cntknw-orchestrator` skill, read `AGENTS.md` and this file, fetch/verify Git, inspect canonical status/review docs, preserve untracked files, and ask for or infer only an explicitly approved milestone. Do not automatically begin the roadmap’s next item.
