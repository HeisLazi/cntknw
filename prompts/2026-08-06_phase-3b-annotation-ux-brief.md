# Phase 3B — Production PDF Annotation UX (implementation brief)

**Date:** 2026-08-06
**Issued by:** Hermes (manager) to Codex CLI (implementer)
**Model:** gpt-5.6-sol, `model_reasoning_effort="high"` (architecture-sensitive UI work)
**Repository:** `HeisLazi/cntknw`, branch `main`
**Baseline (verified):** local HEAD == origin/main == `8414a5ce716a67b021496b518608337d965707c7`
**Working tree:** clean except untracked `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` (sha256 head `2c37d3d7…`) — NEVER stage, modify, rename, or delete it. Never use `git add .`.

Phase 3A (ADR-0007 canonical geometry, schema-v2 migration, exact-asset retrieval) is ACCEPTED and CLOSED. Do NOT reopen or redesign ADR-0007 unless you find an actual demonstrated contradiction. Do NOT begin Phase 3C, Phase 4, Phase 5, or Phase 6 work.

---

## 1. Milestone objective

Turn the accepted Phase 3A annotation architecture into the first real production annotation experience in the PDF Study Workspace. The minimum successful user journey:

1. open a PDF;
2. select source text OR define a page region;
3. create an annotation through a restrained contextual UI;
4. annotation is persisted against the EXACT active `sourceId` + `assetId` + 1-based page;
5. overlay appears at the correct physical source location;
6. zoom / resize / bounded virtualization / leave-and-return / reload do not misalign it;
7. user can focus/select the annotation;
8. user can edit supported presentation properties (restrained style presets);
9. user can delete it with a destructive-action-safe interaction (confirmation);
10. keyboard users can perform the core interaction;
11. failure never silently destroys the local intent.

This is PRODUCTION UI, not another probe. Do NOT mark full Phase 3 complete; pen/drawing authoring and Drawing journal blocks remain Phase 3C.

## 2. Invariants that must hold (from AGENTS.md + ADR-0007)

- Exactly three primary destinations; Study Workspace is `/study/:sourceId`.
- Never persist: CSS viewport pixels, scroll offsets, canvas backing pixels, devicePixelRatio, DOM node identity, mounted page index, five-page-window offsets. (ADR-0007.)
- Every production read for rendered PDF annotations MUST use `getBySourceAssetAndPage(sourceId, assetId, page)`. Never reconstruct a source+page-only access path. Annotations belong to the exact active PDF asset; a replaced asset's annotations must never appear over the replacement.
- Journal blocks remain canonical writing/knowledge records. Do NOT invent an annotation-notes database.
- Block identity/provenance survive; no silent writing loss; optimistic-concurrency guards (ADR-0003) are MANDATORY on every mutating call (`expectedRevision`).
- Phase 2 Infinite Journal stays closed. Bounded virtualization (five-page window in PdfReader) stays intact — the annotation overlay must follow the page's mount/unmount lifecycle, never become an all-document overlay.
- INV-014: UI components do not directly write arbitrary database records. Business/reference integrity goes in an APPLICATION USE CASE (see §5).

## 3. Files to read first (authoritative)

- `docs/CNTKNW_ADR_0007_Canonical_Annotation_Geometry.md` (geometry + identity; do not redesign)
- `src/lib/geometry/index.ts` (canonical conversion API — REUSE IT, do not duplicate)
- `src/domain/annotations/annotation.schemas.ts` (kind/anchor union, style, validation)
- `src/data/repositories/AnnotationRepository.ts` + `src/data/repositories/concurrency.ts` (contract + guards)
- `src/app/routes/StudyRoute.tsx` (workspace composition; `context.primaryAsset` = the exact active asset)
- `src/features/reader/PdfReader.tsx`, `src/features/reader/PdfPage.tsx`, `src/features/reader/pdfjs.ts` (virtualization, viewport, text layer)
- `src/features/reader/reader.css` (page container layout; overlay layer goes inside `.cn-pdf-page`)
- `src/features/workspace/useWorkspacePersistence.ts` + `src/domain/workspace/workspace.schemas.ts` (workspace resume state, PDD §6.2)
- `src/features/journal/JournalPane.tsx` (established error/conflict/retry/save-status patterns to follow)
- `src/application/create-block.ts` + `src/application/resume-source.ts` (application use-case pattern)
- `src/features/reader/PdfSearch.tsx` (contextual toolbar pattern inside the reader)
- `src/components/primitives/` (Button, Dialog, FocusRing, Toast, Field — reuse; no new design system)
- `src/design/tokens.css` (design tokens; restrained palette; reduced-motion block is global)
- `e2e/harness/geometry-probe.tsx` (test-only PROBE — its real-reader geometry derivation (pageBox + viewport) is a legitimate reference for how to derive the page box; it is NOT production infrastructure and must not be imported by production code)
- `e2e/shell/annotation-geometry.spec.ts`, `e2e/shell/reading.spec.ts` (e2e patterns: real app + `makePdf` fixture + `resetApplicationStorage`)

## 4. Architecture (decision summary — implement as specified)

### 4.1 Integration point
- `StudyRoute` already resolves the exact active asset (`context.primaryAsset?.id`). Pass `sourceId` and `assetId` props into `PdfReader`, and `PdfReader` forwards them to each mounted `PdfPage`. Do NOT put asset resolution inside PdfReader/PdfPage.
- Inside `PdfPage`, add an annotation overlay layer as a sibling of the canvas/text-layer divs, inside the existing `.cn-pdf-page` container (which is `position: relative`). The overlay is `position: absolute; inset: 0`, `pointer-events: none` by default; interactive annotation elements opt in (`pointer-events: auto`). It must sit above the text layer but below the page-number badge in visual order (adjust z-index within the existing token scale — the page already uses `isolation: isolate` on the text layer, so keep the overlay in the same stacking context, e.g. `z-index` above `--cn-z-local`).
- The overlay is a projection of canonical records ONLY. Every frame it projects canonical anchors through `page.getViewport({ scale: zoom })` via `canonicalRectToViewport` / `canonicalPointToViewport` / `canonicalPathToViewport` (with the page box derived as in the probe). No canonical value is ever written from DOM geometry except at the capture boundary (§6, §7).

### 4.2 Data access
- A small hook `usePageAnnotations(sourceId, assetId, pageNumber)` in the reader feature calls `useRepositories().annotations.getBySourceAssetAndPage(...)`. It returns `{ annotations, reload, error, loading }`. Follow JournalPane's read-error + Retry pattern (a page-level inline error with a Retry button; the stored data is never deleted).
- Because the hook is called per mounted `PdfPage`, the bounded five-page window naturally bounds overlay data to five pages. No all-document overlay.

### 4.3 Application use-case boundary (MANDATORY)
Create `src/application/annotations/create-annotation.ts` exporting `createSourceAnnotation(repositories, input)` where input is `{ sourceId, assetId, page, kind, anchor, style? }`. It MUST, in order:
1. verify `sources.getById(sourceId)` exists — else throw a typed `SourceNotFoundError` (extend `src/data/errors.ts`);
2. verify `assets.getById(assetId)` exists — else throw `AssetNotFoundError`;
3. verify the asset is ACTUALLY linked to the source: `assets.getAssetsForSource(sourceId)` must include `assetId` — else throw `AssetNotLinkedToSourceError`. (This is the referential-membership check Phase 3A deliberately left out of the repository contract. Phase 3B puts it HERE.)
4. verify `page` is a positive integer;
5. assemble `CreateAnnotationInput` (kind/anchor compatibility is enforced by the schema's `enforceKindAnchor` — rely on it; `style` defaults to `{}`);
6. call `repositories.annotations.create(...)` and return the saved record.

The repository layer is NOT modified to do cross-repository validation — that stays the use case's job.

### 4.4 Workspace state (PDD §6.2 "selected annotation tool")
- Add to `src/domain/workspace/workspace.schemas.ts`: `export const AnnotationToolSchema = z.enum(['select', 'region'])` and add `annotationTool: AnnotationToolSchema.default('select')` to `SourceViewSchema`.
- A zod default is BACKWARD COMPATIBLE with stored records (old records simply get the default). This is a record-shape addition, NOT an index change: do NOT touch `schemaVersions.ts`, do NOT bump the Dexie schema version. Verify there is no compound index over workspace sourceView fields (there is none — the workspace store is indexed by sourceId only).
- Wire it: when the user toggles the region tool, persist via `commit({ sourceView: { ...state.sourceView, annotationTool } })` from `StudyRoute` (the same place zoom is persisted). On reopen it restores. Never persist ephemeral pointer coordinates or selection DOM objects.

### 4.5 Supported kinds in 3B
- CREATE: text highlight (primary), region/area (primary). Underline/strike are OPTIONAL — only if they fall out of the same text-capture path almost free; do not grow a complex toolbar to add features.
- RENDER (read-only projection, must not crash or corrupt the page): any migrated `point` (a small dot) and `ink` (SVG polyline per stroke) records that already exist. No editing controls on them. No raster flattening of ink.
- Pen/drawing AUTHORING is Phase 3C — do NOT build it now.

## 5. Text selection → highlight

- Implement a real PDF-text selection path: listen for selection changes (or `mouseup` + `selectionchange`) in the text layer; derive the exact PDF page from the selection's container (each `.cn-pdf-page` knows its `data-page`).
- Capture: `Range.getClientRects()` for every rect of the selection, transformed from viewport coordinates to page-local CSS coordinates by subtracting the page container's `getBoundingClientRect()` origin. Keep MULTILINE rects as an array (one annotation, not one per line — the anchor's `rects` array is exactly for this).
- Quote: `selection.toString()` trimmed; must be non-empty (schema requires quote for new text annotations).
- Convert every page-local CSS rect through `viewportRectToCanonical(rect, viewport, pageBox)`; compute `boundingRect` with `boundingRectFor(rects)`. Optionally capture `startOffset`/`endOffset` within the page's text content if cheap and reliable; they are optional.
- CROSS-PAGE selections must be handled honestly: if the selection's anchor node and focus node belong to DIFFERENT page containers (or the selection spans a spacer), do NOT write anything. Show a restrained inline notice: "Selection crosses pages — annotate one page at a time." (Prevention + communication is the chosen option; splitting is not required.)
- Default first text action: **Highlight**. Create via `createSourceAnnotation` against the ACTIVE `sourceId` + `assetId` + the page the selection is on (1-based).
- After a successful create: clear the transient selection state, keep the annotation selected/focused in the overlay. After a FAILED create: keep the selection visually intact, show an inline "Not saved — Retry" affordance (see §10). NEVER clear the user's selection before persistence succeeds.

## 6. Region tool

- Toolbar toggle (reader toolbar group): a "Region" button, `aria-pressed`, persisted as `annotationTool` (§4.4). Restrained: small icon button like the existing outline/search buttons.
- When active: cursor becomes crosshair on pages; pointerdown starts a drag; pointermove draws a live preview rect (page-local CSS); pointerup ends it.
- If the drag is degenerate (width or height < 4 CSS px), cancel quietly (no annotation, no error) and keep the tool active.
- Convert the dragged page-local CSS rect via `viewportRectToCanonical` → area anchor → `createSourceAnnotation` with `kind: 'region'` (area anchor required by schema).
- Esc cancels the active drag/tool interaction and returns focus to the source context. The tool remains in its persisted state (it is a resume-state tool, not one-shot).
- No absolute document-scroll coordinates anywhere in this path.

## 7. Overlay rendering

For each mounted page:
1. know sourceId + assetId + 1-based page;
2. `usePageAnnotations(...)` loads exact-asset annotations for that page;
3. project each anchor through the CURRENT viewport:
   - text: one absolutely-positioned element per rect (multiline), background = style color (see §8) at low alpha, `border-radius` matching page radius, `pointer-events: auto` when interactive;
   - area: one element;
   - point: a small dot centered on the projected point;
   - ink: an inline SVG sized to the page, one `<polyline>` per stroke (projected), `vector-effect`/stroke settings so it scales with zoom;
4. elements are keyed by annotation id so remounts reconcile; no DOM-node identity is persisted;
5. page unmount → nothing durable lost (data lives in the repository); remount → reconstructs from the repository record.

## 8. Interaction, style editing, deletion

- Hover/focus affordance: subtle outline on hover; visible focus ring (`--cn-focus-ring`) on keyboard focus; `aria-label` on every annotation element with meaningful context, e.g. `Highlight on page 7: “<quote excerpt, trimmed to ~60 chars>”` / `Region on page 7` / `Point on page 7` / `Ink drawing on page 7`. Never communicate state by colour alone.
- Selection: clicking an annotation (or focusing + Enter/Space) selects it and reveals a SMALL progressive-disclosure action menu (a compact inline popover near the annotation — reuse the Overlay/Dialog/FocusRing primitives; do NOT build a permanent giant toolbar, no Notion-like cardification, no rainbow palette).
- Edit presentation: a restrained set of 4–6 preset colors drawn from the product palette tokens (e.g. default accent, one or two muted tones, a neutral, one warm tone), applied via `repositories.annotations.update(id, { style: { color } }, expectedRevision(annotation.revision))`. No free-form color picker. (A `color` string is already part of the style schema.)
- Delete (NFR-008): CHOOSE CONFIRMATION-BEFORE-DELETE — smallest robust mechanism, no schema change, no soft-delete migration. Use the existing Dialog primitive: title "Delete highlight?", body states the annotation's accessible name, buttons "Delete" (danger) / "Cancel". On confirm: `repositories.annotations.delete(id, expectedRevision(annotation.revision))`. Document this choice (see §12). Short-lived undo would require soft-delete/schema work — do NOT add it in 3B.
- Revision conflict during update/delete (`RevisionConflictError`): show a visible notice ("This annotation changed elsewhere — reloaded."), re-fetch the annotation, do NOT overwrite. Never last-write-wins.

## 9. Keyboard and accessibility (AC-015)

Design and test an explicit keyboard path:
- the Region tool toggle is a real focusable button in the reader toolbar;
- annotation elements are focusable (tab order); Enter/Space on a focused annotation opens its action menu; Esc closes the menu, cancels an active region drag, and returns focus to the source context;
- Delete key on a focused annotation opens the confirmation dialog (protected interaction — deletion never happens on a single unconfirmed keypress);
- the confirmation dialog traps focus and returns focus to the annotation (or its page) on cancel;
- the cross-page selection notice is announced (`role="status"` / `aria-live`);
- selection-to-highlight is reachable by keyboard users where technically feasible: if the user has made a text selection with the keyboard (Shift+arrows), the same contextual Highlight affordance appears (it is driven by selection state, not by mouse events);
- respect reduced motion: use the existing token durations/transitions only, no new animations; the global `prefers-reduced-motion` block in tokens.css/base.css already covers the app — do not add per-component motion that bypasses it;
- do not hijack common browser/text-selection keyboard behaviour (no global keydown overrides; keep page-turn keys working as today).

## 10. Failure and concurrency

- Read failure: per-page inline error + Retry (JournalPane pattern). Stored data never deleted.
- Create failure: keep the selection + captured rects in component state; show "Not saved" with a Retry button; only clear on success or explicit user dismiss. NEVER optimistically pretend success. Do not clear the only recoverable intent before persistence succeeds.
- Update/delete: revision-guarded; conflict → visible notice + re-fetch (see §8).
- Deleted/missing record: if the overlay's annotation disappears from a reload, it simply stops rendering (no crash).
- Asset no longer active: the reader re-resolves `primaryAsset` on source open; annotations for an old asset are simply not queried (exact-asset). No special handling needed beyond never falling back to source+page.
- Page unmounted while async work is in flight: every effect uses a `cancelled` flag / AbortController (mirror PdfPage's existing pattern). No setState after unmount.

## 11. Design language

Quiet private museum / archival reading room. Source-first, minimal chrome, subtle hover/focus, strong accessibility, no dashboard aesthetic, no unnecessary modal workflow (one confirmation dialog for delete is fine), contextual tools near the source interaction, clear but quiet persistence state. Reuse `--cn-*` tokens, existing primitives (IconButton, Button, Dialog, FocusRing, Toast if needed), existing reader toolbar layout. Desktop/laptop is the complete target — do not build phone parity.

## 12. Documentation (implementer: NONE — Hermes owns docs this milestone)

Do NOT modify any `docs/` file. Hermes reconciles `docs/AI_PROJECT_STATE.md`, `docs/CNTKNW_Current_Implementation_Status.md`, `docs/CNTKNW_Repository_Review_2026-08-02.md`, and the Documentation Index after review, including: NFR-008 mechanism chosen (confirmation-before-delete), workspace `annotationTool` resume-state addition (zod-default, no Dexie migration), and Phase 3C remaining scope (pen/drawing authoring, Drawing journal blocks). Do NOT touch sealed v0.2 canonical files. Keep Findings 16/18/19/20 truthful.

## 13. Required tests

Unit (vitest, jsdom, @testing-library/react/user-event available):
- `createSourceAnnotation` use case: happy path persists exact (sourceId, assetId, page); UNRELATED asset (linked to another source, or not linked at all) is REJECTED; missing source / missing asset fail visibly with typed errors; non-positive page rejected; kind/anchor incompatibility rejected; NO PARTIAL WRITES (a failure in any validation step leaves the repository unchanged).
- Selection capture helper (extract the DOM-independent logic into a pure function so it is unit-testable): single-line selection → one rect; multiline → multiple rects; quote captured; page-local CSS → canonical conversion uses the geometry lib; degenerate/empty selection → null.
- Region drag logic: drag rect → canonical area anchor; degenerate drag → no-op.
- Workspace schema: `annotationTool` defaults to `'select'` for old records (zod default), accepts `'region'`.

Component tests (render real components with memory repositories via RepositoryProvider):
- overlay renders a persisted highlight on the correct page and a region on the correct page;
- EXACT-ASSET isolation: source with two assets A and B, annotation on A/page 3 — overlay for B/page 3 renders nothing; overlay for A/page 3 renders it (this is the replacement-asset regression guard);
- keyboard: tab reaches annotations, Enter/Space opens actions, Esc cancels region tool, Delete opens confirmation;
- delete: confirmation required; cancel leaves the record; confirm deletes it (guarded);
- induced create failure (wrap memory repo so `create` rejects): selection/intent retained, visible "Not saved" + Retry; Retry after un-wrapping succeeds;
- induced update conflict (`RevisionConflictError`): visible notice, no silent overwrite, re-fetch shown;
- read failure: Retry affordance; stored data intact;
- unmount during in-flight load: no errors/warnings.

E2E (production app, `e2e/shell/annotations.spec.ts` — real UI, `makePdf` fixture, `resetApplicationStorage`, import via the library file input like `reading.spec.ts`):
- full journey: import PDF → open study → select text (mouse drag) → Highlight appears at the right physical location → zoom in → highlight STILL aligned (compare overlay rect against the text-layer rect of the same quote, tolerance ~1-2px);
- region tool: activate, drag a region on a page → region appears at location → persists across reload;
- reload: annotations survive full reload/reopen;
- virtualization: create annotation on page 1, navigate to a distant page (page 1 unmounts), navigate back → annotation reconstructs at the same location;
- keyboard: reach the region tool toggle, activate a region via keyboard+Enter where feasible, cancel with Esc;
- delete: open actions on an annotation, Delete → confirmation dialog → confirm → annotation disappears;
- cross-page selection: attempt a selection spanning two pages (drag across the boundary) → notice appears, no annotation created (assert repository has no new record via a subsequent reload or UI state);
- offline: the interaction depends on no network/CDN path (the e2e server is local; assert no failed network requests in the page).

Do NOT duplicate Phase 3A geometry unit tests. Test the production integration now.

## 14. Acceptance criteria (all must be true)

- user can create a real PDF annotation (highlight from text selection, region from drag);
- canonical record persisted via the application use case;
- exact active asset enforced at creation AND at render;
- annotation renders at source location; zoom/resize/reload/virtualization remain correct;
- user can interact with it (focus, select, edit presentation presets, delete with confirmation);
- keyboard path exists and is tested;
- failures are visible and never silently destroy local intent;
- revision conflicts are never silently overwritten;
- no duplicate knowledge database; Folio Margin / Study Workspace architecture intact;
- production `dist/` contains NO e2e harness/probe/test leakage (verify with grep for `geometry-probe`, `__cntknwProbe`, `harness`, `data-testid`-only artifacts are fine but probe hooks are not).

## 15. Git safety + verification (implementer)

- Work on `main`. Do NOT commit, stage, or push anything. Leave the tree dirty with your changes only (plus the untouched ZIP).
- After your changes, run and report:
  - `npm run typecheck`, `npm run lint` (must be clean);
  - targeted `npx vitest run` for your new/changed test files, then `npm run test` (report totals);
  - `npm run test:e2e` (report totals; must include your new spec);
  - `npm run build` (report PASS; confirm no probe/harness leakage in `dist/`).
- Do NOT touch `docs/`, `prompts/` (unless you add a note file — you may leave the tree as-is; Hermes archives briefs), the ZIP, or any sealed v0.2 file.

## 16. Report format (return this in your final message)

1. files changed (paths)
2. production architecture summary (integration point, overlay, data flow)
3. `createSourceAnnotation` validation order + error types
4. text-selection implementation (capture, multiline, quote, cross-page handling)
5. region implementation
6. overlay rendering approach per anchor kind
7. workspace-state change (schema + persistence, migration verdict)
8. deletion/recovery mechanism chosen
9. failure/conflict handling summary
10. keyboard/accessibility summary
11. unit totals (new/changed files, passed/skipped)
12. e2e totals (incl. new spec names)
13. typecheck/lint/build results
14. dist leakage scan result
15. explicit statement: pen/drawing authoring and Phase 3C/Phase 4 NOT started

Do not commit. Do not push. End with `MILESTONE STATUS: IMPLEMENTATION COMPLETE`.
