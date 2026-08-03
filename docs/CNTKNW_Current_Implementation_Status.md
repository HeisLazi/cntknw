# CNTKNW Current Implementation Status

**Updated:** 03 August 2026 (Phase 2 Closure)
**Repository:** `HeisLazi/cntknw`
**Git baseline:** `6c27bce`
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

On top of that, the application shell now exists: a router with stable URLs,
exactly three primary destinations, the shared Study Workspace, a design-token
system that is the styling source of truth, and nineteen accessible UI
primitives. The journal feature supports block editing, crash recovery, concurrent re-ordering, 
robust block kind transformation, and explicit conflict resolution.

**Phases 0C and 0D are complete and verified.** The PDD §24 Phase 0 exit
condition — *app shell builds; no direct component DB writes; legacy data can
be read* — is met.

---

## 2. Phase state

| Phase | Scope | State |
|---|---|---|
| 0A | Clean build, TypeScript strict, lint and test scripts | **Complete** |
| 0B | Domain and application contracts | **Complete and verified** |
| 0C | Persistence — Dexie, schema versions, migrations, v1 readers | **Complete and verified**, contract and real browser |
| 0D | Shell, routing, providers, design tokens, UI primitives | **Complete and verified** |
| 0E | Editor spike, then journal vertical slice | **Complete and verified** (ADR-0004, ADR-0005) |
| 1 | Reliable PDF core — import, render, exact resume | **Complete and verified** (Text layer added) |
| 2 | Infinite Journal | **Complete and verified (Closure pass)** (Folio margin ADR-0006 landed) |

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

### Composition and routing — `src/app/`

`composition/production.ts` is the **only** module naming a concrete storage
adapter; everything above it depends on the `Repositories` interface, which is
what makes INV-014 structural rather than a convention. `providers/` holds the
error boundary and the repository provider (injection channel, not a second
database). `routes/` holds the route table and seven routes:

```
/ → /library    /library    /gallery    /notes
/study/:sourceId (books AND artworks)    /settings    /components (dev only)    *
```

Exactly three primary destinations (INV-001, IA-001), enforced by test.

### Design — `src/design/`

`tokens.css` is the styling source of truth: raw palette plus semantic roles,
typography, spacing, radius, borders, shadows, motion, z-index layers, panel
and reading widths, focus ring. Dark-mode first; light mode redefines only the
semantic layer. Reduced motion collapses every duration at the token level.
`design-tokens.test.ts` fails the build on a colour literal, a hard-coded
duration or an unnamed z-index anywhere else.

### Components — `src/components/`

`primitives/` — 19 primitives on native semantics (`<button>`, `<dialog>`,
`<select>`, `<label>`), no meaning carried by colour alone.
`shell/` — `AppShell` with skip link, named landmarks and focus management,
plus the route-level loading, error, missing-source and not-found states.

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
- **Annotation UI, editor, dictionary, cross-source search, maps.**
- **Atlas entities.** Primitives only.
- **Read Aloud playback, TTS, OCR.**
- **3D, chess, AI, sync.**

---

## 5. Verification, last run 03 August 2026

Node v22.16.0, npm 10.9.2, Windows 11 (10.0.26200) x64, clean `npm ci`.

```text
npm ci                PASS
npm run typecheck     PASS   0 errors      (src/ and e2e/)
npm run lint          PASS   0 errors, 0 warnings
npm run test          PASS   425 tests, 16 test files, 0 skipped
npm run test:e2e      PASS   77 tests, chromium, 0 skipped
npm run build         PASS   312.41 kB, 98.19 kB gzipped (main chunk)
npm audit --omit=dev  PASS   0 vulnerabilities
npm audit             exit 1, 5 high, all dev-only (ESLint transitive)
```

Contract suite: 62 tests defined, run against both adapters — memory 62,
indexeddb 62, identical cases.

Browser suite: `@playwright/test` 1.62.0, Chromium 151.0.7922.34, one project,
77 tests. Persistence — BV-001 reload, BV-002 transaction rollback, BV-003
revision conflict, BV-004 nested transaction, BV-005 database separation;
validated by a negative control, since neutering `DexieUnitOfWork.run` fails
BV-002 and BV-004. Shell — routing and refresh on five routes, exactly three
primary links, keyboard focus, reduced motion, responsive navigation at 1280px
and 375px, resizable text.

Bundle: 1375.83 kB (pdf.worker) and 312.41 kB (index). Phase 0C's entry point was a
placeholder importing nothing; this is the first build that includes the domain
schemas, the persistence layer and the router. `dist/` is searched to confirm
no development-only surface ships.

Phase 0C was originally verified on Linux with Node v22.22.3 and now on Windows
with v22.16.0, which closes the Windows-reproduction gap the previous revision
listed.

**Not run:** WebKit and Firefox browser projects; axe or any automated
accessibility rule engine; WCAG contrast measurement; visual regression.

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

**Phase 0E — the editor spike**, then the journal vertical slice.

Open decision 7 (`BlockContent.doc` versus `.text`) must be resolved there. It
is the reason the spike exists, and choosing an editor before resolving it
would decide it by accident.

See `CNTKNW_Phase_0D_Checkpoint_Report.md`,
`CNTKNW_Phase_0C_Checkpoint_Report.md` and
`CNTKNW_ADR_0003_Mandatory_Concurrency_Guards.md`.
