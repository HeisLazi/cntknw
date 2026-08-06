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

**Last completed product milestone:** Phase 3B — Production PDF Annotation
UX (commits `feat(annotations): implement production PDF annotation UX` and,
if review corrections warranted one, a second normal docs/closure commit;
see `git log` for exact SHAs on `main`).

Prior milestone: Phase 3A — Annotation Geometry Architecture, milestone
commit `67f7061` `feat(annotations): establish canonical PDF geometry`,
closed on `main` by the exact-asset retrieval correction (`eb1785f` +
two closure commits).

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
- Phase 3 annotations: Phase 3A canonical geometry and Phase 3B production
  annotation UX (text highlight + region, exact-asset overlay, keyboard,
  confirmation-based deletion) are complete, committed and verified. The
  remaining Phase 3 work is Phase 3C — editable freehand ink/pen drawing
  authoring and Drawing journal blocks (the vector model is preserved but the
  authoring surface is not built). Phase 3 as a whole is therefore NOT fully
  complete.

## Latest completed milestone

Phase 3B — Production PDF Annotation UX, committed on `main`.

Implemented, reviewed and verified:

- application-level annotation creation boundary (`createSourceAnnotation`):
  source exists → asset exists → asset actually linked to that source → page
  positive → kind/anchor schema-valid, with typed errors and no partial writes;
- text-selection → highlight: page-local CSS rects captured only at the
  ADR-0007 CSS-to-canonical boundary, multiline rects preserved, quote captured,
  canonical text anchor persisted against exact `sourceId + assetId + page`;
  cross-page selections are refused with an announced notice (never ambiguous
  geometry);
- region tool (keyboard-reachable, drag on one page → canonical area anchor,
  Escape cancels, degenerate drags ignored, persisted `annotationTool` in the
  workspace resume state via a zod-default — no Dexie schema version bump);
- production overlay as a projection of canonical records per mounted page
  (bounded by the five-page window), exact-asset reads only
  (`getBySourceAssetAndPage`), page unmount/remount reconstructs, no DOM-node
  identity persisted, zoom/resize/reload alignment proven;
- read-only projection of migrated `point` and vector `ink` records; restrained
  preset color editing; confirmation-before-delete (NFR-008) with revision
  guards; visible read/create/update/delete failures with Retry, never silently
  clearing user intent; RevisionConflictError reloads instead of overwriting;
- keyboard + accessibility: keyboard-reachable region tool, tabbable
  annotations with meaningful names, Enter/Space actions, Delete→confirmation,
  Escape cancels/returns focus, notices announced, no colour-only state;
  reduced-motion respected;
- independent adversarial review (MiniMax M-3 via OpenCode, cloning the Phase
  3A review route) — APPROVED WITH CORRECTIONS; the ONE HIGH finding (generic
  "Not saved" swallowed the typed error's user-facing message) was corrected to
  surface the typed message, plus region-tool `isPrimary` and no-op tool-toggle
  guards, each with a regression test; remaining MEDIUM findings (a speculative
  future active-asset helper, stale-snapshot commit matching the established
  zoom pattern, one pure-function perf nit) were assessed and accepted as
  out-of-scope/non-blocking for Phase 3B;
- full project gate verified green on 2026-08-06 (see Verification).

## Current milestone

Phase 3B — Production PDF Annotation UX is complete, committed and verified.
The remaining Phase 3 exit work is Phase 3C: editable freehand pen/drawing
authoring and Drawing journal blocks (AC-008 editable vector drawing, AC-3
source-location inheritance for Drawing blocks). Phase 3 as a whole is not
complete until 3C lands. Phase 3C is NOT yet authorized; do not start it or
Phase 4 without reviewer acceptance of Phase 3B.

## Remaining tracked findings

- Finding 16: Notes destination overstates its data coverage — TO DO.
- Finding 18: README architecture claim needs correction — TO DO.
- Finding 19: GitHub CI pipeline — TO DO.
- Finding 20: Firefox/WebKit browser coverage — DEFERRED.
- Phase 3C remaining scope: editable freehand pen/drawing authoring and
  Drawing journal blocks — NOT STARTED (Phase 3B intentionally deferred it).
- The Phase 3A geometry foundation and Phase 3B production annotation UX are
  no longer open items.

## Verification

Latest uninterrupted gate in the authoritative checkout on 2026-08-06
(Phase 3B corrected tree, exact candidate for commit):

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test`: PASS — 34 files, 591 passed, 1 skipped
- `npm run test:e2e`: PASS — Chromium, 93 passed, 0 skipped
- `npm run build`: PASS
- `npm audit --omit=dev`: PASS — 0 vulnerabilities
- production `dist/` leak scan (geometry-probe / __cntknwProbe /
  harness-client / e2e/harness): 0 matches

## Orchestration files

`AGENTS.md`, `docs/AI_PROJECT_STATE.md`, and `cntknw-orchestrator/` are
versioned in the repository (AI-context housekeeping commit
`chore(ai): optimize model routing across Zen and Go`).

`docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` is a preserved
unrelated user file; never stage, modify, rename, or delete it.

## Next-session procedure

Load the global `cntknw-orchestrator` skill, read `AGENTS.md` and this file, fetch/verify Git, inspect canonical status/review docs, preserve untracked files, and ask for or infer only an explicitly approved milestone. Do not automatically begin the roadmap’s next item.
