# CNTKNW Current Implementation Status

**Updated:** 26 July 2026 (Phase 0C closed; Phase 0D next)
**Repository:** `philosophy-journal-complete`
**Git baseline:** `4494f24`, tag `phase-0c-impl` — the tree as Phase 0C left it
**Status:** Living document. Update at every phase boundary.

Read `CNTKNW_Documentation_Index.md` first for the read order and the phase sequence in force.

---

## 1. One-line state

Domain contracts and persistence are built and verified. Data is stored in
IndexedDB via Dexie, with real transactions, rollback and **mandatory**
optimistic concurrency — and it is now proven in a real browser: eight
Playwright tests in Chromium cover persistence across reload, transaction
rollback, nested transactions, revision conflicts and separation from the v1
database.

**Phase 0C complete and verified in both contract and real-browser
environments.**

---

## 2. Phase state

| Phase | Scope | State |
|---|---|---|
| 0A | Clean build, TypeScript strict, lint and test scripts | **Complete** — the Playwright gap is closed |
| 0B | Domain and application contracts | **Complete and verified** |
| 0C | Persistence — Dexie, schema versions, migrations, v1 readers | **Complete and verified**, contract and real browser |
| 0D | Shell, routing, providers, design tokens, UI primitives | **Not started** |
| 0E | Editor spike, then journal vertical slice | **Not started** |

Phase order per ADR-0001 §1, which supersedes Handoff §19.

---

## 3. What exists

### Domain — `src/domain/`

Zod schemas are authoritative; TypeScript types are inferred. Types describing data flowing *in* use `z.input`; data coming *out* uses `z.infer` (ADR-0001 §2).

| Module | Contents |
|---|---|
| `shared.ts` | `EntityId` (UUID v1–8), timestamps, revisions, normalised page geometry, `TextAnchor`, `SourceLocation`, soft-delete fields, provenance |
| `sources/` | `Source`, `BookDetails`, `ArtworkDetails`. **No reading position** — that lives on `WorkspaceState` |
| `assets/` | `Asset` (immutable, no revision), `SourceAsset` (pure join record) |
| `journals/` | `Journal`, `JournalBlock` with `deletedAt` and `epistemicClaimId`, 14-variant `BlockContent` discriminated union |
| `annotations/` | `Annotation` addressed by source + asset + page |
| `connections/` | `Connection`, extended `Reference` union, `referenceKey`, relationship vocabulary |
| `concepts/` | `Concept`, `GlossaryEntry` incl. `preferredPronunciation` |
| `sessions/` | `StudySession` with `activityMode`, `listenedSeconds`, `listenedLocations` |
| `workspace/` | `WorkspaceState` with three positions, `listen` layout mode, away flag, playback capability |
| `time/` | `TemporalPoint`, `TemporalExtent`, precision and uncertainty as independent axes, eras, calendars |
| `spatial/` | `GeoCoordinate`, `GeoGeometryRef` with `validFor`, `SpatialRef` |
| `knowledge/` | 14 `KnowledgeEntityKind` values, `KnowledgeEntityRef`, `StudyStatus`. **Declarations only — no entity is modelled** |
| `epistemics/` | `EpistemicClaim`, confidence, knowledge status, relationship vocabulary |

### Data — `src/data/`

Eleven repository interfaces, `UnitOfWork` and **mandatory** optimistic
concurrency. Every mutating method on a revisioned record takes a
`ConcurrencyGuard`; omitting it is a compile error and is also rejected at
runtime, so it can never mean last-write-wins (ADR-0003, superseding
ADR-0002 §4).

**Two adapters, contract-identical:** `adapters/memory/` (snapshot rollback) and `adapters/indexeddb/` (Dexie, real transactions). `db/schemaVersions.ts` is the schema source of truth; `db/storageRecords.ts` maps and validates the domain/storage boundary; `errors.ts` carries typed storage errors.

Database: `cntknw`, schema version 1, 16 stores. Deliberately separate from v1 (ADR-0002 §1).

### Application — `src/application/`

`importPdf`, `createPageLinkedBlock`, `resumeSource`, `promoteBlockToClaim`, `linkBlockToExistingClaim`.

### Library — `src/lib/`

`id.ts` (single generation point), `rank.ts` (base-62 fractional indexing).

### Documented decisions

ADR-0001 (Phase 0B foundations, 13 decisions), ADR-0002 (Phase 0C persistence,
10 decisions), ADR-0003 (mandatory concurrency guards; supersedes ADR-0002 §4).

### Legacy — `src/legacy/v1/`

Read-only v1 readers, pure deterministic v1→v2 mappings, and a non-destructive
migration dry run. There is no `applyMigration`; its absence is what guarantees
no destructive path exists, and `read-only-boundary.test.ts` fails if the symbol
ever appears in the tree.

v1 access is **read-only by module boundary and public API**: no schema upgrade
is declared, and no raw database or table handle escapes the reader module.
That is checked in five tests, not asserted in prose — the earlier phrase
"structurally write-incapable" was an overclaim and has been withdrawn.

### Frozen

`src/legacy-v1/` — the v1 prototype, excluded from `tsconfig.json`, never modified. Read-only input for migration.

---

## 4. What does not exist

- **Non-Chromium browsers.** The browser suite runs in Chromium only. WebKit
  and Firefox have their own IndexedDB implementations and are unexercised.
- **`applyMigration`.** Dry run only — deliberately no destructive path exists.
- **Soft deletion beyond blocks and claims.** Every other entity hard-deletes; NFR-008 partial.
- **`appState` migration.** Needs a settings store.
- **Any UI.** No routes, no shell, no design tokens, no CSS. `src/main.tsx` is a placeholder.
- **PDF rendering, annotation UI, editor, dictionary, search, maps.**
- **Atlas entities.** Primitives only.
- **Read Aloud playback, TTS, OCR.**
- **3D, chess, AI, sync.**

---

## 5. Verification, last run 26 July 2026

Node v22.16.0, npm 10.9.2, Windows 11 (10.0.26200) x64, clean `npm ci`.

```text
npm ci                PASS
npm run typecheck     PASS   0 errors      (src/ and e2e/)
npm run lint          PASS   0 errors, 0 warnings
npm run test          PASS   354 tests, 10 test files, 0 skipped
npm run test:e2e      PASS   8 tests, chromium, 0 skipped
npm run build         PASS   190.89 kB, 60.22 kB gzipped
npm audit --omit=dev  PASS   0 vulnerabilities
npm audit             exit 1, 5 high, all dev-only (ESLint transitive)
```

Contract suite: 62 tests defined, run against both adapters — memory 62,
indexeddb 62, identical cases.

Browser suite: `@playwright/test` 1.62.0, Chromium 151.0.7922.34, one project.
BV-001 persistence across reload, BV-002 transaction rollback, BV-003 revision
conflict, BV-004 nested transaction, BV-005 database separation. Validated by a
negative control — neutering `DexieUnitOfWork.run` fails BV-002 and BV-004.

Phase 0C was originally verified on Linux with Node v22.22.3 and now on Windows
with v22.16.0, which closes the Windows-reproduction gap the previous revision
listed.

**Not run:** WebKit and Firefox browser projects.

---

## 6. Open decisions

| # | Decision | Blocks |
|---|---|---|
| ~~1~~ | ~~Approve or downgrade the Read Aloud SDD~~ | **Resolved** — approved 25 Jul (A-015) |
| ~~2~~ | ~~Separate v2 database, or versioned stores beside v1?~~ | **Resolved** — separate `cntknw` database (ADR-0002 §1) |
| ~~3~~ | ~~Classify the high-severity npm advisories~~ | **Resolved** — prod 7→0; 5 dev-only deferred (0C §11) |
| ~~8~~ | ~~Should optimistic concurrency stay opt-in?~~ | **Resolved** — mandatory guard, ADR-0003 (A-016) |
| 4 | Whether `conflict` is its own record or an Event subtype | Atlas modelling |
| 5 | Whether `institution` is distinct from `organisation` | Atlas modelling |
| 6 | Whether `period` is an entity or a named `TemporalExtent` | Atlas modelling |
| 7 | `BlockContent.doc` versus `.text` duplication | Phase 0E editor spike |

---

## 7. Next step

**Phase 0D** — shell, routing, providers, design tokens, UI primitives. The
persistence layer underneath it has now been exercised in a real browser, which
is what Phase 0D was waiting on.

`react-router-dom` was removed in Phase 0C and must be reinstalled only at a
version outside the advisory range `7.12.0 – 8.2.0` — checked against the
registry at implementation time, not trusted from this note.

Design work becomes relevant at 0D.

See `CNTKNW_Phase_0C_Checkpoint_Report.md` and
`CNTKNW_ADR_0003_Mandatory_Concurrency_Guards.md`.
