# WORKSPACE UX-1 — S4: Lightweight local Pomodoro timer

Run AFTER S1 (it provides the left-overlay + top-chrome slots). Implemented by
Codex. Pomodoro only — no Whiteboard, no journal redesign.

## Repo / git state
- Repo: /home/lazi/Projects/personal/heisprojects/cntknw, branch `main`.
- Only unrelated untracked files remain `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`
  and `install.sh` — never touch. No `docs/` edits, no commit, no push.
- Read AGENTS.md, state docs, `git status` first.

## Product target (UX-1 §20)
A lightweight local Pomodoro timer. NOT the future Phase 8 statistics system.
Tone: affirming, never punishing ("You have been focusing" — never
"you failed your streak"). No gamification, no streaks, no guilt. No network,
no account, no dashboard page. No pet (EXPLICITLY NOT NOW — just don't build
architecture that would make a small sidebar companion impossible later).

## Behavior
- Modes: Focus · Short Break · Long Break. Suggest defaults 25 / 5 / 15 min;
  allow custom durations (inexpensive — a couple of inputs) if simple.
- Controls: Start · Pause · Resume · Reset · Skip.
- Compact presentation in the S1 left-overlay slot AND the S1 top-chrome
  Pomodoro region (small, unobtrusive; expands on demand). Do NOT create a
  dashboard/route.
- Timer must keep running (in the app's own state) while the user navigates
  within CNTKNW and switches workspace modes. Persist timer state locally
  (IndexedDB) so navigating does not reset it; a tick is not a DB-write storm
  — persist on state transitions (start/pause/reset/skip/mode switch and on
  pagehide) and keep an in-memory deadline; derive the remaining time from the
  wall-clock deadline, not by persisting every second (don't write to
  IndexedDB every second; drift-time ticks only when the visible badge
  changes). No backend sync.

## Implementation notes
- Reuse the existing repository/application boundaries and storage style
  (see how workspace/journal persist). A tiny timer service hook + a persisted
  timer record in the existing (single) database via an existing repository
  pattern is acceptable; do NOT create a second database. Prefer piggybacking
  on the existing persistence seams where cheap, else a narrow, schema-valid
  timer record. Keep concurrency guards intact if you add a record.
- When the timer completes a phase it stops (no auto-start of the next phase)
  and indicates completion (live region announcement "Focus session complete")
  without pushiness.
- Keyboard accessible (start/pause/reset reachable + announced).

## Tests
- Unit: reducer/service transitions (start/pause/resume/reset/skip, mode
  switch, elapsed derivation, completion), persistence survives a remount
  without resetting, no per-second writes (assert write count on transitions).
- e2e (`e2e/shell/pomodoro.spec.ts`): start focus timer; navigate within the
  app; timer continues; pause/resume; reset; no network requests. Mirror the
  repo's e2e conventions.

## Report (verbatim)
1. files changed
2. timer state machine + persistence model (record/store? no schema bump?)
3. where shown in chrome + keyboard/announcements
4. proof no per-second DB writes and no network
5. targeted unit + e2e results
6. confirmation nothing else touched / no docs / no commit / no push / ZIP +
   install.sh byte-identical