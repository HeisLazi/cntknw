# CNTKNW AI Project State

Updated: 2026-08-06
Repository: `HeisLazi/cntknw`
Authoritative checkout: `/home/lazi/Projects/personal/heisprojects/cntknw`
Branch: `main`

Volatile repository HEAD fields (local HEAD, origin/main and the
"matches origin" relationship) are NOT recorded here. They always
change when a milestone lands, and a state file that stores them
goes stale the next commit. Git is authoritative: derive HEAD from
`git rev-parse HEAD` / `origin/main` at session start.

**Last completed product milestone:** Phase 3A — Annotation Geometry
Architecture (milestone commit `67f7061` `feat(annotations): establish
canonical PDF geometry`, plus the Phase 3A closure-pass correction whose
commit SHA is in Git history; see `git log`).

Prior milestone: Milestone 3B — PDF Core Reliability, commit
`ecb3dd19d295e99a976eeb17429d03c065a72f68`.

The AI routing/bootstrap commit `8197d3683f60d5d0d503dcd6888e0d6888d44413`
(`chore(ai): optimize model routing across Zen and Go`) is recorded here
as historical state only; it is not the live repository HEAD.

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
Cloud, or Codex. At the time of that routing-only commit, no product source
code had changed and Phase 3 had not started.

## Current phase

- Phase 0 foundations: complete and verified.
- Phase 1 PDF core reliability through Milestone 3B: complete and verified.
- Phase 2 Infinite Journal: complete and verified; do not reopen without a demonstrated regression.
- Phase 3 annotations: Phase 3A canonical geometry architecture is complete,
  committed and verified; production annotation UI (Phase 3B) is not yet
  implemented.

## Latest completed milestone

Phase 3A — Annotation Geometry Architecture, committed on `main`.

Implemented, reviewed and verified:

- ADR-0007 canonical geometry: exact `(sourceId, assetId, page, annotationId)`
  identity, normalized unrotated page coordinates, `text | area | point | ink`
  anchors, vector ink, rotation-aware projection;
- schema-v2 transactional migration of legacy opaque geometry, no data loss;
- pure DOM-free geometry conversion library with property tests;
- real-reader Playwright proof of zoom, virtualization/remount and
  persistence/reload alignment (AC-007);
- Phase 3A closure: exact-asset page retrieval
  (`getBySourceAssetAndPage(sourceId, assetId, page)`) replaced the unsafe
  `getBySourceAndPage` (removed; it had no production callers), with a
  two-asset same-source same-page adversarial contract test on BOTH Memory
  and IndexedDB adapters and an application-level asset-replacement safety
  test;
- full project gate verified green on 2026-08-06.

Note: the one-time orchestration brief saying not to start Milestone 3B
arrived after `ecb3dd1` had already been implemented and pushed. Public
history was not rewritten.

## Current milestone

Phase 3A — Annotation Geometry Architecture is complete, committed and
verified. No further product milestone is currently authorized. The next
authorized implementation milestone, after reviewer acceptance of Phase 3A
closure, is Phase 3B — production annotation UX (selection, toolbar,
highlight rendering, editing, keyboard accessibility). Phase 3B has NOT
started; do not mark Phase 3 itself complete.

## Remaining tracked findings

- Finding 16: Notes destination overstates its data coverage — TO DO.
- Finding 18: README architecture claim needs correction — TO DO.
- Finding 19: GitHub CI pipeline — TO DO.
- Finding 20: Firefox/WebKit browser coverage — DEFERRED.
- Production annotation UI/editor and later roadmap work remain unimplemented;
  the Phase 3A geometry foundation is no longer an open item.

## Verification

Latest uninterrupted gate in the authoritative checkout on 2026-08-06
(Phase 3A closure tree):

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test`: PASS — 30 files, 563 passed, 1 skipped
- `npm run test:e2e`: PASS — Chromium, 90 passed, 0 skipped
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
