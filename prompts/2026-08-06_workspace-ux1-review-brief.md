# UX-1 independent adversarial review brief

You are the independent read-only reviewer for WORKSPACE UX-1 (Zen/Gruvbox
study desk + infinite whiteboard + pomodoro) in the CNTKNW repo at
<repo-root>. Do NOT edit, commit, push,
or stage anything. Produce a written review only.

## Baseline
- Accepted baseline commit: 3b2c33320ad2167800707e932a9a57d1b58006fe (git rev-parse HEAD == origin/main == that).
- The ENTIRE UX-1 implementation is the uncommitted working-tree diff on top of
  that baseline. Inspect via `git diff 3b2c33320ad2167800707e932a9a57d1b58006fe` and by reading files.
- There are 4 implementation briefs in prompts/: 2026-08-06_workspace-ux1-s1-foundation-brief.md,
  -s2-journal-brief.md, -s3-whiteboard-brief.md, -s4-pomodoro-brief.md. Treat
  these as the acceptance contract. Read AGENTS.md and
  docs/AI_PROJECT_STATE.md too.

## Confidentiality of protected files
Also note: two protected untracked files
`docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` and `install.sh` are out
of scope and must not be reviewed or touched. Do not stage anything.

## What was built (verify, don't trust)
S1: Gruvbox+glass design tokens; hidden overlay left nav; minimal reveal top
chrome; right ContextPanel (PDF Contents lifted in); horizontal Study
Workspace with split/source-focus/journal-focus + split presets + written
Ratio default 0.7 persisted; keyboard a11y; zen-workspace.e2e.
S2: journal blank-page visual redesign; progressive-disclosure ghost action
bars (Quote/Question/Definition/Move/Delete + disabled Connect-later);
claims nothing lost, visual-only.
S3: infinite vanishing-paper whiteboard project (hand-rolled SVG in
src/features/whiteboard), Select/Pen/Pencil/Highlighter/Eraser/Line/Arrow/
Rect/Ellipse/Text/Hand, colors, session undo/redo, pan/zoom, Write/Whiteboard
switch via WorkspaceState.layout.rightWorkspace, subtle p.N provenance,
objects are canonical journal blocks (drawing|paragraph) positioned by a
WorkspaceState.whiteboard.layout projection (x,y)
persisted with useWorkspacePersistence; document the canonical-ownership
decision, no per-pointer writes, undo restores block+layout, no second store.
S4: local pomodoro feature (focus/break modes, start/pause/resume/reset/skip,
custom durations), persistence on transitions only (wall-clock deadline, no
per-second writes, no network), in left-overlay + top-chrome.

## Your mandate — adversarial, evidence-first
Adversarial means genuinely try to break it, not approve it. Produce a
numbered findings list. Each finding MUST have:
- Severity: CRITICAL / HIGH / MEDIUM / LOW (CRITICAL=data loss or security;
  HIGH=broken product invariant or a crash/data-corruption path; MEDIUM=bug/
  gap with a workaround; LOW=polish).
- One-sentence description, then concrete evidence: file:line + the failing
  argument or a repro sketch. No invented code — cite what you actually read.
- The capability that would satisfy it.

Focus hard areas (look for the real bugs):
1. Concurrency/durability: whiteboard save flush, the pendingEdit seam
   (revision guards), delete vs projection-delete vs block-delete ordering,
   restoreBlock after undo. Verify you never accumulate a stale revision /
   a "flush clears a never pending" guard / conflicting writes. Trace the
   exact save path from pointer-up to indexed DB write for (a) a new stroke,
   (b) a text object, (c) a move, (d) a delete-then-undo.
2. Validation/schema: DrawingData v1 unchanged; text → paragraph; layout
   projection schema; can a shape store content that fails to validate / is
   out of viewBox bounds? superRefine.
3. One-truth invariant: does anything duplicate content (raster, second
   store, duplicated DrawingData), or let the whiteboard diverge from the
   journal run? could a board position block and journal twice?
4. Phase-4 leakage: any feature beyond whiteboard/workspace-chrome/pomodoro
   (connection, backlink, graph, search, dictionary)? Does the Write/Whiteboard
   switch navigate away or unmount destructive state?
5. Accessibility: focus trap in overlays, tool aria-pressed/live-region,
   keyboard-only use of whiteboard tools, focus return, tab-order regressions
   in the journal.
6. Performance: per-pointerwork, setState storms, unbounded history, viewport
   changing geometry, backdrop blur over paper.
7. Security/sanitization: any dangerouslySetInnerHTML, SVG injection from
   stroke/color-control, CSP, external URL fetch, unsandboxed paths.
8. Offline/local-first: no network at runtime in pomodoro/whiteboard; storage
   boundaries and schemaVersions intact (no accidental draft of a new schema
   version).
9. Test honesty: check that the new tests and the claimed counts (whatever the
   suite reports) are actually run and would fail on the real bug; report any
   skipped/ghosted assertions.

## Output format
```
VERDICT: PASS | PASS WITH CORRECTIONS | FAIL
Findings:
- [CRITICAL] path:line — title — evidence
- [HIGH] ...
- [MEDIUM] ...
- [LOW] ...
Summary paragraph (2-4 sentences).
```
List every finding you have, even if none is CRITICAL. If it is honestly clean,
say PASS but still list any LOW polish items you noticed.