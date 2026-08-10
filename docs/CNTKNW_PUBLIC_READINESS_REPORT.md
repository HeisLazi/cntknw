# CNTKNW Public Readiness Report (Phase 3)

**Date:** 2026-08-10  
**Branch:** `portfolio/public-readiness`  
**Current HEAD:** the commit carrying this report update (final branch commit — `docs: finalize commit status in public readiness report`)  
**Origin/main:** `5734da541460e74330ca60980189c809368147af`  
**Target repository:** `HeisLazi/cntknw`  
**Report type:** final Phase 3 deliverable — publication-readiness effort summary

---

## 1. Summary and verdict

**CONDITIONAL GO.**

The `portfolio/public-readiness` branch is publication-safe provided the owner completes the five owner actions listed in §6 before flipping the repository public. All verification gates pass unchanged from baseline to post-change. No product source or test files were modified during this effort. No secrets, credentials, tokens, or private-service URLs were found in any tracked file or in any reachable commit.

This report documents the baseline state, the Phase 2 audit findings (with their disposition), the presentation-layer changes made in Phase 3, the post-change verification evidence, and the remaining owner decisions/actions required before the public flip.

---

## 2. Baseline record

| Item | Value |
|---|---|
| Source branch | `main` |
| Source SHA | `5734da541460e74330ca60980189c809368147af` |
| Branch created | `portfolio/public-readiness` from `origin/main` at `5734da5` |
| Pre-change full gate | PASS |
| Typecheck | PASS |
| Lint | PASS |
| Unit tests | 46 files / 691 passed / 1 skipped |
| E2E tests | 102 passed / 0 skipped (Chromium) |
| Build | PASS |
| npm audit --omit=dev | 0 vulnerabilities |

**E2E note.** The first e2e attempt failed environmentally due to a missing Playwright Chromium binary, which produced two flaky browser-crash failures immediately after install. The issue was resolved by running `npx playwright install chromium`, after which the full uninterrupted rerun passed 102/102.

**Protected untracked files at baseline (preserved):**

| File | Size | Status |
|---|---|---|
| `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip` | 510,686 B | untracked, preserved |
| `install.sh` | 144,190 B | untracked, preserved |
| `prompts/2026-08-06_workspace-ux1-s7-corrections-brief.md` | 10,208 B | untracked, preserved |

---

## 3. Publication audit summary

**Audit document:** `docs/CNTKNW_PUBLICATION_AUDIT.md` (Phase 2)  
**Verdict:** CONDITIONAL GO — 0 CRITICAL / 0 HIGH / 2 MEDIUM / 5 LOW

| ID | Severity | Finding | Disposition on this branch |
|---|---|---|---|
| F-1 | MEDIUM | `docs/CNTKNW_Product_Assessment_2026-08-01.md` exists only on remote branch `docs/product-assessment-2026-08-01` and PR #1; will become public on flip. | **Owner action** — delete remote branch and close PR #1 on GitHub before publication. |
| F-2 | MEDIUM | Local `refs/codex/turn-diffs/*` snapshot refs contain the protected untracked files. | **Owner action / accepted practice** — never mirror-push; optionally delete refs locally. |
| F-3 | LOW | `/home/lazi/` local absolute paths in 9 tracked files at HEAD. | **Remediated** — replaced with `<repo-root>`; 0 occurrences remain at HEAD. |
| F-4 | LOW | Committer identity (name + 2 personal Gmail accounts) permanently public in all 43 commits. | **Owner acceptance** — cannot be changed without rewriting history; conscious acceptance required. |
| F-5 | LOW | `AGENTS.md` + `cntknw-orchestrator/SKILL.md` routing config tracked. | **Owner review** — no credentials; decide whether to keep public. |
| F-6 | LOW | No root `LICENSE` file. | **Owner decision** — add a license before publication if desired. |
| F-7 | LOW | `prompts/README.md` index stale (listed 1 of 15 briefs). | **Remediated** — index now lists all 15 tracked briefs. |

**History scan (from Phase 2 audit):**

- 43 commits (`4494f24` → `5734da5`), 1006 objects.
- 0 secret-pattern hits.
- Deleted files all benign.
- No images, screenshots, or database exports ever in history.
- `dist/`, `test-results/`, `node_modules/`, `*.tsbuildinfo` are gitignored and untracked.

---

## 4. Phase 3 changes

### 4.1 README.md rewrite

`README.md` was fully rewritten to serve as the public landing document for `HeisLazi/cntknw`. It now includes:

- Product pitch and current vertical slice.
- Feature overview.
- Local-first / privacy stance.
- Architecture and concurrency summary.
- Verified test evidence.
- Setup instructions plus the required gate.
- Limitations and roadmap.
- AI-assisted-development disclosure.

No source code was changed.

### 4.2 Screenshots added

Three real Chromium screenshots were captured and added under `docs/screenshots/`:

| File | Dimensions | Size | Content |
|---|---|---|---|
| `study-workspace-desktop.png` | 1440×900 | 39,322 B | Study Workspace, desktop viewport |
| `study-workspace-compact.png` | 390×844 | 27,048 B | Study Workspace, compact/mobile viewport |
| `whiteboard-pomodoro-desktop.png` | 1440×900 | 62,429 B | Whiteboard + Pomodoro, desktop viewport |

All screenshots contain synthetic sample content. The invented source title "The Anatomy of Curiosity" is used as placeholder study material and does not represent a real publication.

### 4.3 Path sanitization (F-3 remediation)

Local absolute paths (`/home/lazi/Projects/...`) were replaced with `<repo-root>` in these 9 tracked files:

1. `docs/AI_PROJECT_STATE.md`
2. `prompts/2026-08-06_phase-3a-annotation-geometry-brief.md`
3. `prompts/2026-08-06_phase-3a-independent-review-brief.md`
4. `prompts/2026-08-06_phase-3b-acceptance-corrections-brief.md`
5. `prompts/2026-08-06_workspace-ux1-review-brief.md`
6. `prompts/2026-08-06_workspace-ux1-s1-foundation-brief.md`
7. `prompts/2026-08-06_workspace-ux1-s2-journal-brief.md`
8. `prompts/2026-08-06_workspace-ux1-s3-whiteboard-brief.md`
9. `prompts/2026-08-06_workspace-ux1-s4-pomodoro-brief.md`

The working tree now contains 0 occurrences of the literal checkout path in tracked files. Older commit blobs continue to carry the pre-sanitization path because history was not rewritten.

### 4.4 Prompts index update (F-7 remediation)

`prompts/README.md` was updated to index all 15 tracked engineering briefs.

### 4.5 AGENTS.md policy commit

Commit `855b722` — `docs(ai): record owner-approved model fallback routing policy` — added 6 lines to `AGENTS.md` documenting the approved fallback/reroute behavior when a routed model is unavailable.

---

## 5. Verification evidence

### 5.1 Pre-change gate (baseline)

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS |
| unit tests | 46 files / 691 passed / 1 skipped |
| e2e tests | 102 passed / 0 skipped (Chromium) |
| build | PASS |
| npm audit --omit=dev | 0 vulnerabilities |

### 5.2 Post-change gate (single uninterrupted run)

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS |
| unit tests | 46 files / 691 passed / 1 skipped |
| e2e tests | 102 passed / 0 skipped (Chromium) |
| build | PASS |
| npm audit --omit=dev | 0 vulnerabilities |

### 5.3 Dist leak scan

Scan performed with the geometry-probe / `__cntknwProbe` / harness-client / `e2e/harness` patterns:

| Pattern class | Matches |
|---|---|
| Probe / harness leakage in `dist/` | 0 |
| Test-only code in build output | 0 |

### 5.4 Sealed-docs checksums

`sha256sum -c docs/CNTKNW_CHECKSUMS_v0.2.sha256`: **9/9 PASS**

### 5.5 Source/test file impact

**No product source files or test files were modified anywhere in this effort.** All changes were confined to documentation, prompts, screenshots, and the AI-workflow routing policy in `AGENTS.md`.

---

## 6. Remaining owner actions before public flip

| Action | Finding | Details |
|---|---|---|
| Delete remote branch + close PR #1 | F-1 | `git push origin --delete docs/product-assessment-2026-08-01`; close/delete PR #1 on GitHub; verify with `git ls-remote origin`. |
| Never mirror-push; optionally delete local `refs/codex/*` | F-2 | Avoid `git push --mirror` or `refs/*:refs/*` refspecs. Optional: `git update-ref -d` on each `refs/codex/turn-diffs/*` ref, then `git gc --prune=now`. |
| Accept public commit identity | F-4 | Commit metadata records the name and two personal Gmail accounts across 43 commits. This cannot be changed without history rewrite, which is out of scope. |
| Review routing-config publicity | F-5 | Decide whether `AGENTS.md` and `cntknw-orchestrator/SKILL.md` should remain public. No security impact — they contain operational model aliases, not credentials. |
| Decide on root LICENSE | F-6 | Add a `LICENSE` file if licensing intent matters; dependencies are already individually licensed. |

Until these actions are completed, the repository should be considered **conditionally** ready for publication.

---

## 7. Commit status on the branch

- `855b722` — `docs(ai): record owner-approved model fallback routing policy` (AGENTS.md routing policy).
- `10d5a42` — `docs: prepare repository for public publication (audit, README, screenshots, sanitization)` (16 files: README rewrite, this report, the publication audit, 3 screenshots, path sanitization, prompts index update).
- The commit carrying this report update — `docs: finalize commit status in public readiness report` (this section's status finalization).
- All three commits are on `portfolio/public-readiness` only. **Nothing has been pushed** — `origin/main` remains at `5734da541460e74330ca60980189c809368147af`.
- Working tree is clean except for the 3 protected untracked files (`docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`, `install.sh`, `prompts/2026-08-06_workspace-ux1-s7-corrections-brief.md`), which are preserved and not part of any commit.

---

## 8. Honest limitations

- **History is immutable.** The pre-sanitization `/home/lazi/...` path occurrences remain in older commit blobs even though HEAD is clean. They expose only the already-public local account name and the repository name.
- **Screenshots are synthetic.** They show real Chromium-rendered UI but use invented placeholder source content.
- **E2E coverage is Chromium-only.** The verified 102/102 run used the Chromium project. Playwright was installed specifically for this gate; the first install attempt produced two flaky browser-crash failures that were resolved before the successful uninterrupted rerun.
- **No root LICENSE** exists yet; licensing intent is left to the owner.
- **Protected untracked files** (`install.sh`, the canonical documentation zip, and the S7 corrections brief) remain local-only and will not be published unless explicitly staged and pushed.

---

## 9. Files changed or added in Phase 3

| Path | Change |
|---|---|
| `README.md` | rewritten |
| `docs/screenshots/study-workspace-desktop.png` | added |
| `docs/screenshots/study-workspace-compact.png` | added |
| `docs/screenshots/whiteboard-pomodoro-desktop.png` | added |
| `docs/AI_PROJECT_STATE.md` | path sanitization |
| `prompts/2026-08-06_phase-3a-annotation-geometry-brief.md` | path sanitization |
| `prompts/2026-08-06_phase-3a-independent-review-brief.md` | path sanitization |
| `prompts/2026-08-06_phase-3b-acceptance-corrections-brief.md` | path sanitization |
| `prompts/2026-08-06_workspace-ux1-review-brief.md` | path sanitization |
| `prompts/2026-08-06_workspace-ux1-s1-foundation-brief.md` | path sanitization |
| `prompts/2026-08-06_workspace-ux1-s2-journal-brief.md` | path sanitization |
| `prompts/2026-08-06_workspace-ux1-s3-whiteboard-brief.md` | path sanitization |
| `prompts/2026-08-06_workspace-ux1-s4-pomodoro-brief.md` | path sanitization |
| `prompts/README.md` | index updated |
| `AGENTS.md` | routing policy added (commit `855b722`) |
| `docs/CNTKNW_PUBLIC_READINESS_REPORT.md` | this report (committed on `portfolio/public-readiness`) |

---

*End of report.*
