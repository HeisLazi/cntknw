# CNTKNW Phase 0C — Checkpoint Report

**Date:** 25 July 2026. **Revised and closed 26 July 2026.**
**Phase:** 0C — Persistence
**ADRs:** ADR-0002 (Accepted), ADR-0003 (Accepted, supersedes ADR-0002 §4), under the sequence in ADR-0001 §1
**Verification:** **PASSED.** Full gate executed, including the real-browser gate. Results in §12.

---

## 0. Closure note, 26 July 2026

This report was first written on 25 July while Playwright was not installed
and browser persistence was unproven. It nonetheless described the phase as
complete and verified. That was the first of five findings raised by the
external audit of 25 July; all five are now closed, and this document has been
corrected rather than reissued.

| # | Finding | Resolution |
|---|---|---|
| C-01 | Phase status contradicted the missing browser gate | Playwright installed; eight browser tests pass in Chromium (§12.2). The status is now true rather than aspirational. |
| C-02 | Optional `expectedRevision` left a silent-overwrite path | Replaced by a mandatory `ConcurrencyGuard`. **ADR-0003**, superseding ADR-0002 §4. §5 rewritten. |
| C-03 | "Structurally write-incapable" was an overclaim | Wording corrected and replaced with a checked boundary test. §7 rewritten. |
| C-04 | Annotation-loss wording was too absolute | Wording corrected to what was actually observed. §2.1 rewritten. |
| C-05 | File inventory counts did not match their own lists | §10 rewritten, and the limits of a Git-derived inventory stated. |
| C-06 | Test terminology conflated cases with assertions | §1 and §12 now use the runner's own terms: test files, tests, skipped. |

The Phase 0C status line, everywhere it appears, is now:

> Phase 0C complete and verified in both contract and real-browser environments.

Until the browser gate passed it read *"Phase 0C implementation complete;
browser and concurrency closure pending"*, which is what it should have said
on 25 July.

**Git baseline.** The repository was placed under version control on 26 July
2026. Commit `4494f24`, tagged `phase-0c-impl`, captures the tree exactly as
this report originally described it. Everything after that tag is closure work.

---

## 1. Requirements and scope

**Gate:**

> The same repository contract suite passes against the memory and IndexedDB adapters, including transaction rollback, optimistic revision conflicts, soft deletion, migration behaviour and failed writes.

**Met.** The contract suite defines 62 tests and runs each of them against both
adapters — 124 tests in one file, 0 failures, 0 skipped. (It was 53 per adapter
at first writing; ADR-0003 added nine. The earlier figure of "106 assertions"
was wrong twice over: 106 was the number of *tests* the runner reported for
that file, not assertions, and no assertion count was ever measured. See C-06.)

**Implemented:** Dexie adapter, documented schema versions, storage-record mapping with validation on read, typed storage errors, real `UnitOfWork` on both adapters, opt-in optimistic concurrency, read-only v1 readers, deterministic v1→v2 mappings, non-destructive migration dry run.

**Not implemented, deliberately:** `applyMigration`. No destructive path exists in the codebase (ADR-0002 §7).

**Not touched:** UI, routing, design tokens, PDF rendering, annotation UI, Atlas entities, Read Aloud playback, OCR, AI, 3D, chess.

---

## 2. Repository observations

`src/legacy-v1/db.js` was read directly rather than trusted second-hand. Three findings changed the mapping design; the first is worse than the handoff records.

**2.1 — the inspected v1 annotation save path fails.** `db.js` creates `pdfAnnotations` (keyPath `id`, indexes `pdfId`, `page`). `PDFReader.jsx:252` writes to a store called `annotations`, which **no version of `db.js` in this repository creates**. In IndexedDB that throws `NotFoundError`, and the call sits inside a `try/catch` whose only handler is `console.error`.

**Corrected wording (C-04).** This report previously said *"every annotation a v1 user drew was discarded"* and *"the reality is total data loss"*. Reading one broken write path proves that path fails; it does not prove that every real v1 database on disk is empty. A user may have run an earlier or patched build, or acquired `pdfAnnotations` rows by some route not visible here. The accurate statement is:

> The inspected v1 annotation save path failed. Migration scans `pdfAnnotations` and any phantom `annotations` store separately; unexpected populated data is reported and preserved for inspection.

The scanning code was already correct and is unchanged — the dry run reads both stores, never conflates them, and reports a populated `pdfAnnotations` as an anomaly rather than silently mapping or discarding it. Only this description was wrong. Handoff §5.3 describes a store mismatch; the mismatch is real and worse than a naming slip, but "worse" is not the same as "provably total".

**2.2 — two note shapes, confirmed.** `NoteSystem.jsx:139` writes `{ text, title, category, chapter, tags[] }`; `PDFReader.jsx:295` writes `{ content }` and none of the rest. The mapper accepts either, prefers `text`, and when a record carries both it keeps both and reports the ambiguity.

**2.3 — drawings are raster only.** `Whiteboard.jsx:199` stores a PNG data URL. No vector data exists, so these become locked `legacy-raster` assets referenced by image blocks, never fabricated editable drawings (INV-008).

---

## 3. Database, stores and indexes

**A separate v2 database, `cntknw`, schema version 1.** The v1 database `philosophy-journal` is never opened for writing, never upgraded, never deleted.

Opening v1 at a higher version would irreversibly upgrade it, after which the v1 app — which opens at version 1 — throws `VersionError` and can never run again. Handoff §6.1 requires legacy to stay runnable until migration is verified. Two databases also make it structurally impossible for v2 code to reach a v1 store. Full reasoning in ADR-0002 §1.

Sixteen stores are declared in `src/data/db/schemaVersions.ts`, which is the source of truth; `database.ts` derives its Dexie declaration from it, so documentation cannot drift from code.

Four index decisions worth stating:

- **`journalBlocks.[journalId+pdfPage]`** — `pdfPage` is flattened onto the record because IndexedDB cannot index through the optional nested path `sourceLocation.pdf.page`.
- **`connections.fromKey` / `toKey`** — flattened reference keys, because a discriminated union is not indexable.
- **`epistemicClaims.*originBlockIds`** — multi-entry, because one claim may originate from several passages (ADR-0001 §4).
- **`assetBinaries`** — split from `assets`, so listing assets never pulls PDF bytes into memory (NFR-003).

**Absent values use `''`, not `undefined`.** IndexedDB will not index `undefined`, so a record with an absent indexed field vanishes from that index entirely. `deletedAt: ''` keeps live-versus-deleted queries honest.

---

## 4. UnitOfWork

**Dexie:** one `readwrite` transaction across every store. Repository calls inside `run` join it, because Dexie binds the active transaction to the async context. Nested `run` calls reuse the outer transaction rather than opening an independent one that could commit while the outer rolled back.

**Memory:** snapshots every store on entry and restores on failure.

The memory snapshot exists so rollback is testable against **both** adapters. If it were only testable against Dexie, the memory adapter would drift and the suite would stop being a contract.

Four rollback cases, run against each adapter: failure after the first write, failure mid-sequence, a rolled-back multi-store import leaving nothing behind, and a nested `run` rolling back with its parent. Plus one asserting an already-committed transaction is *not* rolled back by a later failure.

---

## 5. Optimistic concurrency — rewritten under ADR-0003

**Superseded (C-02).** This section originally described `expectedRevision` as
an optional final parameter, with omission meaning last-write-wins, and argued
that opt-in was deliberate because Phase 0B's use cases read and write inside
one transaction. Two of them did not: `promoteBlockToClaim` and
`linkBlockToExistingClaim` both read a record *before* opening the transaction
and wrote it inside — a genuine stale-read window in the only two use cases
that had one. More fundamentally, an ordinary, fully typed, lint-clean call
could silently overwrite newer user content, which handoff §13.3 forbids
outright. ADR-0002 §4 named that risk in its own Cost paragraph and accepted
it; ADR-0003 does not.

**In force now.** Every mutating method that touches a revisioned record takes
a **mandatory** guard:

```ts
type ConcurrencyGuard =
  | { mode: 'expected'; revision: Revision }
  | { mode: 'unconditional'; reason: 'migration' | 'repair' };
```

- `create` takes no guard; there is nothing stored to overwrite.
- `update`, `delete`, `softDelete`, `restore`, `archive`, `unarchive` and
  `moveBlock` require one.
- Application code uses `expectedRevision(n)`; `unconditionally(...)` is the
  only override and must be written out.
- **Omission never means last-write-wins.** It is a compile error, and
  `assertRevision` also rejects a missing or malformed guard at runtime, so the
  rule survives an untyped caller.
- `WorkspaceState.upsert` is split into `create` and `update`: an upsert cannot
  honour a mandatory guard on its insert branch. Adds `RecordAlreadyExistsError`.

Full reasoning, coverage table and the entities deliberately left unguarded
(`Asset`, `SourceAsset`, `BookDetails`, `ArtworkDetails` — none carries a
revision) are in **ADR-0003**.

**Nineteen concurrency tests per adapter**, up from ten: initial revision,
single increment, matching revision accepted, stale rejected, **stored data
unchanged after a conflict**, both revisions reported, **an unguarded call
rejected rather than granted last-write-wins**, **an explicit unconditional
override honoured**, conflicts on blocks and on workspace state, **stale hard
delete**, **stale soft delete**, **stale restore**, delete-of-absent treated as
a no-op, **cross-entity parity across annotations, concepts, glossary entries,
sessions and connections**, workspace create/update split, and typed
`RecordNotFoundError` rather than a bare `Error`.

---

## 6. Soft deletion — coverage stated exactly

Covered: `JournalBlock`, `EpistemicClaim`.

**Not covered:** `Source`, `Annotation`, `Connection`, `Concept`, `GlossaryEntry`, `StudySession`, `WorkspaceState` — all still hard-delete.

**NFR-008 is therefore partially satisfied, not satisfied.** Journal-block trash does not discharge a requirement covering every destructive action.

---

## 7. Legacy readers and mappings

**Corrected wording (C-03).** This report and ADR-0002 §6 described the readers
as *"structurally write-incapable"*. That is an overclaim: `readV1Snapshot`
holds a live Dexie handle while it runs, and a Dexie handle can write. What is
true is narrower, and is now stated as such:

> v1 access is read-only by module boundary and public API; no schema upgrade
> is declared, and no raw database or table handle escapes the reader module.

That claim is no longer left to assertion. `src/legacy/v1/read-only-boundary.test.ts`
checks it in five tests:

- no `.version()` call anywhere in `readers.ts`, so no upgrade transaction can
  fire and irreversibly break the v1 app;
- no Dexie write, delete, upgrade or `'rw'` transaction verb in the module;
- the module exports exactly `v1DatabaseExists`, `readV1Snapshot` and
  `emptyV1Snapshot`, none of which returns a `Dexie` or `Table`; `openV1` is
  module-private and its one caller closes the handle in a `finally`;
- no module outside `legacy/v1` references the v1 database name at all, apart
  from `schemaVersions.ts`, which declares the constant;
- `applyMigration` does not exist anywhere in the tree (ADR-0002 §7).

Real-browser confirmation is BV-005: after a full v2 session's writing,
`philosophy-journal` is still at version 1 with its records intact, and reading
it twice does not upgrade it.

Mappings are **pure**: no clock, no random, no I/O. Ids and timestamps are injected. Determinism is what makes a dry run trustworthy — a report that could differ from the eventual apply would be worse than no report.

| v1 | v2 | Notes |
|---|---|---|
| `books` | `sources` + `bookDetails` + `journals` + `workspaceStates` | `currentPage` → `WorkspaceState`, never `BookDetails` (ADR-0001 §3) |
| `notes` | `journalBlocks` | Both shapes; `text` preferred; both kept when present |
| `sessions` | `studySessions` | `activityMode: 'reading'` — v1 had no listening |
| `pdfs` | `assets` (+ binary) | Records with no payload are skipped, not turned into dangling assets |
| `pdfAnnotations` | — | Expected empty; populated is reported as an anomaly |
| `annotations` (phantom) | — | Scanned; presence reported as schema divergence |
| `drawings` | `legacy-raster` asset + image block | Locked, never fake vectors |
| `artworks` | `sources` + `artworkDetails` + analysis blocks | Analysis prose → journal blocks (handoff §6.3) |
| `appState` | — | Deferred; needs a settings store |

`publicationYear` maps as free text. "circa 1961" and "1961?" both occur in real form data, and parsing would fabricate precision the source never had.

---

## 8. Dry run

`dryRunMigration` reports `recordsScanned`, `recordsMappable`, `recordsSkipped`, warnings, errors, orphaned records, broken references, note-origin counts, `safeToApply`, and a plain-language summary. It writes nothing, to either database.

`applyMigration` **does not exist.** That absence is the guarantee: no import of the module can trigger a destructive migration, because no code path exists that could.

---

## 9. Schema and migration versioning

Schema version 1. Recovery, quoted from `schemaVersions.ts`:

> The database is new and empty on creation, so failure loses nothing. Delete the "cntknw" database and reopen. The v1 database "philosophy-journal" is never modified and remains intact.

No schema change may exist only inside a Dexie `.version()` call.

---

## 10. Files

**Corrected (C-05).** The original version of this section stated "New (11)"
above a list of twelve, and "Modified (10)" above a list of eleven; within that
list "seven repository interfaces" was itself wrong — eight carried
`ExpectedRevision` at the Phase 0C baseline. Three counting errors in one
section, none of which changed a decision, all of which cost the reader their
trust in the rest of the numbers.

**A limit worth stating plainly.** The repository had no version control until
26 July 2026, so there is no Phase 0B commit. Git therefore **cannot** derive
the new-versus-modified split for Phase 0C: that boundary predates the first
commit and is not recoverable. The lists below are corrected by hand and
labelled as such. What Git *can* attest is stated separately, and everything
from the baseline onward is Git-derived.

### 10.1 Git-verified: the Phase 0C baseline

Commit `4494f24`, tag `phase-0c-impl`. **105 tracked files**, of which **77**
are under `src/` and `docs/` excluding the frozen `src/legacy-v1/` prototype.
Every file named as new below is present at that tag.

### 10.2 Hand-corrected: introduced by Phase 0C (12)

Eleven source files —

`data/errors.ts`, `data/db/schemaVersions.ts`, `data/db/database.ts`,
`data/db/storageRecords.ts`, `data/adapters/indexeddb/index.ts`,
`data/repositories/concurrency.ts`, `legacy/v1/types.ts`,
`legacy/v1/readers.ts`, `legacy/v1/mappings.ts`, `legacy/v1/dryRun.ts`,
`legacy/v1/migration.test.ts`

— plus one document, `docs/CNTKNW_ADR_0002_Phase_0C_Persistence.md`. **Twelve
in total**, which is what the original list contained and not what its heading
claimed.

### 10.3 Hand-corrected: modified by Phase 0C (12)

**Eight** repository interfaces gained the optimistic-concurrency parameter —
`SourceRepository`, `JournalRepository`, `AnnotationRepository`,
`ConceptRepository`, `GlossaryRepository`, `SessionRepository`,
`EpistemicClaimRepository`, `WorkspaceStateRepository` (verified against the
tag, not recalled) — plus `repositories/index.ts`, `adapters/memory/index.ts`
(real snapshot rollback, revision checks, typed errors),
`adapters/repository-contract.test.ts` (parameterised over both adapters), and
`package.json`.

### 10.4 Git-derived: the closure work, 26 July 2026

Three commits on top of the baseline. `git diff --stat phase-0c-impl..HEAD`
is authoritative; the shape of it is:

| Change | Files |
|---|---|
| Mandatory concurrency guards (ADR-0003) | `data/repositories/concurrency.ts` and all eight interfaces rewritten; both adapters; `data/errors.ts` (+`RecordAlreadyExistsError`); `application/import-pdf.ts`; `application/promote-block-to-claim.ts`; both test suites |
| Browser verification | **new:** `playwright.config.ts`, `vite.e2e.config.ts`, `tsconfig.e2e.json`, `e2e/harness/{index.html,harness.ts}`, `e2e/browser/harness-client.ts`, five `bv-00N-*.spec.ts` |
| v1 boundary check (C-03) | **new:** `legacy/v1/read-only-boundary.test.ts` |
| Tooling | `package.json` (typecheck and lint now cover `e2e/`), `eslint.config.js`, `.gitignore` |
| Documents | **new:** `CNTKNW_ADR_0003_Mandatory_Concurrency_Guards.md`; revised: this report, the status document, the register, the index |

---

## 11. Dependencies and security

`fake-indexeddb` added as a dev dependency, for adapter tests without a browser.

**`react-router-dom` removed.** It carried the only two production-reachable advisories (React Router RSC-mode CSRF bypass, GHSA-qwww-vcr4-c8h2), `@latest` (7.18.1) is still inside the vulnerable range `7.12.0 – 8.2.0`, and it was **not imported anywhere** — declared ahead of Phase 0D. Removing an unused dependency was cleaner than pinning a vulnerable one. Phase 0D reinstalls it at whatever version is current and safe then.

| Advisory | Scope | Reachable | Action |
|---|---|---|---|
| react-router / react-router-dom — RSC CSRF bypass | was runtime | No — never imported, and RSC mode is unused | **Removed the dependency** |
| eslint, @eslint/config-array, @eslint/eslintrc, minimatch, brace-expansion | dev only | No — never in a shipped bundle | **Deferred.** Fix requires ESLint 10, a major bump. Not taken mid-phase. |

**Production vulnerabilities: 7 → 0.** Five remain, all dev-only and transitive through ESLint.

`npm audit fix --force` was not run.

**Added at closure, 26 July:** `@playwright/test` 1.62.0 as a dev dependency,
with the Chromium browser binary (Chrome Headless Shell 151.0.7922.34). It
introduces **no new advisory**: the same five ESLint-transitive highs are the
only ones reported, and `npm audit --omit=dev` remains at zero.

The harness that Playwright drives is served by `vite.e2e.config.ts`, a
separate config whose root is `e2e/harness`. `npm run build` uses the default
config and transforms the same 14 modules it did before, with an identical
bundle size; the built output was searched for `__cntknw`, `seedV1Database`
and `harness` and contains none of them. A dev-only surface that ships in the
production bundle is not dev-only, so this is checked rather than assumed.

---

## 12. Verification

### 12.1 Full gate, 26 July 2026

Node v22.16.0, npm 10.9.2, Windows 11 (10.0.26200) x64, clean `npm ci`.

```text
npm ci                PASS   exit 0
npm run typecheck     PASS   exit 0, 0 errors      (src/ and e2e/)
npm run lint          PASS   exit 0, 0 errors, 0 warnings
npm run test          PASS   exit 0, 354 tests, 10 test files, 0 skipped
npm run test:e2e      PASS   exit 0, 8 tests, 1 browser project (chromium), 0 skipped
npm run build         PASS   exit 0, 190.89 kB (60.22 kB gzipped)
npm audit --omit=dev  PASS   0 vulnerabilities
npm audit             exit 1, 5 high, all dev-only (ESLint transitive)
```

`npm audit`'s non-zero exit is the advisory count, not a gate failure: the gate
requires no *production-reachable* high-severity advisory, and there are none.

**Platform note.** Phase 0C was originally verified on Linux with Node
v22.22.3. This run is Windows with Node v22.16.0. Both pass; the suite has now
been executed on two platforms and two Node minors, which the previous report
listed as an open item.

### 12.2 Browser verification — the gate Phase 0C was missing

`@playwright/test` 1.62.0, Chromium 151.0.7922.34, one browser project, workers 1.

| ID | Test file | Tests | Result |
|---|---|---|---|
| BV-001 | `bv-001-persistence-across-reload.spec.ts` | 2 | pass |
| BV-002 | `bv-002-transaction-rollback.spec.ts` | 1 | pass |
| BV-003 | `bv-003-revision-conflict.spec.ts` | 2 | pass |
| BV-004 | `bv-004-nested-transaction.spec.ts` | 1 | pass |
| BV-005 | `bv-005-database-separation.spec.ts` | 2 | pass |
| | **Total** | **8** | **8 passed, 0 skipped** |

Every spec drives the same public composition the application will use —
`importPdf`, `createPageLinkedBlock`, `resumeSource`, the repositories and the
unit of work — through a dev-only harness page. Raw IndexedDB appears in
exactly two places, both fixtures rather than the system under test: staging
the legacy `philosophy-journal` database, which CNTKNW has no writer for and
must never acquire one; and reading `indexedDB.databases()` to observe what v2
did *not* touch. Each test uses its own v2 database, because IndexedDB is
origin-global and shared state would make any failure order-dependent.

**Negative control.** Passing tests are only evidence if they can fail.
`DexieUnitOfWork.run` was temporarily reduced to a pass-through — the exact
defect ADR-0002 §5 warns about — and BV-002 and BV-004 both failed, BV-002
reporting a surviving source where it expected none. The change was reverted
and the suite re-run green. Without that check, "8 passed" would only have
shown that the assertions ran.

### 12.3 Test counts

Vitest's own terms: **10 test files, 354 tests, 0 skipped.** No assertion count
is given, because none was measured (C-06).

| File | Tests |
|---|---|
| `data/adapters/repository-contract.test.ts` | 124 |
| `legacy/v1/migration.test.ts` | 46 |
| `domain/atlas-readiness.test.ts` | 43 |
| `application/application.test.ts` | 33 |
| `domain/domain.test.ts` | 28 |
| `domain/time/time.test.ts` | 26 |
| `domain/read-aloud-readiness.test.ts` | 25 |
| `lib/rank.test.ts` | 22 |
| `legacy/v1/read-only-boundary.test.ts` | 5 |
| `lib/id.test.ts` | 2 |
| **Total** | **354** |

+138 since Phase 0B (216 → 354); +23 since this report was first written
(331 → 354).

**Contract suite split:** the file defines 62 tests and runs each against both
adapters — memory 62, indexeddb 62, identical cases, both green. Groups: Source
6, Journal 8, Asset 4, Annotation 2, Connection 5, Concept 1, Glossary 1,
EpistemicClaim 4, Session 2, WorkspaceState 4, UnitOfWork 8, optimistic
concurrency 17.

### 12.4 Defects found by running

**Two.**

1. *(25 July)* A mapping test used `journalId: 'journal-1'`, and
   `JournalBlockSchema` rejected it because it is not a UUID. **The fixture was
   wrong, not the mapper** — and the failure proves mapper output is genuinely
   validated rather than assumed. Fixture corrected to a real UUID.

2. *(26 July)* The first version of the unguarded-call test extracted
   `repos.sources.update` into a bare variable and called it, which detached
   `this` and threw `Cannot read properties of undefined (reading 'sources')`
   instead of the guard's own error. The test was wrong, not the guard: it was
   proving that an unbound method fails, which is true of every method. Rewritten
   to call through the repository so a *missing argument* is what is actually
   under test.

---

## 13. Requirement mapping

Labels per the Phase 0B checkpoint §6.

| Requirement | Status |
|---|---|
| Phase 0C gate — one suite, both adapters | **contract-tested** — 62 tests per adapter, identical |
| Transaction rollback | **contract-tested** (4 failure points, both adapters) and **browser-tested** (BV-002) |
| Nested transaction joins its parent | **contract-tested** and **browser-tested** (BV-004) |
| Optimistic revision conflicts | **contract-tested**, both adapters, 17 cases; **browser-tested** (BV-003) |
| Mandatory guard — omission cannot mean last-write-wins | **contract-tested**, both adapters (compile-time and runtime) — ADR-0003 |
| Soft deletion and restore | **contract-tested** — blocks and claims only |
| Typed storage errors | **contract-tested** |
| Validation of stored records on read | **contract-tested** |
| v1 read-only access | **contract-tested** — read-only by module boundary and public API; no `.version()`, no handle escapes (§7) — and **browser-tested** (BV-005) |
| v1→v2 mappings | **contract-tested**, pure and deterministic |
| Dry run, non-destructive | **contract-tested** |
| **Persistence across a real page reload** | **browser-tested** (BV-001) — identity, content, revisions and source-location context |
| **Database separation from v1** | **browser-tested** (BV-005) — `philosophy-journal` still at version 1, records intact |
| INV-013 — schema changes include migrations | **satisfied for v2 schema v1**; v1→v2 apply deferred |
| INV-014 — components do not write arbitrary records | **not yet exercised** — no UI exists until Phase 0D |
| NFR-005 — deterministic migrations with recovery | **partial** — declared and documented; apply not implemented |
| NFR-008 — recovery for destructive actions | **partial** — see §6 |
| NFR-003 — large PDFs not fully loaded | **design-satisfied** — binaries split from metadata; unmeasured |
| AC-001 — PDF import offline | **E2E-deferred** — persistence-ready, not accepted; no UI to accept it through |

---

## 14. Known limitations

1. **One browser engine.** The suite runs in Chromium only. WebKit and Firefox
   have their own IndexedDB implementations and their own quirks; neither has
   been exercised. Adding the projects is cheap and should happen before any
   claim of cross-browser support, not before Phase 0D.
2. **No storage-pressure or eviction testing.** `QuotaExceededError` is typed
   and thrown, but no test fills a real quota, and there is no eviction policy
   or pre-flight estimate.
3. **`applyMigration` not implemented.** Intentional (ADR-0002 §7), and now
   checked: `read-only-boundary.test.ts` fails if the symbol appears anywhere
   in the tree.
4. **`appState` not mapped.** Needs a settings store.
5. **v1 annotations: nothing recoverable from the inspected path.** The save
   path targets a store that is never created, so it fails. That is not proof
   that every real v1 database is empty — see §2.1. Populated data is reported,
   never discarded.
6. **Soft deletion partial.** §6. NFR-008 is not satisfied.
7. **Dry run loads all v1 into memory,** including PDF binaries. Fine for a
   personal library; not streamed.
8. **Concept and glossary lookups scan the table** for case-insensitive
   matching. Correct, not indexed.
9. **The browser harness is a test surface, not the application.** It proves
   the persistence layer works in a browser. It says nothing about UI, because
   there is none until Phase 0D.

---

## 15. Status and next step

**Phase 0C is complete and verified in both contract and real-browser
environments.** All five audit findings are closed; the gate in §12 passed in
full, including `npm run test:e2e`.

Next: **Phase 0D** — shell, routing, providers, design tokens, UI primitives.
`react-router-dom` must be reinstalled only at a version outside the advisory
range `7.12.0 – 8.2.0`, checked at implementation time rather than trusted from
this note.

Design work becomes relevant at 0D.
