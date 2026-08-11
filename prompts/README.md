# CNTKNW Prompts Archive

Prompts, briefs and audit instructions issued to AI agents working on CNTKNW, kept so a later agent — or a later human — can reconstruct **why** the repository looks the way it does.

## Why this exists

The canonical documents say what CNTKNW should be. The ADRs say what was decided. Neither records what an agent was *asked* to do at a given moment, which is often the missing piece when a decision looks arbitrary in hindsight.

If an agent picks up this repository cold, reading `prompts/` in date order alongside `docs/CNTKNW_Current_Implementation_Status.md` should explain the trajectory.

## Naming

```text
YYYY-MM-DD_short-subject.md
```

Date is the day the prompt was issued. Keep the original wording — these are a record, not a spec.

## Rules

1. **Prompts are archival. Never edit one after filing it.** If instructions changed, file the new prompt as a separate dated entry.
2. **Prompts are not normative.** They record what was asked, not what was decided. Decisions live in ADRs; requirements live in the canonical v0.2 documents. Source-of-truth precedence is unchanged: a prompt never outranks the Product Design Document.
3. **Record the outcome.** Each entry gets a short front-matter block noting what came of it and which documents it produced.
4. **Redact nothing silently.** If something must be removed, say so inline.

## Index

| Date | File | Subject | Outcome |
|---|---|---|---|
| 2026-07-25 | `2026-07-25_phase-0b-audit-and-phase-0c-brief.md` | External audit of the Phase 0B checkpoint, plus the implementation brief for Phase 0C persistence | Phase 0B documentation corrected; Phase 0C not yet started at time of prompt |
| 2026-07-25 | `2026-07-25_claude-code-handoff-phase-0c-closure-and-0d.md` | Handoff to Claude Code for Phase 0C closure and Phase 0D routing | Self-contained brief; superseded the in-session 0C/0D execution |
| 2026-08-06 | `2026-08-06_phase-3a-annotation-geometry-brief.md` | Phase 3A — canonical annotation geometry architecture | ADR-0007, schema-v2 migration, exact-asset retrieval |
| 2026-08-06 | `2026-08-06_phase-3a-independent-review-brief.md` | Independent adversarial review of Phase 3A | Read-only review; produced findings for the manager |
| 2026-08-06 | `2026-08-06_phase-3a-closure-exact-asset-retrieval-brief.md` | Phase 3A closure — replace `getBySourceAndPage` with exact-asset retrieval | Repository-wide contract tightened |
| 2026-08-06 | `2026-08-06_phase-3b-annotation-ux-brief.md` | Phase 3B — production PDF annotation UX | Highlight/region tools, keyboard access, confirmation delete |
| 2026-08-06 | `2026-08-06_phase-3b-acceptance-corrections-brief.md` | Phase 3B final acceptance corrections | Two blockers and one non-blocking check addressed |
| 2026-08-06 | `2026-08-06_phase-3c-pen-drawing-brief.md` | Phase 3C — editable freehand pen/drawing authoring and drawing journal blocks | Completes Phase 3 |
| 2026-08-06 | `2026-08-06_workspace-ux1-review-brief.md` | Independent adversarial review of WORKSPACE UX-1 S1–S4 | Read-only review; PASS WITH CORRECTIONS |
| 2026-08-06 | `2026-08-06_workspace-ux1-s1-foundation-brief.md` | WORKSPACE UX-1 S1 — design system, chrome, workspace layout | Foundation for Zen/Gruvbox study desk |
| 2026-08-06 | `2026-08-06_workspace-ux1-s2-journal-brief.md` | WORKSPACE UX-1 S2 — journal blank-writing-page visual redesign | Journal visual refresh |
| 2026-08-06 | `2026-08-06_workspace-ux1-s3-whiteboard-brief.md` | WORKSPACE UX-1 S3 — production infinite whiteboard | Whiteboard projection over canonical journal blocks |
| 2026-08-06 | `2026-08-06_workspace-ux1-s4-pomodoro-brief.md` | WORKSPACE UX-1 S4 — lightweight local Pomodoro timer | Local timer, no network |
| 2026-08-06 | `2026-08-06_workspace-ux1-s5-corrections-brief.md` | WORKSPACE UX-1 S5 — review-correction pass for blocking findings | HIGH/MEDIUM findings fixed |
| 2026-08-06 | `2026-08-06_workspace-ux1-s6-menuremount-brief.md` | WORKSPACE UX-1 S6 — bugfix for kind-menu click on empty composing block | Regression in journal acceptance specs fixed |

The file `2026-08-06_workspace-ux1-s7-corrections-brief.md` exists in this directory as an **untracked** working note; it is not part of the tracked prompts archive and should not be treated as normative.
