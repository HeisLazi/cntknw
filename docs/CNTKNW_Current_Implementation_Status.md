# CNTKNW Current Implementation Status

**Updated:** 06 August 2026 (Phase 3B Production PDF Annotation UX — closed; final acceptance corrections applied)
**Repository:** `HeisLazi/cntknw`
**Git baseline:** Phase 3B (including its final acceptance corrections) is committed and verified on `main`. Per
AI_PROJECT_STATE policy, no volatile live-HEAD SHA is recorded here; derive
HEAD from Git at session start.
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
primitives. 

The Infinite Journal feature (Phase 2) supports block editing, crash recovery,
concurrent re-ordering, robust block kind transformation, and explicit,
failure-safe conflict resolution. The PDF reader has bounded continuous
scrolling, viewport-truth navigation, exact resume coverage, honest outline
failure handling, reliable search semantics, and evidence-based import
duplicate-read reduction.

Phase 3A established asset-bound, rotation-aware canonical PDF annotation
geometry, transactional schema-v2 migration, and a DOM-free coordinate
projection library; its closure pass added exact-asset page retrieval
(`getBySourceAssetAndPage`) so annotations on a replaced asset can never leak
onto a replacement asset's render path. Phase 3B turns that architecture into
a real production experience: text-selection → highlight and a region tool
persist canonical records against the exact `sourceId + assetId + page`
through an application-level creation boundary; the reader renders a
repository-backed overlay per mounted page that stays aligned across
zoom/resize/reload/virtualization; annotations are keyboard-reachable,
colour-editable from restrained presets, and deletable only through
confirmation. Migrated vector `ink` and `point` records render read-only.
**Editable freehand pen/drawing authoring and Drawing journal blocks are not
built; that Phase 3C work remains, so Phase 3 is not fully complete.**

**Phases 0A–0E are complete and verified.** 

---

## 2. Phase state

| Phase | Scope | State |
|---|---|---|
| 0A | Clean build, TypeScript strict, lint and test scripts | **Complete** |
| 0B | Domain and application contracts | **Complete and verified** |
| 0C | Persistence — Dexie, schema versions, migrations, v1 readers | **Complete and verified**, contract and real browser |
| 0D | Shell, routing, providers, design tokens, UI primitives | **Complete and verified** |
| 0E | Editor spike, then journal vertical slice | **Complete and verified** (ADR-0004, ADR-0005) |
| 1 | Reliable PDF core — import, render, exact resume | **Milestone 3B complete and verified** (Findings 11–15 resolved; annotation UI remains out of scope) |
| 2 | Infinite Journal | **Complete and verified** (Folio margin ADR-0006 landed) |
| 3 | Annotations | **Phase 3A geometry architecture + Phase 3B production annotation UX complete, committed and verified** (exact-asset creation + overlay, highlight/region, keyboard, confirmation-based delete); Phase 3C pen/drawing authoring and Drawing journal blocks remain |

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
| `annotations/` | `Annotation` addressed by source + exact asset + 1-based page; strict `text`/`area`/`point`/`ink` anchor union in normalized unrotated page space; vector ink and linked journal block IDs |
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

Database: `cntknw`, schema version 2, 16 stores. Version 2 transactionally
folds opaque v1 annotation geometry/text anchors into canonical ADR-0007
anchors, explicitly marking converted versus fallback geometry. It reuses the
existing annotations store and remains deliberately separate from legacy v1
(ADR-0002 §1).

### Application — `src/application/`

Contains use-cases that orchestrate repositories. Examples include: `importPdf`, `createPageLinkedBlock`, `resumeSource`, `promoteBlockToClaim`, `linkBlockToExistingClaim`, `changeBlockKind`, `removeBlock`, `resolveConflictKeepSaved`, `resolveConflictUseMyVersion`, and `createSourceAnnotation` (the Phase 3B annotation creation boundary: source exists → asset exists → asset linked to that source → page positive → kind/anchor schema-valid).

### Library — `src/lib/`

`id.ts` (single generation point), `rank.ts` (base-62 fractional indexing).
`geometry/` is the pure, deterministic conversion boundary between page-local
CSS coordinates and canonical normalized annotation coordinates. It accepts a
structural PDF viewport and plain page box and imports neither the DOM nor
`pdfjs-dist`.

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
10 decisions), ADR-0003 (mandatory concurrency guards; supersedes ADR-0002
§4), ADR-0004 (explicit journal conflict resolution), ADR-0005 (ProseMirror
for block-level rich text editing), ADR-0006 (Folio margin reading layout),
ADR-0007 (canonical annotation geometry and asset identity).

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

## 4. Current known limitations

- **Non-Chromium browsers.** The browser suite runs in Chromium only. WebKit
  and Firefox have their own IndexedDB implementations and are unexercised.
- **`applyMigration`.** Dry run only — deliberately no destructive path exists.
- **Soft deletion beyond blocks and claims.** Every other entity hard-deletes; NFR-008 partial.
- **`appState` migration.** Needs a settings store.
- **Annotation UX.** Text highlight and region annotations can be created,
  rendered, coloured and confirmation-deleted, keyboard-accessible, in the PDF
  reader. **Editable freehand pen/drawing authoring and Drawing journal
  blocks are not built** (Phase 3C); migrated `ink`/`point` records render
  read-only.
- **Dictionary, cross-source search, maps.**
- **Atlas entities.** Primitives only.
- **Read Aloud playback, TTS, OCR.**
- **3D, chess, AI, sync.**
- **PDF peak-memory measurement**: Browser peak-memory APIs are not portable enough for a deterministic project gate here. The repeatable 8 MiB probe measures duplicate file reads instead; it supports reusing inspected bytes and does not claim a portable peak-memory number.

---

## 5. Verification, Phase 3B gate run 06 August 2026

Node/npm and platform are supplied by the current Linux development
environment. The implementer ran the suite during implementation; Hermes ran
the full uninterrupted gate once on the pre-review candidate tree and again
on the corrected final tree after the adversarial review corrections.

```text
npm run typecheck     PASS   0 errors      (src/ and e2e/)
npm run lint          PASS   0 errors, 0 warnings
npm run test          PASS   36 files, 605 passed, 1 skipped
npm run test:e2e      PASS   Chromium, 94 passed, 0 skipped
npm run build         PASS   
npm audit --omit=dev  PASS   0 vulnerabilities
Production dist leak  PASS   0 matches (geometry-probe / __cntknwProbe / harness-client / e2e/harness)
```

Final acceptance corrections (ChatGPT milestone review) added, in the
annotation-feature layer: `legacyGeometry.ts` partitions records so
`legacyMigration.geometryStatus === 'fallback'` records are never spatially
projected, rendered, focused, or deleted — each page with such records shows
one count-honest accessible degraded notice (`role="status"`); native and
`'converted'` records render exactly as before. `pendingAnnotationIntent.ts`
moves the pending-annotation-creation truth above the virtualized page: a
store keyed by `sourceId:assetId:page` holding only canonical fields
(status `draft|saving|failed`, canonical anchor, user-facing error), so an
async page unmount can never destroy unsaved user intent — success clears the
entry even after unmount, failure persists a Retry/Dismiss popover, Retry
cannot duplicate (one durable record after retry), and intents never leak
across source/asset identity. PdfReader clears only `draft` intents on source
change/unmount; `saving`/`failed` intents survive navigation.

Contract suite is defined and run against both adapters — memory and indexeddb, identical cases. The annotation contract includes a two-asset same-source same-page adversarial case proving exact-asset retrieval isolates annotations per asset and page on both adapters.

Phase 3B adds: unit coverage of the `createSourceAnnotation` membership/validation boundary (unlinked asset, wrong-source asset, missing source/asset, invalid page, kind/anchor mismatch, no partial writes — all rejected), the text-selection/region capture helpers (single-line, multiline, reverse drag, degenerate drag), the workspace `annotationTool` schema default, a `PdfAnnotationLayer` component suite (exact-page projection, **replacement-asset isolation**, keyboard actions + confirmation-before-delete, failed-intent retention with visible typed-or-generic error, style-update conflict reload, read retry, read-only point/ink projection, Escape cancels region drag with focus return, no setState after unmount), the fallback-geometry proofs (point/ink/area/text sentinels never rendered or focusable, record stays in the repository, degraded notice accessible, native+converted still positioned) and the virtualization proofs (failure after unmount → remount → Retry → exactly one durable record; success after unmount → exactly one durable record, no stale retry; cross-source/asset isolation; collapsed selection changes never clear an in-flight `saving` intent).

Browser suite: one Chromium project, 94 tests. The Phase 3B production specs drive the real app: (1) a highlight journey that stays sub-pixel aligned through zoom, reload and page-unmount/remount, is deleted only via the confirmation dialog, and makes zero network requests; (2) a keyboard-reachable region tool that cancels with Escape, persists a drag across reload, and restores its tool state; (3) a cross-page text selection that is refused with an announced notice and creates no annotation; (4) a legacy-fallback spec that seeds a schema-valid `geometryStatus='fallback'` record through the e2e harness (never the production path), proves the degraded notice and the absence of any spatial mark, and proves the record survives a full reload.

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
| ~~7~~ | ~~`BlockContent.doc` versus `.text` duplication~~ | **Resolved** — unified under Phase 0E spikes |
| 4 | Whether `conflict` is its own record or an Event subtype | Atlas modelling |
| 5 | Whether `institution` is distinct from `organisation` | Atlas modelling |
| 6 | Whether `period` is an entity or a named `TemporalExtent` | Atlas modelling |

---

## 7. Next step

**Phase 3B Production PDF Annotation UX is complete, committed, verified, and
reviewer-accepted** (the ChatGPT milestone review's two final acceptance
blockers — legacy fallback geometry policy and pending-create-intent lifetime —
are closed; see §5). Text-selection highlight and region annotations are
created through an application boundary, persisted against the exact asset,
rendered in a repository-backed per-page overlay, and are keyboard-accessible,
colour-edited from restrained presets and confirmation-deleted. The next
authorized implementation milestone is **Phase 3C — editable freehand
pen/drawing authoring and Drawing journal blocks** (AC-008 editable vector
drawing, AC-3 source-location inheritance for Drawing blocks), which Phase 3B
intentionally deferred. Phase 3C has NOT been authorized or started; do not
begin it or Phase 4 without reviewer acceptance of Phase 3B's final
acceptance corrections.

See `CNTKNW_Phase_0D_Checkpoint_Report.md`,
`CNTKNW_Phase_0C_Checkpoint_Report.md` and
`CNTKNW_ADR_0003_Mandatory_Concurrency_Guards.md`.
