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
| 2026-07-25 | `2026-07-25_phase-0b-audit-and-phase-0c-brief.md` | External audit of the Phase 0B checkpoint, plus the implementation brief for Phase 0C persistence | Phase 0B documentation corrected; Phase 0C not yet started |
