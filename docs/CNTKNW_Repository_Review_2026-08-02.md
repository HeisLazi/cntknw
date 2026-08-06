# CNTKNW Repository Review - 2026-08-02

This living audit document tracks the findings and resolutions from the adversarial review of the CNTKNW repository prior to the continuation of Phase 2.

**Baseline Details:**
- **Reviewed Commit**: `51c4861`
- **Local State**: `main` branch, with the preserved unrelated ZIP untracked and untouched.
- **Verification**: Milestone 3B full gate passed after implementation (`npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`, `npm audit --omit=dev`).

---

## Finding 1: Conflict Recovery Still Loses User Text
**Severity**: CRITICAL
**Status**: FIXED AND VERIFIED
**Description**: The current `JournalPane` conflict reload behavior clears the local draft, silently picking the remote version. ADR-0004 intent requires both Truth A (remote) and Truth B (local) to remain visible/recoverable.
**Action**: Implemented an explicit resolution UI (keep saved, use local, copy local text). Added acceptance tests for draft recovery.

## Finding 2: Journal Read Failure Pretends the Journal is Empty
**Severity**: CRITICAL
**Status**: FIXED AND VERIFIED
**Description**: `listBlocks()` catches read errors and defaults to an empty array `[]`, showing "Nothing written yet".
**Action**: Render a safe error/retry affordance instead of masking storage errors.

## Finding 3: Journal Write Failure Needs a Visible Recovery Path
**Severity**: HIGH
**Status**: FIXED AND VERIFIED
**Description**: `flush()` removes items from the pending list before awaiting repository writes. Generic write errors can silently fail, abandoning the user's intent.
**Action**: Retained the pending state until persistence completes. Surfaced write failures visibly and allow retries. Distinguished conflict from quota/unavailable errors.

## Finding 4: Enforce Block Kind/Content Consistency
**Severity**: HIGH
**Status**: FIXED AND VERIFIED
**Description**: Zod schemas do not constrain `kind` to match `content.type`.
**Action**: Used refinements in Zod (`JournalBlockSchema = BaseJournalBlockSchema.refine(...)`) to make mismatched records unrepresentable.

## Finding 5: Do Not Integrate JournalBlockView With the Current Paragraph Save Path
**Severity**: HIGH
**Status**: FIXED AND VERIFIED
**Description**: `JournalPane` currently saves every block with `content.type = paragraph`.
**Action**: Built a kind-aware save path preserving kind-specific metadata (`textOfEditableContent`, `withEditedText`, `contentForKind`) before integrating `JournalBlockView`.

## Finding 6: ProseMirror Boundary is Documented But Not Enforced
**Severity**: MEDIUM
**Status**: FIXED AND VERIFIED
**Description**: Architecture tests do not explicitly forbid `prosemirror-*` imports from leaking into `src/domain`, `src/data`, or `src/application`.
**Action**: Added architectural guards enforcing this boundary (`src/app/architecture.test.ts`).

### [V] FINDING 7: Journal Uniqueness Invariant Bypassed
**Status: FIXED AND VERIFIED**
- Both Memory and Dexie adapters correctly wrap `getOrCreateJournalForSource` in transactional guards.
- Adversarial hardening check (August 2, 2026): Verified that `createJournal` explicitly enforces the `sourceId` uniqueness invariant in both adapters, completely preventing creation of duplicate journals even if called directly bypassing `getOrCreateJournalForSource`.

### [V] FINDING 8: Fractional Rank Collision and Stale Anchor Handling
**Status: FIXED AND VERIFIED**
- Fractional ranking model was hardened. The pure mathematical fractional algebraic sorting was retained.
- Adversarial hardening check (August 2, 2026): A full unit test simulating three concurrent connections proves that structural serialization inside the database transaction boundary (`deps.journals.transact`) guarantees robust allocation. `rankAfter` is invoked atomically inside `createPageLinkedBlock`, preventing identical rank allocation in concurrent insertions. No fallback ID comparisons or random jitter hacks are necessary.

### [V] FINDING 9: Silent Nested Object Clobbering in Autosave
**Status: FIXED AND VERIFIED**
- Deep diff logic introduced to compute explicitly changed scalar leaves inside nested objects like `sourceView` and `layout`.
- Deep merge logic applies accumulated changes on top of remotely-resolved states.
- Adversarial hardening check (August 2, 2026): A full unit test proves that two windows concurrently editing `scrollOffset` and `zoom` respectively will both perfectly preserve their edits across conflict resolution. `pendingChanges` diff in `useWorkspacePersistence`. On `RevisionConflictError`, the exact diff is applied over the freshly fetched remote state, safely merging independent concurrent operations.

## Finding 10: Position-Buffer Implementation Fix is Good; Regression Test is Weak
**Severity**: MEDIUM
**Status**: FIXED
**Description**: `bv-007-position-buffer-scope.spec.ts` manually sets `localStorage` instead of exercising `stashPosition()`.
**Action**: Deleted the manual UI E2E test and added rigorous direct component tests for `stashPosition`, `recoverPosition`, `clearPosition`, including malformed records and expiry in `positionBuffer.test.ts`.

## Finding 11: Make PDF Scrolling Actually Continuous
**Severity**: HIGH PRODUCT/UX
**Status**: RESOLVED — Milestone 3A
**Description**: PDF scrolling previously only tracked `scrollTop` and did not auto-advance the page window, breaking the continuous scrolling requirement (NFR-003).
**Action**: Implemented viewport visibility tracking with IntersectionObserver-backed geometry selection, a bounded five-page window, stable virtual spacers, and first/last-page boundary handling. Playwright proves forward and backward natural scrolling plus the 500-page mount bound.

## Finding 12: Direct Page Navigation Must Move the Reader, Not Only State
**Severity**: MEDIUM
**Status**: RESOLVED — Milestone 3A
**Description**: Tests for direct page, outline, and search navigation previously did not assert the spatial consequence of the navigation.
**Action**: Navigation now requests the target window, waits for its measured page element, scrolls the bounded reader to it, and verifies viewport intersection. Playwright covers direct page entry, outline destinations, and source-search results.

## Finding 13: Search Semantics Need Hardening
**Severity**: MEDIUM
**Status**: RESOLVED — Milestone 3B
**Description**: Search concatenation lacks spacing rules, discarding `matches` counts.
**Action**: Search now joins PDF text items with punctuation-aware spacing and line boundaries, applies Unicode/whitespace/case normalization, reports per-page non-overlapping match counts, propagates extraction failures, and treats cancellation as silent. The search UI retains counts, reports real failures, and guards results/navigation/loading state by search generation so stale searches cannot overwrite newer results. Unit coverage proves normalization, counts, failure handling, cancellation and stale-result suppression; Playwright covers real-document navigation and count display.

## Finding 14: PDF Outline Needs Failure Handling
**Severity**: LOW/MEDIUM
**Status**: RESOLVED — Milestone 3A
**Description**: `PdfOutline` previously lacked an error path for `getOutline()` rejection.
**Action**: Added explicit loading, no-outline, and outline-unavailable states. Rejected extraction is quiet and honest, exposes retry, and is covered by unit tests; valid PDFs with no outline remain distinct.

## Finding 15: Large PDF Import Memory
**Severity**: PERFORMANCE
**Status**: RESOLVED — Milestone 3B
**Description**: The import pipeline copies the full File ArrayBuffer multiple times.
**Action**: Added a deterministic 8 MiB duplicate-read probe. The import UI's metadata inspection and transactional persistence now share the already-read bytes, reducing `File.arrayBuffer()` reads from two to one while retaining pre-write `%PDF-` signature validation and transactional persistence. Browser peak-memory measurement is not portable in this environment; no speculative peak-memory claim or complexity was added.

## Finding 16: Notes Primary Destination Currently Lies About its Data
**Severity**: HIGH PRODUCT TRUST
**Status**: TO DO
**Description**: `NotesRoute` claims to show everything but only loads epistemic claims, lying to users with "Nothing written yet".
**Action**: Temporarily label it as incomplete (or implement a canonical block list without duplicating databases).

## Finding 17: Documentation Requires a Complete Reconciliation
**Severity**: HIGH
**Status**: RESOLVED
**Description**: `CNTKNW_Current_Implementation_Status.md` contains contradictory/outdated state.
**Action**: Completely rewritten to match Phase 2 closure state, identifying Phase 1 PDF reader hardening as the next milestone.

## Finding 18: README Must Match the Actual Architecture
**Severity**: MEDIUM
**Status**: TO DO
**Description**: `README.md` implies all UI durable actions flow through use cases, which contradicts architectural tests allowing direct repository interaction.
**Action**: Correct the documentation boundary claim.

## Finding 19: Consider GitHub CI
**Severity**: DEVELOPMENT HYGIENE
**Status**: TO DO
**Description**: The repo lacks a CI pipeline to independently observe verifiable green builds.
**Action**: Add a basic `.github/workflows/verify.yml` executing the gate.

## Finding 20: Browser Coverage
**Severity**: DEFERRED HARDENING
**Status**: DEFERRED
**Description**: Playwright runs only in Chromium.
**Action**: Document this limitation. Firefox/WebKit testing is deferred until public release candidate phase.

## Finding 21: Phase 2 Acceptance Hardening Run
**Severity**: CLOSURE
**Status**: RESOLVED
**Description**: Phase 2 required final evidence that it safely handles concurrent rank allocation, persistent paragraph formatting over block kind changes, and data integrity invariant checks at the final boundaries.
**Action**: 
- Validated concurrent transactional rank reallocation explicitly to resolve IDB overlap edge cases.
- Ensured formatting UI gracefully manages and preserves draft text across unexpected block transformations (`changeBlockKind`).
- Verified IndexedDB and Memory adapters strictly enforce domain invariants when assembling merged records before commit.
- Final failure-safe conflict resolution implemented at `9094220`. Retains local truth (draft, edits, conflict UI) safely without discarding it before remote fetching succeeds.
- Real gate (Typecheck, Lint, Test, E2E, Build) verified as passing. Phase 2 closure achieved.

---

## Phase 3A Annotation Geometry Architecture

**Status**: VERIFIED BY MANAGER AND INDEPENDENT REVIEW — COMMITTED; PRODUCTION ANNOTATION UI NOT YET IMPLEMENTED

ADR-0007 now settles exact asset and 1-based page identity, strict normalized
unrotated page coordinates, explicit text/area/point/ink anchors, vector ink,
rotation, multiline selections and asset replacement. The existing annotation
store advances transactionally to schema version 2; every legacy record is
converted or retained with an explicit fallback-geometry marker. A pure
DOM-free conversion library and a test-only real-reader probe verify zoom,
bounded virtualization and persistence/reload alignment. No production
annotation UI was added, and no previous finding was reopened.

**Closure correction (exact-asset retrieval).** ADR-0007's identity tuple is
`(sourceId, assetId, page, annotationId)`, but `AnnotationRepository` exposed
`getBySourceAndPage(sourceId, page)` with no assetId — an unsafe cross-asset
access path for a renderer displaying a replacement asset. Closure replaced
it with `getBySourceAssetAndPage(sourceId, assetId, page)` in the interface
and both adapters (Memory: three-field filter; IndexedDB: existing
`[sourceId+page]` index plus an in-JS assetId filter — no schema bump, no v3
migration). `getBySourceAndPage` was removed; it had no production callers.
A two-asset same-source same-page adversarial contract test now runs against
both adapters (asset A/page 7 and asset B/page 7 never leak into each
other's results; page mismatch returns empty; `getBySource` still
intentionally returns both assets' annotations), and an application-level
test guards the Phase 3B renderer seam against replacement-asset leakage.
Merged annotation records still validate through `AnnotationSchema` on
create and update in both adapters. Boundary note for Phase 3B: the
repository validates record shape only; confirming that an `assetId`
belongs to its `sourceId` is the production annotation creation use-case's
responsibility, not the repository contract.

Findings 16, 18, 19 and 20 remain open/deferred exactly as before.

## Phase 3B Production PDF Annotation UX

**Status**: VERIFIED BY MANAGER AND INDEPENDENT REVIEW — COMMITTED; PHASE 3C PEN/DRAWING AUTHORING NOT STARTED

Phase 3B turns the Phase 3A architecture into a real production experience in
the PDF Study Workspace without redesigning ADR-0007 canonical geometry. The
application-level creation boundary (`createSourceAnnotation`) fulfils the
Phase 3A boundary note: it is the layer that confirms an `assetId` belongs to
its `sourceId`, so a repository call can never silently write an annotation
under an unrelated asset. It validates, in order: source exists → asset
exists → asset actually linked to that source → page positive → kind/anchor
schema-compatible, failing visibly with typed errors and no partial writes.

- Text selection → highlight: page-local CSS rects are read from the pdf.js
  text layer and converted to canonical ADR-0007 anchors ONLY at the CSS→
  canonical boundary; multiline rects preserved; the quote is captured; the
  record persists against the exact `sourceId + assetId + page`. Cross-page
  selections are refused with an announced notice — never attached to ambiguous
  geometry. The old source+page-only access path is never reconstructed; every
  rendered page reads `getBySourceAssetAndPage(sourceId, assetId, page)`.
- Region tool: a keyboard-reachable toggle; drag on one rendered page → canonical
  area anchor; Escape cancels; degenerate drags are no-ops. The selected tool is
  persisted in the workspace resume state (`annotationTool` on `SourceView`,
  a zod default — no Dexie schema version/index change).
- Overlay renderer: per-mounted-page projection of canonical repository records,
  bounded by the reader's five-page window, tolerating page unmount/remount and
  never persisting DOM-node identity. `pointer-events` keep the layer from
  blocking text selection; the page isolates its own stacking context.
- Supported kinds: highlight/area are fully interactive; migrated `point` and
  vector `ink` records render read-only and cannot crash or corrupt the page.
  Restrained preset colour editing and confirmation-before-delete (NFR-008)
  with revision guards; read/create/update/delete failures are visible with
  Retry and never silently clear user intent; `RevisionConflictError` reloads
  instead of overwriting; in-flight async work is unmount-safe.
- Keyboard/accessibility (AC-015): keyboard-reachable region tool, tabbable
  annotations with meaningful names, Enter/Space actions, Delete → confirmation,
  Escape cancels/returns focus, notices announced; no colour-only state;
  reduced-motion respected.

**Independent adversarial review (MiniMax M-3, OpenCode; cloned the Phase 3A
review route): APPROVED WITH CORRECTIONS.** Findings and disposition:

- HIGH (fixed): the create-failure notice surfaced a generic "Not saved" and
  swallowed the typed error's `userMessage`. Corrected to surface the typed
  message (with a generic fallback) and to retain the selection; regression
  test added.
- MEDIUM (fixed): the region tool's pointer-down accepted multi-touch
  secondary pointers; added an `isPrimary` guard (test switched to a realistic
  `user.pointer` event). A no-op region-tool toggle committed unchanged state
  and bumped the workspace revision; added an early return. Each corrected with
  a regression test.
- MEDIUM (assessed, non-blocking, out of 3B scope): a speculative future
  "active asset" helper for `assetId` (the product has exactly one content
  asset per source today and `primaryAsset.id` is the loaded asset — a hook is
  unwarranted until a second selectable asset exists); stale-`sourceView`
  commit snapshot matching the established zoom-persistence pattern (drift-merged
  fresh value) — to revisit with any active-asset work; one pure-function
  perf nit on the renderer (negligible; memo decided against on a pure call).
- The reviewer explicitly permitted the MEDIUM findings to land in a follow-up;
  the HIGH was required in this milestone and is fixed.

Full Phase 3B gate verified green on 2026-08-06 (typecheck, lint, 34 files /
591 passed / 1 skipped, Chromium e2e 93 passed, build, audit 0 vulns, and a
production `dist/` leak scan with 0 matches).

Findings 16, 18, 19 and 20 remain open/deferred exactly as before, unchanged
by this milestone.

---

## Acceptance-corrections review — Phase 3B final (2026-08-06, after d5da063)

ChatGPT's milestone review of committed Phase 3B blocked final closure on two
correctness issues; an independent adversarial review of the correction delta
was then run on MiniMax M3 (via OpenCode, read-only). The reviewer was given
the uncommitted delta (`legacyGeometry.ts`, `pendingAnnotationIntent.ts`,
`PdfAnnotationLayer.tsx`/`PdfReader.tsx` changes, harness seed, and all new
tests) and a twelve-point attack brief. Verdict: **APPROVED WITH CORRECTIONS**.

Attack matrix (fallback sentinel rendered / fallback deleted / degraded notice
inaccessible / intent tied to DOM-viewport / retry duplication / stale retry
after success / source-asset leakage / virtualization remount races / region
flow / selectionchange handler / harness isolation / test quality): all CLEAN
except one finding:

- **MEDIUM (fixed before commit):** stale-closure race in the
  `selectionchange` handler — the guard and draft-clear read render-time
  `pending`, so a collapsed-selection event landing in the micro-gap after
  `putPendingIntent('saving')` could transiently clear the in-flight intent.
  No data loss or duplication was possible (the success/failure continuations
  unconditionally rewrite the store), but the handler now reads the live store
  (`getPendingIntent`) for both the `saving|failed` guard and every draft-clear
  branch, and `handleRegionStart` does the same; effect deps no longer depend
  on store status. A regression test proves a collapsed selection change never
  clears a `saving` intent and still clears a `draft`.
- **LOW (assessed, non-blocking, deferred):** module-map lifetime of abandoned
  `failed` intents (bounded per source/asset/page; TTL or retry cap is a
  future hardening option); `useSyncExternalStore` getSnapshot closure identity
  (safe — value identity is stable); `crossPageNotice` local state lost on page
  remount (minor UX; the selection itself is refused either way).

Non-blocking pointer check from the milestone brief: marks use
`pointer-events: auto`, but a real-Chromium probe showed ordinary mouse
selection/copy of text under/through marks still works; a drag starting
exactly on a mark also selects that annotation (documented as an annotation
interaction hardening item, deliberately not redesigned in this milestone).

Final acceptance-corrections gate verified green on 2026-08-06 (typecheck,
lint, 36 files / 605 passed / 1 skipped, Chromium e2e 94 passed, build,
audit 0 vulns, and a production `dist/` leak scan with 0 matches).

Findings 16, 18, 19 and 20 remain open/deferred exactly as before, unchanged
by the acceptance corrections.

## Phase 3C Editable Freehand Pen/Drawing Authoring + Drawing Journal Blocks (2026-08-06)

Phase 3C implements the last Phase 3 piece: editable vector drawing authoring
as journal Drawing blocks. Review of the committed candidate tree and the
corrections applied across the review/gate loop:

- **Typed vector model (AC-008).** `drawingData` is no longer a loose blob;
  `DrawingDataSchema` is `version:1`, canvas-local `width`/`height`
  (viewBox units — never PDF or viewport coordinates), and
  `strokes: {id, color, width, opacity?, points[]}` with min-2 finite points
  and a `superRefine` point-bounds check. No database schema/version change
  (block content is a JSON blob). Strokes persist and render as SVG `<path>`
  data; no raster conversion anywhere. Junk and out-of-canvas data are
  rejected by tests.
- **Capture and editor.** Pointer events become canvas-local points at the
  DOM boundary (`getBoundingClientRect` + viewBox scaling), `isPrimary` guard,
  `setPointerCapture`, 0.5-unit point sampling, 2-unit minimum travel so
  degenerate drags are ignored. The `DrawingCanvas` is plain SVG (no new
  dependency): draw, select a stroke, Delete/undo/clear-with-confirmation
  (NFR-008), restrained colour/width presets, Escape exits edit with focus
  returned, Enter opens edit, a `role="status"` live region announces changes,
  honest empty and read states.
- **Save path.** `pendingEdit.ts` discriminates text vs whole-content edits so
  drawing content travels the same debounced, revision-guarded flush as text.
  Conflicts surface a textual summary ("Drawing — N strokes"); failures stay
  visible with Retry; `flushAll` on pagehide/visibility covers drawing edits.
  Commit preserves the optional `previewDataUrl` so an existing raster
  thumbnail is never discarded by an edit (M1).
- **Page inheritance (AC-003).** "Draw a sketch." creates a drawing block via
  `createPageLinkedBlock`, inheriting the active page — proven in unit and e2e.
- **Trash/restore (NFR-008).** Deleting a block with a pending drawing flush
  newest vector before soft-delete (restore never resurrects a stale version);
  a trailing blank text edit never clobbers last-saved writing (regression
  fixed); if a delete-triggered flush fails the user gets a visible notice
  with Retry instead of a silent no-op (H1).
- **Accessibility (AC-015).** Labelled tab-ordered buttons, stroke selection
  via Enter/Space/Delete, Escape exits, live-region announcements, meaning
  never conveyed by colour alone.
- **Independent adversarial review (MiniMax M-3, OpenCode, read-only):**
  APPROVED WITH CORRECTIONS. The three required corrections — H1
  (delete feedback when a flush fails), M1 (preserve `previewDataUrl`), M5
  (e2e network filter no longer allows `data:` URLs) — were applied with
  regression tests. Remaining MEDIUM/LOW findings (stale-closure snapshot,
  autoFocus mount-only contract, stroke-id non-UUID, focus-after-delete)
  assessed non-blocking/deferred.
- **Manager's own full gate** additionally caught and corrected one regression
  in a pre-existing acceptance test (bv-009 E delete-then-restore: the new
  flush-before-delete persisted a trailing empty text edit over saved text).
- **Final gate (2026-08-06):** typecheck PASS, lint PASS, unit 39 files /
  633 passed / 1 skipped, Chromium e2e 95 passed / 0 failed, build PASS,
  audit 0 vulns, production `dist/` leak scan 0 matches.

Findings 16, 18, 19 and 20 remain open/deferred exactly as before, unchanged
by Phase 3C. Phase 4A (connection picker) is not started, hard-blocked on
ChatGPT acceptance of the Phase 3C milestone.
