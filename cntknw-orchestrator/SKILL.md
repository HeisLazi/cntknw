---
name: cntknw-orchestrator
description: "Use when continuing or reviewing CNTKNW development."
version: 1.2.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [cntknw, orchestration, codex, opencode, ollama, git]
---

# CNTKNW Orchestrator

Use when the user says “continue CNTKNW”, “work on CNTKNW”, “next CNTKNW milestone”, “review CNTKNW”, or “fix CNTKNW”.

## Startup

1. Dynamically locate the `HeisLazi/cntknw` Git repository; do not assume an old path.
2. Read repo-root `AGENTS.md`, the volatile CNTKNW state file under `docs/`, `docs/CNTKNW_Current_Implementation_Status.md`, and relevant findings in `docs/CNTKNW_Repository_Review_2026-08-02.md`.
3. Run `git fetch origin`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse origin/main`, and `git log -5 --oneline`.
4. Git is authoritative. If HEAD differs from `origin/main`, investigate before editing. Preserve every unknown/untracked file.
5. Identify the current approved milestone from repository evidence. Never infer approval from roadmap order alone.

## Product invariants

- Exactly three primary destinations: Library, Gallery, Notes.
- Books and artworks share one Study Workspace.
- One continuous canonical journal per source; alternate views are projections, not duplicate stores.
- Source-created content inherits source location.
- Block identity and provenance survive transformations.
- No silent writing loss; local-first/offline behavior and mandatory concurrency guards remain intact.
- Phase 2 Infinite Journal is closed unless a demonstrated regression requires a narrow fix.

## Worker routing

Free Zen models are NON-SENSITIVE ONLY (never for work/confidential/client
repos, secrets, credentials, customer data, or private documents).

- Manager (orchestration/planning/repo-state reasoning): `manager` = `opencode-zen/deepseek-v4-flash-free`; fallback `opencode-go/deepseek-v4-flash`, then Ollama Cloud.
- Architecture-sensitive/core work: Codex CLI, GPT-5.6 Sol, High reasoning. Escalate to Sol Max only after a genuine blocker.
- Bounded known-architecture implementation: Codex CLI, GPT-5.6 Terra, High.
- Mechanical work: verified free Zen coder (`opencode-zen/ling-3.0-flash-free`) or Go (`opencode-go/mimo-v2.5`) or Codex Terra Medium.
- Default independent reviewer: `opencode-zen/laguna-s-2.1-free` (micro-eval winner), read-only and adversarial; important milestone review on `opencode-go/minimax-m2.7`, escalation `opencode-go/minimax-m3`.
- Large-context audit: `opencode-go/deepseek-v4-flash` or `ollama-cloud/deepseek-v4-flash:0731`.
- Visual/frontend review: `opencode-go/kimi-k2.6`.
- Escalation reviewer: `opencode-go/deepseek-v4-pro`, only when justified.

The direct DeepSeek API route is not authenticated in Hermes; keep it dormant
and never route to it. On repeated provider failures stop retrying, move to the
fallback, and record the model as temporarily unhealthy. Free model IDs may
disappear; routing must tolerate that.

Do not create unnecessary swarms.

## Implementation brief

Give the worker verified HEAD/origin/status, milestone objective, affected invariants, exact scope/non-goals, files to inspect, acceptance criteria, required tests, documentation changes, Git safety rules, commit message, push/post-push verification, and report format. The worker owns implementation, tests, docs, intentional staging, normal push, and post-push HEAD comparison.

Never use `git add .` while unrelated untracked files exist. Never force-push, hard-reset unknown work, amend pushed commits, or rewrite history.

## Independent review

After implementation, verify the commit and actual diff yourself. Run a read-only OpenCode adversarial review against the base and implementation SHAs. Classify findings CRITICAL/HIGH/MEDIUM/LOW. Send only blocking corrections back to Codex, then re-review.

## Required closure gate

Run one uninterrupted final gate:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit --omit=dev
```

A targeted rerun never converts a failed full gate into a successful gate. Update volatile/canonical docs only when evidence supports the new status. Stage intentional files explicitly, push normally, fetch, and verify local HEAD equals `origin/main`.

## Standard report

Report milestone/verdict, exact SHA, changed files, behavior and architecture decisions, tests and exact totals/skips, typecheck/lint/build/audit, docs, remaining findings, `git status --short`, local HEAD, `origin/main`, whether they match, and preserved unrelated files.

End with exactly `MILESTONE STATUS: COMPLETE AND VERIFIED` or `MILESTONE STATUS: NOT COMPLETE`, then stop unless continuous execution was explicitly authorized.
