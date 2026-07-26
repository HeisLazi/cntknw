# CNTKNW Documentation Index

**Updated:** 25 July 2026
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
6. `CNTKNW_Amendments_Register_v0.2.md` — every change to the v0.2 line, with evidence.

### Current state

7. `CNTKNW_Current_Implementation_Status.md` — what exists, what is next, which phase applies.
8. `CNTKNW_Phase_0B_Checkpoint_Report.md` — most recent completed phase.

### Supplemental feature specifications

9. `CNTKNW_Atlas_System_Design_Document_v0.1.md` — **approved.** Owner-authored. Governs Atlas work. Primitives reconciled against it in ADR-0001 §13.
10. `CNTKNW_Read_Aloud_System_Design_Document_v0.1.md` — **NOT APPROVED.** See §3.

### Working history

11. `prompts/` — prompts and briefs issued to agents, in date order. Archival, never normative.

---

## 2. Phase order in force

Handoff §19 places shell and routing at Phase 0B and persistence at 0C. **That ordering is superseded** by ADR-0001 §1, ratified by the repository itself (`src/main.tsx` has carried "Phase 0D will replace this with the router" since Phase 0A).

| Phase | Scope | State |
|---|---|---|
| 0A | Clean reproducible build, TypeScript strict, lint and test scripts | Complete except Playwright |
| 0B | **Domain and application contracts.** No user-facing surface. | Complete and verified |
| 0C | **Persistence.** Dexie adapter, schema versions, migrations, v1 readers. | Not started |
| 0D | **Shell, routing, providers, design tokens, UI primitives.** | Not started |
| 0E | Editor spike, then the journal vertical slice | Not started |

Shell, routing, design tokens and UI primitives moved from 0B to **0D**. Domain and persistence, previously both at 0C, split into **0B** (contracts) and **0C** (storage).

Phases 1–11 in PDD §24 are unchanged, and the Phase 0 exit condition in PDD §24 is unchanged: *app shell builds; no direct component DB writes; legacy data can be read.* Only 0A–0E internal sequencing was reordered — the exit condition is met at the end of 0D, not 0B.

---

## 3. Read Aloud — approval outstanding

`CNTKNW_Read_Aloud_System_Design_Document_v0.1.md` declares itself a canonical feature specification. **It is not approved.**

The owner supplied its substance as prose in conversation on 25 July 2026. The document — its structure, its RA-nnn numbering, its invariants, and its ten recorded conflict resolutions against v0.2 — was drafted by an agent, which then labelled its own output canonical. That is not how canonical status is conferred.

Domain fields supporting it are implemented and tested, and are additive and harmless. But until the owner approves or downgrades the document:

- treat RA identifiers as **unverified**;
- do not implement playback, text-to-speech or OCR;
- do not cite RA requirements as satisfied;
- do not delete the existing fields — removing them costs a migration later for no benefit.

See register entry A-013.

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
