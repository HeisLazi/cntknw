# CNTKNW AI Project State

Updated: 2026-08-06
Repository: `HeisLazi/cntknw`
Authoritative checkout: `<repo-root>`
Branch: `main`

Volatile repository HEAD fields (local HEAD, origin/main and the
"matches origin" relationship) are NOT recorded here. They always
change when a milestone lands, and a state file that stores them
goes stale the next commit. Git is authoritative: derive HEAD from
`git rev-parse HEAD` / `origin/main` at session start.

**Last completed product milestone:** WORKSPACE UX-1 — the Zen/Gruvbox
study desk, infinite whiteboard and Pomodoro (committed on `main`). This is
the study-workspace completion record pending the ChatGPT milestone review
of the UX-1 acceptance (see the Latest milestone section).

Prior milestone: Phase 3C — Editable Freehand Pen/Drawing Authoring +
Drawing Journal Blocks (commits on `main`; see `git log` for exact SHAs).
This completed Phase 3 (Annotation & Drawing) in full.

Prior milestone: Phase 3B — Production PDF Annotation UX, closed on `main`
by the final acceptance-corrections commits (`889e938` fix → `8158fec`
docs → `a880711` lint repair).

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
- Phase 3 annotations & drawing: Phase 3A canonical geometry, Phase 3B
  production annotation UX (text highlight + region, exact-asset overlay,
  keyboard, confirmation-based deletion), and Phase 3C editable freehand
  pen/drawing authoring + Drawing journal blocks (typed canvas-local vector
  model, SVG freehand editor, content-replacement save path) are all
  complete, committed and verified. Phase 3 as a whole is complete.
- WORKSPACE UX-1 (Zen/Gruvbox study desk + infinite whiteboard +
  Pomodoro): complete, committed and verified (see Latest milestone).

## Latest completed milestone

WORKSPACE UX-1 — the Zen/Gruvbox study desk, infinite whiteboard and
Pomodoro, committed on `main`.

Implemented, reviewed and verified:

- design system: `src/design/tokens.css` is the single styling source of
  truth (Zenburn/Gruvbox-inspired dark), enforced by
  `design-tokens.test.ts` (no raw hex/durations outside tokens.css);
- workspace layout: `WorkspaceLayoutSchema` gains `mode`
  (split | source-focus | journal-focus | compare) and `rightWorkspace`
  (write | whiteboard), default split 0.7, persisted; the shell + context
  panel use a first↔last focus trap over `role="dialog"` `aria-modal`
  containers; source-focus is a full-width projection;
- journal blank-page composing: a source opens to a single "Write…"
  placeholder that composes blocks on Enter; the ghost action row stays
  mounted (`hidden` toggle) so the menu trigger node never remounts on a
  focus re-render; the Menu primitive opens on primary `pointerdown` with
  the follow-up click suppressed while keyboard activation (`detail === 0`)
  still toggles — restoring mouse/keyboard parity on empty composing blocks;
- infinite whiteboard: `rightWorkspace = whiteboard` projects the same
  canonical journal blocks as the write pane (a projection, not a second
  store); `DrawingData.strokes` unchanged; saves travel
  `createPageLinkedBlock` + the `pendingEdit` revision-guarded flush;
  on `RevisionConflictError` the flush preserves BOTH truths — the local
  pending edit stays pending, the remote block is re-read and summarized,
  and a restrained conflict notice offers explicit Keep Saved / Use My
  Version (revision-guarded reapply, Retry on failure); Delete/Clear and
  destructive history are blocked while unresolved, and local Undo/Redo
  history is invalidated on conflict so stale snapshots cannot replay;
  whiteboard text edits reuse the synchronous draftBuffer recovery and
  whole-content edits flush on pagehide/visibilitychange/cleanup;
  projection membership (`WhiteboardState.layout`) is presentation state —
  whiteboard-authored objects are filtered out of the Write projection so
  the blank writing surface stays clean, with one canonical record per
  object and no duplicate projection records;
- Pomodoro: pure reducer over an in-memory wall-clock deadline;
  zero network writes, zero per-second persistence writes (start = 1 create,
  0 updates; transitions only), `pagehide` flushes the snapshot (§
  PomodoroProvider);
- full project gate verified green on 2026-08-06 (see Verification).

See `docs/CNTKNW_ADR_0008_Zen_Study_Workspace.md` for the decision record.

### Previous milestone

- typed vector drawing model replacing the loose `drawingData` blob
  (`DrawingDataSchema`): `version: 1`, canvas-local `width`/`height`
  (viewBox units, never PDF or viewport coordinates), strokes of
  `{id, color, width, opacity?, points[]}` with min-2 finite points and a
  `superRefine` bound check keeping every point inside the canvas; old
  placeholder fixtures updated; no database schema/version change (block
  content is a JSON blob);
- `drawingCapture.ts`: DOM-boundary pointer→canvas-local conversion via
  `getBoundingClientRect` + viewBox scaling, `isPrimary` guard,
  `setPointerCapture`, 0.5-unit point sampling and 2-unit minimum travel so
  degenerate drags are ignored;
- `DrawingCanvas.tsx`: plain-SVG freehand editor — draw (pointerdown/move/up
  commits a stroke), select a stroke, Delete/undo/clear-with-confirmation
  (NFR-008), restrained colour (Graphite/Verdigris/Ochre) and width
  (Fine/Regular/Broad) for the next stroke, Escape exits edit mode with focus
  returned, Enter opens edit, `role="status"` live region announces every
  change, honest empty/read states, no raster conversion anywhere — strokes
  persist as vector `<path>` data (AC-008);
- capture path: "Draw a sketch." beside "Start writing." creates a drawing
  block through the existing `createPageLinkedBlock`, inheriting the active
  page automatically (AC-003);
- save path: `pendingEdit.ts` discriminates text vs whole-content edits;
  drawing content travels the SAME debounced, revision-guarded flush as text
  (`applyPendingEdit`), conflicts surface a textual summary ("Drawing — N
  strokes"), failures stay visible with Retry, `flushAll` on
  pagehide/visibility covers drawing edits — no silent stroke loss;
- soft delete/restore unchanged for drawing blocks (NFR-008); deleting a
  block with a pending drawing flushes the newest vector first so Restore
  never resurrects a stale version, while a trailing blank text edit never
  clobbers last-saved writing (regression covered);
- keyboard/accessibility (AC-015): labelled tab-ordered controls, stroke
  selection via Enter/Space, no colour-only meaning;
- independent adversarial review (MiniMax M-3 via OpenCode, read-only) of
  the Phase 3C delta: APPROVED WITH CORRECTIONS — the three required
  corrections (H1 delete-intent feedback when a flush fails, M1
  `previewDataUrl` preserved across edits, M5 e2e network filter no longer
  allows `data:` URLs) were applied with regression tests; remaining
  MEDIUM/LOW findings assessed non-blocking;
- the manager's own full gate additionally caught and corrected one
  regression in a pre-existing acceptance test (delete-then-restore of a
  block whose trailing debounced edit was blank text now preserves the last
  saved writing in the trash);
- full project gate verified green on 2026-08-06 (see Verification).

### Previous milestone

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

Final acceptance corrections (ChatGPT milestone review at d5da063, closed
2026-08-06):

- **Blocker 1 — legacy fallback geometry policy.** Records with
  `legacyMigration.geometryStatus === 'fallback'` carry zero-origin sentinel
  geometry only to stay schema-valid and preserved; ADR-0007 §7 forbids
  presenting them as precise source geometry. The overlay now partitions
  annotations (`legacyGeometry.ts`): native/converted records render normally
  at canonical geometry; fallback records are NEVER spatially projected,
  rendered, focused, or made selectable, are never deleted or mutated by the
  overlay, and surface one count-honest accessible degraded notice per page
  (`role="status"`): "A legacy annotation on this page could not be positioned
  precisely." (or an N-count variant). Migration semantics unchanged; no
  reattachment workflow added.
- **Blocker 2 — pending create intent lifetime.** Pending annotation creation
  truth now lives ABOVE the virtualized page in an external store
  (`pendingAnnotationIntent.ts`) keyed by `sourceId:assetId:page`, holding only
  canonical fields (sourceId, assetId, 1-based page, kind, canonical anchor,
  status `draft|saving|failed`, user-facing error). `savePending` transitions
  `draft → saving → failed|cleared`; success reloads and clears the entry even
  after page unmount; failure persists a retryable message even after unmount;
  Retry/Dismiss are the only exits from `failed`; drafts are cleared on
  selection collapse, region start, and source change (reader cleanup);
  `saving`/`failed` intents survive navigation. No DOM/Selection/viewport
  pixels are stored — the popover position is recomputed from the canonical
  anchor at render. One intent per (source, asset, page); no duplicates, no
  cross-source/asset leakage.
- Non-blocking pointer check: marks (`pointer-events: auto`) do not prevent
  ordinary mouse selection/copy of underlying text in Chromium (verified by a
  real-browser probe; drags starting on a mark also select the annotation —
  documented as an annotation interaction hardening item, not fixed).
- Independent adversarial review of the correction delta (MiniMax M3):
  APPROVED WITH CORRECTIONS — attack matrix clean; one MEDIUM (stale-closure
  selectionchange race) corrected with a live-store read + regression test;
  three LOW findings (module-map lifetime of abandoned failed entries,
  getSnapshot closure identity, cross-page notice lost on remount) assessed
  non-blocking and deferred.

## Current milestone

Phase 3C — Editable Freehand Pen/Drawing Authoring + Drawing Journal Blocks is
COMPLETE, committed, verified, gated green, and its acceptance-corrections
applied and re-verified. This closes Phase 3 (Annotation & Drawing) in full.
Phase 3C is awaiting the ChatGPT milestone review of its acceptance; Phase 3
is formally complete once that review accepts. Phase 4 (connections,
backlinks, graph/map, and the Phase 4A connection picker) has NOT been
started and must not begin without reviewer acceptance of the Phase 3C
milestone.

## Remaining tracked findings

- Finding 16: Notes destination overstates its data coverage — TO DO.
- Finding 18: README architecture claim needs correction — TO DO.
- Finding 19: GitHub CI pipeline — TO DO.
- Finding 20: Firefox/WebKit browser coverage — DEFERRED.
- Phase 3C scope (editable freehand pen/drawing authoring and Drawing journal
  blocks) — COMPLETE, committed, verified and gated green on 2026-08-06;
  awaiting the ChatGPT milestone review of its acceptance. Phase 4A
  (connections/backlinks/connection picker) remains not started, hard-blocked
  on Phase 3C acceptance.
- The Phase 3A geometry foundation, Phase 3B production annotation UX and
  Phase 3C drawing authoring are no longer open items.

## Verification

Latest uninterrupted gate in the authoritative checkout on 2026-08-06
(WORKSPACE UX-1 tree, exact candidate for commit):

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test`: PASS — 46 files, 684 passed, 1 skipped
- `npm run test:e2e`: PASS — Chromium, 100 passed, 0 skipped
- `npm run build`: PASS
- `npm audit --omit=dev`: PASS — 0 vulnerabilities
- production `dist/` leak scan (geometry-probe / __cntknwProbe /
  harness-client / e2e/harness): 0 matches
- protected `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` and
  `install.sh` remain untracked and byte-identical (never staged).

## Orchestration files

`AGENTS.md`, `docs/AI_PROJECT_STATE.md`, and `cntknw-orchestrator/` are
versioned in the repository (AI-context housekeeping commit
`chore(ai): optimize model routing across Zen and Go`).

`docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` is a preserved
unrelated user file; never stage, modify, rename, or delete it.

## Next-session procedure

Load the global `cntknw-orchestrator` skill, read `AGENTS.md` and this file, fetch/verify Git, inspect canonical status/review docs, preserve untracked files, and ask for or infer only an explicitly approved milestone. Do not automatically begin the roadmap’s next item.
