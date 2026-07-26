---
issued: 2026-07-25
issued_by: Lazarus Petrus (external audit + implementation brief)
subject: Phase 0B checkpoint audit and Phase 0C persistence brief
status: Part I actioned — documentation corrected. Part II not started.
produced:
  - docs/CNTKNW_Phase_0B_Checkpoint_Report.md (corrected)
  - docs/CNTKNW_Current_Implementation_Status.md (new)
  - docs/CNTKNW_Documentation_Index.md (new)
  - docs/CNTKNW_Amendments_Register_v0.2.md (A-013, A-014)
note: >
  Archival record. Not normative — see docs/ for requirements and ADRs for
  decisions. Reproduced verbatim below; nothing removed.

  Written against the PRE-VERIFICATION checkpoint. Corrections 1 and 8 were
  partly superseded before this was actioned, because verification had since
  been executed. Every item was re-checked against the live repository rather
  than accepted or dismissed on its face; the disposition of each is recorded
  in the corrected checkpoint report §9.
---

# CNTKNW Phase 0B Audit and Phase 0C Claude Prompt

**Prepared:** 25 July 2026  
**Repository:** `philosophy-journal-complete`

---

# Part I — Phase 0B Audit

## Scope

This is a documentation-and-claims audit based on the canonical CNTKNW v0.2 documents, the Atlas v0.1 Markdown specification, and the submitted Phase 0B checkpoint. It is **not** an independent source-code audit because the complete repository and Git history were not supplied here. Claude must inspect the real repository and rerun every command.

## Verdict

**Phase 0B is plausibly complete under the ADR-revised sequence, but the checkpoint cannot be accepted unchanged.** Correct the report and documentation before declaring Phase 0C started.

## Blocking corrections

### 1. Verification contradicts itself

The header and section 7 say all commands passed, while Known Limitation 1 says verification was not run. Section 7.3 also describes an “expected outcome, from reading” even though section 7 claims a real Linux scratch-directory execution.

Correct the report to say:

- verification was run on Linux in a clean scratch copy;
- Windows reproduction was not independently run unless it actually was;
- exact commands and results are preserved;
- speculative language is removed from the verified result.

### 2. Revised phase order is not visible in the canonical read path

The v0.2 handoff labels Phase 0B as shell/routing and Phase 0C as domain/persistence. The checkpoint says ADR-0001 revised the order. That is valid only when the ADR is approved, explicit, and linked where coding agents will see it.

Required:

- verify ADR-0001 exists and is approved;
- document the revised 0A/0B/0C/0D sequence;
- state where shell, routing, design tokens, and primitives moved;
- link the ADR and current implementation status from the read-first/index document;
- do not silently rewrite product requirements.

### 3. “No migration is required” is too broad

No **v2-to-v2 runtime migration** is needed if no v2 database has shipped. But legacy v1 data exists conceptually, and Phase 0C still owes deterministic v1 readers, mappings, dry runs, validation, and rollback/recovery.

Use language equivalent to:

> No runtime v2-to-v2 migration is required for Phase 0B because no v2 persistent database exists. Migration obligations remain open for Phase 0C: read-only v1 inspection, deterministic v1-to-v2 mapping, dry-run reporting, validation, recovery instructions, and preservation of original v1 data.

Do not call INV-013/NFR-005 “strengthened” until persistence migrations and tests exist.

### 4. Acceptance criteria are overclaimed

AC-002, AC-003, AC-004, and AC-005 describe integrated product behaviour. Unit/use-case/repository tests may establish readiness but do not complete later-phase E2E acceptance.

Use precise labels:

- domain contract covered;
- use-case logic covered;
- repository contract covered;
- full product acceptance deferred;
- E2E accepted only after the assigned Playwright gate.

### 5. The persistence repository gate is still open

The canonical gate requires one behavioural suite against both memory and IndexedDB adapters, covering:

- transactions and rollback;
- revision conflicts;
- soft deletion and restore;
- migration;
- failed writes.

The checkpoint admits Dexie is absent, UnitOfWork is pass-through, rollback is untested, and optimistic concurrency is absent. That is acceptable for revised Phase 0B, but Phase 0C is not partly complete merely because interfaces exist.

### 6. Atlas wording must be corrected

The Atlas Markdown is now readable. It requires structured knowledge objects, source-page provenance, exact and uncertain time, approximate dates, centuries, ranges, time-aware historical borders, knowledge/perspective, and future CSV/JSON/GeoJSON imports.

The current work intentionally contains primitives only and no Person, Place, Event, Organisation, Movement, Polity, Religion, Ideology, Commodity, or Route schemas.

Required:

- re-audit `time`, `spatial`, `knowledge`, `epistemics`, and `Reference` against the actual Atlas Markdown;
- rename the checkpoint claim to **Atlas primitive and provenance readiness**;
- do not claim entity-to-source-page acceptance without Atlas entity records;
- do not add full Atlas entities during Phase 0C unless an approved ADR assigns them there.

### 7. Read Aloud requirements are not traceable in the supplied canonical set

The checkpoint cites RA-021, RA-022, RA-023, RA-024, RA-INV-002, RA-INV-004, and RA-INV-008, but their definitions were not found in the supplied v0.2 package.

Required:

- locate the approved Read Aloud specification in the repository;
- link it from the documentation index if normative;
- if absent, mark RA claims unverified and do not reconstruct requirement text from field names;
- preserve existing fields unless they are demonstrably harmful;
- record the provenance issue.

### 8. Test totals need one exact source of truth

The report alternates between approximately 36 and 37 repository cases and “roughly 176” new cases while claiming 216 exact passing tests.

Report exact test files and exact runner totals. Explain whether 36 was pre-fix and 37 post-fix.

## Phase 0C risks that must be addressed

1. **Real UnitOfWork:** memory snapshot rollback plus real Dexie transactions; force mid-operation failure and prove no partial records survive.
2. **Optimistic concurrency:** expected revision/compare-and-swap, typed conflict errors, identical behaviour across adapters.
3. **Legacy preservation:** read-only v1 readers; never mutate/delete v1; write v2 separately; dry-run before apply.
4. **Asset recovery:** binary and metadata must be atomic or produce an explicit typed recovery record.
5. **Security:** classify the seven reported high-severity findings; never run `npm audit fix --force` blindly.
6. **Browser proof:** jsdom is not proof of IndexedDB persistence. Run at least one real browser/Playwright reload and transaction test.
7. **Soft-delete scope:** journal-block trash does not prove every destructive action satisfies NFR-008.
8. **ID policy:** parsers may accept approved legacy UUID versions, but new generation should emit one canonical format.

## Documentation updates required

Create or update:

1. `docs/CNTKNW_Phase_0B_Checkpoint_Report.md`
2. `docs/CNTKNW_Current_Implementation_Status.md`
3. `docs/CNTKNW_ADR_0001_Phase_0B_Foundations.md` only when incomplete/ambiguous; supersede rather than silently rewrite an approved ADR
4. `docs/CNTKNW_Amendments_Register_v0.2.md`
5. `CNTKNW_READ_ME_FIRST_v0.2.md` or the repository docs index
6. `docs/CNTKNW_Phase_0C_Persistence_Design.md`
7. `docs/CNTKNW_Phase_0C_Checkpoint_Report.md` after verification

Add the Atlas Markdown to the supplemental read order. Add the Read Aloud specification only if it exists and is approved.

If canonical package files are modified rather than supplemented, use an explicit version/patch decision and regenerate matching checksums. Do not leave stale DOCX/PDF/checksum files appearing current.

---

# Part II — Copy-Paste Prompt for Claude Code

You are the senior implementation engineer and audit owner for **CNTKNW**, a local-first personal knowledge museum and study studio.

Your task has two ordered parts:

1. correct and verify the Phase 0B checkpoint and documentation;
2. implement **Phase 0C — persistence** under the approved revised phase sequence.

Do not begin persistence coding until you have completed the pre-implementation audit and reported any architecture-blocking conflict.

## 1. Read the authoritative context completely

Before editing code, read these files in full when present:

1. `CNTKNW_Product_Design_Document_v0.2.md`
2. `CNTKNW_AI_Implementation_Handoff_v0.2.md`
3. `CNTKNW_Requirements_v0.2.json`
4. `CNTKNW_READ_ME_FIRST_v0.2.md`
5. `CNTKNW_Master_AI_Context_v0.2.md`
6. `CNTKNW_Atlas_System_Design_Document_v0.1.md`
7. `docs/CNTKNW_ADR_0001_Phase_0B_Foundations.md`
8. `docs/CNTKNW_Amendments_Register_v0.2.md`
9. the current Phase 0B checkpoint report
10. every approved Read Aloud specification defining RA-021, RA-022, RA-023, RA-024, RA-INV-002, RA-INV-004, and RA-INV-008

Use this precedence:

1. latest explicit user decision;
2. Product Design Document v0.2;
3. AI Implementation Handoff v0.2;
4. approved later ADRs and amendments;
5. approved supplemental feature specifications, provided they do not conflict with the product documents;
6. existing code;
7. assumptions.

Do not treat existing code as the product specification.

## 2. Inspect the actual repository first

Confirm and report:

- repository root, branch, and Git status;
- actual source layout;
- package manager and lockfile;
- dependency versions;
- existing database name and legacy v1 stores;
- current schemas and repository interfaces;
- memory adapter behaviour;
- existing tests and exact test count;
- existing ADR/documentation files;
- whether the reported Linux verification is independently reproducible;
- whether a Windows verification was actually executed.

Do not rely on the checkpoint report alone.

## 3. Correct Phase 0B documentation

Fix the checkpoint so it no longer:

- says verification passed and was not run;
- describes executed Linux results as merely expected from reading;
- claims migration obligations do not exist;
- claims INV-013/NFR-005 are complete before migrations exist;
- marks later product acceptance criteria passed from unit tests;
- claims Atlas entity behaviour when only primitives exist;
- cites Read Aloud IDs without a traceable source;
- mixes approximate and exact test totals.

Use status labels such as:

- implemented;
- contract-tested;
- persistence-tested;
- browser-tested;
- E2E-accepted;
- deferred;
- blocked;
- unverified.

## 4. Confirm the revised phase sequence

The original handoff labels Phase 0B as shell/routing and Phase 0C as domain/persistence. Verify ADR-0001:

- exists and is approved;
- explicitly defines the revised order;
- states where shell/routing/design work moved;
- does not weaken the Product Design Document Phase 0 exit condition.

If absent or architecture-relevant details are ambiguous, stop and report the conflict. Do not invent a sequence.

If valid, create/update a current implementation-status document and link it from the read-first/index document.

## 5. Phase 0C gate

Implement a real persistence adapter and migration foundation without building product UI.

The gate is:

> The same repository contract suite passes against memory and IndexedDB/Dexie adapters, including transaction rollback, optimistic revision conflicts, soft deletion, migration behaviour, and failed writes.

## 6. Allowed scope

Implement only:

- Dexie or the already approved migration-friendly IndexedDB wrapper;
- typed storage records and mapping functions;
- explicit database schema versions;
- required stores and indexes;
- IndexedDB adapter;
- real UnitOfWork;
- optimistic concurrency;
- deterministic migration functions;
- read-only legacy v1 readers;
- legacy audit and migration dry-run reports;
- rollback/recovery instructions;
- typed storage/transaction/conflict errors;
- repository contract expansion;
- browser-capable persistence tests;
- documentation/checkpoint updates.

Do not implement:

- Library/Gallery/Notes UI;
- routing or design-system work unless ADR-0001 explicitly assigns it here;
- full journal editor;
- PDF rendering/PDF.js;
- annotation UI;
- Atlas UI or full Atlas entities;
- Read Aloud playback/TTS;
- OCR, AI, 3D, or chess.

## 7. Persistence architecture

### Adapter isolation

Domain/application code must not import Dexie. UI/feature code must not import adapters. Preserve:

```text
domain/application
    -> repository interfaces / UnitOfWork
        -> memory or IndexedDB adapter
```

Generic `put(storeName, object)` is prohibited outside explicit migration tooling.

### Database safety

Inspect legacy DB reality before choosing:

- a separate v2 database; or
- new versioned stores that preserve v1 records.

Document the choice. Never mutate, delete, or “clean up” v1 stores.

### Schema versions

Create an explicit source of truth for:

- database name;
- schema version;
- stores;
- primary keys;
- indexes/compound indexes;
- uniqueness;
- associated migration;
- rollback/recovery.

No schema change may exist only inside a Dexie `.version()` call without documentation.

### Domain/storage boundaries

Every adapter boundary must validate inputs and stored outputs, map domain/storage records explicitly, reject malformed data with typed errors, avoid `any`, retain legacy IDs, and avoid silently dropping unknown legacy information.

Confirm that new ID generation emits one canonical format even when parsers accept approved legacy UUID versions.

### Real UnitOfWork

For memory: snapshot/copy-on-write rollback.

For Dexie: one real read-write transaction covering every participating store. Ensure repository calls use the active transaction and do not escape into nested independent transactions.

Add forced-failure tests after the first and middle writes and prove no partial records survive.

### Optimistic concurrency

Use one typed compare-and-swap policy, such as:

```ts
type RevisionedWrite = {
  expectedRevision: number;
};
```

Required behaviour:

- documented initial revision;
- valid update increments once;
- stale update throws typed `RevisionConflictError`;
- stored data remains unchanged;
- delete/restore conflicts are detected;
- memory and Dexie match.

Never silently overwrite a newer revision.

### Soft deletion

Test:

- `deletedAt` set;
- ordinary lists exclude deleted records;
- deleted lists include them;
- restore preserves identity/content;
- revision policy applies;
- rollback restores prior state after failure.

Document exactly which destructive actions are covered. Do not claim global NFR-008 completion from block trash alone.

### Asset/PDF-import persistence readiness

Do not build the reader, but make the existing import application contract safe:

- preserve file-boundary validation;
- use real storage keys;
- define atomic/recovery behaviour between Blob storage and metadata;
- roll back or create a typed import-recovery record on partial failure;
- prevent unreported orphaned binary or metadata records.

This is persistence readiness, not full AC-001 acceptance.

## 8. Legacy v1 audit and migration

### Read-only readers

Implement readers for stores that actually exist, including where present:

- `books`;
- `pdfs`;
- `notes`;
- `pdfAnnotations`;
- alternate/broken `annotations`;
- `drawings`;
- `sessions`;
- `artworks`;
- `appState`.

Tolerate verified inconsistencies: `text`/`content`, `pdfId`/`bookId`, missing stores/fields, raster-only drawings, malformed records, and incomplete binaries.

Never fix v1 in place.

### Deterministic mappings

Create pure tested mappings:

- `books` -> `sources` + `bookDetails`;
- `pdfs` -> `assets` + `sourceAssets`;
- `notes` -> `journals` + `journalBlocks`;
- `pdfAnnotations` -> `annotations`;
- broken annotation references -> recovery findings;
- `drawings` -> locked legacy-raster records/references;
- `sessions` -> `studySessions`;
- `artworks` -> `sources` + `artworkDetails` + assets;
- `appState` -> `settings` + `workspaceStates`.

Include:

- legacy `currentPage`/`currentChapter` -> `WorkspaceState.activeLocation`;
- missing `JournalBlock.deletedAt` -> live;
- every approved amendment from ADR-0001/register.

### Dry-run report

A dry run performs no v2 writes and reports at least:

```ts
type MigrationDryRunReport = {
  sourceDatabase: string;
  sourceVersion?: number;
  targetSchemaVersion: number;
  startedAt: string;
  completedAt: string;
  storesFound: string[];
  storesMissing: string[];
  recordsScanned: Record<string, number>;
  recordsMappable: Record<string, number>;
  recordsSkipped: Record<string, number>;
  warnings: MigrationFinding[];
  errors: MigrationFinding[];
  conflicts: MigrationFinding[];
  orphanedAssets: MigrationFinding[];
  brokenReferences: MigrationFinding[];
  safeToApply: boolean;
};
```

Use approved project names if contracts already exist. Distinguish added, updated, skipped, conflicted, invalid, orphaned, and unrecoverable.

### Apply migration

Only implement apply after dry-run tests exist. Apply must:

- require explicit caller action;
- preserve v1;
- write v2 transactionally;
- produce an apply report;
- verify counts/relationships;
- be idempotent or detect prior completion;
- avoid duplicates on retry;
- stop on unresolved high-severity conflicts.

Do not auto-run destructive migration merely by importing the database module.

## 9. Atlas validation

Read the Atlas Markdown and audit only existing shared primitives:

- exact, approximate, century, range, and uncertain time;
- eras/calendars where approved;
- coordinates/geometry references;
- knowledge-entity kind references;
- claim/source/page provenance;
- confidence, dispute, and personal-interpretation states;
- future ability to represent time-aware historical borders without false certainty.

Do not add full Atlas entities unless an approved ADR explicitly requires them in Phase 0C.

Change documentation from “Atlas entity-to-source-page connections covered” to “Atlas primitive and provenance readiness” unless actual entities exist.

## 10. Read Aloud traceability

Locate the approved Read Aloud source.

If found, link it and trace every claimed RA field/invariant.

If absent, mark claims unverified, do not invent requirement text, preserve existing code unless harmful, and do not implement playback.

## 11. Testing

Run one adapter-agnostic suite against memory and IndexedDB. Cover:

- create/read/update;
- ordering/rank persistence;
- source queries;
- boundary validation;
- backlinks and undirected matching;
- soft delete/restore;
- revision conflicts;
- commit/rollback;
- failed writes;
- malformed stored records;
- migration mapping;
- dry run;
- idempotent apply where implemented.

Use a suitable isolated IndexedDB environment for fast tests and at least one real Playwright/browser flow proving persistence across reload and actual transaction behaviour. Do not claim browser persistence from jsdom.

Run from a clean install:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit
npm audit --omit=dev
```

Use actual script names if different. Report exact exit codes, test counts, skips, environment, browser version, bundle result, and vulnerability classification.

Never use `npm audit fix --force` without explicit reviewed approval.

## 12. Documentation

Create/update:

- corrected Phase 0B checkpoint;
- current implementation status/approved phase sequence;
- Phase 0C persistence design;
- migration mapping/dry-run schema;
- amendments register;
- read-first/index;
- Phase 0C checkpoint after verification.

Add Atlas Markdown to supplemental read order. Add Read Aloud only if it exists and is approved.

If normative content changes, use a version/patch decision, update authoritative Markdown/JSON first, and regenerate matching checksums. Do not leave stale derived files appearing canonical.

## 13. Security review

Classify each reported high-severity vulnerability as:

- direct/transitive;
- runtime/development-only;
- reachable/not reasonably reachable;
- fix available without breaking changes;
- deferred with reason.

Make compatible upgrades only, then rerun the full gate.

## 14. Prohibited shortcuts

- No direct component DB writes.
- No `any` bypass.
- No generic store writes outside migration tooling.
- No in-place v1 mutation/deletion.
- No last-write-wins overwrite.
- No fake transaction wrapper.
- No auto-running destructive migration.
- No E2E claims from unit tests.
- No hidden Atlas entities inside generic primitives.
- No guessed Read Aloud requirements.
- No UI expansion, PDF rendering, TTS, OCR, AI, 3D, or chess.
- No forced dependency audit fix.
- No completion claim while a required gate fails.

## 15. Final deliverable

Return one checkpoint report containing:

1. approved phase and ADR;
2. requirements/scope;
3. repository observations;
4. Phase 0B audit corrections;
5. files changed;
6. database/stores/indexes;
7. UnitOfWork and concurrency design;
8. soft-delete coverage;
9. v1 readers and migration mappings;
10. dry-run/apply behaviour;
11. schema/migration version and recovery;
12. exact verification results;
13. requirement mapping using contract-tested/persistence-tested/browser-tested/E2E-deferred/unverified labels;
14. known limitations;
15. next safe step.

Do not claim Phase 0C complete unless:

- memory and IndexedDB adapters pass the same repository contracts;
- rollback and revision-conflict tests pass;
- v1 dry run is tested and non-destructive;
- real browser persistence/reload verification passes;
- documentation is updated;
- clean production build succeeds.
