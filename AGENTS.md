# CNTKNW Agent Instructions

This file is the repository-local operating contract for AI work on CNTKNW.

## Startup checklist

Before deciding or editing:

1. Confirm this checkout is `HeisLazi/cntknw`; discover the path dynamically rather than assuming an old location.
2. Read this file, `docs/AI_PROJECT_STATE.md`, `docs/CNTKNW_Current_Implementation_Status.md`, and relevant findings in `docs/CNTKNW_Repository_Review_2026-08-02.md`.
3. Run `git fetch origin`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse origin/main`, and `git log -5 --oneline`.
4. Treat Git as authoritative. If local HEAD differs from `origin/main`, investigate before editing.
5. Preserve every unknown/untracked file. Never use `git add .` in a dirty tree.
6. Identify the current user-approved milestone from live repository evidence. Roadmap order alone is not approval.

## Product invariants

- Exactly three primary destinations: Library, Gallery, Notes.
- Books and artworks use the same Study Workspace.
- One continuous canonical journal exists per source; alternate views are projections, not duplicate stores.
- Content created from a source inherits the source location.
- Block identity and provenance survive transformations.
- Never silently lose writing.
- Preserve local-first/offline behavior and mandatory optimistic-concurrency guards.
- Phase 2 Infinite Journal is closed unless a demonstrated regression requires a narrow fix.

## Worker policy

Hermes is the manager and verifier; it should not be the primary coding worker.

### Provider routing (live model identifiers)

Free Zen models are NON-SENSITIVE ONLY. Never use them for internship/work
repositories, confidential company/client source, secrets, credentials,
customer data, or private documents. For sensitive/work contexts route to Go,
Ollama Cloud, or native Codex.

Aliases (resolved via `opencode-zen/<id>`, `opencode-go/<id>`, `ollama-cloud/<id>`):

- Manager (Hermes orchestration/planning/task decomposition/repo-state reasoning): `manager` = `opencode-zen/deepseek-v4-flash-free`, fallback Go `opencode-go/deepseek-v4-flash`, then Ollama Cloud.
- Free independent review: `opencode-zen/laguna-s-2.1-free` (best in micro-eval; read-only/adversarial).
- Free mechanical coder: `opencode-zen/ling-3.0-flash-free` (verified); do NOT use free models for core architecture.
- Free overflow (summarization/classification/docs cleanup): `opencode-zen/laguna-s-2.1-free`.
- Go fast/cheap (overflow orchestration, bulk analysis, test triage): `opencode-go/qwen3.7-plus`.
- Go general cheap (docs, ordinary analysis): `opencode-go/mimo-v2.5`.
- Go review (important independent milestone review, adversarial QA, diff review): `opencode-go/minimax-m2.7`.
- Go review plus (higher-stakes cross-cutting): `opencode-go/minimax-m3`.
- Go coder (bounded known-architecture work): `opencode-go/kimi-k2.7-code`.
- Go visual (frontend/UI/visual critique): `opencode-go/kimi-k2.6`.
- Go escalation (difficult arbitration only): `opencode-go/deepseek-v4-pro`.
- Ollama Cloud fallback: `ollama-cloud/deepseek-v4-flash:0731`.

Architecture-sensitive/core implementation (persistence, annotation geometry,
concurrency, architecture, major refactors, difficult bugs, core product
behavior): Codex CLI, GPT-5.6 Sol, High. Bounded implementation in known
architecture: Codex GPT-5.6 Terra, High. Mechanical/simple work: verified free
Zen coder OR Go model OR Codex Terra Medium, depending on quality/sensitivity.
Sol Max only after a genuine blocker.

The direct DeepSeek API route is NOT configured/authenticated in Hermes
(`DeepSeek ✗ not set`); keep it dormant, never route to it, and never retry a
known-failing provider path. On repeated transport/auth/server failures stop
retrying, move to the configured fallback, record the model as temporarily
unhealthy, and retry only during an explicit health check.

Free/direct provider model IDs are temporary and may disappear; routing must
tolerate disappearance by falling back. Do not create unnecessary swarms.

## Delegation contract

Implementation briefs must include verified SHAs/status, milestone, invariants, exact scope/non-goals, acceptance criteria, required tests, docs, Git safety, commit message, push/post-push verification, and report format. The worker owns implementation, tests, docs, intentional staging, normal push, and post-push verification.

After implementation, Hermes verifies the actual diff/commit and commissions an independent read-only review. Classify review findings CRITICAL/HIGH/MEDIUM/LOW. Send blocking corrections back to the implementer, then re-review.

## Required final gate

One uninterrupted successful run is required:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit --omit=dev
```

A targeted rerun does not convert a failed full gate into a successful gate.

## Git safety

- Stage intentional files explicitly.
- Never force-push.
- Never amend a pushed commit.
- Never rewrite history.
- Never hard-reset unknown work.
- Fetch after push and verify local HEAD equals `origin/main`.

## State and reporting

Update `docs/AI_PROJECT_STATE.md` whenever project state changes. Reconcile canonical status/review documents only when evidence supports it.

Final reports must include milestone/verdict, SHA, changed files, behavior/architecture, exact tests and skips, full-gate results, docs, remaining findings, Git status, local/origin SHAs, and preserved unrelated files. End with `MILESTONE STATUS: COMPLETE AND VERIFIED` or `MILESTONE STATUS: NOT COMPLETE`, then stop unless continuous execution was explicitly authorized.
