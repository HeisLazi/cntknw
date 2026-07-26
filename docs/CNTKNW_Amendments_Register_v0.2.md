# CNTKNW Amendments Register — v0.2 line

**Version:** 0.2 (register itself)
**Date:** 26 July 2026
**Owner:** Lazarus Petrus
**Purpose:** Record every change to the v0.2 canonical documents, so a future reader knows which parts of v0.2 are still binding.

---

## Provenance and honesty note

An earlier amendment register existed. `src/domain/shared.ts` cites *"amendment 7"* and `src/domain/annotations/annotation.schemas.ts` cites *"amendment 11"*, so at least eleven amendments were made. **That document is not in the repository and could not be recovered.**

This register is therefore a **fresh start**. It contains only amendments that can be **proven** from the current documents, the current repository, or an explicit owner instruction in the Phase 0B conversation. Nothing has been invented, and the original numbering has not been guessed at.

Two amendments below (A-001, A-002) are reconstructions of the *effect* of the original amendments 7 and 11, evidenced by the code comments that cite them. Their original wording is unknown and their original numbers are not reused.

**If the original register resurfaces, reconcile it against this one before trusting either.**

---

## Register

### A-001 — Zod schemas are the authoritative source of TypeScript types

- **Amends:** Handoff §8 (which specifies `<area>.types.ts` files), §9 (which presents contracts as hand-written TypeScript)
- **Evidence:** `src/domain/shared.ts` header comment — *"All Zod schemas are authoritative. TypeScript types are inferred via z.infer to prevent schema/type drift (amendment 7)."* No `*.types.ts` file exists anywhere in `src/domain/`.
- **Amendment:** Domain types are inferred from Zod schemas with `z.infer` / `z.input`. Separate `*.types.ts` files are not created. The TypeScript contracts in Handoff §9 are the *specification*; the Zod schemas are the *implementation* of that specification, and where they differ the schema governs.
- **Status:** In force. Ratified by ADR-0001 §11.

### A-002 — Legacy annotation geometry is preserved unchanged

- **Amends:** Handoff §9.7, §14.4 (which require normalised page-space coordinates)
- **Evidence:** `src/domain/annotations/annotation.schemas.ts` header — *"Legacy annotations without viewport data are preserved as-is (amendment 11)"* — and the `normalized: boolean` flag on `AnnotationGeometrySchema`.
- **Amendment:** `AnnotationGeometry` carries a `normalized` flag and an opaque `data` record. Annotations migrated from v1 without viewport dimensions are stored unchanged and marked `normalized: false`, rather than being converted with guessed dimensions. New annotations are normalised.
- **Status:** In force. Full discrimination of geometry by annotation kind is deferred to Phase 3.

### A-003 — Revised phase order

- **Amends:** Handoff §19 (Exact Build Order)
- **Evidence:** `src/main.tsx` — *"Phase 0D will replace this with the router, providers, and AppShell layout"* — plus the owner's explicit Phase 0B instruction.
- **Amendment:** 0A build → **0B domain and application contracts** → 0C persistence → 0D shell and routing → 0E editor spike. Handoff §19's placement of shell and routing at 0B, and persistence at 0C, is superseded.
- **Status:** In force. Recorded in ADR-0001 §1.

### A-004 — The Replit implementation was never adopted

- **Amends:** nothing in v0.2; corrects working assumptions
- **Evidence:** Explicit owner instruction, 25 July 2026.
- **Amendment:** An attempted Replit implementation — `artifacts/cntknw/`, `legacy-v1-app/`, `ARCHITECTURE.md`, commit `ff3e2e1`, a pnpm workspace layout — is **not part of the canonical project**. The canonical repository is `philosophy-journal-complete`, with the v2 foundation at `src/` and frozen legacy at `src/legacy-v1/`.
- **Status:** In force.

### A-005 — `WorkspaceState` owns reading position

- **Amends:** Handoff §9.2 (`BookDetails`)
- **Evidence:** Handoff §9.2 defines `BookDetails` without `currentPage` or `currentChapter`; the implementation had added both. Audit defect A-8.
- **Amendment:** `BookDetails` carries no reading position. `WorkspaceState.activeLocation` is canonical. v1 `books.currentPage` maps into `WorkspaceState` at migration.
- **Status:** In force. ADR-0001 §3.

### A-006 — `EntityId` accepts UUID versions 1–8

- **Amends:** Handoff §9.1 (*"Use UUIDv7 or ULID after one decision"*)
- **Evidence:** Zod's `.uuid()` accepts only versions 1–5 and would reject UUIDv7, foreclosing the option §9.1 leaves open.
- **Amendment:** UUID is adopted. `EntityIdSchema` accepts versions 1–8 plus the nil UUID. Generation stays behind `lib/id.ts`, currently v4. ULID is not adopted.
- **Status:** In force. ADR-0001 §5.

### A-007 — Use cases live in `src/application/`

- **Amends:** Handoff §8 (Target Repository Structure)
- **Evidence:** `src/application/` exists with an `@application/*` path alias in `tsconfig.json`; no `*.service.ts` file exists.
- **Amendment:** Orchestration logic lives in `src/application/`. Domain modules hold schemas and pure functions only. Handoff §8's `domain/<area>/*.service.ts` is superseded.
- **Status:** In force. ADR-0001 §11.

### A-008 — Read Aloud is a specified feature of the v0.2 line

- **Amends:** PDD §5.1, §6.1, §9.5, §9.11, §18
- **Evidence:** Owner instruction plus `CNTKNW_Read_Aloud_System_Design_Document_v0.1.md`.
- **Amendment:** Read Aloud is added as a Study Workspace capability, never a primary destination. `WorkspaceState` gains listening and furthest positions, a `listen` layout mode, an away flag and playback capability. `StudySession` gains `activityMode`, `listenedSeconds` and `listenedLocations`. The Read Aloud SDD records ten conflict resolutions against v0.2; no v0.2 requirement was weakened.
- **Status:** Domain readiness in force. Implementation deferred past v0.2 Phase 2.

### A-009 — Atlas is a planned Library room

- **Amends:** PDD §5.1, §11.4, §14.1, §22.1
- **Evidence:** Owner instruction, 25 July 2026. `CNTKNW_Atlas_System_Design_Document_v0.1.docx` exists but **could not be read** — see Open Items.
- **Amendment:** An Atlas Room will sit near the entrance of the immersive Library: a geographical and temporal view of the same knowledge system, not a separate main tab. Phase 0B adds shared primitives only — temporal, spatial, knowledge-entity references, epistemics, and an extended `Reference` union. No Atlas entity is modelled.
- **Status:** Readiness primitives in force. Entity modelling blocked on a readable Atlas SDD.

### A-010 — Claim promotion links rather than transforms

- **Amends:** PDD §7.5 (Transform rather than recreate)
- **Evidence:** Owner instruction that formal claims must be referenced identically by Atlas and argument-map views.
- **Amendment:** Journal claim blocks stay ordinary journal content. A block may be promoted to a canonical `EpistemicClaim` by linking (`epistemicClaimId` on the block, `originBlockIds` on the claim). PDD §7.5's in-place transform still governs paragraph-to-question and similar changes, but does not govern claim promotion, because one claim may be asserted at several passages.
- **Status:** In force. ADR-0001 §4.

### A-011 — Soft deletion is implemented, not merely named

- **Amends:** nothing in v0.2; enforces PDD §19.3 and NFR-008
- **Evidence:** Audit defect A-6 — `softDeleteBlock` performed a hard delete and `JournalBlock` had no `deletedAt`.
- **Amendment:** `JournalBlock` and `EpistemicClaim` carry `deletedAt`. Deletion marks; restore unmarks; live queries exclude deleted records.
- **Status:** In force. ADR-0001 §12.

### A-012 — Atlas SDD transcribed and reconciled

- **Amends:** register entry A-009 (which recorded the Atlas SDD as unreadable)
- **Evidence:** `CNTKNW_Atlas_System_Design_Document_v0.1.md`, supplied by the owner 25 July 2026 as a Markdown transcription of the `.docx`.
- **Amendment:** The Atlas SDD is now readable and is canonical for Atlas work. Reconciliation against the Phase 0B primitives produced five decisions, recorded in ADR-0001 §13:
  - `KnowledgeEntityKind` gains `period`, `conflict`, `institution`.
  - `Source` and `Claim` are **not** added as Atlas kinds — both are existing CNTKNW entities and existing `Reference` endpoints.
  - Trade route and migration route remain one `route` kind.
  - `StudyStatus` is introduced as a separate axis from `KnowledgeStatus`.
  - `GeoGeometryRef` gains `validFor` and `attribution`, making historical borders time-aware.
- **Status:** In force. Atlas entity modelling remains deferred.

### A-013 — Read Aloud specification provenance: NOT APPROVED

- **Amends:** register entry A-008, which recorded Read Aloud as a specified feature of the v0.2 line
- **Evidence:** `CNTKNW_Read_Aloud_System_Design_Document_v0.1.md` exists and every cited identifier resolves within it. But its substance was supplied by the owner as conversational prose on 25 July 2026, and the document — its structure, RA-nnn numbering, invariants and ten conflict resolutions — was agent-drafted. The agent then labelled its own output "Canonical feature specification".
- **Amendment:** The Read Aloud SDD is **not approved** and is not normative. Its identifiers are traceable but its requirements are unverified. Domain fields supporting it remain implemented — they are additive, harmless, and removing them would cost a migration later for no benefit — but no RA requirement may be cited as satisfied, and no playback, TTS or OCR may be implemented, until the owner either approves the document or downgrades it to a draft proposal.
- **Rule established:** an agent may draft a specification. It may not confer canonical status on its own output. Approval is an owner act.
- **Status:** In force. **Owner decision outstanding.**

### A-015 — Read Aloud specification approved

- **Supersedes:** A-013 (which recorded it as not approved)
- **Evidence:** Explicit owner decision, 25 July 2026: *"it is canonical so it is approved"*.
- **Amendment:** `CNTKNW_Read_Aloud_System_Design_Document_v0.1.md` is **approved and canonical**, subordinate to the Product Design Document v0.2. Its RA identifiers, invariants and acceptance criteria are normative. Implementation remains sequenced by its own §20: RA-0 schema work belongs to Phase 0B (done); RA-1 may not begin before v0.2 Phase 2 exits.
- **Retained from A-013:** the rule that produced the challenge stands — an agent may draft a specification, only the owner may approve one. The provenance note remains in the document header.
- **Status:** In force. A-013's blocking condition is discharged.

### A-014 — Supplemental documentation index and status document

- **Amends:** nothing in v0.2; supplements the read path
- **Evidence:** External audit, 25 July 2026, correction 2 — the ADR-revised phase order was not visible to an agent following the canonical read path, so Handoff §19 would have been followed literally and the router built during Phase 0B.
- **Amendment:** Two supplemental documents are added:
  - `CNTKNW_Documentation_Index.md` — full read order incl. amendments, the phase sequence in force, precedence, and editing rules for the sealed files.
  - `CNTKNW_Current_Implementation_Status.md` — what exists, what does not, verification results, open decisions, next phase.

  `CNTKNW_READ_ME_FIRST_v0.2.md` was deliberately **not** edited: it is covered by `CNTKNW_CHECKSUMS_v0.2.sha256`, all nine entries of which still verify. Editing it would break the manifest or force a full v0.2 reissue with regenerated DOCX and PDF.
- **Status:** In force.

### A-016 — Concurrency guards are mandatory, not opt-in

- **Supersedes:** ADR-0002 §4 (optimistic concurrency by expected revision)
- **Amends:** nothing in v0.2; **enforces** Handoff §13.3
- **Evidence:** External audit, 25 July 2026, finding C-02. ADR-0002 §4 made `expectedRevision` optional and stated that omission retained last-write-wins; its own Cost paragraph conceded that *"a guarantee that must be opted into can be forgotten."* Two Phase 0B use cases — `promoteBlockToClaim` and `linkBlockToExistingClaim` — read a record before opening their transaction and wrote it inside, which is the stale-read window ADR-0002 §4 argued did not exist.
- **Amendment:** Every mutating repository method that touches a revisioned record takes a mandatory `ConcurrencyGuard`, either `{ mode: 'expected'; revision }` or `{ mode: 'unconditional'; reason: 'migration' | 'repair' }`. `create` takes none. Omission is a compile error and is also rejected at runtime, so it can never mean last-write-wins. `WorkspaceState.upsert` splits into `create` and `update`, because an upsert cannot honour a mandatory guard on its insert branch.
- **Recorded in:** `CNTKNW_ADR_0003_Mandatory_Concurrency_Guards.md`.
- **Status:** In force. Contract-tested against both adapters (17 concurrency tests each) and browser-tested (BV-003).

### A-017 — Phase 0C closure: four corrections to the record

- **Amends:** `CNTKNW_Phase_0C_Checkpoint_Report.md` §1, §2.1, §5, §7, §10, §12–15; `CNTKNW_Current_Implementation_Status.md`
- **Evidence:** External audit, 25 July 2026, findings C-01 and C-03 through C-06. Each is a claim the documents made that the repository did not support.
- **Amendment:** Four wording and accuracy corrections, made in place rather than by reissue:
  - **C-01 — phase status.** The documents called Phase 0C "complete and verified" while also recording that Playwright was absent and browser persistence unproven. Playwright is now installed and eight browser tests pass in Chromium, so the status is true as written. Had the gate still been open, the required wording was *"Phase 0C implementation complete; browser and concurrency closure pending."*
  - **C-03 — v1 read-only claim.** *"Structurally write-incapable"* was an overclaim: `readV1Snapshot` holds a live Dexie handle while it runs. Replaced with *"v1 access is read-only by module boundary and public API; no schema upgrade is declared and no raw database or table handle escapes the reader module"* — and that narrower claim is now checked by `src/legacy/v1/read-only-boundary.test.ts` rather than asserted.
  - **C-04 — annotation loss.** *"Every annotation a v1 user drew was discarded"* was not supported by the evidence, which was one broken write path in one build. Replaced with *"the inspected v1 annotation save path failed"*, plus the statement that migration scans both stores separately and preserves unexpected data. **No code changed; the scanning was already correct.**
  - **C-05 — file inventory.** The checkpoint's §10 stated "New (11)" above a list of twelve and "Modified (10)" above a list of eleven, and miscounted eight repository interfaces as seven. Corrected, with the limit stated: there is no pre-0C commit, so Git cannot derive the new-versus-modified split for that phase. Everything from the `phase-0c-impl` tag onward is Git-derived.
  - **C-06 — test terminology.** "106 assertions" was the runner's *test* count for one file, not an assertion count, and no assertion count was ever measured. All figures now use Vitest's and Playwright's own terms: test files, tests, skipped, browser projects.
- **Also recorded:** the repository was placed under version control on 26 July 2026. Commit `4494f24`, tag `phase-0c-impl`, captures the tree as Phase 0C left it. The absence of a repository was itself an audit obstacle, since a Git-derived inventory had been requested and was impossible.
- **Status:** In force.

### A-018 — `react-router`, not `react-router-dom`

- **Amends:** Phase 0C checkpoint §11 and the status document, both of which said to "reinstall `react-router-dom` at a version outside the advisory range"
- **Evidence:** Checked against the registry on 26 July 2026. `react-router-dom@latest` is **7.18.1**, still inside the advisory range `7.12.0 – 8.2.0`, and is a wrapper whose only dependency is `react-router` at the same version — so installing it would pull the vulnerable version in. `react-router@8.3.0` is above the range's ceiling. Peer requirement `react >= 19.2.7` is met by the project's `^19.2.7`.
- **Amendment:** Phase 0D depends on **`react-router@8.3.0`**. This is not a change of router library: from v7 onward `react-router` is the package and `react-router-dom` is a compatibility shim for v6 import paths. `npm audit --omit=dev` remains at 0.
- **Rule retained:** the version must be re-checked against the registry whenever it is changed, not trusted from a note in a document. This entry records what was true on 26 July 2026 and nothing more.
- **Status:** In force.

### A-019 — Phase 0D complete

- **Amends:** nothing in v0.2; records a phase boundary
- **Evidence:** `CNTKNW_Phase_0D_Checkpoint_Report.md`; gate results in its §10.
- **Amendment:** Phase 0D is complete and verified. Composition root, providers, router, three primary destinations, shared Study Workspace, route-level states, design tokens, 19 UI primitives, development-only component lab, responsive shell, and accessibility, component, routing and browser tests. **The PDD §24 Phase 0 exit condition is met** — the app shell builds, no component writes to the database directly, and legacy data can be read.
- **Two invariants moved from convention to enforcement:**
  - **INV-001 / IA-001** — `PRIMARY_DESTINATIONS` is asserted to have exactly three entries, and a twelve-item deny list fails if Sessions, Whiteboard, PDF Reader, Dictionary, Export, Settings, Chess, Atlas, Components, Home, Dashboard or Search is ever promoted.
  - **INV-014** — `architecture.test.ts` fails if any UI module imports a storage adapter, or if a second module besides the composition root names the production one.
- **Status:** In force. Next phase: 0E, the editor spike.

---

## Open items, not yet amendments

These are known gaps, recorded so they are not lost. None is a decision yet.

| Item | Blocked on |
|---|---|
| Atlas entity schemas — Person, Place, Region, Period, Event, Conflict, Organisation, Institution, Movement, Polity, Religion, Ideology, Commodity, Route | Nothing external. Scheduled for the Atlas modelling phase; the SDD is now readable (A-012). |
| Place identity over time — stable identity with time-sliced names, borders and sovereignty | Atlas modelling phase. `GeoGeometryRef.validFor` is the enabling primitive. |
| Whether `conflict` is its own record or an Event subtype | Atlas modelling phase |
| Whether `institution` is distinct from `organisation` | Atlas modelling phase |
| Whether `period` is an entity or a named `TemporalExtent` | Atlas modelling phase |
| Filters versus Layers as a saved-view record | Atlas Phase 1 |
| `BlockContent.doc` versus `.text` duplication | Editor spike, Phase 0E |
| `AnnotationGeometry` discrimination by kind | Phase 3 |
| ~~Optimistic-concurrency revision checking~~ | **Closed** — mandatory guards, A-016 |
| ~~Playwright and end-to-end suite~~ | **Closed** — installed 26 Jul; BV-001…BV-005 pass in Chromium (A-017) |
| Browser projects beyond Chromium (WebKit, Firefox) | Nothing external. Not required by any gate yet. |
| The original amendment register | May not exist; reconcile if found |

---

## Rules for this register

1. Every amendment names the document and section it changes.
2. Every amendment cites evidence: a document, a file, or a dated owner instruction.
3. Nothing is recorded that cannot be proven from one of those three.
4. Amendments are numbered `A-nnn` and never renumbered.
5. Superseding an amendment adds a new entry; it does not edit the old one.
6. An amendment may not weaken a product invariant (INV-001 … INV-015). Doing so requires a product-design revision, not an amendment.
