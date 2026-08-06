# CNTKNW Phase 3C — Editable Freehand Pen/Drawing Authoring + Drawing Journal Blocks

**Milestone:** Phase 3C (completes Phase 3: Annotation & Drawing).
**Repository:** `HeisLazi/cntknw`, branch `main`.
**Baseline (verified by manager):** HEAD == origin/main == `a8807115e2c87a7b8ffc671cf8a13eb6bddca5ec` (Phase 3B final acceptance corrections). Working tree clean except two preserved untracked files: `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` and `install.sh` — never touch, never stage, never delete either.
**Worker:** Codex CLI `gpt-5.6-sol`, reasoning `high`. Implement code + tests ONLY. Do NOT modify docs/, do NOT commit, do NOT push. The manager runs the gate, review, docs, commit, and push.

## Milestone objective

Implement the last piece of Phase 3: **editable freehand pen/drawing authoring and Drawing journal blocks**, satisfying:

- **AC-008** — Editable drawings retain vector/object data rather than only raster output.
- **AC-003** — A drawing created while page N is active inherits page N automatically (source-location inheritance).
- **AC-015** — Core actions keyboard-accessible.
- Product invariants: canonical records/projections, local/offline-first, no silent writing loss, mandatory optimistic concurrency, block identity survives transformations, Folio Margin aesthetic (quiet archival reading room — NOT a neon whiteboard).

Phase 3C is the milestone that lets ChatGPT formally mark Phase 3 complete. Phase 3C must be complete, gated, and reviewed before Phase 4A (connections/backlinks) may start.

## Current state (verified by manager — trust this, then re-inspect the files yourself)

- `DrawingContentSchema` exists in `src/domain/journals/journal.schemas.ts` (~line 139): `{ type: 'drawing', drawingData: z.record(z.unknown()), previewDataUrl: optional string }`. `drawingData` is deliberately loose today — Phase 3C makes it a concrete typed vector model (AC-008).
- `'drawing'` is in the BlockKind union; `JournalBlock` content is a discriminated union on `type`.
- `src/features/journal/JournalBlockView.tsx` → `NonTextualBlock` renders drawing kind as an honest placeholder: "Drawing — not yet displayable. Your content is stored and unchanged."
- `src/application/create-block.ts` → `createPageLinkedBlock(deps, {sourceId, sourceLocation, content, kind, afterBlockId?})` is generic — creating a drawing block with page inheritance (AC-003) needs no new use case. `sourceLocation` carries the active page (INV-004/AC-003 already proven for other kinds).
- `src/features/journal/JournalPane.tsx`: the journal run pane. `addBlock` currently hardcodes `kind: 'paragraph'` (line ~296) and is triggered by the "Start writing." button (line ~516). Save pipeline: `onChange({doc, text})` → `scheduleSave` (debounced) → `flush` (line ~170) → `withEditedText(currentBlock.content, edit)` → `journals.updateBlock({id, content}, expectedRevision(revision))`. Conflict → `conflictData` (shows remote/local TEXT), failure → `failedWrites` + "Retry saving". `flushAll` on pagehide/visibilitychange/cleanup. `removeBlock` → `journals.softDeleteBlock` (soft delete + trash).
- `src/application/change-block-kind.ts` + `src/domain/journals/transform.ts`: kind changes are transform-never-recreate, revision-guarded. `CHANGEABLE_KINDS` (blockVocabulary.ts) is textual-only, so drawing is NOT reachable as a kind-change target — drawing blocks are created through the capture path only. `transform.ts` already has `case 'drawing'` in `canChangeKind`/`textOfContent` (textOfContent(drawing) = '').
- Ink stroke primitive exists in `src/domain/annotations/annotation.schemas.ts` (`InkStrokeSchema { points: AnnotationPoint[] }`) — that is PDF-page **annotation** geometry (ADR-0007). Do NOT reuse it for journal Drawing blocks and do NOT modify annotation schemas. Drawing-block stroke coordinates are canvas-local (see schema below).
- No canvas/graphics library in package.json (verified). Use plain SVG. No new runtime dependency.
- Repository layer: `JournalRepository` (memory + indexeddb adapters, contract suites), revision guards via `expectedRevision` / `RevisionConflictError`. schemaVersions live in the data layer — a bump is required ONLY if tables/indexes change (content is a JSON blob, so a bump should be unnecessary; verify and state the finding).
- Test conventions: Vitest unit suites colocated as `*.test.ts(x)`, Playwright e2e under `e2e/shell/*.spec.ts` (one Chromium project, production path only — the harness exists at `e2e/harness` for seeding, but the core journey must NOT use a test-only implementation path).

## Scope — DO

1. **Typed vector drawing model** (`src/domain/journals/`): replace the loose `drawingData: z.record(z.unknown())` with a concrete zod schema, e.g.:

   ```
   DrawingStrokeSchema = {
     id: string,
     color: string,            // restrained palette default
     width: number > 0,
     opacity: number 0..1 optional,
     points: array of {x: number, y: number}, min 2   // freehand polyline
   }
   DrawingDataSchema = {
     version: literal(1),
     width: number > 0, height: number > 0,            // canvas-local viewBox units
     background: optional string,
     strokes: array of DrawingStrokeSchema
   }
   DrawingContentSchema = { type: 'drawing', drawingData: DrawingDataSchema, previewDataUrl: optional string }
   ```

   Coordinates are CANVAS-LOCAL (0..width/0..height), resolution-independent via SVG viewBox — never PDF page coordinates, never viewport pixels, never DOM nodes (this is the ADR-0007 discipline applied to drawings). `previewDataUrl` stays an optional disposable raster for lazy rendering; the vector strokes are the source of truth. Update the transform test fixtures that used placeholder junk (`drawingData: {strokes:[1]}`, `{strokes:[]}`, `{}`) to schema-valid data. Old empty-drawing creation must produce `{version:1, width:800, height:600, strokes:[]}` (or similar sensible defaults).

2. **Stroke capture helper** (pure, unit-tested, mirroring `annotationCapture.ts` style): pointer events → points (canvas-local via getBoundingClientRect + viewBox scaling), ignore degenerate drags (min 2 points / min distance), `isPrimary` guard, `setPointerCapture`.

3. **DrawingCanvas component** (`src/features/journal/`): SVG freehand editor.
   - Draw: pointerdown starts a stroke, pointermove appends points, pointerup commits. Render strokes as `<path>` polylines.
   - Edit: select a stroke (click), delete selected stroke (Delete key + labelled button), undo (remove last stroke), clear all (with confirmation — NFR-008), restrained color/width choice for the NEXT stroke only.
   - Resize-independent: viewBox scaling; the vector data is what persists.
   - Keyboard: canvas/block focusable; all controls are real labelled buttons in tab order; Escape exits edit mode; a `role="status"` live region announces drawing changes ("Added a stroke. 3 strokes."); no meaning conveyed by color alone (color is a choice, semantic labels carry meaning).
   - Reads: when not editing, render the strokes as SVG (or the previewDataUrl if present) — read state is still honest vector content, never a blank placeholder.

4. **Capture path**: extend the journal creation affordance (next to "Start writing.") with a restrained "Draw a sketch." control that calls `createPageLinkedBlock` with `kind: 'drawing'` and an empty drawing (AC-003 inheritance happens automatically via `sourceLocation`). Auto-focus the new block in edit mode. No giant modal. PDD §7.4 orders Draw #4 in the capture menu; a quiet secondary button is acceptable for this milestone.

5. **Render path**: `JournalBlockView`/`NonTextualBlock` renders drawing blocks via the DrawingCanvas (edit affordance + read view) instead of the placeholder. Mark menu (kind change) must NOT offer converting drawing → text (CHANGEABLE_KINDS is textual-only already — keep it that way; a drawing keeps its identity).

6. **Save path for whole-content edits**: the current pipeline is text-centric (`withEditedText`, conflict UI shows text). Add a content-replacement path: drawing edits are scheduled through the SAME debounce/pending/flush machinery, but flush applies the drawing content directly via `journals.updateBlock({id, content}, expectedRevision(revision))` instead of `withEditedText`. Conflict display for a drawing block shows a textual summary ("Drawing — N strokes") as the local/remote text stand-in so the existing conflict UI works unchanged. Failure → existing `failedWrites` + Retry. `flushAll` on pagehide covers drawings. NEVER silently drop a stroke on unmount/visibility/navigation. Exactly ONE durable truth per update — no duplicate writes.

7. **Deletion/recovery**: existing soft delete (`softDeleteBlock`) + trash — no change needed; a drawing block deletes/restores like any block.

8. **Tests** (Vitest unit + Playwright e2e):
   - schema: valid drawing parses; invalid (empty points, non-numeric, wrong version, junk replacing typed data) rejected.
   - capture helper: normal drag → points; degenerate drag ignored; isPrimary guard; pointer-capture used.
   - transform: drawing ↔ other kinds refused both directions; textOfContent(drawing) = ''.
   - component/unit: draw → save → reload → strokes intact and still vector (AC-008); edit adds/removes stroke; undo; clear-with-confirmation; Escape exits edit; live region announces.
   - save path: content replacement persisted with revision guard; conflict surfaced (stale update rejected, no last-write-wins); failure → Retry visible; pagehide flushAll persists drawing.
   - creation: drawing created while page N active lands on page N (AC-003).
   - e2e (production path, real browser): open/import a source → create a drawing block on a page → draw a stroke → save → reload → stroke still rendered and editable → zero external network requests. Seed nothing through the harness for the core journey.
   - accessibility unit/e2e: keyboard path — focus block, enter edit, undo/delete via keyboard, Escape exits.

9. **Docs (worker does NOT touch docs/)** — manager handles mutable docs after gate. You only note any finding that changes the documented model.

## Scope — DO NOT

- NO connections/backlinks (Phase 4A) — nothing related to Connection/backlink/embed for this milestone.
- NO graph/mind-map/argument-map UX (Phase 4B/4C).
- NO dictionary (Phase 5), NO search/full-text index (Phase 6).
- NO AI relationship/drawing generation, NO embeddings, NO sync, NO 3D, NO chess.
- NO changes to annotation schemas, annotation geometry, or the reader overlay (ink *annotations* are Phase 3A/3B territory and already shipped — untouched here).
- NO canvas/fabric/konva/roughjs dependency. Plain SVG only.
- NO second database, NO duplicated block truth, NO storing block text in drawings.
- NO schemaVersions bump unless the data layer genuinely requires it (content is a JSON blob — justify any bump with evidence).
- NO commit/push by the worker.

## Invariants to protect (regression-test where touched)

- One continuous canonical journal per source; blocks keep id/rank/location/revision across edits (update, never recreate).
- Source-location inheritance (AC-003).
- Mandatory optimistic concurrency — no last-write-wins anywhere.
- Never silently lose writing (drawing strokes included) — visible failure + Retry, flushAll on every exit path.
- Local/offline-first: zero network in the drawing journey.
- Keyboard accessibility (AC-015).
- Folio Margin aesthetic: quiet, archival, restrained.

## Files to inspect first

`src/domain/journals/journal.schemas.ts`, `transform.ts`, `transform.test.ts`, `src/application/create-block.ts`, `change-block-kind.ts`, `src/features/journal/JournalPane.tsx`, `JournalBlockView.tsx`, `blockVocabulary.ts`, `journal.css`, `src/features/reader/annotationCapture.ts` (pattern reference only), `src/domain/annotations/annotation.schemas.ts` (ink reference only — do not modify), `src/data/repositories/JournalRepository.ts` (interface), existing e2e specs under `e2e/shell/`, `docs/AI_PROJECT_STATE.md` (context only).

## Acceptance criteria (your tests must prove each)

1. Create a drawing block while page 5 active → block's sourceLocation page = 5 (AC-003).
2. After reload, the drawing is still vector (strokes with points persisted), not flattened to raster-only (AC-008).
3. Editing a stroke (add/remove/undo/clear) persists through reload; conflicts surface; failure shows Retry.
4. Deleting the block soft-deletes it (trash), restoring brings the drawing back.
5. The drawing journey makes zero network requests.
6. Keyboard path: reach the block, enter edit, draw/undo/delete via keyboard-accessible controls, Escape exits.
7. Exactly one durable truth per edit — no duplicate blocks/writes.

## Report format (return these 12 items)

1. Starting SHA (a8807115e2c87a7b8ffc671cf8a13eb6bddca5ec) and confirmation HEAD/origin unchanged, nothing staged.
2. Canonical DrawingData schema (final zod shape).
3. Canvas-local coordinate discipline (how pointer→points conversion works, viewBox).
4. Capture path (where "Draw a sketch." lives, AC-003 proof).
5. Render path (read state + edit state).
6. Save path (content-replacement flush, conflict/failure handling, flushAll coverage).
7. AC-008 vector-retention proof (test names).
8. AC-003 page-inheritance proof (test names).
9. Accessibility path (controls, live region, Escape, focus).
10. Files changed (new + modified).
11. Targeted test run results (files/tests passed).
12. Deviations from this brief (any) + confirmation: no annotation-schema changes, no new dependency, no schemaVersions bump (or evidence if bumped), ZIP + install.sh untouched, no docs/ edits, no commit/push.
