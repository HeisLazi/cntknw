# WORKSPACE UX-1 — S3: Production infinite Whiteboard

Run AFTER S1 and S2 are reviewed and landed. Implemented by Codex. This is the
largest workstream of UX-1.

## Repo / git state

- Repo: <repo-root>, branch `main`.
- Read AGENTS.md, docs/AI_PROJECT_STATE.md, and git status/log first. The only
  unrelated untracked files are `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`
  and `install.sh` — NEVER touch them. No `docs/` edits (manager writes docs
  and ADRs at closure), no commit, no push. No `git add .`.

## Non-negotiable product invariants (UX-1 §11, §18, §19, §26)

- ONE canonical knowledge/drawing truth. The Whiteboard is a PROJECTION over
  canonical journal blocks — never a second store, never a raster copy, never
  duplicated drawing content.
- Existing Phase 3C Drawing blocks (typed editable vector `DrawingData`, v1)
  MUST keep working, unbroken, in the journal (AC-008).
- Content created on the Whiteboard while studying a source inherits the
  active source location/page (AC-003). Provenance stays SUBTLE ("p.42" on
  selection), never big badges.
- Optimistic-concurrency guards, repository/application boundaries and the
  save-path seams stay intact (ADR-0003 / ADR-0004).
- No new runtime dependency (hand-rolled SVG, like Phase 3C). Do NOT add
  tldraw/excalidraw/konva/fabric/roughjs or any canvas library. The handoff
  v0.2 explicitly rejects the old raster `canvasData` whiteboard (ADR-0002
  §8.3) — vector truth only.
- No Phase 4 leakage: no connections/backlinks/graph/dictionary/search.

## Canonical-ownership decision (document this precisely in your report — the
## manager will write the ADR from your stated decision)

**Decision: the Whiteboard is a layout projection over canonical journal
blocks (UX-1 §19 option B).**

- Each Whiteboard object IS one canonical journal block:
  - strokes / shapes (pen, pencil, highlighter, line, arrow, rectangle,
    ellipse, eraser targets) → a `drawing`-kind block whose content is
    schema-valid `DrawingData`;
  - text → a `paragraph`-kind block (the same notebook, not a second one).
- A durable **layout record** (presentation coordinates only) positions each
  block on the infinite board: `blockId -> { x, y }` in canonical board units.
  It holds NO content — content lives in the block.
- Deleting a board entry only removes the projection. The explicit product
  action "delete this block" (select + Delete) deletes the canonical block
  through the existing journal use cases (`removeBlock`), so nothing is ever
  silently destroyed.
- The layout + viewport live in `WorkspaceState` (extend it with a
  `whiteboard` field: `{ viewport: { x, y, zoom }, layout: Record<BlockId,
  { x, y }> }`), persisted per source via `useWorkspacePersistence` — same
  revision-guarded store, no second database, no schemaVersions bump, no
  migration. This satisfies "persist locally where architecture permits".
- Alternate projections (journal run vs board) refer to the same block id and
  render the same canonical content.

## Existing pieces to reuse (inspect first)

- `src/domain/journals/journal.schemas.ts` — `DrawingDataSchema` v1
  (version, width, height in canvas-local viewBox units, strokes[] with
  {id,color,width,opacity?,points[]}, superRefine bounds). Keep v1 valid.
- `src/features/journal/DrawingCanvas.tsx`, `drawingCapture.ts` (Phase 3C
  pointer→canvas-local capture), `pendingEdit.ts` (text|content discriminated
  seam + `applyPendingEdit`), `JournalPane.tsx` save/conflict/trash paths,
  `createPageLinkedBlock` application use case (content + kind generic).
- `src/features/workspace/useWorkspacePersistence.ts` (commit/drift), the S1
  `WorkspaceState.layout.rightWorkspace: 'write' | 'whiteboard'` field and the
  right pane slot in `StudyRoute`.
- `e2e/shell/*.spec.ts` conventions (makePdf, resetApplicationStorage).

## Deliver — the Whiteboard feature

New `src/features/whiteboard/` directory, wired into the Study Workspace right
pane (StudyRoute) behind `layout.rightWorkspace === 'whiteboard'`.

### 1. Infinite canvas engine (hand-rolled SVG)
- A viewport transform (translate + scale) on a single `<g>`; canonical board
  coordinates NEVER change when the viewport changes. Screen↔world conversion
  on pointer events: `world = (client − rect) / scale − translate`, computed
  per event from the current transform (no stale closure drift).
- Pan: Hand tool, Space+drag, and (safe) wheel/trackpad (e.g. wheel =
  vertical scroll, shift+wheel or modifier = horizontal, ctrl/cmd+wheel or
  pinch = zoom at cursor). Keyboard zoom: +/-/0 buttons + shortcuts.
- Zoom range bounded (e.g. 10%–400%), "fit" resets viewport to show all
  objects (or origin when empty). No visible boundary — the canvas spans the
  container; objects may be far from origin. Do NOT grow DOM unboundedly:
  render only existing objects; a large background pattern (optional grid or
  dot lattice, subtle) is a single SVG pattern element, not per-pixel DOM.
- Persist `viewport {x, y, zoom}` and per-object layout through
  `useWorkspacePersistence` (drift for viewport, commit for discrete object
  placement/deletion). Never mutate geometry because zoom changed.

### 2. Tools (real, visible, no fake affordances)
Toolbar (compact, Gruvbox, keyboard-reachable, `aria-pressed` states):
Select · Pen · Pencil · Highlighter · Eraser · Line · Arrow · Rectangle ·
Ellipse · Text · Hand. Global: Undo · Redo · zoom out · zoom % · zoom in ·
fit.
- Pen: smooth freehand vector stroke, configurable width/color/opacity.
- Pencil: visually/behaviorally distinct (rougher/softer) freehand stroke.
- Highlighter: broad, low-opacity stroke (e.g. opacity ~0.3 default).
- Eraser: WHOLE-STROKE/WHOLE-OBJECT erasing for this milestone (predictable
  deletion; partial-path erasing documented as known debt, not faked).
- Line/Arrow/Rectangle/Ellipse: vector shapes; stroke color/width; fill where
  supported; Arrow has a proper arrowhead.
- Text: click to place an editable text object (font size + color), rendered
  on canvas; double-click/Enter to edit in place.
- Select: click to select, drag to MOVE, Delete removes (with the journal
  removeBlock semantics), Esc deselects. NO fake resize handles — if resize
  is not implemented, do not draw handles that do nothing. (Resize is known
  debt; omit handles.)
- Hand: pan without drawing.
- Color: curated Gruvbox quick palette + "recent" swatches + a real color
  picker + hex entry + opacity control. Color is NEVER the only semantic
  carrier (labels/announcements accompany tool and selection state).

### 3. Objects → canonical blocks (save path)
- Gestures accumulate in local state; the canonical block is created
  on gesture END (stroke committed / shape placed / text confirmed) via
  `createPageLinkedBlock` (kind drawing|paragraph) with the ACTIVE source
  location — so a drawing made on page 42 inherits page 42 (AC-003).
- Subsequent edits (move, recolor, delete, text edit) update the canonical
  block through the EXISTING guarded paths: drawing content via the
  `pendingEdit` content seam (same debounced, revision-guarded flush as the
  journal), text via the text seam; failures stay visible with Retry; no
  IndexedDB writes during a pointer gesture (write on commit/end only).
- Board layout entries (`blockId -> {x,y}`) are written to
  `WorkspaceState.whiteboard.layout` (drift/commit). Layout writes never touch
  block content. Deleting an object removes its layout entry AND its block
  (explicit delete action); a test must prove deleting the projection alone
  (without block deletion) never happens accidentally.
- Move: updating a layout entry must NOT rewrite block content.

### 4. Undo/redo
- Session-level command history over OBJECT operations (create, delete, move,
  recolor, text edit, clear) — NOT per-pixel. Buttons + Ctrl/Cmd+Z, Ctrl/Cmd+
  Shift+Z or Ctrl/Cmd+Y. History is memory-bounded (cap, e.g. 200 entries);
  not durable cross-session (documented debt). Undo of a delete restores the
  block (via journal restore) + layout entry.

### 5. Keyboard / accessibility (AC-015)
- Tool shortcuts (V select, P pen, H hand, T text, B pencil, I highlighter,
  E eraser, L line, A arrow, R rect, O ellipse), Ctrl/Cmd+Z/Y, Delete,
  Escape cancels current gesture/deselects, +/-/0 zoom, Space+drag pan.
- Every tool button labelled, `aria-pressed` when active; tool state also
  announced via a live region; selection state conveyed by more than color
  (outline + label + announcement).
- Canvas focusable; all actions reachable without hover. Escape never
  ambiguously exits the workspace (it cancels gestures/deselects first).

### 6. Write ⇄ Whiteboard switch
- The right workspace control "Write | Whiteboard" (S1 shell) flips
  `layout.rightWorkspace`; switching preserves BOTH modes' state (journal
  scroll/pending edits; whiteboard viewport/layout/objects) with NO remount
  of the hidden mode's data (projection swap only). Whiteboard is NOT a
  modal and never navigates away from the Study Workspace.

### 7. Provenance
- When an object is selected/inspected show a SUBTLE `p.<N>` hint (source
  page inherited at creation). No per-object badges.

## Performance rules
- No per-pointermove DB writes or setState storms on the whole board: local
  gesture state; viewport transforms applied via CSS/SVG attributes; React
  renders bounded to object count; history capped. PDF.js and journal must
  not regress. Backdrop blur ONLY on chrome (S1 glass tokens), never over
  paper.

## Tests (unit + e2e)
- Unit (jsdom): coordinate conversion (screen↔world) incl. after zoom/pan;
  viewport never mutates stored geometry; tool state machine (gesture
  start/commit/cancel); whole-stroke eraser deletes block+layout; layout
  delete ≠ block delete; undo/redo restores block+layout; text object
  editable; AC-003 page inheritance (created with active page); save uses
  guarded flush (no direct repository bypass); WorkspaceState whiteboard
  field serializes/restores.
- e2e (`e2e/shell/whiteboard.spec.ts`, production UI, real pointer events):
  pen stroke → shape → text; change color; select+move; undo/redo; reload →
  objects still editable vector truth; pan far + zoom + reload → viewport
  preserved; source page N active → draw → inspect repository → page N
  retained; Write↔Whiteboard switch preserves both modes; zero network
  requests. Mirror existing spec conventions (makePdf, resetApplicationStorage,
  viewport size).

## Report (verbatim)
1. files changed (new + modified)
2. the canonical-ownership decision as you implemented it (blocks+layout
   projection; where layout lives; how delete is safe) — this becomes the ADR
3. tools implemented + eraser policy + resize policy (known debt)
4. save path + concurrency + provenance
5. undo/redo design + bounds
6. performance measures (no per-pointer writes; render bounds)
7. targeted unit + e2e results
8. confirmation nothing else touched / no docs / no commit / no push / ZIP +
   install.sh byte-identical
