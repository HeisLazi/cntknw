# UX-1 S6 — bugfix: kind-menu mouse click on an EMPTY composing block

You are fixing a regression caught by the full e2e gate. WORKSPACE UX-1
(design system + chrome + journal blank-page + whiteboard + pomodoro) is
implemented in this working tree on top of baseline 3b2c333 (git rev-parse
HEAD == origin/main == that). Everything except these fixes is already
reviewed and green except TWO failing browser specs that you must repair so
the FULL gate is green.

## The failing tests
- e2e/browser/bv-009-journal-acceptance.spec.ts › "G. Pending edit kind
  transforms for non-paragraph kinds" (line 207)
- e2e/browser/bv-009-journal-acceptance.spec.ts › "H. Conflict resolution
  for non-paragraph textual kinds" (line 282)
Both fail at `await page.click('text="Evidence"')` / `text="Objection"`:
the type-change Menu never appears. Repro: `npx playwright test
e2e/browser/bv-009-journal-acceptance.spec.ts -g "G.\\|H." --project=chromium`.

## Diagnosed root cause (verified with a DOM probe — trust this)
The failing step clicks the type-change mark button
(`.cn-block__mark-button`, the Menu trigger) on the NEW EMPTY COMPOSING
paragraph block (created by `press('Enter')`, showing the "Write…" placeholder),
then expects the Menu to open.

Evidence gathered live in Chromium:
- On that empty block, `pointerdown` and the `mousedown` both hit the
  button; the `click` event does NOT. A capture listener at `document` shows
  the click being dispatched on the ANCESTOR `.cn-block` (the block root)
  instead of the button. That is the browser's quirk for "mousedown and
  mouseup targeted different button NODES": React replaced/remounted the
  button DOM node between the down and up while the block re-rendered
  (the block gains `cn-block--actions-visible` / a ghost action row on focus),
  so the click is delivered to their common ancestor and the trigger's
  `onClick` never runs.
- Keyboard activation (focus the button, press Space) DOES open the menu
  (proven: `[role=menu]` renders its items), because no pointer remount.
- On a normal (non-composing, already-committed) block the mouse click
  WORKS. It is specific to the EMPTY COMPOSING block that re-renders on
  pointerdown/focus.

We DO NOT want to change the e2e test. We want a product fix so a mouse
click on the type-change markdown of ANY block, incl. the empty composing
one, opens the menu.

## Fixes to apply (product behavior — keep semantics + a11y)
Implement a robust, minimal fix. Two acceptable directions (pick the one
that keeps the ghost-row UX and keyboard semantics):
1. Do not replace/mount the markdown button node across the
   focus/actions-visible re-render (e.g. keep the ghost action row
   mounted-tree and toggle its visibility via an attribute/
   hidden property / CSS rather than conditionally unmounting the row so
   the block's child list is stable), so the click always reaches the
   button. [preferred if straightforward]
2. OR open the Menu reliably on MOUSE-DOWN (PointerDown/MouseDown) for the
   trigger in addition to onClick, so a swallowed click cannot block the
   open. Keep keyboard +1 paths intact.

Whichever you choose: verify the empty-composing-block mouse click opens
the menu in Chromium, and add a regression test that reproduces the exact
scenario (Enter a second empty block, mouse-click its type Markdown button,
menu opens with "Evidence"/"Objection" items), plus keep your tests. Do NOT
weaken ANY existing assertion and DO NOT touch the bv-009 assertions.

## Scope
- Only fix this interaction. Do NOT redesign the Menu, the ghost row, the
  save path, or the whiteboard. Code + tests only.
- Read AGENTS.md and git status first. Preserve the rest of UX. Do NOT
  touch the protected untracked files (docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip
  and install.sh).
- No docs/ edits (manager owns docs/ADR), no commit, no push.

## Verification (must all be green)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npx playwright test e2e/browser/bv-009-journal-acceptance.spec.ts --project=chromium` (ALL letters A..H must pass)
- Your new regression test
- `git diff --check`
Report root cause confirmed, the fix (file+lines), how it preserves keyboard
AC-010/AC-015, and exact counts. Confirm ZIP + install.sh untouched.