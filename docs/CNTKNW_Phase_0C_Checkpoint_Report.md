# CNTKNW Phase 0C — Checkpoint Report

**Date:** 25 July 2026
**Phase:** 0C — Persistence
**ADR:** ADR-0002 (Accepted), under the sequence in ADR-0001 §1
**Verification:** **PASSED.** Full gate executed; results in §12.

---

## 1. Requirements and scope

**Gate:**

> The same repository contract suite passes against the memory and IndexedDB adapters, including transaction rollback, optimistic revision conflicts, soft deletion, migration behaviour and failed writes.

**Met.** 53 identical cases run against each adapter; 106 assertions, 0 failures.

**Implemented:** Dexie adapter, documented schema versions, storage-record mapping with validation on read, typed storage errors, real `UnitOfWork` on both adapters, opt-in optimistic concurrency, read-only v1 readers, deterministic v1→v2 mappings, non-destructive migration dry run.

**Not implemented, deliberately:** `applyMigration`. No destructive path exists in the codebase (ADR-0002 §7).

**Not touched:** UI, routing, design tokens, PDF rendering, annotation UI, Atlas entities, Read Aloud playback, OCR, AI, 3D, chess.

---

## 2. Repository observations

`src/legacy-v1/db.js` was read directly rather than trusted second-hand. Three findings changed the mapping design; the first is worse than the handoff records.

**2.1 — v1 annotations were never persisted at all.** `db.js` creates `pdfAnnotations` (keyPath `id`, indexes `pdfId`, `page`). `PDFReader.jsx:252` writes to a store called `annotations`, which **no version of `db.js` ever creates**. In IndexedDB that throws `NotFoundError`, and the call sits inside a `try/catch` whose only handler is `console.error`.

Every annotation a v1 user drew was discarded at the moment of saving. `pdfAnnotations` should be **empty in every real v1 database**, so the dry run treats a populated one as the anomaly and reports it rather than mapping it. Handoff §5.3 describes a store mismatch; the reality is total data loss.

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

## 5. Optimistic concurrency

`expectedRevision` is an optional final parameter on every mutating method. Supplied and stale → `RevisionConflictError`, and nothing is written. Omitted → last-write-wins.

Opt-in rather than mandatory, deliberately: Phase 0B's use cases read and write inside one transaction and have no stale-read window, so requiring a revision everywhere would be ceremony without safety. The path that needs it is Phase 2's debounced autosave, where a read and its write are separated by user time. Making it an explicit parameter rather than an options-bag field means its absence is visible at the call site. ADR-0002 §4.

Ten cases per adapter: initial revision, single increment, matching revision accepted, stale rejected, **stored data unchanged after a conflict**, both revisions reported on the error, last-write-wins when omitted, conflicts on blocks and on workspace state, and typed `RecordNotFoundError` rather than a bare `Error`.

---

## 6. Soft deletion — coverage stated exactly

Covered: `JournalBlock`, `EpistemicClaim`.

**Not covered:** `Source`, `Annotation`, `Connection`, `Concept`, `GlossaryEntry`, `StudySession`, `WorkspaceState` — all still hard-delete.

**NFR-008 is therefore partially satisfied, not satisfied.** Journal-block trash does not discharge a requirement covering every destructive action.

---

## 7. Legacy readers and mappings

`src/legacy/v1/readers.ts` is the only code permitted to touch v1, and exposes no write method. It opens v1 in Dexie's dynamic mode — no `.version()` call — which attaches to the existing schema so no upgrade transaction can fire.

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

**New (11):** `data/errors.ts`, `data/db/schemaVersions.ts`, `data/db/database.ts`, `data/db/storageRecords.ts`, `data/adapters/indexeddb/index.ts`, `data/repositories/concurrency.ts`, `legacy/v1/types.ts`, `legacy/v1/readers.ts`, `legacy/v1/mappings.ts`, `legacy/v1/dryRun.ts`, `legacy/v1/migration.test.ts`, plus `docs/CNTKNW_ADR_0002_Phase_0C_Persistence.md`.

**Modified (10):** seven repository interfaces (optimistic concurrency), `repositories/index.ts`, `adapters/memory/index.ts` (real snapshot rollback, revision checks, typed errors), `adapters/repository-contract.test.ts` (parameterised over both adapters, +25 cases), `package.json`.

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

---

## 12. Verification

Node v22.22.3, npm 10.9.8, Linux x86_64, clean scratch install.

```text
npm ci              PASS   exit 0
npm run typecheck   PASS   exit 0, 0 errors
npm run lint        PASS   exit 0, 0 errors, 0 warnings
npm run test        PASS   exit 0, 331/331, 9 files, 0 skipped
npm run build       PASS   exit 0, 190.89 kB (60.22 kB gzipped)
npm audit --omit=dev       0 vulnerabilities
npm audit                  5 high, all dev-only
```

### Test counts

| File | Cases |
|---|---|
| `data/adapters/repository-contract.test.ts` | 106 |
| `legacy/v1/migration.test.ts` | 46 |
| `domain/atlas-readiness.test.ts` | 43 |
| `application/application.test.ts` | 33 |
| `domain/domain.test.ts` | 28 |
| `domain/time/time.test.ts` | 26 |
| `domain/read-aloud-readiness.test.ts` | 25 |
| `lib/rank.test.ts` | 22 |
| `lib/id.test.ts` | 2 |
| **Total** | **331** |

+115 since Phase 0B (216 → 331).

**Contract suite split:** memory 53/53, indexeddb 53/53 — identical cases, both green. Groups: Source 6, Journal 8, Asset 4, Annotation 2, Connection 5, Concept 1, Glossary 1, EpistemicClaim 4, Session 2, WorkspaceState 2, UnitOfWork 8, optimistic concurrency 10.

### Defect found by running

**One.** A mapping test used `journalId: 'journal-1'`, and `JournalBlockSchema` rejected it because it is not a UUID. **The fixture was wrong, not the mapper** — and the failure proves mapper output is genuinely validated rather than assumed. Fixture corrected to a real UUID.

---

## 13. Requirement mapping

Labels per the Phase 0B checkpoint §6.

| Requirement | Status |
|---|---|
| Phase 0C gate — one suite, both adapters | **persistence-tested** |
| Transaction rollback | **persistence-tested**, both adapters, 4 failure points |
| Optimistic revision conflicts | **persistence-tested**, both adapters, 10 cases |
| Soft deletion and restore | **persistence-tested** — blocks and claims only |
| Typed storage errors | **persistence-tested** |
| Validation of stored records on read | **persistence-tested** |
| v1 read-only access | **contract-tested** — structurally write-incapable |
| v1→v2 mappings | **contract-tested**, pure and deterministic |
| Dry run, non-destructive | **contract-tested** |
| INV-013 — schema changes include migrations | **satisfied for v2 schema v1**; v1→v2 apply deferred |
| NFR-005 — deterministic migrations with recovery | **partial** — declared and documented; apply not implemented |
| NFR-008 — recovery for destructive actions | **partial** — see §6 |
| NFR-003 — large PDFs not fully loaded | **design-satisfied** — binaries split from metadata; unmeasured |
| AC-001 — PDF import offline | **E2E-deferred** — persistence-ready, not accepted |
| **Browser persistence across reload** | **NOT browser-tested** — see §14 |

---

## 14. Known limitations

1. **No real-browser verification.** All IndexedDB tests ran under `fake-indexeddb`, which implements the API faithfully but is not a browser. Persistence across an actual page reload is **unproven**. The Phase 0C brief asked for at least one Playwright flow; Playwright is still not installed. **This is the one brief requirement not met.**
2. **Playwright absent.** `test:e2e` exists; the dependency and config do not. Outstanding since Phase 0A.
3. **`applyMigration` not implemented.** Intentional.
4. **`appState` not mapped.** Needs a settings store.
5. **v1 annotations unmappable.** Nothing to migrate — the data never existed (§2.1).
6. **Soft deletion partial.** §6.
7. **No storage-quota handling beyond classification.** `QuotaExceededError` is typed and thrown; no eviction or pre-flight estimate.
8. **Dry run loads all v1 into memory,** including PDF binaries. Fine for a personal library; not streamed.
9. **Concept and glossary lookups scan the table** for case-insensitive matching. Correct, not indexed.

---

## 15. Next safe step

**Install Playwright and prove browser persistence** — write, reload, read back, plus one real transaction rollback. That closes the Phase 0A gap and the one Phase 0C requirement left open, and it should happen before Phase 0D builds UI on storage never exercised in a browser.

Then **Phase 0D** — shell, routing, providers, design tokens, UI primitives. Reinstall `react-router-dom` at a version outside the advisory range.

Design work becomes relevant at 0D.
