# Phase 3A — Annotation Geometry Architecture: Implementation Brief

**Date:** 2026-08-06
**Issued by:** Hermes (manager) to Codex CLI (primary architecture implementer)
**Model:** gpt-5.6-sol, reasoning effort high
**Milestone:** Phase 3A — Annotation Geometry Architecture (stakeholder-authorized)

---

## 1. Verified repository state (do not re-derive; re-verify before acting)

- Checkout: `<repo-root>` (repo `HeisLazi/cntknw`)
- Branch: `main`; local HEAD == origin/main == `8197d3683f60d5d0d503dcd6888e0d6888d44413`
- Untracked file that MUST be preserved byte-for-byte and NEVER staged:
  `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`
- The working tree already contains one small doc edit by Hermes:
  `docs/AI_PROJECT_STATE.md` (volatile repo-HEAD fields replaced with
  Git-derived semantics). Keep that change; do not revert it.

## 2. Milestone objective

Establish the canonical domain and coordinate architecture required for
reliable PDF annotations. Annotations must remain attached to the SAME source
content through zoom, resize, reload, fit-width, fit-page, continuous
scrolling, bounded page virtualization and devicePixelRatio changes, and must
prepare later support for text highlights, quote anchors, area annotations,
point annotations and editable freehand pen strokes.

**This milestone does NOT implement annotation UX.** No toolbar, no selection
interaction, no production highlight rendering.

## 3. Product invariants that must be preserved (from AGENTS.md)

- AC-003 source-created content inherits active source location
- AC-007 annotation alignment survives zoom, resize, reopen, view-mode change
- AC-008 drawings remain editable vector/object data
- AC-009 editing through a projection edits the same canonical record
- AC-010 alternate views do not duplicate canonical records
- AC-015 core actions remain keyboard accessible
- local-first/offline behavior; one canonical journal per source; Folio Margin;
  no duplicate annotation databases; no silent user-data loss; mandatory
  optimistic-concurrency guards.

## 4. Architecture constraints you must respect (existing code)

- **Domain** (`src/domain/`): Zod schemas authoritative; TS types inferred via
  `z.infer`; create-input types use `z.input` (ADR-0001 §2). Domain modules
  must stay free of React and of `@data` imports (enforced by
  `src/app/architecture.test.ts`).
- **Persistence** (`src/data/`): repository interfaces + `UnitOfWork` +
  mandatory `ConcurrencyGuard` on every revisioned update/delete (ADR-0003).
  Two contract-identical adapters: `adapters/memory/` and
  `adapters/indexeddb/` (Dexie). `db/schemaVersions.ts` is the schema source
  of truth; `db/storageRecords.ts` maps/validates the domain↔storage boundary
  (every read validated, never cast — ADR-0002 §3). `db/database.ts` declares
  every version in order; there is currently NO `.upgrade()` callback.
- **UI must never import an adapter or `@data/db`** (architecture test).
- **`pdfjs-dist` imports** must stay inside `src/features/reader/pdfjs.ts`
  for application code (test code may import `pdfjs-dist` directly if needed,
  but prefer the existing boundary).
- **Reader**: `PdfReader` mounts a bounded virtualized window
  (`PAGE_WINDOW = 2`, five pages), spacers for the rest, IntersectionObserver
  for current page. `PdfPage` renders canvas at
  `viewport = page.getViewport({ scale: zoom })`, backing store ×
  `devicePixelRatio`, CSS size = `floor(viewport.width/height)`. Text layer
  via `new pdfjs.TextLayer(...)` with `--scale-factor` = `viewport.scale`.
  Page numbers are **1-based at the domain boundary** everywhere.
- **E2E**: `playwright.config.ts` → `vite.e2e.config.ts` serves BOTH the app
  and `/e2e/harness/index.html` from one origin (IndexedDB is origin-scoped).
  The harness (`e2e/harness/harness.ts`) exposes `window.__cntknw` and drives
  the public composition. Production build (`vite.config.ts`) must never
  include anything under `e2e/` (existing tests assert this — keep them
  green).
- **Current annotation domain** (`src/domain/annotations/annotation.schemas.ts`):
  `AnnotationSchema` = BaseEntityFields + `sourceId`, `assetId`, `page`
  (1-based positive), `kind` (10-value enum), `geometry` (opaque
  `AnnotationGeometrySchema` with `normalized` flag + raw `data` +
  optional viewport dims), `style`, optional `textAnchor`
  (`TextAnchorSchema` from `src/domain/shared.ts`), `linkedBlockIds`.
  This opaque `geometry` is exactly what the milestone replaces with a
  canonical model. `shared.ts` already has `NormalizedPointSchema` and
  `NormalizedRectSchema` (unconstrained x/y/width/height) and `TextAnchorSchema`
  (used by `PdfLocation`/journal `sourceLocation` — those usages stay).

## 5. Scope — exact deliverables

### 5.1 ADR first: `docs/CNTKNW_ADR_0007_Canonical_Annotation_Geometry.md`

Next ADR number is **0007** (ADR-0006 is the latest). Model the style on
`docs/CNTKNW_ADR_0006_The_Folio_Margin.md`. The ADR must settle, with explicit
reasoning, all of A–J:

- **A. Asset identity.** An annotation identifies the ACTUAL asset
  (`assetId`), not merely a book/source. Reason through `sourceId` +
  `assetId` + `page` (a source can have multiple/replaced assets). PDF page
  number is 1-based. Never store virtualized viewport indices, spacer-derived
  offsets or window positions as canonical identity.
- **B. Page identity.** 1-based PDF page number is canonical.
- **C. Coordinate space.** Canonical geometry must be independent of CSS
  pixels, zoom, canvas resolution, devicePixelRatio and viewport dimensions.
  Recommended (you may refine in the ADR with justification): normalized
  page-local coordinates in the page's **unrotated** frame, x∈[0,1]
  left→right, y∈[0,1] top→bottom, covering the full page box. Define origin,
  axes, range, rotation handling and normalization rules precisely. Conversion
  to/from rendered viewports goes through PDF.js viewport conversion
  primitives (`convertToPdfPoint` / `convertToViewportRectangle`, which are
  rotation-aware) or equivalent pure math — the geometry library itself must
  stay DOM-free.
- **D. Anchor types.** Discriminated union with at least `text`, `area`,
  `point`, `ink`. Do not force different annotation kinds into one ambiguous
  rectangle structure.
- **E. Text anchors.** `quote` (selected text) + `page` + one or more
  geometry rects + optional text offsets/prefix/suffix. No OCR-style fuzzy
  matching in this milestone.
- **F. Area anchors.** Rectangular region independent of rendered scale.
- **G. Ink.** Freehand strokes persist as editable vector path data
  (strokes → normalized points). NEVER flatten to PNG/canvas bitmap. Do NOT
  integrate Excalidraw or tldraw.
- **H. Rotation.** Decide how canonical coordinates behave under page
  rotation. You must include at least one non-zero rotation test.
- **I. Multiple rectangles.** Text selections span lines → `rects[]`, never
  one rect per highlight.
- **J. Asset replacement.** Document semantics when a book's primary PDF
  changes: annotations remain bound to the `assetId` they were created on;
  canonical identity must never silently attach old coordinates to a different
  binary. No full migration UX now.

Also settle (ADR must explain the choice): the relationship between the
existing `kind` enum (highlight/underline/strike/pen/rect/ellipse/arrow/text/
region/bookmark) and the new `anchor` union (a mapping table is enough), and
what happens to the legacy `geometry` and `textAnchor` fields (they are
folded into `anchor`; `TextAnchorSchema` in `shared.ts` remains for
`PdfLocation`).

### 5.2 Domain model — `src/domain/annotations/annotation.schemas.ts`

Evolve the schema (approximate shape; refine as the ADR dictates):

```
Annotation { id, sourceId, assetId, page, kind, anchor, style, linkedBlockIds,
             createdAt, updatedAt, revision }
Anchor (discriminated union, normalized page-local primitives):
  { kind: 'text',  quote, rects: NormalizedRect[], boundingRect: NormalizedRect,
    startOffset?, endOffset?, prefix?, suffix? }
  { kind: 'area',  rect: NormalizedRect }
  { kind: 'point', point: NormalizedPoint }
  { kind: 'ink',   strokes: { points: NormalizedPoint[] }[] }
```

Zod is authoritative. Normalized primitives: decide whether to tighten
`NormalizedPointSchema`/`NormalizedRectSchema` in `shared.ts` (e.g. 0–1 range
refinements) or define annotation-local ones; either is acceptable but the
ADR must say which, and out-of-range geometry must be rejected or normalized
per the ADR (a tolerance epsilon for float rounding is fine). Keep
`CreateAnnotationInput` as `z.input`.

### 5.3 Annotation ↔ journal relationship (NO duplicate data)

Decide explicitly and document in the ADR. Recommended: annotations are
canonical **source markup entities**; the journal remains the canonical
knowledge record; annotations reference journal blocks via the existing
`linkedBlockIds`. A highlight + a journal quote + a map object must never
become three independent truths. Do NOT create a second notes database.

### 5.4 Persistence — reuse the existing `annotations` store

Do NOT add a new store or database. The `annotations` store, both adapters and
`AnnotationRepository` already exist and are contract-tested.

- Bump `CURRENT_SCHEMA_VERSION` 1 → 2 with a new `SCHEMA_VERSIONS[1]` entry
  (same stores; document migration + recovery text per NFR-005).
- Add a real Dexie `.upgrade()` (version 2) that converts legacy
  v1-shaped annotation records (`geometry: {normalized, data, viewportW/H}`
  + optional `textAnchor`) into canonical `anchor` records, following the
  mapping table the ADR defines. Constraints:
  - no record may be silently dropped; every record must remain readable and
    valid after migration;
  - unmappable legacy records must be preserved in some lossy-but-honest form
    (e.g. text anchor carrying the original quote, geometry from viewport
    dimensions when normalized data exists) — the ADR documents the rules;
  - the migration must be transactional (Dexie upgrades already are) so a
    partial migration cannot silently lose data;
  - update `db/database.ts` so version 2 attaches the upgrade, keeping the
    loop-over-declared-versions pattern coherent (a per-version upgrade map is
    fine).
- Update `db/storageRecords.ts` (`StoredAnnotation` = new `Annotation`; both
  mappers validate through `AnnotationSchema`).
- Memory + IndexedDB adapters stay contract-identical; concurrency guards
  unchanged; `AnnotationRepository` interface unchanged (only the record
  shape changes).

### 5.5 Geometry conversion library — pure, DOM-free

New `src/lib/geometry/` module(s) implementing:

- viewport/CSS selection → canonical normalized page coordinates
- canonical → current viewport/CSS coordinates

for rectangles, points and path points. Properties: deterministic; pure (no
DOM, no `window`); no `pdfjs-dist` import (accept a structural
viewport-like argument: `{ width, height, convertToPdfPoint, convertToViewportRectangle }`
or equivalent plain geometry inputs); supports zoom and width/height changes;
handles rotation per the ADR. This library is the trusted boundary future UI
code will use.

### 5.6 Geometry property tests (new, strong)

At minimum (use tolerances, never brittle exact float equality):

- A. round trip: viewport → canonical → viewport ≈ original
- B. zoom independence: capture at 1.0, render at 2.0 → same physical region
- C. resize independence: capture at width W1, render at W2 → correct scaling
- D. devicePixelRatio independence (CSS/display coords never confused with
  backing canvas pixels)
- E. multi-rectangle text selections
- F. path/ink points round trip
- G. first/last page (page 1 and page N)
- H. invalid/out-of-range geometry rejected or normalized per ADR
- I. at least one non-zero rotation case

### 5.7 Domain + migration tests

- `src/domain/annotations/annotation.schemas.test.ts` (new): anchor union
  validation, defaults, out-of-range rejection, `CreateAnnotationInput`
  semantics.
- Update `src/domain/domain.test.ts` (its "legacy non-normalized geometry"
  test at ~line 241 must be replaced with canonical-anchor coverage).
- Migration test: seed a v1-shaped annotation record, open DB at v2, assert
  conversion per the ADR mapping and that nothing is dropped; assert the
  meta schemaVersion is 2. (Use `fake-indexeddb`/`createTestDatabase`; look at
  `src/data/adapters/indexeddb/concurrent.test.ts` for the pattern.)
- Update `src/data/adapters/repository-contract.test.ts` annotation cases
  (~lines 410, 1044) to the new input shape — both adapters must pass
  identical cases.

### 5.8 Minimal integration proof — REAL reader, test-only

Do NOT build the production annotation toolbar. Add the smallest technical
integration proof that the architecture works against the REAL reader:

1. **Reader probe page (test-only):** a new harness page under `e2e/harness/`
   (e.g. `e2e/harness/geometry-probe.tsx` + `geometry-probe.html`) that mounts
   the REAL `PdfReader` with a real PDF (use `makePdf` fixture bytes stored
   through the real import pipeline or served to the probe) and exposes a
   minimal `window.__cntknwProbe` API: import/open PDF at page N, define a
   region on a real rendered page (CSS px), convert to canonical via the
   library, set zoom, ask for the rendered rect of a canonical geometry,
   navigate/scroll so a page unmounts and remounts, and read real DOM
   geometry. This page is served ONLY by `vite.e2e.config.ts` and must never
   enter the production build (keep the existing production-build guards
   green).
2. **E2E spec** `e2e/shell/annotation-geometry.spec.ts` proving, against the
   real reader:
   - region defined on a real page → canonical → rendered rect covers the
     same source region (AC-007 architectural viability);
   - zoom change: canonical rect still covers the same region;
   - virtualization: canonical geometry for a page → scroll far enough that
     the page unmounts → return → page remounts → reconstructed geometry
     still aligns (no dependence on retained DOM nodes);
   - persistence/reload: create a canonical annotation through the real
     `AnnotationRepository` (extend `e2e/harness/harness.ts` `window.__cntknw`
     with annotation create/get methods) → reload page → retrieve → convert →
     same source region.
   Assert with pixel tolerances.

### 5.9 Accessibility boundary

No UI this milestone, but document accessibility implications in the ADR:
highlights cannot be visual-only forever; annotations need semantic
discoverability; source-linked annotation navigation will need keyboard
support; focus must be able to move between the journal representation of an
annotation and the source region. Do not build any of it.

### 5.10 Documentation updates

- `docs/CNTKNW_ADR_0007_Canonical_Annotation_Geometry.md` (new)
- `docs/CNTKNW_Documentation_Index.md` — add ADR-0007 to the approved
  amendments read order (item numbering follows existing style)
- `docs/CNTKNW_Current_Implementation_Status.md` — Phase 3A state, domain
  table annotation row, limitations, verification totals after your local run
  (state them as YOUR run; Hermes re-runs the final gate)
- `docs/AI_PROJECT_STATE.md` — current milestone section: Phase 3A
  architecture complete; production annotation UI NOT YET IMPLEMENTED; do not
  mark Phase 3 itself complete. Preserve Hermes's volatile-HEAD edit at the
  top.
- `docs/CNTKNW_Repository_Review_2026-08-02.md` — only if your work resolves
  or surfaces an annotation-geometry finding; otherwise note Phase 3A landing
  where the status line suggests.

## 6. Explicit non-goals

- No annotation toolbar, selection UX, highlight rendering, or any annotation
  UI in production routes.
- No Excalidraw, tldraw, or third-party annotation framework. No new npm
  dependencies at all.
- No Phase 3B, no drawing UI, no other roadmap milestone.
- No v1 (`legacy-v1` / `philosophy-journal`) writes; v1 readers untouched.
- Do not change reader rendering behavior, virtualization, or resume logic.
- Do not modify `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`.

## 7. Acceptance criteria

1. ADR-0007 exists and settles A–J + the kind↔anchor mapping + annotation↔
   journal relationship + asset-replacement semantics.
2. Domain schema is the canonical discriminated-union anchor model; all
   existing tests updated; `tsc --noEmit` clean.
3. Schema v2 with transactional upgrade migration; memory and indexeddb
   adapters pass the identical contract suite.
4. Pure geometry library with property tests A–I passing.
5. Reader probe + e2e spec prove AC-007 viability, virtualization
   independence and persistence/reload round trip against the real reader.
6. Full local gate green: `npm run typecheck && npm run lint && npm run test
   && npm run test:e2e && npm run build && npm audit --omit=dev`.
7. Production build contains no e2e/harness artifacts (existing guards pass).
8. All docs updated; no invariant violated; no architecture-test violations.

## 8. Git safety (STRICT)

- **DO NOT commit. DO NOT stage. DO NOT push.** Leave the working tree with
  your changes (plus Hermes's AI_PROJECT_STATE.md edit) uncommitted. Hermes
  verifies the diff, runs independent review, then stages intentionally and
  commits with message:
  `feat(annotations): establish canonical PDF geometry`
- NEVER touch `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`.
- Never use `git add .`; never amend, force-push, or rewrite history.
- Run `git status --short` before finishing and include it in your report.

## 9. Report format (return this)

1. Summary of ADR decisions A–J in one line each
2. Files created/changed (complete list)
3. Canonical coordinate definition + rotation model (as implemented)
4. Migration semantics for legacy annotation records
5. Exact unit test totals (files, passed, skipped) and e2e totals from YOUR run
6. Gate results from YOUR run (each of the six commands)
7. Any deviations from this brief and why
8. `git status --short` at the end

## 10. Reference material (read before designing)

- `src/features/reader/PdfReader.tsx`, `PdfPage.tsx`, `pdfjs.ts`, `reader.css`
- `src/domain/annotations/annotation.schemas.ts`, `src/domain/shared.ts`
- `src/data/db/schemaVersions.ts`, `src/data/db/database.ts`,
  `src/data/db/storageRecords.ts`
- `src/data/adapters/memory/index.ts` (annotations section),
  `src/data/adapters/indexeddb/index.ts`
- `src/data/adapters/repository-contract.test.ts`, `src/data/adapters/indexeddb/concurrent.test.ts`
- `src/domain/domain.test.ts`, `src/app/architecture.test.ts`
- `e2e/harness/harness.ts`, `e2e/harness/index.html`,
  `e2e/browser/harness-client.ts`, `e2e/shell/pdf-spatial-reliability.spec.ts`,
  `e2e/fixtures/makePdf.ts`
- `vite.config.ts`, `vite.e2e.config.ts`, `playwright.config.ts`, `package.json`
- `docs/CNTKNW_ADR_0006_The_Folio_Margin.md` (ADR style),
  `docs/CNTKNW_ADR_0001_Phase_0B_Foundations.md` (domain conventions)

External architectural reference (inspiration only — CNTKNW owns its schema;
do not import their code): react-pdf-highlighter stores per-line rects +
boundingRect with page number, normalizes against the rendered page's CSS
size, and uses PDF.js viewport conversion primitives for rotation-aware
transforms (`agentcooper/react-pdf-highlighter`, `src/lib/coordinates.ts`).
