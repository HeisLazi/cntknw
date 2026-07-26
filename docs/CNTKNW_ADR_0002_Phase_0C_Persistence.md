# ADR-0002 — Phase 0C Persistence

**Status:** Accepted
**Date:** 25 July 2026
**Owner:** Lazarus Petrus
**Depends on:** ADR-0001
**Amends:** Handoff §7.1 (storage), §10 (repositories), §19 (Phase 0C scope)

---

## 1. A separate v2 database

**Decision.** v2 uses a new IndexedDB database, `cntknw`, at schema version 1. The v1 database, `philosophy-journal` version 1, is never opened for writing, never upgraded, and never deleted.

**Why.** The alternative — adding v2 stores to the v1 database via a Dexie `.version(2)` upgrade — is the more common pattern, and it is wrong here for three reasons.

Opening `philosophy-journal` at version 2 **irreversibly upgrades it**. Once that happens the v1 app, which opens at version 1, throws `VersionError` and can never run again. Handoff §6.1 requires legacy to stay a working reference until migration is verified, and `src/legacy-v1/` exists precisely so its behaviour can be compared against v2.

It also makes rollback impossible. A separate database can be discarded wholesale if migration proves wrong; an upgraded one cannot be un-upgraded.

And it removes a whole class of accident: with two databases, no v2 code path can reach a v1 store at all. Within one database, only convention prevents it.

**Cost.** Migration copies rather than renames, so both datasets exist on disk until the owner deletes v1. Given that PDFs can be large, this is a real cost, and it is the right one — the alternative trades disk for the ability to recover.

---

## 2. Schema versions are documented, not implicit

**Decision.** `src/data/db/schemaVersions.ts` is the single source of truth: database name, schema version, every store, primary key, index, and the migration attached to each version. `database.ts` derives the Dexie declaration from it.

**Why.** Handoff §19.1 and NFR-005 require deterministic migrations with recovery instructions. A schema that exists only inside a `.version(2).stores({...})` call is undocumented by construction — nothing states what changed or how to recover. Deriving Dexie from a declared table means the documentation cannot drift from the code, because it *is* the code.

**Cost.** One indirection between Dexie and the schema.

---

## 3. Storage records are mapped explicitly, never cast

**Decision.** Each adapter boundary converts between domain and storage records through named functions, and validates on the way out of storage as well as in.

**Why.** IndexedDB returns whatever was written, including records written by an older version, a partial migration, or a bug. Trusting them because they came from our own database is how corrupt data spreads silently. Validating on read turns that into a typed error at the boundary.

Storage records also differ from domain records in two specific ways: optional domain fields become `null` rather than `undefined` so they remain indexable, and derived index columns are materialised. Casting would hide both.

**Cost.** Two representations and a mapper per entity.

---

## 4. Optimistic concurrency by expected revision

**Decision.** Mutating repository methods accept an optional `expectedRevision`. When supplied and it does not match the stored revision, the write throws `RevisionConflictError` and nothing changes. When omitted, the write proceeds — last-write-wins is retained for callers that genuinely do not care.

**Why.** Handoff §13.3 requires that a newer revision is never silently overwritten. Making the check opt-in rather than mandatory is deliberate: Phase 0B's use cases read-then-write within one transaction and have no stale-read window, and forcing a revision through every call site would be ceremony without safety. The autosave path in Phase 2, where a debounced write can race a user edit, is where it matters — and that path can pass it.

**Cost.** A guarantee that must be opted into can be forgotten. Mitigated by making the parameter explicit in the interface rather than hidden in options, so its absence is visible at the call site.

---

## 5. UnitOfWork is real on both adapters

**Decision.** Dexie: one `readwrite` transaction spanning every participating table, with repositories bound to it. Memory: snapshot every store on entry, restore on failure.

**Why.** A pass-through unit of work is worse than none — it advertises atomicity it does not provide. `importPdf` writes to six stores; a failure after the binary lands must not leave an asset with no source.

The memory snapshot exists so the contract suite can assert rollback against *both* adapters. If rollback were only testable against Dexie, the memory adapter would drift and the suite would stop being a contract.

**Cost.** Memory snapshots copy every store per transaction. Fine at test sizes; the memory adapter is not a production target.

---

## 6. v1 readers are structurally read-only

**Decision.** Legacy readers open `philosophy-journal` with Dexie in a mode that declares no schema upgrade, expose only read methods, and are the sole code permitted to touch it.

**Why.** Handoff §6.2 and §26 prohibit mutating or deleting v1 before verified migration. Making the readers physically incapable of writing is stronger than a convention that a future agent might not read.

**Cost.** Duplicated open logic. Worth it.

---

## 7. Dry run before apply, always

**Decision.** `dryRunMigration` reads v1, produces a `MigrationDryRunReport`, and **writes nothing**. `applyMigration` is deliberately not implemented in this phase.

**Why.** The audit brief is explicit: apply only after dry-run tests exist. Deferring apply keeps Phase 0C free of any destructive path — there is no code that could run one, accidentally or otherwise. Importing the database module cannot trigger a migration because no apply function exists to trigger.

**Cost.** Migration is not finished at the end of Phase 0C. Correct: the gate is a *tested, non-destructive* dry run.

---

## 8. Recorded v1 findings that shape the mapping

Established by reading `src/legacy-v1/`, not assumed from the handoff.

**8.1 — v1 annotations were never persisted.** `db.js` creates `pdfAnnotations` (keyPath `id`, indexes `pdfId`, `page`). `PDFReader.jsx:252` writes to a store named `annotations`, which **no version of `db.js` ever creates**. In IndexedDB that throws `NotFoundError`, and the call sits inside a `try/catch` that only calls `console.error`.

Every annotation a v1 user drew was silently discarded at the moment of saving. `pdfAnnotations` is therefore expected to be **empty in every real v1 database**, and the migration must treat a populated one as the surprise rather than the norm. The dry run reports both stores separately and never conflates them.

This is worse than handoff §5.3 records — it describes a store mismatch, not total data loss.

**8.2 — two incompatible note shapes, as documented.** `NoteSystem.jsx:139` writes `{ id, bookId, category, title, text, chapter, page, tags[], createdAt, updatedAt }`. `PDFReader.jsx:295` writes `{ id, bookId, content, page, createdAt, updatedAt }` — no `text`, no `title`, no `category`, no `tags`. The mapper accepts either, preferring `text` and falling back to `content`, and records which was used.

**8.3 — v1 drawings are raster-only.** `Whiteboard.jsx:199` stores `canvasData` as a PNG data URL with `width`/`height`. No vector data exists to recover. Per handoff §6.3 these migrate to a locked legacy-raster asset referenced by an image block, never to a fabricated editable drawing.

**8.4 — reading position lives on the book.** v1 `books` carry `currentPage` and `currentChapter`. Per ADR-0001 §3 these map to `WorkspaceState`, not to `BookDetails`.

**8.5 — `publicationYear` is a free string.** From a form field, unparsed. Maps to `BookDetails.publicationDate` as-is; no date parsing is attempted, because guessing would fabricate precision.

**8.6 — v1 artworks embed analysis prose.** `{ analysis: { description, interpretation, evaluation, context }, annotations, tags[] }`. Per handoff §6.3 the analysis fields become journal blocks rather than artwork metadata columns.

---

## 9. Consequences

- Handoff §19's Phase 0C gains an explicit database-separation decision it did not specify.
- INV-013 becomes satisfiable: schema versions are declared and documented.
- NFR-008 remains only partially satisfied — soft deletion still covers journal blocks and epistemic claims alone.
- No destructive migration path exists in the codebase at the end of this phase.
- AC-001 remains E2E-deferred: import is persistence-ready, not accepted.

## 10. Deferred

- `applyMigration`, its idempotency and its apply report.
- Backup and restore (PDD §19.2), which builds on these mappers.
- Soft deletion for the remaining entities.
- Search index persistence.
