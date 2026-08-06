# WORKSPACE UX-1 — S5: review-correction pass (blocking findings)

From an independent adversarial review (minimax-m3) of the S1–S4 UX-1 diff:
VERDICT = PASS WITH CORRECTIONS. The full local gate (typecheck, lint, 673
unit, build) is already green. Your job: fix the listed findings without
regressing the gate. Code + tests only; no docs/ edits; no commit; no push.
NEVER touch `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` or
`install.sh`.

Read AGENTS.md and git status/log first. The working tree holds the entire
UX-1 implementation (S1–S4) on top of baseline 3b2c333; do not disturb the
rest. Preserve prior changes; add only the corrections below plus tests.

FIX ALL HIGH + MEDIUM, plus the LOW items explicitly marked MUST. For LOW
items marked OPTIONAL you may defer and record a one-line rationale in your
report. Then update the affected tests and add any new ones described.

## HIGH-1 — useWhiteboardJournal.ts:155-170: delete is stuck after a save failure
A revision-conflict/other failure on `flushRef.current(blockId)` populates
`failedWrites` but does NOT clear `pending.current`, so the subsequent
`if (pending.current.has(blockId))` throws "The latest object changes must
save before it can be deleted" — the user can only retry a save that keeps
failing; delete and undo are blocked forever (CRITICAL-adjacent dead-end).
Fix: in the catch distinguish (a) "save failed because the store moved"
(revision conflict) — discard the stale pending edit, re-read the latest
revision from the store, then permit the delete/undo to proceed; from
(b) transient failure — keep the pending entry and refuse the delete.
Extend the repository ContractTest for RevisionConflictError to cover this
path, and add a Whiteboard test proving delete/undo succeeds after a
conflict is reconciled.

## HIGH-2 — SplitPane/StudyRoute: Source Focus leaves a blank strip
In Source Focus (`rightVisible === false`) the right pane+handle are hidden,
but the left pane still has `style={{ flex: '0 0 ${percent}%' }}` (default
70%), so 30% of the work area is empty. The narrow-viewport CSS already makes
the visible pane fill when one side is hidden — do the same for the
wide-screen focus mode (single rule that fires when `startVisible===false`
or `endVisible===false` → visible pane `flex: 1 1 auto`). Add a unit test
(hide one pane, assert the visible pane's width ≈ full container) and extend
the zen-workspace e2e to assert Source Focus fills the work area.

## MEDIUM-1 — Whiteboard quick swatches mismatch: "click Red, then draw" broken
Quick/recent swatches call `recolorSelected` on click (no-op when nothing is
selected), so users cannot set the NEXT stroke's color with a swatch. The Hex
control already splits intent (onChange → next stroke, onBlur → recolor select).
Fix: clicking a swatch sets the upcoming-stroke color (`rememberColor`), and
provide a distinct, explicit affordance (e.g. a "Apply to selection" action or
a separate menu item) to recolor the currently-selected object — the two
intents must never collide silently.

## MEDIUM-2 — Whiteboard paragraph `<text>` hard-coded 240px width
`objectSize`/hitbox/foreignObject and the selection rect are a constant 240px,
so text longer than ~24 chars per line is truncated in edit and mis-hitboxed
in select, and the aria-label isn't text-aware. Fix: measure the rendered text
(or use a hidden probe) and grow hitbox + foreignObject width accordingly (and
make the aria-label length-aware). Keep it robust when font/zoom changes.

## MEDIUM-3 — Tool single-letter shortcuts shadow focused toolbar buttons
The global keydown intercepts "p"/"h"/etc. even when a `<button>` in the
toolbar has focus, so Space on a focused button switches tools instead of
activating it. Fix: skip the shortcut when `event.target` is a `<button>` (or
attach the shortcut layer to the canvas, not a delegated handler reaching over
toolbar buttons). Add a test: focus the Pen button, press Space, Pen stays
focused and is activated (not switched-away).

## MEDIUM-4 — Journal ghost action row permanently reserves block bottom space
The block always has `padding-block-end: calc(chrome + md)` even when the ghost
row is hidden, adding whitespace to every block on every pane. Fix: reserve the
row space only while `actionsVisible` is true (conditional class / overlap the
bottom margin) so a hidden row consumes no layout. Keep AC-015 (row reachable
on hover & keyboard focus) intact.

## MEDIUM-5 — Journal: Menu and ghost row duplicate actions incl. two "Connect"
The 13-item type Menu and the ghost row overlap, with a disabled
"Connect — later" in BOTH. Pick ONE canonical source of truth (the Menu is the
in-tab-order persistent control) and remove the duplicate disabled Connect from
the row (or let the ghost row expose just Move/Delete). Ensure no action lost.

## LOW — apply where cheap (else document a deferral)
- Focus trap on the open left-nav overlay and right ContextPanel (Tab cycles
  within, `aria-modal`/`role=dialog` where it is a modal). (a11y — do this.)
- Add a test for closing navigation via the same Ctrl/Cmd+Shift+M shortcut and
  asserting focus returns to the trigger (existing test only covers Escape).
- `doc` divergence: whiteboard edit writes a ProseMirror `doc`; decide and
  record a single producer of `doc` (ADR-0005 BlockEditor). Prefer sending
  text-only edits and letting journal regenerate the doc; verify no divergence.
- Arrow tool records 3 separate strokes (recolour independently) — collapse to
  one stroke with NaN-separated path so an arrow recolours as one object.
- Arrowhead length should be screen-stable (not vanish at 10% zoom).
- Recent-colour swatches need a visual differentiator (border) vs curated ones.
- Pomodoro `nextMode` auto-rotation never reaches `long-break` — document the
  2-cycle or implement "every fourth focus → long break".

## Verification (verbatim results)
- `npm run typecheck`, `npm run lint`, `npm run test`,
- whiteboard + journal + zen-workspace + accessibility + pomodoro + routing
  Playwright specs.
- `git diff --check`.
Report each fix (file + change), the exact test counts, and a one-line note on
each deferred LOW item. Confirm the two protected untracked files
(ZIP + install.sh) remain untouched and byte-identical.