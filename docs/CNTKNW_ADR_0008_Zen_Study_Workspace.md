# ADR-0008 — The Zen Study Workspace (UX-1)

**Status:** Accepted
**Date:** 6 August 2026
**Owner:** Lazarus Petrus
**Implements:** AC-001, AC-004, AC-006, AC-010, AC-015, AC-016; NFR-001,
NFR-002, NFR-005
**Supersedes:** the pre-Phase-4 study-desk mock (`mode: 'write'`-only layout,
ad-hoc styling outside a token system)

---

## 1. The decision

The Study Workspace becomes a calibrated, keyboard-first reading-and-writing
desk with exactly four work modes — `split`, `source-focus`, `journal-focus`
and `compare` — and a right-side projection that is either the **write**
(journal) pane or the **whiteboard**. All styling flows from one design-token
stylesheet; the palette is the Zenburn/Gruvbox-inspired dark theme defined in
`src/design/tokens.css`. There are still exactly three primary destinations
(Library, Gallery, Notes), and the Study Workspace remains the single shared
place where books and artworks are read, annotated and written over.

The whiteboard is not a second store. It is a **projection over the same
canonical journal blocks** that appear in the write pane; strokes are stored
in the existing block schema (`DrawingData.strokes: DrawingStroke[]`, each
stroke carrying `{id, color, width, opacity?, points[]}`) through the
existing `createPageLinkedBlock` boundary and the guarded `pendingEdit`
flush seam. Turning a source's journal into a whiteboard view, back into the
journal, or into a compare view never duplicates a block and never forks its
identity.

## 2. Why

- Phase 2 shipped the Infinite Journal but the surrounding room was still a
  placeholder desk. Users could write, but could not focus the source, sit
  with a blank page, or think in space.
- A second datastore for whiteboard strokes would have violated the
  one-continuous-canonical-journal invariant (INV-003) and the "content
  created from a source inherits the source location" rule.
- The token system closes the gap where raw hex and raw durations could
  appear in arbitrary CSS; `src/design/design-tokens.test.ts` enforces that
  tokens.css is the only place raw values are declared.

## 3. Workspace state

`WorkspaceLayoutSchema.mode` is one of:

- `split` — source and journal side by side (default; `rightWorkspace` is
  `write` by default and `0.7` is the default split);
- `source-focus` — the source pane fills the room; the journal/whiteboard
  pane is collapsed out of view;
- `journal-focus` — the journal (or whiteboard) fills the room;
- `compare` — the source and the projection side by side with equal
  emphasis.

`rightWorkspace` is `write` | `whiteboard`. **Whiteboard Focus** is
`rightWorkspace = whiteboard` combined with `journal-focus` mode. The state
persists through the workspace repository and survives reload, exactly like
the rest of the shell.

## 4. The whiteboard as a projection

- Canonical records are **shared** between the write pane and the
  whiteboard: both project the same journal blocks, and neither copies
  content. Projection visibility and layout are **presentation state**
  (`WhiteboardStateSchema.layout`, a blockId → position map owned by the
  workspace state), never a second content truth.
- Projection membership does **not** imply full inline rendering in the
  write pane. Objects authored exclusively on the whiteboard (present in
  the board layout) are filtered out of the write projection, so ordinary
  pen strokes and shapes never flood the blank writing surface as a
  sequence of drawing editors. Journal-authored prose remains visible in
  the write pane and on the board alike. Deleting a whiteboard block
  deletes the same canonical block the journal would show.
- `DrawingData` is unchanged: strokes are `DrawingStroke[]`, each with
  `{id, color, width, opacity?, points[]}`. The whiteboard's own saved
  shape is a journal block of kind `drawing`.
- All saves go through `createPageLinkedBlock` plus the `pendingEdit`
  guarded flush seam; the same optimistic-concurrency guards (revision
  checks) apply as everywhere else. On a `RevisionConflictError` the flush
  **preserves both truths**: the local pending edit stays pending, the
  remote block is re-read and summarized, and a restrained conflict notice
  offers explicit **Keep Saved** (discard the local edit only after the
  user chooses) or **Use My Version** (re-read the current remote, reapply
  the preserved local edit against the current revision, revision-guard
  the write; a failed resolution write keeps both truths and allows
  Retry). Delete, Clear and destructive history operations are blocked
  while an object's latest content has an unresolved conflict, and local
  Undo/Redo history is invalidated on conflict so stale snapshots can
  never replay over the accepted truth.
- The whiteboard is therefore a view, never a parallel truth.

## 5. Journal blank-page composing

- A journal starts as a single composing paragraph with a "Write…"
  placeholder and `autoFocus`; `Enter` composes further blocks.
- The type-change control remains the persistent mark lane affordance
  (ADR-0006), with the ghost action row (`role="toolbar"`) as a convenience
  projection that stays mounted and toggles via the `hidden` attribute so
  the block's child list — and therefore the menu trigger's DOM node —
  never remounts during a focus re-render.
- **Menu interaction contract (primitive, `Menu` in Overlay.tsx):** the menu
  opens on primary `pointerdown` (so a remount or a focus-driven re-render
  between pointerdown and click can never swallow the open), the follow-up
  `click` from that pointer gesture is suppressed, and keyboard activation
  (`detail === 0`) still toggles. This is what keeps mouse and keyboard
  parity on empty composing blocks.

## 6. Pomodoro

- A focus/break timer lives in `pomodoroState` as a pure reducer over a
  wall-clock deadline.
- Invariants (tested): **no network writes at all** (the e2e asserts zero
  requests), **no per-second persistence writes** (start = 1 create, 0
  updates; writes only on transitions), and the remaining time is computed
  from `Date.now()` against an in-memory deadline, so a paused tab cannot
  drift. `pagehide` flushes the current snapshot so a closing tab cannot
  lose the running state.

## 7. Focus management

- `focusTrap` (used by the shell navigation and the context panel, both
  `role="dialog"` `aria-modal`) wraps first↔last focus, ignores hidden or
  `aria-hidden` candidates, and returns focus on close.

## 8. Consequences

- Design tokens are the single styling source of truth; new UI must consume
  tokens and never introduce raw values outside `tokens.css`.
- The whiteboard adds no new storage, no new repository, no network path;
  it reuses the journal repository and its concurrency guards.
- The Menu primitive's open-on-pointerdown contract is now a stable part of
  the interaction layer; consumers must not rely on the click event alone
  to open a menu.
- Pomodoro remains fully local-first; no server round-trips exist to break
  offline behavior.
