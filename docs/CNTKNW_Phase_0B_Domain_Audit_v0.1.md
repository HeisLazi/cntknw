# CNTKNW Phase 0B — Existing Domain Audit and Change Proposal

**Version:** 0.1
**Date:** 25 July 2026
**Status:** Read-only audit. No code modified. Awaiting approval.
**Scope:** Every existing schema, repository interface, memory adapter method, use case, and test in `src/`.

> **Verification status: PENDING.** The isolated Linux environment failed again this session (`HYPERVISOR_VIRT_DISABLED`). I could not run `npm ci`, `typecheck`, `lint`, `test`, or `build`. Findings marked **[predicted]** are derived from reading the source against `tsconfig.json` (`strict: true`); they are not observed compiler output. I do not claim Phase 0B complete and I do not claim the current tree builds.

---

## Headline finding

**The tree very probably does not typecheck today.** I found five distinct type errors by reading, plus two prohibited `any` casts. The most consequential is systemic and affects nearly every `Create*Input` type in the domain — see A-1. It should be fixed before anything is added, because every new schema written in Phase 0B would inherit the same defect.

---

## 1. Existing-domain requirement matrix

Categories: **OK** correct as-is · **INC** incomplete · **INX** inconsistent/broken · **MIS** missing · **PRE** premature · **MOD** requires modification.

### 1.1 Shared primitives — `src/domain/shared.ts`

| Item | Status | Finding |
|---|---|---|
| `EntityIdSchema` | MOD | `z.string().uuid()`. Handoff §9.1 requires a **decided** UUIDv7-or-ULID policy; none recorded. `uuid()` would reject ULID, silently foreclosing that option. |
| `ISODateTimeSchema`, `RevisionSchema` | OK | Match §9.1. |
| `NormalizedPoint` / `NormalizedRect` | OK | Match §9.1. |
| `TextAnchorSchema` | MOD | Matches §9.1, but has no sentence-level identity. Read Aloud needs sentence granularity (RA-INV-004). Additive change only. |
| `SourceLocationSchema` | MOD | Matches §9.4 exactly. Needs optional `sentenceIndex` on `pdf` for Read Aloud, and must stay open for a future Atlas/knowledge-entity locator. |
| `LegacyMarkerSchema`, `BaseEntityFieldsSchema`, `ProvenanceSchema` | OK | Sound. `BaseEntityFields` reuse is good. |
| **Temporal model** | MIS | No `TemporalPoint`, `TimeRange`, precision, uncertainty, era, or calendar. Required by the Atlas-readiness brief. |
| **Spatial / geometry reference** | MIS | `NormalizedRect` is *page/image* space only. No geographic coordinate or geometry reference exists. |
| **Generic knowledge-entity reference** | MIS | No stable way to refer to a not-yet-modelled Atlas entity. |

### 1.2 Sources — `source.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `SourceSchema` | OK | Matches §9.2 field-for-field. |
| `ArtworkDetailsSchema` | OK | Matches §9.2. |
| `BookDetailsSchema.currentPage` | **INX** | **Not in Handoff §9.2.** This is a second, competing store of reading position alongside `WorkspaceState.activeLocation`. It appears to be a v1 leftover (`books.currentPage`) that leaked into v2. Two positions that can disagree is precisely the defect the Read Aloud three-position model must not be built on. |
| `BookDetailsSchema.currentChapter` | **INX** | Same. Also not in §9.2, and duplicated by chapter detection later. |
| `CreateBookDetailsInputSchema` | INX | Consequence of A-1 below: `currentPage` becomes **required** in the inferred type, and `importPdf` does not pass it. |

### 1.3 Assets — `asset.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `AssetSchema` | OK | Matches §9.3. Correctly has `createdAt` but no `updatedAt`/`revision`. |
| `AssetKindSchema` | OK | Matches §9.3. (`ocr-text` will be needed at RA-3, not now.) |
| `SourceAssetSchema` | OK | Matches §9.3: `sourceId` + `assetId` + `role`, no base fields. |
| Adapter conformance | **INX** | The memory adapter writes base fields onto both. See A-3, A-4. |

### 1.4 Journals and blocks — `journal.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `JournalSchema` | OK | Matches §9.6. |
| `BlockKindSchema` | OK | All 14 kinds match §7.3 / §9.6. |
| `BlockContentSchema` | OK | Proper Zod discriminated union, one shape per kind. Satisfies the §9.6 requirement explicitly. Good work. |
| `ProseMirrorJSONSchema` | INC | `z.record(z.unknown())` placeholder. Correctly deferred to the editor spike; noted, not a defect. |
| `ParagraphContent` having both `doc` and `text` | INC | Dual representation risks reintroducing the v1 `text`/`content` ambiguity (Handoff §5.4) once the editor lands. Acceptable now; must be resolved at the spike. |
| `JournalBlockSchema` | **INC** | **No `deletedAt`.** `JournalRepository.softDeleteBlock` therefore cannot be implemented. Violates PDD §19.3 (soft deletion and trash) and NFR-008. |
| `rank: z.string()` | INC | Shape is right; no ordering algorithm is defined. See 1.9. |
| `MoveBlockInputSchema` | OK | Correctly carries `newSourceLocation`, supporting the explicit page-move action in Handoff §13.2. |
| Claim / Evidence / Objection content | MOD | Exist as journal content with ad-hoc `supportingBlockIds` / `claimBlockId` / `targetBlockId`. Per your instruction these stay ordinary journal content, but they need a **promotion path** to a canonical `EpistemicClaim`. See §5.3. |

### 1.5 Annotations — `annotation.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `AnnotationKindSchema`, `AnnotationStyleSchema` | OK | Match §16.2 / §9.7. |
| `AnnotationSchema` | OK | Matches §9.7 including `assetId` + `page` + `textAnchor` + `linkedBlockIds`. Correctly avoids the v1 "annotations by bookId" defect. |
| `AnnotationGeometrySchema` | INC | `normalized` flag plus opaque `data` record. Pragmatic for legacy tolerance (amendment 11), but geometry is not yet discriminated by kind as §9.7 requires. Acceptable until Phase 3. |
| Adapter conformance | **INX** | Adapter queries `a.location.pdf?.page`; no such property. See A-2. |

### 1.6 Connections — `connection.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `ReferenceSchema` | **MOD** | Correct for v0.2's six endpoints. **Closed to extension** — Atlas entities and formal claims cannot be connection endpoints. This is the single most important Atlas-readiness change. |
| `ConnectionSchema` | OK | Matches §9.8. Backlinks correctly derived from records, not stored arrays (INV-007). |
| `RelationshipTypeSchema` vs `relationship: z.string()` | INX | The enum is defined but `ConnectionSchema.relationship` is a bare `z.string()`, so the enum is decorative and unenforced. Either validate against it with a `custom` escape hatch, or delete it. |

### 1.7 Concepts and glossary — `concept.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `ConceptSchema`, `GlossaryEntrySchema` | OK | Match §9.9. |
| Repositories for them | **MIS** | No `ConceptRepository`, no `GlossaryRepository`, and neither appears in `createMemoryRepositories()`. Schemas exist with no access path. |
| Phase fit | PRE (mild) | Concepts are Phase 4, glossary Phase 5. Harmless to have the schemas early; leave them. |

### 1.8 Sessions — `session.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `TimerModeSchema` | OK | All five modes match §9.11 / §18.1. |
| `StudySessionSchema` | OK | Matches §9.11 field-for-field, including the idle/pause accounting that INV-010 depends on. |
| `activityMode` | **MIS** | Required for Read Aloud readiness. |
| `listenedSeconds` | **MIS** | Required to keep listening time separable from visual reading (RA-INV-008). |
| Adapter conformance | **INX** | Adapter writes `createdAt`/`updatedAt` which the schema does not define. See A-5. |

### 1.9 Workspace — `workspace.schemas.ts`

| Item | Status | Finding |
|---|---|---|
| `SourceViewSchema`, `JournalViewSchema`, `WorkspaceLayoutSchema`, `OpenPanelSchema` | OK | Match §9.5. |
| `WorkspaceStateSchema.activeLocation` | **MOD** | Single position. Read Aloud requires three: visual, listening, furthest-reached. |
| `LayoutModeSchema` | MOD | Four modes. Needs `listen` so Listen-Only stays a layout mode and never becomes a route (RA-INV-001, INV-001). |
| Away-mode / playback cache | MIS | No place to persist an optional playback-position cache or background-playback capability state. |
| Resume contract coverage | INC | §6.2 also lists selected annotation tool and text selection; both absent. Minor, Phase 3 concern. |

### 1.10 Repository interfaces — `src/data/repositories/`

| Item | Status | Finding |
|---|---|---|
| `SourceRepository`, `JournalRepository`, `AssetRepository`, `AnnotationRepository`, `ConnectionRepository`, `SessionRepository`, `WorkspaceStateRepository` | OK | Seven interfaces, defined before adapters, as Handoff §10 requires. Domain types only; no Dexie leakage. Correct. |
| `JournalRepository.transact` | OK | Present, matching §10. |
| `transact` on other repositories | INC | Only `JournalRepository` has it. §10 requires transactions to cross related records via a unit-of-work boundary; `importPdf` currently writes asset + source + details + link + journal + state with **no transaction**, so a mid-import failure leaves orphans. Handoff §11.1 explicitly requires rollback or a recovery record. |
| `ConceptRepository`, `GlossaryRepository` | MIS | See 1.7. |

### 1.11 Memory adapter — `src/data/adapters/memory/index.ts`

| Item | Status | Finding |
|---|---|---|
| Seven implementations + `createMemoryRepositories()` | OK | Structure is right; a memory adapter before IndexedDB is exactly Handoff §19 Phase 0C order. |
| `softDeleteBlock` | **INX** | Performs `this.blocks.delete(blockId)` — a **hard delete**. Directly contradicts its own name, PDD §19.3, and NFR-008. |
| `getBySourceAndPage` | **INX** | Reads a non-existent property. See A-2. |
| `upsertArtworkDetails` | **INX** | `...(input as any)` — prohibited by Handoff §26 ("No `any` to bypass core domain typing"). |
| `refsMatch` | **INX** | `(r1 as any).id` — same prohibition. A discriminated-union narrow avoids it entirely. |
| Revision handling | OK | Increments on update throughout. Optimistic-concurrency *checking* is not yet implemented (§13.3), but that is a Phase 0C+ concern. |

### 1.12 Application use cases — `src/application/`

| Item | Status | Finding |
|---|---|---|
| `importPdf` | INC | Sequence matches §11.1, but: no transaction/rollback; `storageKey` written as `''` then never set; no MIME/signature validation; missing `currentPage` (A-1). |
| `createPageLinkedBlock` | **INC** | Correctly inherits `sourceLocation` from the caller's context (INV-004) — the most important behaviour in the product, and it is right. But `generateRank` **ignores `afterBlockId`** and returns timestamp+random, so insertion between two blocks is impossible. Ordering is effectively broken. |
| `resumeSource` | OK | Correctly loads saved state and never resets to page 1 (WS-001, §26 prohibition). Good. |
| Layer placement | MOD | `src/application/` is not in Handoff §8's tree, though `@application/*` is aliased in `tsconfig`. Intentional and defensible — needs ADR ratification. |

### 1.13 Tests

| Item | Status | Finding |
|---|---|---|
| `domain.test.ts` | INC | ~20 schema cases. Good coverage of parsing/defaults/rejection for Source, Block, Annotation, Connection, Workspace. |
| `lib/id.test.ts` | OK | Present. |
| Repository contract tests | **MIS** | Handoff §20.2 requires one suite run against *both* memory and IndexedDB adapters. None exist. This is the gap that will hurt most when Dexie lands. |
| Use-case tests | **MIS** | No test for `importPdf`, `createPageLinkedBlock`, or `resumeSource`. |
| Schema coverage gaps | MIS | No tests for `asset`, `concept`, `glossary`, `session`, `journal` (the `Journal` entity itself), or `MoveBlockInput`. |
| Playwright / E2E | **MIS** | Not installed. Phase 1's exit gate names it explicitly. |

### 1.14 Premature or out-of-scope

| Item | Status | Finding |
|---|---|---|
| Everything inspected | — | **Nothing is premature.** No routing, no CSS, no Dexie, no PDF, no 3D, no chess, no TTS. The tree respects the phase boundary. |
| `dexie`, `react-router-dom`, `zustand`, `pdfjs-dist` in `package.json` | PRE (mild) | Declared but unused. Harmless — Handoff §7.1 anticipates them — but they inflate the lockfile before their phase. Recommend leaving them. |

---

## 2. Consolidated defects

Referenced above as A-n.

| # | Defect | Severity | Location |
|---|---|---|---|
| **A-1** | **`Create*Input` types use `z.infer` (output type), so every `.default()` field becomes *required* on input.** This inverts the intent of every default in the codebase and is why `importPdf` fails to compile. Affects `CreateSourceInput`, `CreateBookDetailsInput`, `CreateBlockInput`, `CreateSessionInput`, `CreateConnectionInput`, `CreateAnnotationInput`. **[predicted]** | **Critical — systemic** | all `*.schemas.ts` |
| **A-2** | `getBySourceAndPage` reads `a.location.pdf?.page`; `Annotation` has `page`, not `location`. **[predicted compile error]** | Critical | `memory/index.ts` ~301 |
| **A-3** | `MemoryAssetRepository.create` writes `updatedAt`/`revision`; `Asset` defines neither. **[predicted excess-property error]** | Critical | `memory/index.ts` ~233 |
| **A-4** | `linkToSource` writes `id`/`createdAt`/`updatedAt`/`revision`; `SourceAsset` defines none. **[predicted]** | Critical | `memory/index.ts` ~259 |
| **A-5** | `MemorySessionRepository.create` writes `createdAt`/`updatedAt`; `StudySession` defines neither. **[predicted]** | Critical | `memory/index.ts` ~391 |
| **A-6** | `softDeleteBlock` hard-deletes; `JournalBlock` has no `deletedAt`. | High | schema + adapter |
| **A-7** | Two `any` casts, prohibited by Handoff §26. | High | `memory/index.ts` ~113, ~345 |
| **A-8** | `BookDetails.currentPage` / `currentChapter` duplicate `WorkspaceState.activeLocation`. | High | `source.schemas.ts` |
| **A-9** | `generateRank` ignores `afterBlockId`; no fractional indexing. | Medium | `create-block.ts` |
| **A-10** | `importPdf` has no transaction or rollback; `storageKey` left `''`. | Medium | `import-pdf.ts` |
| **A-11** | `RelationshipTypeSchema` defined but unenforced. | Low | `connection.schemas.ts` |
| **A-12** | Unused imports (`ISODateTimeSchema` ×3, `BaseEntityFieldsSchema` in sessions). Lint noise only. | Low | several |

---

## 3. Files I would modify

Correction first, then additive readiness. Nothing here adds a feature.

```text
src/domain/shared.ts
  · re-export new time + spatial primitives
  · TextAnchor: optional sentenceIndex
  · SourceLocation.pdf: optional sentenceIndex
  · add generic KnowledgeEntityRef primitive
  · fix unused ISODateTime import

src/domain/sources/source.schemas.ts            A-1, A-8
  · Create*Input via z.input
  · deprecate currentPage/currentChapter (retain, comment as legacy-migration-only,
    or remove — your call, see §5.1)

src/domain/assets/asset.schemas.ts              A-1
src/domain/annotations/annotation.schemas.ts    A-1, unused import
src/domain/concepts/concept.schemas.ts          A-1

src/domain/journals/journal.schemas.ts          A-1, A-6
  · add deletedAt to JournalBlock
  · add optional epistemicClaimId (promotion pointer, §5.3)

src/domain/connections/connection.schemas.ts    A-1, A-11
  · extend Reference union: 'knowledge-entity', 'epistemic-claim'
  · enforce RelationshipType with custom escape hatch

src/domain/sessions/session.schemas.ts          A-1
  · add activityMode: 'reading' | 'listening' | 'mixed'
  · add listenedSeconds
  · fix unused import

src/domain/workspace/workspace.schemas.ts
  · add listenLocation?, furthestLocation?
  · LayoutMode += 'listen'
  · add awayMode flag + optional playbackPositionCache
  · add playbackCapability: 'web-best-effort' | 'desktop-reliable' | 'unknown'

src/domain/index.ts                             export new modules

src/data/repositories/JournalRepository.ts      listDeletedBlocks / restoreBlock
src/data/repositories/index.ts                  export new interfaces

src/data/adapters/memory/index.ts               A-2, A-3, A-4, A-5, A-6, A-7
  · true soft delete
  · remove both any casts
  · add Concept/Glossary/KnowledgeEntity/EpistemicClaim memory repos
  · register them in createMemoryRepositories()

src/application/import-pdf.ts                   A-1, A-10 (transaction + storageKey)
src/application/create-block.ts                 A-9 (real fractional rank)
src/domain/domain.test.ts                       extend

package.json                                    add Playwright + test:e2e (closes 0A gap)
```

## 4. Files I would create

Deliberately thin. Primitives and one extension point each — **no Person, Place, Polity, Religion, Ideology, Commodity, Route, Movement, or boundary schemas.**

```text
src/domain/time/time.schemas.ts
  TemporalPrecision  year | decade | century | month | day | era
  TemporalUncertainty  circa | disputed | inferred | exact + confidence
  TemporalPoint    value + precision + uncertainty + calendar + era
  TemporalExtent   start / end TemporalPoint, either side open or fuzzy
src/domain/time/time.test.ts

src/domain/spatial/spatial.schemas.ts
  GeoCoordinate    lat/lon + optional elevation + datum
  GeoGeometryRef   opaque, typed reference to point/line/area geometry
  SpatialRef       coordinate | geometry | named-place-ref, discriminated
src/domain/spatial/spatial.test.ts

src/domain/knowledge/knowledge.schemas.ts
  KnowledgeEntityKind   open enum: person | place | event | organisation |
                        movement | polity | religion | ideology | commodity |
                        route | region  (declared, NOT modelled)
  KnowledgeEntityRef    { kind, id } — stable pointer only
src/domain/knowledge/knowledge.test.ts

src/domain/epistemics/epistemics.schemas.ts
  EpistemicClaim     canonical, promoted from a journal block
  ConfidenceLevel
  KnowledgeStatus    open | supported | contested | superseded | settled
  EvidenceLink / ObjectionLink via Connection, not embedded arrays
src/domain/epistemics/epistemics.test.ts

src/data/repositories/ConceptRepository.ts        (closes 1.7 gap)
src/data/repositories/GlossaryRepository.ts
src/data/repositories/KnowledgeEntityRepository.ts
src/data/repositories/EpistemicClaimRepository.ts

src/data/adapters/memory/contract.test.ts         repository contract suite,
                                                  adapter-agnostic so the future
                                                  Dexie adapter reuses it verbatim

src/application/import-pdf.test.ts
src/application/create-block.test.ts
src/application/resume-source.test.ts

docs/CNTKNW_ADR_0001_Phase_0B_Foundations.md
docs/CNTKNW_Amendments_Register_v0.2.md
```

## 5. Recommended to leave unchanged

- `src/legacy-v1/**` — frozen (Handoff §6.2, §26).
- `src/main.tsx` — placeholder until Phase 0D.
- `AnnotationGeometrySchema` — opaque form is deliberate legacy tolerance; discriminate at Phase 3.
- `ProseMirrorJSONSchema` placeholder — resolve at the editor spike, not now.
- Concept and glossary *schemas* — mildly early but harmless and already correct.
- `dexie` / `react-router-dom` / `zustand` / `pdfjs-dist` dependencies — unused but anticipated.
- All existing repository interfaces — well-shaped; only additive changes proposed.
- `resumeSource` — correct as written.
- `tsconfig.json` `exclude: ["src/legacy-v1"]` — correctly freezes legacy.

---

## 6. Unresolved architecture decisions

**D-1 — `Create*Input`: `z.input` or restructured schemas? (A-1)**
`z.input` is the two-character fix. The alternative is separate hand-written input schemas, which is more explicit but doubles maintenance. **I recommend `z.input`.** Needs your call because it changes every create call site.

**D-2 — `BookDetails.currentPage` / `currentChapter`: remove, or retain as migration-only? (A-8)**
`WorkspaceState.activeLocation` is the canonical position. Keeping a second one guarantees they diverge. **I recommend removing both** and mapping v1 `books.currentPage` straight into `WorkspaceState` during migration. Removing is cheap now and expensive after data exists.

**D-3 — Claim promotion mechanics.**
Your instruction: journal claim blocks stay ordinary content; a block may be *promoted* to a canonical `EpistemicClaim`; Atlas and argument maps reference the same formal object. Open question: does promotion **transform** the block (§7.5 transform-not-recreate, same ID retained) or **link** it (block keeps identity, gains `epistemicClaimId`)? **I recommend linking** — it preserves the block's journal identity and lets one claim be asserted from several passages. Transformation cannot express that.

**D-4 — `EntityId`: UUIDv7 or ULID?**
Undecided since v0.2. `z.string().uuid()` currently forecloses ULID. `crypto.randomUUID()` emits v4, not v7. Cheap now.

**D-5 — Fractional indexing library or hand-rolled? (A-9)**
Affects `moveBlock` correctness and the Phase 2 gate. A small dependency is the pragmatic answer, but it is a new dependency during Phase 0B.

**D-6 — Transaction boundary for multi-repository use cases. (A-10)**
`importPdf` spans five repositories. Does `transact` move to a unit-of-work object spanning repositories, or does each repository keep its own? The memory adapter makes this invisible; Dexie will not.

**D-7 — Open vs. closed `KnowledgeEntityKind`.**
A closed Zod enum gives exhaustiveness checking; an open one lets Atlas add kinds without a migration. **I recommend closed**, since adding an enum member is trivial and exhaustiveness is worth more.

**D-8 — Read Aloud background playback capability.**
You asked to distinguish web best-effort from desktop-reliable. Open question: is capability **detected at runtime** and cached on `WorkspaceState`, or **declared at build time** as a compile-time constant? **I recommend runtime detection with a persisted last-known value**, so the same domain record survives the desktop wrap.

**D-9 — Ratify the `application/` layer.**
Deviates from Handoff §8. ADR-0001 will record it unless you object.

---

## 7. Estimated tests to add

| Area | Est. cases | Notes |
|---|---|---|
| Time primitives | 18–22 | Precision × uncertainty matrix, open-ended extents, BCE, era boundaries, invalid combinations |
| Spatial primitives | 8–10 | Coordinate bounds, datum, discriminated `SpatialRef` |
| Knowledge entity refs | 5–6 | Kind validity, ref stability |
| Epistemics | 12–15 | Claim lifecycle, knowledge status transitions, block→claim promotion, evidence via Connection |
| Extended `Reference` union | 6–8 | Each new endpoint parses; unknown types rejected |
| Session `activityMode` | 6–8 | Three modes, `listenedSeconds` separability from `focusedSeconds` |
| Workspace three positions | 10–12 | Independence of visual/listening/furthest, `listen` layout mode, away flag, capability field |
| Soft delete (A-6) | 6–8 | Delete marks not removes; restore; deleted excluded from `listBlocks` |
| Rank / fractional indexing (A-9) | 10–14 | Insert between, insert at ends, repeated inserts at one position, stability |
| `Create*Input` after `z.input` (A-1) | 8–10 | Defaults genuinely optional on input, applied on output |
| Repository contract suite | 30–40 | One suite, run against memory now and Dexie later — the highest-value item here |
| Use cases | 12–16 | `importPdf` incl. rollback, `createPageLinkedBlock` location inheritance, `resumeSource` never-page-1 |
| Adapter regression (A-2…A-5) | 6–8 | Guard the shapes that currently mismatch |

**Total: roughly 140–190 cases**, of which the repository contract suite is the one I would not cut.

---

## 8. Proposed order of work

1. **Fix before adding** — A-1 through A-7. Every new schema would otherwise inherit A-1.
2. Get `typecheck` / `lint` / `test` green and **report actual output**.
3. Additive readiness — time, spatial, knowledge refs, epistemics, `Reference` extension.
4. Read Aloud domain fields — sessions, workspace.
5. Repository interfaces + memory implementations for the new entities.
6. Contract suite and use-case tests.
7. ADR-0001 and the amendments register.
8. Re-run all five commands and report.

Steps 1–2 are worth doing even if you reject everything else.

---

## 9. Confirmation

Phase 0B remains **domain and application contracts only**. I will not add routing, shell, providers, design tokens, CSS, Dexie, IndexedDB adapters, migration writes, PDF implementation, Atlas UI, Atlas entity schemas beyond the shared primitives listed in §4, Read Aloud UI, TTS, OCR, 3D, chess, or AI.

No entity or service that already exists will be duplicated.

I will not declare Phase 0B complete without running `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` and reporting their real output. If the environment still cannot execute commands, I will deliver the diff and mark verification **pending**.

**Stopping for approval.**
