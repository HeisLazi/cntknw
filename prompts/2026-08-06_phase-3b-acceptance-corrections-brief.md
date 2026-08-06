# Phase 3B Final Acceptance Corrections — Implementation Brief

Date: 06 August 2026. Manager: Hermes. Implementer: Codex CLI (gpt-5.6-sol, high).

## 1. Repo state (verified by manager)

- Repo: HeisLazi/cntknw, branch `main`, checkout `/home/lazi/Projects/personal/heisprojects/cntknw`.
- HEAD == origin/main == `d5da063ce6cac6c9b58db10e1490e10d0168c637` (Phase 3B committed, pushed).
- Working tree clean EXCEPT the untracked canonical docs ZIP:
  `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` — NEVER stage, modify, or delete it.
- Do NOT commit, do NOT push. Manager commits and pushes after gate + review.

## 2. Milestone

Phase 3B final acceptance corrections. ChatGPT independently reviewed committed
Phase 3B (d5da063) and blocked closure on exactly TWO correctness issues plus
one non-blocking check. Fix the two blockers, apply the non-blocking verdict,
test, and report. Nothing else.

## 3. Scope / non-goals

- Do NOT start Phase 3C or Phase 4. No pen/drawing authoring, no Drawing blocks.
- Do NOT redesign ADR-0007, do NOT change the canonical geometry library, do NOT
  change the migration semantics in `src/legacy/v1/` (no migration bug found).
- No Dexie schema version bump, no new stores, no new indexes, no soft-delete
  migration for annotations. `schemaVersions.ts` must stay untouched.
- Do NOT create a second annotation/knowledge database.
- Do NOT edit any file under `docs/`. The manager owns all doc reconciliation.
- Do NOT commit or push anything.

## 4. Inspect first (authoritative)

- `src/features/reader/PdfAnnotationLayer.tsx` — the overlay; owns pending-create
  state today (`PendingCreate`, `savePending`, `mounted.current` early-returns).
- `src/features/reader/PdfPage.tsx` — mounts the layer per virtualized page.
- `src/features/reader/PdfReader.tsx` — five-page window; where page unmounts.
- `src/features/reader/usePageAnnotations.ts` — exact-asset read per page.
- `src/domain/annotations/annotation.schemas.ts` — `legacyMigration` /
  `geometryStatus: 'converted' | 'fallback'` (lines ~151-214), `AnnotationSchema`.
- `src/lib/geometry` — canonical ↔ viewport projection (reuse; do not change).
- `src/features/reader/reader.css` — `.cn-annotation*` styles (lines ~203-362).
- `src/features/reader/PdfAnnotationLayer.test.tsx` — existing harness
  (PageHarness + real MemoryRepositories).
- `src/application/annotations/create-annotation.ts` — creation use case (unchanged).
- `e2e/harness/harness.ts` + `e2e/browser/harness-client.ts` — in-page harness
  exposes `db` (CntknwDatabase) and `repos`; used by e2e specs.
- `e2e/shell/annotations.spec.ts` — existing Phase 3B specs and helpers.

## 5. BLOCKER 1 — never project legacy fallback sentinels as precise geometry

ADR-0007 §7: `legacyMigration.geometryStatus === 'fallback'` marks legacy
records whose geometry could not be converted; they carry zero-origin sentinel
geometry ONLY to stay schema-valid and preserved. The overlay currently renders
every annotation, projecting sentinel geometry as if it were precise (a
fallback point renders top-left, a fallback ink renders a zero-origin
path/hit target, a fallback area/text renders zero-origin interactive marks).

### Required behavior

For each page's annotation list, partition:

- `positioned` — `legacyMigration` undefined OR `geometryStatus === 'converted'`
  (native + converted): render normally at canonical geometry, exactly as today.
- `fallback` — `geometryStatus === 'fallback'`: DO NOT spatially project, DO NOT
  render any button/mark/hit-target/focusable element, DO NOT delete the record,
  DO NOT fabricate coordinates.

Surface ONE honest, non-spatial, accessible degraded-state indication per page
when `fallback.length > 0`, using the existing notice styling and role
`status` (polite). Text must be restrained and CNTKNW-native; use count-aware
phrasing, e.g.:

- 1: "A legacy annotation on this page could not be positioned precisely."
- n: "N legacy annotations on this page could not be positioned precisely."

`selected` must be derived from the positioned partition only (a fallback
record can never open the actions toolbar, never receive focus, never appear in
`annotationRefs`). Do not change `usePageAnnotations` (it returns everything;
the partition is presentation policy at render time).

### Implementation

- New pure module `src/features/reader/legacyGeometry.ts`:
  - `isLegacyFallback(annotation: Annotation): boolean`
  - `splitAnnotationsByLegacyGeometry(annotations: readonly Annotation[]): { positioned: Annotation[]; fallback: Annotation[] }`
  No React, no DOM. Unit-testable.
- `PdfAnnotationLayer`: use the split; render `positioned` in the existing map;
  render the degraded notice from `fallback`. If a variant style is wanted, add
  a quiet `.cn-annotation-notice--degraded` CSS rule; otherwise reuse the
  existing notice class unchanged. No color-only communication: the notice is
  readable text.

## 6. BLOCKER 2 — pending create intent must survive page virtualization

Today `pendingCreate`/`savingCreate`/`createError` live in PdfAnnotationLayer,
which unmounts when its page leaves the five-page window; `savePending` exits
early on `!mounted.current`, so a write that rejects after unmount silently
destroys the user's only recoverable intent.

### Required behavior

The recoverable pending truth must live ABOVE the virtualized page and contain
ONLY durable/canonical information: `sourceId`, exact `assetId`, 1-based
`page`, annotation `kind`, canonical `anchor`, and failure state/message.
Never store DOM nodes, Selection objects, viewport pixels, or scroll offsets.

The manager's chosen mechanism (implement this): a small external store module.

### Store module — `src/features/reader/pendingAnnotationIntent.ts`

Module-level `Map<string, PendingAnnotationIntent>` keyed by
`pendingIntentKey(sourceId, assetId, page)` (`${sourceId}:${assetId}:${page}` —
isolation between sources/assets/pages is structural).

```ts
export type PendingIntentStatus = 'draft' | 'saving' | 'failed';
export interface PendingAnnotationIntent {
  sourceId: EntityId;
  assetId: EntityId;
  page: number;                     // 1-based
  kind: 'highlight' | 'region';
  anchor: AnnotationAnchor;         // canonical ADR-0007 anchor
  status: PendingIntentStatus;
  errorMessage?: string;            // user-facing message when failed
}
```

API (all pure JS, no React in the store core):
- `pendingIntentKey(sourceId, assetId, page): string`
- `getPendingIntent(sourceId, assetId, page): PendingAnnotationIntent | null`
- `putPendingIntent(intent: PendingAnnotationIntent): void` — new object each
  call (React snapshot identity depends on it); notify listeners.
- `clearPendingIntent(sourceId, assetId, page): void`
- `clearDraftIntentsForSource(sourceId): void` — removes only `status==='draft'`
  entries for a source (in-flight/failed entries survive navigation).
- `subscribePendingIntents(listener: () => void): () => void`
- `usePendingIntent(sourceId, assetId, page): PendingAnnotationIntent | null`
  via `useSyncExternalStore` (getSnapshot returns the stable entry object).

### PdfAnnotationLayer changes

Replace local `pendingCreate`/`savingCreate`/`createError` with the store:
`const pending = usePendingIntent(sourceId, assetId, pageNumber);`
Derived: `saving = pending?.status === 'saving'`; `failed = pending?.status === 'failed'`.

- `savePending(intent)`:
  1. `putPendingIntent({ ...intent, status: 'saving', errorMessage: undefined })`
  2. `await createSourceAnnotation(repositories, { sourceId, assetId, page, kind, anchor })`
  3. `await reload()` — safe to call when unmounted (usePageAnnotations guards itself)
  4. `clearPendingIntent(...)` — MUST run even when unmounted
  5. UI side-effects (setSelectedId, selection clear, focus) guarded by
     `mounted.current` as today
  6. catch: `putPendingIntent({ ...intent, status: 'failed', errorMessage })`
     where errorMessage is the existing typed/generic logic (`CntknwStorageError`
     `userMessage`, else 'Could not save the annotation. Your selection is kept — try again.').
     NO early return on unmount in the catch path.
- Selection handler: when collapsed/foreign selection and `pending?.status ===
  'draft'` → `clearPendingIntent`; when `saving` or `failed` → never touch the
  store; a valid selection → `putPendingIntent({...draft})`.
- Region start: clears only a `draft`; ignore the drag entirely when
  `pending?.status === 'failed'` (user must Retry or Dismiss first — the failed
  popover is visible); also return early when `saving`.
- Region end: `putPendingIntent({... intent, status: 'saving'})` then
  `void savePending(intent)` as today.
- Dismiss button: `clearPendingIntent(...)` + `window.getSelection()?.removeAllRanges()`.
- Popover position: recompute AT RENDER from the canonical anchor
  (`canonicalRectToViewport(anchor.boundingRect | anchor.rect, viewport, pageBox)`
  bottom-left) — never persist viewport coordinates in the store.
- Popover rendering per status: draft highlight → "Highlight" button (loading
  while saving); saving region → nothing (parity with today); failed → error
  message + Retry + Dismiss, `role="alert"`.
- Failed-region preview rect: keep projecting the canonical rect as today.

### PdfReader changes

`useEffect(() => clearDraftIntentsForSource(sourceId), [sourceId])` — cleanup
of stale drafts when the reader unmounts or the source changes. In-flight
`saving` and `failed` entries intentionally survive (that is the point).

### Semantics to preserve

- Exactly one intent per (source, asset, page).
- `draft → saving → failed | cleared`; `failed → saving` (Retry) | `cleared`
  (Dismiss); `draft → cleared` (selection collapse / region start / Dismiss).
- A successful write followed by a stale retry must be impossible: success
  clears the entry; Retry only ever re-creates from a `failed` entry.

## 7. NON-BLOCKING CHECK — pointer-events on marks vs text selection

Manager ran a real-Chromium probe (temporary spec, deleted): with the mark
(pointer-events:auto) over the text layer, (a) a drag STARTING on a mark still
created a real text selection AND additionally selected the annotation; (b) a
drag starting on unmarked text crossing a mark created a clean text selection
with no annotation side-effect. Ordinary mouse selection/copy of text
under/through marks works in Chromium.

Verdict: DOCUMENT, do not fix. No code change for this item. Record it in the
report as a non-blocking annotation-interaction hardening item (the residual
wrinkle: a drag starting exactly on a mark also selects that annotation).
Do not redesign the overlay for it.

## 8. Required tests

### Unit — pure modules

- `src/features/reader/legacyGeometry.test.ts`: partition behavior; native
  (no legacyMigration), converted, fallback; mixed lists; empty list.
- `src/features/reader/pendingAnnotationIntent.test.ts`: key isolation across
  source/asset/page; status transitions; `clearDraftIntentsForSource` removes
  only drafts and never saving/failed; subscription notify on put/clear only.

### Component — PdfAnnotationLayer.test.tsx (extend the existing harness)

Seed fallback records by constructing schema-valid `Annotation` objects
(parse through the real `AnnotationSchema` — do NOT go through the repository
create path, which intentionally cannot carry legacyMigration) and return them
from the annotation repository mock/`getBySourceAssetAndPage`.

Blocker 1 proofs:
1. fallback `point` sentinel → no `.cn-annotation--point` element, no focusable
   mark, nothing at top-left;
2. fallback `ink` sentinel → no `.cn-annotation__ink` SVG and no ink target;
3. fallback `area`/`text` sentinel → no `.cn-annotation--region` / `--highlight`
   mark, no focus target;
4. record still present: repository still returns it after render; no delete
   call was made;
5. degraded notice is present and accessible (role status, count-aware text);
6. native and `geometryStatus==='converted'` records render normally at their
   canonical positions (existing positioning assertions still pass).

Blocker 2 proofs (delayed create via a deferred promise wrapping
`repositories.annotations.create`):
- Test A (failure after unmount): delay create → capture/create → unmount the
  page (rerender without the layer) → reject persistence → remount → failed
  popover visible with Retry → Retry succeeds → repository create called
  exactly twice total, final `getBySourceAssetAndPage` returns exactly ONE
  durable annotation, no pending UI remains.
- Test B (success after unmount): delay create → initiate → unmount → resolve
  success → remount → annotation appears from repository, no pending popover,
  no Retry offered, create called exactly once, exactly ONE durable annotation.
- Isolation: a pending intent under (sourceA, assetA, pageN) must not render in
  a layer for (sourceB, assetB, pageN); assert no cross-source popover/notice.

### E2E — real browser (Chromium), new spec `e2e/shell/annotation-fallback.spec.ts`

Import a real PDF, then seed a schema-valid fallback annotation into IndexedDB
through the in-page harness (`window.__cntknw.db` handle — add a small seed
method to `e2e/harness/harness.ts` + typed client in
`e2e/browser/harness-client.ts`; harness-only code, never imported by the
production build). Prove:
- degraded notice visible on the page;
- no spatial mark rendered for it (no `.cn-annotation--*` for that record);
- record survives `page.reload()` (notice still shown; record count unchanged).
If the seed mechanism proves unclean, flag it in the report instead of hacking
production code.

## 9. Files you may touch

New: `src/features/reader/legacyGeometry.ts` (+test), `src/features/reader/pendingAnnotationIntent.ts` (+test), `e2e/shell/annotation-fallback.spec.ts`.
Modified: `src/features/reader/PdfAnnotationLayer.tsx`, `src/features/reader/PdfReader.tsx`, `src/features/reader/reader.css` (only if a degraded variant is added), `src/features/reader/PdfAnnotationLayer.test.tsx`, `e2e/harness/harness.ts`, `e2e/browser/harness-client.ts`.
Untouched: `src/lib/geometry/*`, `src/domain/annotations/*`, `src/data/*` (except nothing), `src/application/annotations/create-annotation.ts`, `docs/*`, `src/legacy/v1/*`, `schemaVersions.ts`, the ZIP.

## 10. Acceptance criteria

- No fallback sentinel geometry is ever spatially rendered or focusable.
- Fallback records are never deleted by the overlay.
- The degraded notice is announced/readable and count-honest.
- Pending intent survives unmount; failed writes are retryable after remount;
  success clears intent; no duplicates; no cross-source/asset leakage.
- All required tests above pass; existing suites stay green.

## 11. Git safety

Never `git add .`, never stage the ZIP, never commit, never push, never amend,
never force-push, never rewrite history. Leave the tree exactly as you found it
plus your intended file changes.

## 12. Report format (return exactly this)

1. Blocker 1 implementation summary + which tests prove each of the 6 points
2. Blocker 2 store architecture + savePending state machine
3. Test A result (create call count, durable count)
4. Test B result (create call count, durable count, no stale retry)
5. Isolation test result
6. Non-blocking pointer verdict (documented)
7. Files changed (new/modified)
8. Targeted test run: files / passed / skipped
9. Full suite: files / passed / skipped (you may run the full unit suite; the
   manager runs the complete final gate)
10. Any deviation from this brief (must be justified)

MILESTONE STATUS: <IMPLEMENTATION COMPLETE | BLOCKED> — then stop.
