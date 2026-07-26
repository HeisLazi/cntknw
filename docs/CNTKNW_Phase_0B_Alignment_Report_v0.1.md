# CNTKNW Phase 0B — Repository and Requirements Alignment Report

**Version:** 0.1
**Date:** 25 July 2026
**Status:** Read-only review. No code was modified.
**Reviewed against:** Product Design Document v0.2, AI Implementation Handoff v0.2, Master AI Context v0.2, Requirements v0.2 JSON, and the actual working tree.

> **Verification limitation, stated up front.** The isolated Linux environment for this session failed to start (`HYPERVISOR_VIRT_DISABLED`). I therefore could **not** run `git`, `npm install`, `typecheck`, `lint`, `test`, or `build`. Every statement below about file contents is verified by direct read. Every statement about *build status* and *commit `ff3e2e1`* is **unverified**. I have not confirmed that any build passes. Handoff §25 requires honest reporting of exactly this kind of gap.

---

## 1. Product vision

CNTKNW is a **local-first personal knowledge museum and study studio**. It unifies serious source reading, visual analysis, journaling, drawing, vocabulary work, and connected thinking so the user never has to jump between a PDF reader, dictionary, whiteboard, notes app, and mind-map tool.

The central claim is not feature count. It is **the removal of context switching**:

```text
Open a source
-> read, look up, highlight, draw, question, connect, reflect
-> close the source
-> return later to the exact intellectual context
```

The vision statement: a place where a person's reading, visual study, vocabulary, questions, drawings, and connections **remain attached to the sources that produced them** while becoming part of one growing intellectual archive.

The principles I will hold to hardest, because they are the ones most easily eroded by implementation convenience:

- **Source-aware by default** — the active location supplies context automatically; the user is never asked to categorise.
- **One canonical piece of content** — every view is a projection, never a copy.
- **Think first, organise later** — capture is immediate; structure is added during review.
- **Local-first by design** — no account, no network, no CDN in the core path.
- **Depth over gamification** — statistics describe study; they never reward rushing or punish rereading.
- **AI is optional and subordinate** — generated material never silently replaces source text or the user's interpretation.

---

## 2. The three primary destinations and the Study Workspace

**Exactly three primary destinations.** No more, ever, without an explicit product-design revision (IA-001).

| Destination | Contents |
|---|---|
| **Library** | Books, papers, PDFs, collections, timelines, future immersive library |
| **Gallery** | Artworks, art history, comparison, visual annotation, future immersive museum |
| **Notes** | Journals, all blocks, themes, connections, glossary, maps, standalone notes |

**The Study Workspace** is the shared interaction surface. Books and artworks both open into it. It is not a destination and never appears in primary navigation — it is reached *through* Library or Gallery, at a nested route such as `/study/:sourceId`.

Its structure is a source pane beside **one continuous journal** for that source:

```text
+--------------------------------+--------------------------------+
| SOURCE PANE                    | JOURNAL PANE                   |
| PDF or artwork                 | Current context header         |
| Annotation layer               | Page-linked journal blocks     |
| Search, contents, navigation   | Drawings, maps, concepts       |
| Zoom, view mode, compare       | Backlinks and connections      |
+--------------------------------+--------------------------------+
| Source location | Focus 43:21 | Autosaved | Dictionary | View   |
+-----------------------------------------------------------------+
```

The behaviour that defines the product: while page 5 is active, **everything created inherits page 5** — paragraph, quote, drawing, question, definition, connection origin. Moving to page 6 changes context without erasing page 5 and without creating an empty page 6 section.

Everything else — PDF reader, artwork viewer, journal editor, drawing, dictionary, timer, connections, and later Read Aloud and Atlas — is a **tool inside this workspace**, not a destination.

---

## 3. Non-negotiable architectural invariants

I will stop and report before implementing anything that would violate these.

| ID | Invariant |
|---|---|
| INV-001 | Exactly three primary destinations: Library, Gallery, Notes. |
| INV-002 | PDF reader, artwork viewer, journal, drawing, dictionary, timer, connections are tools inside the shared Study Workspace. |
| INV-003 | Each source has one continuous journal. |
| INV-004 | New blocks inherit the active source location automatically. |
| INV-005 | Empty PDF pages do not create visible empty journal sections. |
| INV-006 | Journal, outline, cards, and map views render the same canonical blocks. |
| INV-007 | Every explicit connection produces a backlink. |
| INV-008 | Drawings and annotations retain editable object/vector data. |
| INV-009 | Core reading, writing, annotation, dictionary, and search work offline. |
| INV-010 | Manual timing is the default; quiet reading is valid focus. |
| INV-011 | 3D worlds are optional access layers and never gate content. |
| INV-012 | Chess is a future room in Library, not a core tab. |
| INV-013 | Schema changes always include migrations. |
| INV-014 | UI components do not write directly to arbitrary database stores. |
| INV-015 | Core data can be backed up and restored without cloud services. |

Supporting rules I treat as equally binding: **IA-001** (no new primary tab), **WS-001** (reopening restores state, never resets to page 1), and **NFR-006** (no core runtime dependency from a CDN).

Two further rules from the handoff that constrain Phase 0B directly: generic `put(storeName, object)` is **prohibited** outside migration tooling, and `any` may not be used to bypass core domain typing.

---

## 4. Current repository structure, and what is canonical

### 4.1 What I actually found

Root: `C:\Books\philosophy-journal-complete\`

```text
package.json            name "cntknw", version 0.2.0
package-lock.json
tsconfig.json           strict: true; excludes src/legacy-v1
tsconfig.node.json
vite.config.ts
eslint.config.js
index.html
vite-env.d.ts
tsconfig.tsbuildinfo / tsconfig.node.tsbuildinfo   (build artefacts, committed?)
vite.config.d.ts                                    (build artefact, committed?)
node_modules/

docs/
  CNTKNW_READ_ME_FIRST_v0.2.md
  CNTKNW_Master_AI_Context_v0.2.md
  CNTKNW_Product_Design_Document_v0.2.{md,docx,pdf}
  CNTKNW_AI_Implementation_Handoff_v0.2.{md,docx,pdf}
  CNTKNW_Requirements_v0.2.json
  CNTKNW_CHECKSUMS_v0.2.sha256
  CNTKNW_Atlas_System_Design_Document_v0.1.docx      ← docx only
  CNTKNW_Read_Aloud_System_Design_Document_v0.1.md   ← added this session

src/
  main.tsx                          Phase 0A placeholder shell
  lib/id.ts, lib/id.test.ts
  tests/setup.ts
  domain/
    shared.ts, index.ts, domain.test.ts
    sources/source.schemas.ts
    assets/asset.schemas.ts
    journals/journal.schemas.ts
    annotations/annotation.schemas.ts
    connections/connection.schemas.ts
    concepts/concept.schemas.ts
    sessions/session.schemas.ts
    workspace/workspace.schemas.ts
  data/
    repositories/  Source, Journal, Asset, Annotation, Connection, Session,
                   WorkspaceState, index
    adapters/memory/index.ts
  application/
    import-pdf.ts, create-block.ts, resume-source.ts, index.ts
  legacy-v1/
    App.jsx, db.js, main.jsx, index.css
    v1-components/  ×12 (ArtGallery, BookDetail, BookLibrary, ConfirmModal,
                    ExportImport, NoteSystem, PDFReader, SessionTracker,
                    Settings, Sidebar, Toast, Whiteboard)
```

### 4.2 What you described that I could not find

| Expected | Found |
|---|---|
| `artifacts/cntknw/` | **Absent.** The v2 foundation lives at `src/`, not under `artifacts/`. |
| `legacy-v1-app/` | **Absent.** Legacy lives at `src/legacy-v1/`, inside the v2 tree. |
| `ARCHITECTURE.md` | **Absent** anywhere under `C:\Books`. |
| Phase 0A checkpoint document | **Absent** from `docs/`. |
| Amendment documents | **Absent** — though the code cites them (see §6.3). |
| Commit `ff3e2e1` | **Unverifiable** — no shell, no `git`. |
| Two passing builds | **Unverifiable, and structurally doubtful** — see below. |

### 4.3 "Both builds passing" — a structural problem

There is only **one** build. `src/legacy-v1/` has no `package.json`, no `index.html`, and no entry wiring. It is *excluded from `tsconfig.json`* (`"exclude": ["src/legacy-v1"]`) and `"include"` covers only `.ts`/`.tsx`, so the legacy `.jsx` files are neither type-checked nor bundled.

This is **correct** for freezing legacy as a read-only reference, and it satisfies Handoff §6.1 step 1. But it means legacy-v1 is **not a runnable application** in this repository. If you need the frozen legacy app to stay *runnable* for behavioural comparison during migration, it needs its own `package.json`, `index.html`, and build script — which is what a separate `legacy-v1-app/` directory would have given you.

### 4.4 Canonical application for new work

**`src/` is canonical.** All new work targets the v2 TypeScript foundation.

`src/legacy-v1/` is a **frozen read-only reference**. Per Handoff §6.2 it must not be mutated, and per §26 v1 data must not be deleted before verified migration and backup. I will read it only to write migration mappings and fixtures.

---

## 5. Phase 0A status

Handoff §19 defines Phase 0A as: remove bundled `node_modules`, clean lock file, TypeScript strict, lint/unit/E2E scripts, and a verified clean install and build.

| 0A requirement | Status | Evidence |
|---|---|---|
| Clean dependency install | Likely done | `package-lock.json` present; dependency set matches Handoff §7.1 (dexie, zod, react-router-dom, zustand, pdfjs-dist) and no longer matches the v1 set (`idb`, `fabric`, `uuid` are gone) |
| TypeScript, strict mode | **Done** | `tsconfig.json` `"strict": true`, path aliases configured |
| Lint script | **Done** | `"lint": "eslint src/"` |
| Unit test script | **Done** | `"test": "vitest run"`, `vitest` + Testing Library + jsdom present, `src/tests/setup.ts` exists |
| **E2E script** | **Not done** | No `test:e2e` script; **Playwright is not a dependency**. Handoff §19 0A step 4 and §20.4 require it. |
| Clean install and build verified | **Unverified** | No shell access this session |

**Assessment: Phase 0A is substantially complete but not fully met.** The missing piece is the E2E harness. That matters more than it looks — Phase 1's gate is *"AC-001 and AC-002 pass in Playwright offline mode"*, so Playwright is a prerequisite for exiting a later phase, and adding it now is cheap.

### 5.1 Work has already landed beyond 0A

This is worth stating plainly: the repository already contains **domain schemas, seven repository interfaces, a memory adapter, and three application use cases** (`import-pdf`, `create-block`, `resume-source`). Under Handoff §19 that is Phase **0C** work.

So the true state is: **0A complete-but-for-E2E, a substantial slice of the domain layer already built, and no shell or routing.** It is not a clean "0A done, nothing else started" boundary. This does not appear to be a mistake — see §6.1 — but the next phase must be scoped against what is actually there, not against a fresh 0A baseline.

Quality of what exists is good. `shared.ts` derives every TypeScript type via `z.infer` from an authoritative Zod schema, which structurally prevents schema/type drift. `SourceLocation`, `TextAnchor`, `WorkspaceState`, and `StudySession` match the Handoff §9 contracts field-for-field.

---

## 6. Conflicts, contradictions, and missing files

### 6.1 Phase numbering: the handoff is stale, not wrong

Your instruction says Phase 0B is domain-model readiness and explicitly forbids routing. **Handoff §19 says Phase 0B *is* "Shell and routing"** plus design tokens. Read literally, those contradict.

They are reconciled by the code itself. `src/main.tsx` carries this comment:

> *"Phase 0D will replace this with the router, providers, and AppShell layout."*

So the phase sequence has already been renumbered — routing moved from 0B to **0D** — and the repository, your instruction, and the placeholder comment all agree. **The only thing that disagrees is Handoff §19, which was not updated.**

**Conclusion: Handoff §19's build order is outdated.** I will follow your definition (source precedence rule #1). But the handoff needs an amendment recording the renumbering, or every future agent that reads §19 literally will try to build the router during 0B.

### 6.2 The amendment register is missing

`src/domain/shared.ts` cites *"amendment 7"*. `src/domain/annotations/annotation.schemas.ts` cites *"amendment 11"*. **No amendment document exists in `docs/`**, and no file under `C:\Books` matches. At least eleven amendments to v0.2 have been made and the register is not in the repository.

This is the most consequential gap in the documentation set. It means I cannot know which other v0.2 statements have been superseded — §6.1 above is one I caught only because a code comment happened to reveal it. There may be others I would follow incorrectly.

**I need that register before I can safely claim alignment with anything.**

### 6.3 The Atlas document cannot be read

`CNTKNW_Atlas_System_Design_Document_v0.1.docx` exists as **`.docx` only**. It is a binary format, and with the Linux sandbox down I have no way to extract it. Every other canonical document has a `.md` sibling; this one does not.

I have your prose summary of Atlas from this conversation, which is enough to *avoid foreclosing* Atlas in the domain model. It is **not** enough to design the Atlas entity shapes correctly. Building them from the bullet list alone risks rework of exactly the records that are most expensive to change later (time and place).

**Please export it as `CNTKNW_Atlas_System_Design_Document_v0.1.md` alongside the docx.**

### 6.4 v0.2 does not yet contain Atlas or Read Aloud

Neither feature appears in the canonical documents:

- PDD §22.1 core entities has no Place, Event, Person-as-historical-actor, Movement, Polity, Commodity, Route, or Region.
- PDD §14.1 connection endpoints stops at source, location, block, annotation, concept, glossary entry, creator, artwork region, and future chess. No Atlas endpoints.
- PDD §9.5 `WorkspaceState` has a single `activeLocation`. There is no listening position and no furthest-reached position.
- PDD §9.11 `StudySession` has no `activityMode`.
- PDD §5.1's IA tree has no Atlas Room; §11.4's immersive library description does not mention it.

I have written **`CNTKNW_Read_Aloud_System_Design_Document_v0.1.md`** this session, reconciled clause-by-clause against v0.2, with ten recorded conflict resolutions and no v0.2 requirement weakened. Atlas still needs the equivalent treatment once §6.3 is resolved.

### 6.5 Structural drift from Handoff §8

Minor, but it should be a deliberate decision rather than drift:

- Handoff §8 specifies `domain/<area>/{types,schemas,service}.ts`. The repo has **schemas only** — no `.types.ts` (deliberate and better: types are inferred via `z.infer`) and **no `.service.ts`**.
- Business logic instead lives in **`src/application/`**, which does not appear in Handoff §8's target tree at all. There is an `@application/*` path alias, so this is intentional.
- `domain/glossary/`, `domain/maps/`, and `domain/search/` are absent (Phases 5–6; expected).

The `application/` layer is a reasonable clean-architecture choice, but it deviates from the documented structure and should be ratified by an ADR so it is not "corrected" back later.

### 6.6 Claim and evidence are about to be modelled twice

PDD §7.3 already defines `claim`, `evidence`, and `objection` as **journal block kinds**, with argument-map edge semantics in §8.5. Your Atlas brief asks for *"claims, evidence, confidence and knowledge status"* as **Atlas entities**.

If both are built independently, CNTKNW ends up with two incompatible claim models and connections that cannot cross between them. This must be settled before either is written. See §9.

### 6.7 Smaller observations

- `EntityIdSchema` is `z.string().uuid()`. Handoff §9.1 requires a decision between **UUIDv7 and ULID**; the code has not recorded one. ULID would fail this validator.
- `tsconfig.tsbuildinfo`, `tsconfig.node.tsbuildinfo`, and `vite.config.d.ts` are build artefacts sitting in the repo root. If they are tracked, they should be ignored.
- `CNTKNW_Master_AI_Context_v0.2.md` is a concatenation of READ_ME_FIRST + PDD + Handoff with no unique content. It needs no separate reading, but it will silently go stale as amendments land.
- `CNTKNW_CHECKSUMS_v0.2.sha256` exists; I could not verify it without a shell.

---

## 7. Scope of the next approved phase

**Phase 0B — Domain model future-readiness. Contracts only. No user-facing surface.**

The objective is narrow: ensure the shared `Reference`, `SourceLocation`, time, session, workspace, and connection models **will not prevent** Atlas and Read Aloud later — while building neither.

In scope:

1. **Time model** — `TimeRange` / temporal point with explicit **precision** and **uncertainty**, plus era handling. New shared primitive.
2. **Atlas entity contracts** — Place, Event, Person, Organisation, Movement, Polity, Religion, Ideology, Commodity, Route, Region. Zod schemas and inferred types only.
3. **Claim, evidence, confidence, knowledge status** — one model, reconciled with the existing journal block kinds (§6.6).
4. **`Reference` union extension** — so connections can target Atlas entities and Atlas entities can link back to original source pages.
5. **Read Aloud domain readiness** — separate visual / listening / furthest positions on `WorkspaceState`; `activityMode` and `listenedSeconds` on `StudySession`; sentence-level anchoring adequate for future audio notes and bookmarks.
6. **Repository interfaces** for the new entities, plus memory-adapter implementations.
7. **Schema tests** for everything added.
8. **Documentation** — ADR ratifying the phase renumbering and the `application/` layer; recovery of the amendment register.

Out of scope, explicitly: routing, shell, design tokens, any CSS, Dexie, IndexedDB adapters, migration *writes*, PDF work, Atlas UI, Read Aloud UI, TTS, OCR, 3D, chess.

**One point strongly in favour of doing this now.** There is **no IndexedDB adapter and no shipped database**. Every schema addition proposed here therefore costs **zero migration** today. The same additions made after Phase 0C's Dexie adapter lands would each require a versioned migration under INV-013. This is the cheapest moment in the project's life to widen these contracts, and it is the correct reason to do domain-readiness before routing.

---

## 8. Files I propose creating or modifying in Phase 0B

Nothing below has been touched. This is a proposal awaiting your approval.

### 8.1 New files

```text
src/domain/time/
  time.schemas.ts              TemporalPoint, TimeRange, precision, uncertainty, era, calendar
  time.test.ts

src/domain/atlas/
  place.schemas.ts             Place, Region, geometry, time-sliced attributes
  actor.schemas.ts             Person, Organisation, Movement, Polity, Religion, Ideology
  event.schemas.ts             Event, participation roles, temporal + spatial extent
  commodity.schemas.ts         Commodity, flows
  route.schemas.ts             Route, waypoints, period of use
  epistemics.schemas.ts        Claim, Evidence, Confidence, KnowledgeStatus
  index.ts
  atlas.test.ts

src/data/repositories/
  AtlasRepository.ts           interfaces only
  EpistemicsRepository.ts      interfaces only

docs/
  CNTKNW_ADR_0001_Phase_Renumbering_and_Application_Layer.md
  CNTKNW_Amendments_Register_v0.2.md          (reconstructed — needs your input)
  CNTKNW_Phase_0B_Checkpoint_Report.md        (written at phase exit)
```

### 8.2 Modified files

```text
src/domain/shared.ts                     re-export time primitives; extend PdfLocation
                                         with optional sentence-level anchoring
src/domain/connections/connection.schemas.ts
                                         extend Reference union with Atlas + epistemic refs
src/domain/sessions/session.schemas.ts   + activityMode: 'reading'|'listening'|'mixed'
                                         + listenedSeconds
src/domain/workspace/workspace.schemas.ts
                                         + listenLocation, furthestLocation
                                         + LayoutMode 'listen'; + awayMode flag
src/domain/journals/journal.schemas.ts   audio-note readiness on block content contracts
src/domain/index.ts                      export new modules
src/domain/domain.test.ts                extend coverage
src/data/repositories/index.ts           export new interfaces
src/data/adapters/memory/index.ts        memory implementations for new repositories
package.json                             add Playwright + test:e2e (closes the 0A gap)
```

### 8.3 Files I will not touch

```text
src/legacy-v1/**            frozen reference (Handoff §6.2, §26)
src/main.tsx                stays a placeholder until Phase 0D
src/app/**                  does not exist; will not be created
src/features/**             does not exist; will not be created
src/design/**               does not exist; will not be created
**/*.css
src/data/adapters/indexeddb/**
src/data/db/migrations/**
docs/CNTKNW_*_v0.2.*        canonical docs amended only by ADR, never edited in place
```

---

## 9. Risks and decisions to settle before implementation

Ordered by cost of getting wrong.

**1. The temporal model — highest cost to change later.**
Historical time is not a timestamp. The model must express: circa dates, floruit, ranges with fuzzy ends (`c. 1200–1250`), century-level and decade-level precision, BCE, regnal and dynastic years, non-Gregorian calendars, and *disputed* dates where sources disagree. Two distinct axes must not be conflated: **precision** (we know it to the decade) and **uncertainty** (we are not confident). Getting this wrong means re-encoding every Atlas record later. **This needs an explicit decision, ideally informed by the Atlas document.**

**2. Place versus polity versus region over time.**
A place's name, borders, and sovereignty all change. If `Place` is modelled as a flat record with one name and one geometry, the Atlas can never show change over time — which appears to be its entire purpose. The likely answer is stable identity plus time-sliced attributes, but this is expensive to retrofit. **Needs a decision.**

**3. One claim model or two.**
§6.6 above. `claim` / `evidence` / `objection` already exist as journal block kinds with argument-map edge semantics. Atlas wants claims with confidence and knowledge status. My recommendation is **one** epistemic model that both the journal and the Atlas reference — but this is a genuine architectural fork and it is yours to call.

**4. Atlas document availability.**
§6.3. Proceeding without it means designing eleven entity types from a bullet list. I can produce contracts that do not *foreclose* Atlas, but I cannot claim they are *right*.

**5. The missing amendment register.**
§6.2. Eleven-plus amendments exist and I cannot see them. Until they are recovered I cannot guarantee that anything I build matches current intent rather than superseded v0.2 text.

**6. `EntityId`: UUIDv7 or ULID.**
Handoff §9.1 demands one decision. Code currently validates `uuid()`, which excludes ULID. Cheap now, annoying after data exists.

**7. Block ordering.**
`rank: string` implies fractional indexing. The library or algorithm has not been chosen. Affects `moveBlock` correctness.

**8. Ratifying the `application/` layer.**
§6.5. Needs an ADR or it will be "fixed" back toward Handoff §8 by a future agent.

**9. Playwright absent.**
§5. Phase 1's exit gate names Playwright explicitly. Adding it during 0B is cheap and closes the 0A gap.

**10. Verification blackout.**
I cannot run git, install, typecheck, lint, tests, or build in this session. Before Phase 0B is declared complete, those must be run and reported — by you, or by me in a session with a working shell. I will not claim a passing gate I have not observed.

---

## 10. Scope confirmation

I confirm that during Phase 0B I will **not** begin:

- routing, the app shell, providers, or any navigation;
- visual redesign, design tokens, CSS, typography, or UI primitives;
- Dexie or any IndexedDB adapter;
- migration **writes** of any kind (read-only v1 inspection only, and only if asked);
- PDF implementation, rendering, or text extraction;
- the Atlas UI, the Atlas Room, or any 3D;
- Read Aloud UI, text-to-speech, audio playback, or OCR;
- chess, AI features, sync, or any other user-facing feature.

Phase 0B is **domain contracts, repository interfaces, memory adapters, tests, and documentation only.**

I further confirm that I have **not modified any code** in producing this report. The only files written this session are two new documents in `docs/`: the Read Aloud System Design Document v0.1 and this report.

**Stopping here for approval.**

---

## Appendix — documents read

| Document | Status |
|---|---|
| `CNTKNW_READ_ME_FIRST_v0.2.md` | Read in full |
| `CNTKNW_Product_Design_Document_v0.2.md` | Read in full |
| `CNTKNW_AI_Implementation_Handoff_v0.2.md` | Read in full |
| `CNTKNW_Master_AI_Context_v0.2.md` | Read; confirmed to be a concatenation of the above with no unique content |
| `CNTKNW_Requirements_v0.2.json` | Read: invariants and acceptance criteria |
| `CNTKNW_Atlas_System_Design_Document_v0.1.docx` | **Not read — binary, no extraction tooling available** |
| `ARCHITECTURE.md` | **Not found** |
| Phase 0A checkpoint / amendment documents | **Not found** |
| Source tree | All non-`node_modules` files enumerated; key domain, repository, adapter, config, and entry files read directly |
