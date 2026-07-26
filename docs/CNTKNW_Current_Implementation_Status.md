# CNTKNW Current Implementation Status

**Updated:** 25 July 2026 (Phase 0C complete)
**Repository:** `philosophy-journal-complete`
**Status:** Living document. Update at every phase boundary.

Read `CNTKNW_Documentation_Index.md` first for the read order and the phase sequence in force.

---

## 1. One-line state

Domain contracts and persistence are built and verified. Data is stored in IndexedDB via Dexie, with real transactions, rollback and optimistic concurrency. **Not yet proven in a real browser** — all storage tests run under `fake-indexeddb`.

---

## 2. Phase state

| Phase | Scope | State |
|---|---|---|
| 0A | Clean build, TypeScript strict, lint and test scripts | **Complete**, except Playwright |
| 0B | Domain and application contracts | **Complete and verified** |
| 0C | Persistence — Dexie, schema versions, migrations, v1 readers | **Complete and verified** (browser proof outstanding) |
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

Eleven repository interfaces, `UnitOfWork` and opt-in optimistic concurrency.

**Two adapters, contract-identical:** `adapters/memory/` (snapshot rollback) and `adapters/indexeddb/` (Dexie, real transactions). `db/schemaVersions.ts` is the schema source of truth; `db/storageRecords.ts` maps and validates the domain/storage boundary; `errors.ts` carries typed storage errors.

Database: `cntknw`, schema version 1, 16 stores. Deliberately separate from v1 (ADR-0002 §1).

### Application — `src/application/`

`importPdf`, `createPageLinkedBlock`, `resumeSource`, `promoteBlockToClaim`, `linkBlockToExistingClaim`.

### Library — `src/lib/`

`id.ts` (single generation point), `rank.ts` (base-62 fractional indexing).

### Documented decisions

ADR-0001 (Phase 0B foundations, 13 decisions), ADR-0002 (Phase 0C persistence, 10 decisions).

### Legacy — `src/legacy/v1/`

Read-only v1 readers, pure deterministic v1→v2 mappings, and a non-destructive migration dry run. There is no `applyMigration`; its absence is what guarantees no destructive path exists.

### Frozen

`src/legacy-v1/` — the v1 prototype, excluded from `tsconfig.json`, never modified. Read-only input for migration.

---

## 4. What does not exist

- **Browser verification.** All IndexedDB tests run under `fake-indexeddb`. Persistence across a real page reload is unproven.
- **Playwright.** Script exists; dependency and config do not. Outstanding since Phase 0A.
- **`applyMigration`.** Dry run only — deliberately no destructive path exists.
- **Soft deletion beyond blocks and claims.** Every other entity hard-deletes; NFR-008 partial.
- **`appState` migration.** Needs a settings store.
- **Any UI.** No routes, no shell, no design tokens, no CSS. `src/main.tsx` is a placeholder.
- **PDF rendering, annotation UI, editor, dictionary, search, maps.**
- **Atlas entities.** Primitives only.
- **Read Aloud playback, TTS, OCR.**
- **3D, chess, AI, sync.**

---

## 5. Verification, last run 25 July 2026

Node v22.22.3, npm 10.9.8, Linux x86_64, clean scratch install.

```text
npm ci              PASS
npm run typecheck   PASS   0 errors
npm run lint        PASS   0 errors, 0 warnings
npm run test        PASS   331 / 331, 9 files, 0 skipped
npm run build       PASS   190.89 kB, 60.22 kB gzipped
npm audit --omit=dev       0 vulnerabilities
npm audit                  5 high, all dev-only (ESLint transitive)
```

Contract suite: memory 53/53, indexeddb 53/53 — identical cases.

Not run: `npm run test:e2e` (Playwright absent), Windows reproduction, real-browser persistence.

---

## 6. Open decisions

| # | Decision | Blocks |
|---|---|---|
| ~~1~~ | ~~Approve or downgrade the Read Aloud SDD~~ | **Resolved** — approved 25 Jul (A-015) |
| ~~2~~ | ~~Separate v2 database, or versioned stores beside v1?~~ | **Resolved** — separate `cntknw` database (ADR-0002 §1) |
| ~~3~~ | ~~Classify the high-severity npm advisories~~ | **Resolved** — prod 7→0; 5 dev-only deferred (0C §11) |
| 4 | Whether `conflict` is its own record or an Event subtype | Atlas modelling |
| 5 | Whether `institution` is distinct from `organisation` | Atlas modelling |
| 6 | Whether `period` is an entity or a named `TemporalExtent` | Atlas modelling |
| 7 | `BlockContent.doc` versus `.text` duplication | Phase 0E editor spike |

---

## 7. Next step

**Install Playwright and prove browser persistence.** One flow: write, reload, read back, plus a real transaction rollback. This closes the Phase 0A gap and the single Phase 0C requirement left open, and should land before Phase 0D builds UI on storage never exercised in a browser.

Then **Phase 0D** — shell, routing, providers, design tokens, UI primitives. Reinstall `react-router-dom` outside the advisory range `7.12.0 – 8.2.0`.

Design work becomes relevant at 0D.

See `CNTKNW_Phase_0C_Checkpoint_Report.md`.
