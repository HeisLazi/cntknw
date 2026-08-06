# WORKSPACE UX-1 — S1: Design system + do-useful chrome + workspace layout

Implemented by Codex. Do NOT start the infinite Whiteboard (S3), the
Journal blank-page redesign (S2), or Pomodoro (S5). This session is the
presentation-layer foundation.

## Repo / git state (verified by manager)

- Repo: /home/lazi/Projects/personal/heisprojects/cntknw (HeisLazi/CNTKNW), branch `main`.
- local HEAD == origin/main == 3b2c33320ad2167800707e932a9a57d1b58006fe (accepted baseline).
- Working tree: ONLY two untracked files exist, `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` and `install.sh`. NEVER stage, modify, delete or rewrite either.
- No amend. No force-push. No history rewrite. No `git add .` in a dirty tree.
- Children code+tests only. Do NOT edit `docs/`, do NOT commit, do NOT push. (Docs are written by the manager at closure.)

## Milestone intent (WORKSPACE UX-1, after Phase 3 which is CLOSED)

Make the EXISTING product feel like an intentional quiet study environment.
Gruvbox Dark Soft atmosphere, glass chrome over opaque work surfaces, content
first, chrome revealed on demand. NOT Phase 4 (no connections/backlinks/
graph/search/dictionary). Three primary destinations stay exactly Library/
Gallery/Notes.

## Hard invariants to preserve (these MUST still pass)

- AC-002 exact source resume: reading position persistence must keep working.
- AC-003 source-created content inherits active page/location (unchanged here).
- AC-015 keyboard accessibility, visible focus, no mouse-only navigation.
- Exactly three primary destinations; `navigation.test.ts` asserts length === 3. You may change HOW they're rendered (overlay panel) but not the set.
- The design-token architecture tests in `src/design/design-tokens.test.ts`
  remain intact or only get STRICTER. No hex literals, no hard-coded
  durations/z-index outside `tokens.css`.
- No new runtime dependency. This milestone is hand-rolled (no UI library).
- All existing unit + e2e tests must keep passing.

## Where things live today (inspect first)

- `src/design/tokens.css` — raw palette + semantic roles (warm ink palette
  now); `src/design/base.css`; `src/design/design-tokens.test.ts`.
- `src/components/shell/AppShell.tsx` + `shell.css` — permanent left nav
  (Library/Gallery/My Notes) currently consumes `--cn-nav-width` 15rem permanently.
- `src/app/routes/StudyRoute.tsx` — the Study Workspace; already uses
  `SplitPane` (`@components/primitives/SplitPane.tsx`) for a 50/50 vertical
  split and `useWorkspacePersistence` for persisted `WorkspaceState`
  (`src/features/workspace/useWorkspacePersistence.ts`).
- `WorkspaceState` lives in `src/domain/...` (see `initialWorkspace` in
  `StudyRoute.tsx`: layout `{mode:'split', splitRatio, sourceCollapsed,
  journalCollapsed}`). Persisted via useWorkspacePersistence (commit for
  discrete changes like layout mode, drift for continuous ratio).
- `src/components/primitives/SplitPane.tsx` — already a real accessible
  separator (arrow-key 2% steps, Home/End); supports `orientation`,
  `defaultRatio`, `minRatio/maxRatio`, `onRatioChange`.
- Reader: `src/features/reader/PdfReader.tsx`, `PdfOutline.tsx`, which takes
  `document: LoadedDocument` + `onNavigate(page)`. StudyRoute already holds
  the `LoadedDocument` (it loads bytes then `loadPdfDocument`) — so the
  outline can be lifted into the new right context panel.

## Deliver for S1

### 1. Design system — Gruvbox Dark-Soft tokens

The existing warmard palette is already close. Adjust the `tokens.css` so the
default `:root`/dark theme is Gruvbox Dark-Soft-flavoured:

- canvas/paper family: #282828 / #32302f backgrounds, #3c3836 raised,
  #504945 selection, #ebdbb2 primary text, #a89984 muted.
- Keep the token architecture: extend `--cn-palette-gruvbox-*` raw family AND
  remap the semantic roles (`--cn-canvas`, `--cn-surface`, `--cn-surface-raised`,
  `--cn-paper`, `--cn-ink`, `--cn-ink-muted`, `--cn-accent`, etc.) so rest
  components pick up the new palette through roles, not literals. Do not
  scatter new hex values into feature CSS.
- Add semantic Z-gruvbox accents (red/green/yellow/blue/purple/aqua/orange) as
  raw `--cn-palette-*` tokens only; the app uses them sparingly/semantically.
- KEEP dark as default and KEEP the `[data-theme='light']` block working
  (the light block only redeclares roles, never palettes — see test).
- Add the glass layer tokens: `--cn-glass-bg`, `--cn-glass-border`,
  `--cn-glass-blur` using color-mix with transparency + backdrop-filter,s for
  APP CHROME only (left overlay / right panel / top chrome / popovers /
  Pomodoro). Never blur beneath readable PDF or journal text — opaque work
  surfaces remain `--cn-paper`/`--cn-surface`.
- Ensure `prefers-reduced-motion` still collapses all durations; ensure
  `prefers-reduced-transparency` degrades glass to near-opaque (graceful).

Crunch: `design-tokens.test.ts` must keep passing (and ideally gain a new
assertion that no feature CSS uses a glass/backdrop-filter). New tokens go in
tokens.css; touch the test only to make it stricter.

### 2. Segregate AS-ambiguous — surface layout is opaque

Add tokens/layout for: solid work surfaces always opaque. PDF pages, journal
paper, whiteboard canvas remain literally opaque throughout. Only the chrome
overlays and menus use translucency.

### 3. Chrome conversion — hidden overlay panels + minimal top surface

Refactor `AppShell` + `shell.css`:

- **Left overlay panel** (replace the permanent nav column). Closed BY DEFAULT
  so content starts full-width. When open it overlays at the left edge (glass,
  subtle blur over the work area, does NOT shrink the work). Content:
  exactly the three primary destinations (Library / Gallery / My Notes) using
  PRIMARY_DESTINATIONS, the component brand mark, and a reserved Pomodoro
  region (S4 will fill it — stub it now with a disabled/placeholder "Focus
  timer" row that displays nicely, no timer logic yet).
  Open affordances: (a) an always-reachable left edge button (visually subtle
  when closed, e.g. a narrow "rail" or small floating button), (b) keyboard
  shortcut, (c) accessible focusable control. Close: Escape, same shortcut,
  close affordance, and clicking an active route also closes it.
  NOT mouse-hover-only for critical navigation.
- **Minimal revealable top chrome**: replace the current permanent study title
  bar area. In the default study state show as few pixels of chrome as
  possible. Provide a small revealable surface holding source title, global
  controls, workspace controls (split / Source Focus / Journal Focus /
  Whiteboard Focus), Pomodoro, and settings/overflow. It must be
  keyboard-accessible and NOT require hover. It may collapse to a slim strip
  and expand.
- **Right context panel SHELL** (no real features yet): a reusable
  `ContextPanel` primitive (place in `src/components/primitives/`), closed by
  default, overlays the work rather than shrinking it, glass chrome. For this
  milestone, MOVE the PDF "Contents" outline into it as its first occupant:
  lift `PdfOutline` from inside `PdfReader` to `StudyRoute` (StudyRoute owns
  the `LoadedDocument`), render it inside the right `ContextPanel`, wire
  `onNavigate` to `setPage`. Remove the old in-reader "Toggle contents" so the
  same outline is not reachable two ways. Keep `PdfOutline.tsx` itself.

All chrome affordances get clear, compound OR `aria-*` accessible labels and
visible focus rings (the global `:focus-visible` rule already exists).

### 3. Horizontal Study Workspace + focus (projection) modes

Default workspace layout is HORIZONTAL adjacency:

     Source/Reader  |  Journal-or-Whiteboard
(book on the left, the writing/drawing surface on the right).

- `SplitPane` already does resizable split. Give it a set of sensible
  defaults (Reading-heavy ~70/30, Balanced 50/50, Writing-heavy 40/60,
  Whiteboard-heavy 30/70). These are RATIOS the user can reach via the
  divider; optionally add a small "reset to balanced" control. Persist the
  current ratio (already via `onRatioChange -> drift`).
- Make the divider visually SUBTLE when idle and clearly affordant only on
  hover/DS:focus/drag (thin, low-contrast line; high-contrast on hover). It
  must remain reachable and operable by keyboard (SplitPane already gives
  that — don't regress).
- Add layout FOCUS MODES as projections, NOT separate routes/state: 
    - Split (both panes)
    - Source Focus (book only — hide the right pane)
    - Journal/Whiteboard Focus (right pane only, full width)
  Extend `WorkspaceState.layout` accordingly: keep `mode` and `splitRatio`,
  and the RIGHT pane's kind (`rightWorkspace: 'write' | 'whiteboard'`) with
  default `'write'` for S1 (the whiteboard pane itself lands in S3). Switching
  focus modes PRESERVES both panes' scroll positions and any pending edits
  (projection/no-remount). Implement mode-switch locally in StudyRoute without
  unmounting PdfReader / JournalPane.
- Keyboard-accessible mode + Write/Whiteboard switcher controls in the top
  chrome.

### 4. Persistence + performance

- Layout mode and ratio are discrete/continuous respectively — reuse the
  existing commit vs drift split in `useWorkspacePersistence`. Do not write on
  pointer move.
- Keep PDF resume/scroll debounce behavior unchanged.

### 5. Responsive

Desktop/laptop primary. On narrow widths avoid absurd-narrow panes; allow the
split to collapse to a single active pane with a fast pane-toggle when the
container is small (e.g. < 900px). Do not build phone-first.

### 6. Tests you must add (unit; keep existing passing)

- SplitPane default/limit behavior (extend existing SplitPane tests if any).
- Workspace layout state: mode/ratio serialize and restore through
  useWorkspacePersistence (mirror existing patterns).
- AppShell: left panel hidden by default; open via button and via keyboard
  shortcut; closes via Escape; focus returns to the trigger after close;
  hidden panel content is NOT tab-focusable while closed; exactly 3 primary
  destinations still asserted by navigation.test.ts.
- Right context panel: closed default; not focusable when closed; opens/
  closes with keyboard; does not shrink the work area (it overlays).
- Top chrome revealed affordance is keyboard-reachable (no hover-only).
- Design tokens: still pass + new strict check that feature css has no
  backdrop-filter literal and no hex literal.
- StudyRoute: switching focus mode preserves PdfReader and JournalPane
  (render presence / no remount), preserves page + journal scroll + pending
  edits (react-testing-library; follow existing StudyRoute/PdfReader mock
  patterns in the repo tests).

At least one Playwright e2e journey (add `e2e/shell/zen-workspace.spec.ts`):
- open a source; assert left panel hidden by default;
- resize the split divider (drag or assert persisted default);
- reload; assert split preference restored;
- open/close left nav; assert focus returns and nav still active;
- switch Source Focus and back; assert the PDF page is preserved.
Match existing e2e setup (they use `makePdf`, `resetApplicationStorage`,
`test.use({ viewport ... })`, local dev server URL from `playwright.config`),
SEE `e2e/shell/*.spec.ts` to mirror conventions.

## Run targeted verification

- `npm run typecheck`
- `npm run lint`
- `npm run test` (whole unit suite, plus your new suite files)
- `npx playwright test e2e/shell/zen-workspace.spec.ts` (plus existing
  representative specs that touch the shell: e.g. any nav/study spec) to prove
  no regression. E2e needs the app running; check how existing specs start it
  (webkit) for the standard pattern.

## Report (verbatim)

1. files changed
2. design-system: token diffs + new strict checks; light-mode still passes
3. left overlay / top chrome / right context panel implementation summary
4. workspace landscape + focus modes + split persistence
5. the layout state shape change (WorkspaceState.decode)
6. keyboard/accessibility mappings used
7. targeted test results (unit counts + the new e2e + existing shell-adjacent specs)
8. confirmation nothing else touched / no docs / no commit / no push / ZIP + install.sh untouched