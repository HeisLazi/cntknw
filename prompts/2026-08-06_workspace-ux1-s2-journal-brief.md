# WORKSPACE UX-1 — S2: Journal blank-writing-page visual redesign

Run AFTER S1 (foundation) has been reviewed; S2 must build on S1's tokens and
shell. Implemented by Codex. Do NOT touch the Whiteboard (S3) or Pomodoro (S5).

## Repo / git state

- Repo: <repo-root>, branch `main`.
- S1 changes are already in the working tree OR committed — run `git status`
  and `git log --oneline -3` and read AGENTS.md/state names first. Working
  tree MUST still have only `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`
  and `install.sh` as unrelated untracked files. Never touch either.
- No amend / force-push / history rewrite / `git add .`. No `docs/` edits,
  no commit, no push (manager handles docs+commit at closure).

## What's here today (inspect)

- `src/features/journal/JournalBlockView.tsx` — one block = a mark button in
  the margin (the kind/`Menu`) + the prose column (`BlockEditor` or a
  non-textual block). It already keeps the mark in the TAB ORDER (an explicit
  AC-015 decision, ADR-0006 §2: the mark *is* the control, no hovering bar).
- `src/features/journal/journal.css` — a ruled leaf: sticky running head,
  folio numerals ("p. N") in a wide left gutter, per-block marginal marks
  (CLAIM / ? / quote rule), decorative `text-transform: uppercase` running
  head labels.
- `src/features/journal/JournalPane.tsx` — the JournalPane owns runs/scrolling/
  save debounce; the block list under `cn-run__blocks`.
- `src/features/journal/BlockEditor.tsx` (block body),
  `blockVocabulary.ts` (kinds).

## Product target (UX-1 §9)

The journal should READ as a BLANK WRITING PAGE, not a list of cards:

- no card feel, no visible box/border around each block;
- no metadata panels, no paragraph chrome, no big labels;
- writing feels continuous across the leaf;
- the unterlying Folio/page-provenance model and block identity REMAIN
  canonical (page numerals + marginal taxonomy stay underneath, subdued).

## Rules

- Do NOT merge canonical records or remove block identity to fake one page —
  this is a VISUAL projection only (INV-003 / AC-009-010).
- Do NOT regress AC-015: the existing marginal-mark control stays in the tab
  order and stays functional. Keep the "type-change" reachable by keyboard.
- Keep `drawing` blocks and `DrawingCanvas` rendering intact (AC-008).
- Keep the save/debounce/conflict path in JournalPane intact (block sign
  semantics). Touch only VISUAL surface + progressive disclosure, not
  durability logic.

## Deliver

### A. Quiet blank writing surface
- Reduce visible structure: remove any boxy/card chrome on prose blocks;
  paper background stays `--cn-paper` (opaque), blocks become flat text rows
  separated by whitespace; borders rule only where truly needed (the leaf
  still needs its folio gutter). Make the running heads and marginal labels
  quieter (lower contrast, not shouty uppercase where it reads as chrome).
- Keep the p.<N> numerals as the provenance anchor but understated.
- The blank composition ("Start writing.") sits on the paper like text, not a
  container.

### B. Progressive disclosure — ghost actions on the block
Add a restrained, hover/focus-revealed action row for the most common block
operations, appearing when a block is hovered, focused or keyboard-focused:

- Quote
- Question
- Definition
- Move (up/down)
- Delete
- A disabled "Connect" entry labelled "Connect — later" (Phase-4 reservation
  of the space; DISABLED, does nothing). Do NOT implement Phase 4 wiring.

Implementation that satisfies AC-015 without a mouse-only path:

- Keep the existing mark = the type-change control in the tab order (it is
  the persistent keyboard reachable affordance AND hosts the same actions via
  the existing `Menu`).
- The ghost action row is a SECONDARY, convenience surface: it expands the
  same actions as the menu (Quote/Question/Definition/Connect-disabled/Move/
  Delete) and appears on hover AND on keyboard focus of the block, and its
  buttons are keyboard-reachable when visible. When not visible, the menu
  (already in tab order) still exposes the same actions, so nothing is
  mouse-only and no action is discover-hidden from keyboard users.
- Free right-click/context menu (optional, if a native `Menu` exists) can also
  open it.

Actions map onto EXISTING JournalBlockView callbacks (`onChangeKind`,
`onMoveUp`, `onMoveDown`, `onRemove`) via blockVocabulary — do not invent new
domain behaviour. Quote/Question/... change the block's kind through the
existing `canChangeKind` guard (a disabled state when the transform would
destroy content).

### C. Tests
- Unit: JournalBlockView tests (existing ones must pass) + new ones asserting
  the ghost action row appears on focus, is keyboard-operable, has
  screen-readable labels, and offers Connect as a disabled "future" item;
  block identity/provenance records unchanged.
- Extend the existing blank-page/Persist journal e2e journey to assert the
  paper surface has no visible card-chrome and content survives a reload with
  provenance intact. Mirror `e2e/shell/*` conventions.

## Report (verbatim)
1. files changed
2. what visual chrome was reduced/kept (journal css changes)
3. progressive-disclosure design + how keyboard reaches actions
4. how Connect-future is presented without Phase-4 behaviour
5. proof AC-008/AC-015 preserved and provenance records unchanged
6. targeted unit + e2e results
7. confirmation nothing else touched / no docs / no commit / no push / ZIP+install.sh byte-identical