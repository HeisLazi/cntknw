# CNTKNW Documentation Index

**Updated:** 6 August 2026
**Status:** Supplemental, unversioned. Maintained continuously.

`CNTKNW_READ_ME_FIRST_v0.2.md` remains the canonical entry point and is unchanged — it is covered by `CNTKNW_CHECKSUMS_v0.2.sha256` and still verifies. This index supplements it with everything approved *since* v0.2 was sealed.

> **Read this before acting on Handoff §19.** The build order in the v0.2 handoff has been superseded. See §2.

---

## 1. Read order

### Canonical — the v0.2 package (checksummed, do not edit in place)

1. `CNTKNW_READ_ME_FIRST_v0.2.md`
2. `CNTKNW_Product_Design_Document_v0.2.md`
3. `CNTKNW_AI_Implementation_Handoff_v0.2.md`
4. `CNTKNW_Requirements_v0.2.json`

`CNTKNW_Master_AI_Context_v0.2.md` is a concatenation of 1–3 with no unique content. Read it *or* the parts, not both.

### Approved amendments — read immediately after the canonical set

5. `CNTKNW_ADR_0001_Phase_0B_Foundations.md` — thirteen decisions. **Supersedes Handoff §19, §8, §9.1, §9.2.**
6. `CNTKNW_ADR_0002_Phase_0C_Persistence.md` — ten decisions. **§4 is superseded by ADR-0003; the rest stands.**
7. `CNTKNW_ADR_0003_Mandatory_Concurrency_Guards.md` — **supersedes ADR-0002 §4.** Read it before writing any repository call.
8. `CNTKNW_ADR_0004_Editor_and_Block_Content.md` — explicit journal conflict resolution.
9. `CNTKNW_ADR_0005_Durability_of_In_Flight_State.md` — ProseMirror and durable block-editing boundary.
10. `CNTKNW_ADR_0006_The_Folio_Margin.md` — continuous canonical journal layout and provenance.
11. `CNTKNW_ADR_0007_Canonical_Annotation_Geometry.md` — asset-bound, rotation-aware canonical annotation anchors.
12. `CNTKNW_Amendments_Register_v0.2.md` — every change to the v0.2 line, with evidence.

### Current state

13. `CNTKNW_Current_Implementation_Status.md` — what exists, what is next, which phase applies.
14. `CNTKNW_Phase_0D_Checkpoint_Report.md` — most recent completed phase. Covers the Phase 0C closure as well as Phase 0D.
15. `CNTKNW_Phase_0C_Checkpoint_Report.md` — revised 26 July; read §0 first, which lists what the first revision got wrong.
16. `CNTKNW_Phase_0B_Checkpoint_Report.md` — the phase before those.

### Supplemental feature specifications

17. `CNTKNW_Atlas_System_Design_Document_v0.1.md` — **approved.** Owner-authored. Governs Atlas work. Primitives reconciled against it in ADR-0001 §13.
18. `CNTKNW_Read_Aloud_System_Design_Document_v0.1.md` — **approved** 25 July 2026. See §3.

### Working history

19. `prompts/` — prompts and briefs issued to agents, in date order. Archival, never normative.

---

## 2. Phase order in force

Handoff §19 places shell and routing at Phase 0B and persistence at 0C. **That ordering is superseded** by ADR-0001 §1, ratified by the repository itself (`src/main.tsx` has carried "Phase 0D will replace this with the router" since Phase 0A).

| Phase | Scope | State |
|---|---|---|
| 0A | Clean reproducible build, TypeScript strict, lint and test scripts | Complete — the Playwright gap closed 26 July |
| 0B | **Domain and application contracts.** No user-facing surface. | Complete and verified |
| 0C | **Persistence.** Dexie adapter, schema versions, migrations, v1 readers. | Complete and verified, contract and real browser |
| 0D | **Shell, routing, providers, design tokens, UI primitives.** | Complete and verified |
| 0E | **Editor spike, then the journal vertical slice** | Complete and verified (ADR-0004, ADR-0005) |
| 1 | **Reliable PDF core** — import, render, exact resume | Complete and verified through PDF Core Reliability Milestone 3B (Findings 11–15 resolved) |
| 2 | **Infinite Journal** | Complete and verified (Folio margin ADR-0006 landed) |
| 3 | **Annotations** | Phase 3A canonical geometry architecture complete, committed and verified (incl. exact-asset retrieval closure correction); production annotation UI not yet implemented |

Shell, routing, design tokens and UI primitives moved from 0B to **0D**. Domain and persistence, previously both at 0C, split into **0B** (contracts) and **0C** (storage).

Phases 1–11 in PDD §24 are unchanged, and the Phase 0 exit condition in PDD §24 is unchanged: *app shell builds; no direct component DB writes; legacy data can be read.* Only 0A–0E internal sequencing was reordered — the exit condition is met at the end of 0D, not 0B.

---

## 3. Read Aloud — approved, but not yet buildable

`CNTKNW_Read_Aloud_System_Design_Document_v0.1.md` was **approved by the owner
on 25 July 2026** (register entry A-015, superseding A-013). Its RA
identifiers, invariants and acceptance criteria are normative, subordinate to
the Product Design Document v0.2.

Approval is not permission to build. Implementation stays sequenced by the
SDD's own §20: RA-0 schema work belonged to Phase 0B and is done; **RA-1 may
not begin before v0.2 Phase 2 exits.** So, still:

- do not implement playback, text-to-speech or OCR;
- do not delete the existing domain fields.

The rule that produced the original challenge stands, and is worth keeping in
view: an agent may draft a specification; only the owner may approve one.

---

## 4. Source-of-truth precedence

1. Latest explicit owner decision.
2. `CNTKNW_Product_Design_Document_v0.2.md`.
3. `CNTKNW_AI_Implementation_Handoff_v0.2.md`.
4. Approved ADRs and register entries dated after v0.2.
5. Approved supplemental specifications, where they do not conflict with 2 or 3.
6. Existing code — evidence of what was built, never a specification.
7. Agent assumptions. Last, and to be surfaced rather than acted on.

Prompts in `prompts/` sit outside this order entirely. They record what was asked, not what was decided.

---

## 5. Editing rules

**The nine checksummed files are sealed.** `CNTKNW_READ_ME_FIRST_v0.2.md`, the Product Design Document, the Implementation Handoff (all three formats each), the Master AI Context and the Requirements JSON verify against `CNTKNW_CHECKSUMS_v0.2.sha256`.

To change any of them: bump the version, update the authoritative Markdown and JSON first, regenerate DOCX and PDF, regenerate the checksum manifest, and record the change in the register. Never leave a stale DOCX or PDF looking current.

To change anything else — an amendment, an ADR, a status document, this index — edit directly and record it in the register.

---

## 6. Version control

The repository was placed under Git on **26 July 2026**. Commit `4494f24`, tag
`phase-0c-impl`, captures the tree exactly as Phase 0C left it, before any
closure work.

There is **no commit before that tag**. Phase 0A, 0B and 0C were built without
version control, so no Git command can reconstruct which files those phases
added versus modified — a limitation the Phase 0C checkpoint §10 states rather
than papers over. Any file inventory covering work before the tag is
hand-derived and must say so; anything after it is Git-derived and should cite
a commit range.
