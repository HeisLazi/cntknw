# CNTKNW Publication Audit (Phase 2)

**Date:** 2026-08-10
**Audited HEAD:** `5734da541460e74330ca60980189c809368147af` (branch `portfolio/public-readiness`)
**Target repository:** `HeisLazi/cntknw` (proposed public GitHub repository)
**Auditor:** automated repository audit (read-only; no files modified other than this document)

---

## 1. Verdict

**CONDITIONAL GO** — no credentials, tokens, keys, or private-service URLs exist anywhere in the tree or in any commit; the only pre-publication actions required are deletion of one remote branch (+ its open PR) carrying a strategic business dossier, and care that locally-created Codex snapshot refs are never pushed.

---

## 2. Audit scope and method

**Scope.** All tracked files at HEAD (283 files), all 43 commits reachable across all refs (`git rev-list --all`), all refs including tags and non-branch refs (`refs/codex/*`), the remote state (`git ls-remote origin`), and the three protected untracked files (existence only).

**Methods.**

- `git grep -I -n -E '<patterns>' HEAD -- .` for the HEAD tree; same pattern set run against every commit hash (`git grep` across `git rev-list --all`) for full-history blob coverage.
- Pattern sets: `sk-*`, `ghp_*`, `gho_*`, `xox*-*`, `AKIA*`, `AIza*`, `-----BEGIN ... PRIVATE KEY`, `aws_access_key_id`, `aws_secret_access_key`, `Bearer <long>`, `eyJ...` JWT fragments, `api_key`/`password`/`secret`/`token`/`credential` value-assignment shapes, email addresses, phone-number shapes, street/postal addresses, absolute paths (`/home/`, `/Users/`, `C:\`), private IP ranges, `localhost`, `ngrok`, `.internal` domains, and `.env`/`.pem`/`.key`/`netrc` file names.
- File/object inventory: `git rev-list --all --objects`; deleted-file inventory via object-set difference against `git ls-files`; binary inventory by extension census.
- Identity inventory: `git log --format` over all commits.
- Integrity: `sha256sum -c docs/CNTKNW_CHECKSUMS_v0.2.sha256` (pass/fail, no writes).
- Remote exposure: `git ls-remote origin` to enumerate refs already present on GitHub.

**Commit range.** `4494f24` (2026-07-26, tagged `phase-0c-impl`) through `5734da5` (HEAD). 43 commits total: 42 on the `main` lineage and 1 branch-only commit (`9a14231`). Phases 0A–0C predate git; no history exists before `4494f24` (consistent with `docs/CNTKNW_Documentation_Index.md` §6).

---

## 3. Findings and remediation

### CRITICAL — none

### HIGH — none

### MEDIUM

**F-1. Strategic business dossier exists on a remote branch and PR that will become public.**
`docs/CNTKNW_Product_Assessment_2026-08-01.md` (product/launch assessment: competitive positioning vs. Readwise, portfolio revenue framing, "private" repo label, launch blockers, owner direction) exists **only** on the orphan branch commit `9a14231`, which is currently on `origin` as `refs/heads/docs/product-assessment-2026-08-01` and as the head of **PR #1** (`refs/pull/1/head`, merge ref `refs/pull/1/merge`). When the repository is flipped public, this dossier becomes publicly visible.
*Remediation:* before publication, delete the remote branch (`git push origin --delete docs/product-assessment-2026-08-01`) and close/delete PR #1 on GitHub. Verify afterwards with `git ls-remote origin`. If the dossier is intended to stay with the project, move it into the private archive only.

**F-2. Local Codex snapshot refs contain full working-tree snapshots of the protected untracked files.**
Six local refs under `refs/codex/turn-diffs/*` (5 capture refs and 1 checkpoint ref, all local-only — not present on `origin`, verified by `git ls-remote`) hold two tree snapshots of the working tree (trees `b9a700c` and `a0c7c72`), including `install.sh` (blob 23bb54c) and `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` (blob 1f352b1). Normal branch pushes do not transfer these refs, but `git push --mirror` or a `refs/*:refs/*` refspec would.
*Remediation:* never use mirror / all-refs push modes. Optional hardening: delete the refs locally (`git update-ref -d` on each `refs/codex/**` ref) to drop the snapshots from the local object store; the blobs already written to `.git/objects` remain until `git gc --prune=now` (still local-only either way).

### LOW

**F-3. Local absolute paths in 9 tracked files at HEAD (57 occurrences history-wide).**
`/home/lazi/Projects/...` appears in tracked files (one docs file, eight prompt briefs) and in the same files across 16 earlier commits. Exposes the (already public) local account name `lazi`; no other machine detail. Paths are working-checkout references, not credentials.
*Remediation (optional, new commit only):* replace the literal checkout path with `<repo-root>` in:
- `docs/AI_PROJECT_STATE.md`
- `prompts/2026-08-06_phase-3a-annotation-geometry-brief.md`
- `prompts/2026-08-06_phase-3a-independent-review-brief.md`
- `prompts/2026-08-06_phase-3b-acceptance-corrections-brief.md`
- `prompts/2026-08-06_workspace-ux1-review-brief.md`
- `prompts/2026-08-06_workspace-ux1-s1-foundation-brief.md`
- `prompts/2026-08-06_workspace-ux1-s2-journal-brief.md`
- `prompts/2026-08-06_workspace-ux1-s3-whiteboard-brief.md`
- `prompts/2026-08-06_workspace-ux1-s4-pomodoro-brief.md`

History cannot be rewritten; older commit blobs carrying the path remain in the published history either way.

**F-4. Committer identity is permanently public in all 43 commits.**
Commit metadata records author/committer name **Lazarus Petrus** with the primary email `h***` @ `gmail.com` (42 commits) and a second personal email on 1 commit (`9a14231`). Git metadata exports with the history and cannot be changed without rewriting. Masked classification: personal email addresses, two distinct Gmail accounts.
*Remediation:* none possible (history preserved); conscious acceptance required before publication. No commit email appears anywhere in file content; the name "Lazarus Petrus" is also the deliberate public **Owner** signature throughout the docs, so the identity link is intentional and already public in the repo's own documentation.

**F-5. Internal AI/orchestration operating details are tracked.**
`AGENTS.md` (tracked, versioned) and `cntknw-orchestrator/SKILL.md` (tracked) contain the owner's model-routing config (provider/model IDs, Hermes workflow rules, "DeepSeek direct route not authenticated / keep dormant", sensitivity guidance for free models). No credentials; purely operational configuration. A staged (uncommitted to HEAD) 6-line `AGENTS.md` change (reroute/fallback policy text) is benign.
*Remediation:* owner review only — decide whether routing configuration should be public. No security impact.

**F-6. No repository LICENSE file.**
Third-party dependencies are all licensed (see §5), and `cntknw-orchestrator/SKILL.md` declares MIT in its frontmatter, but the repository itself carries no `LICENSE`.
*Remediation:* add a `LICENSE` (owner choice) before publication if licensing intent matters.

**F-7. Stale prompts archive index.**
`prompts/README.md` indexes only 1 of the 15 tracked briefs. Publication-quality issue, not security.
*Remediation:* update the index or note in the doc that it is intentionally partial.

---

## 4. History-scan result

**Commits.** 43 total (42 on `main`, 1 on the orphan assessment branch). Earliest `4494f24` (2026-07-26), HEAD `5734da5` (2026-08-10). Tags present: `phase-0c-impl`, `phase-0c-closed`, `phase-0d-complete`, `phase-0e-editor`, `phase-1-core`.

**Pattern hits (full history, all blobs, redacted).**

| Pattern class | Hits | Detail |
|---|---|---|
| API keys, tokens (`sk-`, `ghp_`, `gho_`, `xox`, `AKIA`, `AIza`) | 0 | — |
| Private keys (`BEGIN *PRIVATE KEY`) | 0 | — |
| AWS credentials (`aws_access/_secret`) | 0 | — |
| JWT fragments (`eyJ...`) | 0 | — |
| `api_key`/`password`/`secret`/`token` value assignments | 0 | — |
| Emails in file content | 0 | — |
| Phone numbers / postal addresses | 0 | false positives only (SHA-256 digests, UUIDs, test fixtures) |
| Absolute paths `/home/`, `/Users/`, `C:\` | 57 | 10 files, 9 still at HEAD (F-3); all are the working-checkout path, no other directories |
| `localhost` | 2 | `playwright.config.ts` dev-server port binding (benign, variable-derived) |
| `.env` / `.pem` / `.key` / `netrc` file names | 0 | never existed in any commit |
| Private URLs (ngrok, `.internal`, private IPs, `amazonaws` private endpoints) | 0 | all URLs are public npm/registry/funding/product-reference links |

**Deleted-file inventory** (files that ever existed but are not in HEAD) — all benign:

| File | Removed in | Classification |
|---|---|---|
| `test-figma.ts` | `b9aeac7` | scratch rank-ordering analysis script |
| `test-jitter.ts` | `b9aeac7` | scratch rank-ordering analysis script |
| `e2e/browser/bv-007-position-buffer-scope.spec.ts` | `4898c81` | removed e2e spec (hardening) |
| `docs/CNTKNW_Product_Assessment_2026-08-01.md` | never on `main` | exists only on the remote branch / PR #1 — see **F-1** |

**Binary inventory (all history).**

| File | Status |
|---|---|
| `docs/CNTKNW_Product_Design_Document_v0.2.pdf` (537 KB) | tracked at HEAD; project document |
| `docs/CNTKNW_AI_Implementation_Handoff_v0.2.pdf` (379 KB) | tracked at HEAD; project document |
| `docs/CNTKNW_Product_Design_Document_v0.2.docx` (63 KB) | tracked at HEAD; project document |
| `docs/CNTKNW_AI_Implementation_Handoff_v0.2.docx` (59 KB) | tracked at HEAD; project document |
| `docs/CNTKNW_Atlas_System_Design_Document_v0.1.docx` (39 KB) | tracked at HEAD; project document |
| `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` (511 KB) | **not tracked at HEAD** (protected); blob exists only in local Codex snapshot refs — see **F-2** |

No images, screenshots, `.db`, `.sqlite`, or user-data exports ever existed in history. `test-results/`, `dist/`, `node_modules/`, `*.tsbuildinfo`, `vite.config.d.ts` are untracked and covered by `.gitignore` (verified via `git status --ignored`); `git ls-files` confirms zero tracked files under `dist/` or `test-results/`.

---

## 5. Asset and license inventory

**Bundled assets.** None. No fonts (system font stacks via CSS variables `--cn-font-sans/serif/mono` in `src/design/tokens.css`), no icon files (emoji iconography per design brief), no image files, no `assets/` directories anywhere in the tree. README explicitly states "No CDN dependencies — everything bundled locally."

**Runtime dependencies** (`package.json`):

| Dependency | License |
|---|---|
| dexie v4 | Apache-2.0 |
| pdfjs-dist v4 | Apache-2.0 |
| prosemirror-commands/history/keymap/model/state/view | MIT |
| react / react-dom v19 | MIT |
| react-router v8 | MIT |
| zod | MIT |
| zustand | MIT |

**Dev dependencies:** typescript (Apache-2.0), vite (MIT), vitest (MIT), eslint + typescript-eslint (MIT), @playwright/test (Apache-2.0), @testing-library/* (MIT), fake-indexeddb (Apache-2.0), jsdom (MIT) — all consistent with the versions resolved in `package-lock.json`.

**Other:** `cntknw-orchestrator/SKILL.md` — declares MIT in its skill frontmatter. `src/legacy-v1/*` and `src/legacy/v1/*` are the owner's own legacy code (no third-party provenance).

**License gaps:** no root `LICENSE` for the repository itself (F-6); the bundled PDF/DOCX canonical documents are generated from the repo's own Markdown and carry no external attribution obligations identified.

---

## 6. Files requiring removal or sanitization

**Removal actions (before publication):**

- Delete remote ref `refs/heads/docs/product-assessment-2026-08-01` and PR #1 on GitHub (F-1).
- Do not push local `refs/codex/*`; optionally delete them locally (F-2).

**Sanitization (optional, new commit — no history rewrite):**

- Replace `/home/lazi/Projects/personal/heisprojects/cntknw` with `<repo-root>` in the 9 files listed in F-3 (recommended, since the path is in files that will be public).

**No file in the publication commit requires removal or redaction on security grounds** (no secrets found).

---

## 7. Publication-safe summary (what WILL be public)

- **Docs.** The full v0.2 canonical package: Product Design Document, AI Implementation Handoff, Master AI Context, READ_ME_FIRST, 8 ADRs, Requirements JSON, Amendments Register, Atlas System Design, Read Aloud System Design, Autonomous Build Brief, Claude Design Brief, phase checkpoint reports, repository review, current implementation status, documentation index, checksum file, AI project state.
- **Source.** Complete TypeScript/React app: domain layer, repository adapters (IndexedDB/memory), application use-cases, features (journal, reader, annotations, drawing, whiteboard, pomodoro, workspace), design tokens, legacy v1 code and migration readers, test suites.
- **Tests.** 46 unit-test files plus ~30 Playwright e2e specs; test harness and PDF-fixture generators; no screenshots or user data.
- **Prompts.** Archive of 15 tracked engineering briefs plus the prompts README; the UX-1 S7 corrections brief is untracked and will not be published.
- **Orchestration.** `AGENTS.md` and `cntknw-orchestrator/SKILL.md` (owner's AI workflow configuration — see F-5).
- **Git metadata.** 43 commits, 5 tags, all author/committer identities as described in F-4.
- **Not published.** `install.sh`, `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`, `prompts/2026-08-06_workspace-ux1-s7-corrections-brief.md` (untracked, confirmed present; zip 510,686 B and install.sh 144,190 B match the preserved snapshots recorded in `docs/AI_PROJECT_STATE.md` §Verification), `docs/CNTKNW_Product_Assessment_2026-08-01.md` (remote-branch only — F-1), `dist/`, `node_modules/`, `test-results/`, tsbuildinfo files.

---

## 8. Integrity verification

`sha256sum -c CNTKNW_CHECKSUMS_v0.2.sha256` (run in `docs/`): **9/9 PASS** — all sealed canonical documents (READ_ME_FIRST, PDD .md/.docx/.pdf, AI Handoff .md/.docx/.pdf, Master AI Context, Requirements JSON) verify against the published checksum file. No files modified.

Protected untracked files confirmed present and byte-size-consistent with the preserved snapshots referenced by `docs/AI_PROJECT_STATE.md` (zip 510,686 B; install.sh 144,190 B; s7 brief 10,208 B). The staged `AGENTS.md` modification is a benign 6-line documentation change.