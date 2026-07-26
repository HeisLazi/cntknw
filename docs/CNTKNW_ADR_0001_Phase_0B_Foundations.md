# ADR-0001 — Phase 0B Foundations

**Status:** Accepted
**Date:** 25 July 2026
**Owner:** Lazarus Petrus
**Supersedes:** nothing
**Amends:** `CNTKNW_AI_Implementation_Handoff_v0.2.md` §8, §9.1, §9.2, §19
**Companions:** `CNTKNW_Phase_0B_Alignment_Report_v0.1.md`, `CNTKNW_Phase_0B_Domain_Audit_v0.1.md`

This record captures the decisions taken during Phase 0B. Each states the decision, why, and what it costs. Decisions 2 through 5 correct defects found in the existing implementation; 6 through 10 are additive readiness.

---

## 1. Revised phase order

**Decision.** The build order is:

| Phase | Scope |
|---|---|
| 0A | Clean reproducible build, TypeScript strict, lint and test scripts |
| **0B** | **Domain and application contracts. No user-facing surface.** |
| 0C | Persistence — Dexie adapter, schema versions, migrations, v1 readers |
| 0D | Shell, routing, providers, design tokens, UI primitives |
| 0E | Editor spike, then the journal vertical slice |

**Why.** Handoff §19 places shell and routing at 0B and persistence at 0C. That ordering was superseded in practice: `src/main.tsx` already carries the comment *"Phase 0D will replace this with the router, providers, and AppShell layout"*, and the repository, the owner's instruction and that comment all agree. Handoff §19 alone was not updated.

Doing domain before routing is also the cheaper order. There is no IndexedDB adapter and no shipped database, so every schema decision in this phase costs **zero migration**. The same changes after 0C would each need a versioned migration under INV-013.

**Cost.** Handoff §19 is now stale and must be read alongside this ADR. A future agent reading §19 literally would try to build the router during 0B.

---

## 2. Create-input types use `z.input`, not `z.infer`

**Decision.** Every `Create*Input` type is derived with `z.input<typeof Schema>`. Repositories parse the input through its schema at the boundary, which validates it and applies declared defaults.

**Why.** `z.infer` yields the **output** type, in which every `.default()` has already been applied and is therefore **required**. Using it for create inputs inverted the meaning of every default in the codebase: `importPdf` failed to compile because `.default(0)` on `currentPage` made it mandatory to supply. Six create-input types were affected.

Parsing at the repository boundary is also what handoff §10 asks for — *"repository methods accept validated domain inputs"* — so validation and default application happen in one place rather than being scattered through callers.

**Cost.** Callers pass a looser type than they receive back. The repository's return type is the parsed output, so nothing downstream is weakened.

**Extends to embedded types, not just `Create*Input`.** The first pass at this decision fixed the `Create*Input` aliases but missed hand-written interfaces that embed a domain type as an input. `CreatePageLinkedBlockInput.content` was typed `BlockContent` — the output type — which forced callers to supply `resolved`, `supportingBlockIds` and every other defaulted field. Six compile errors, all the same cause.

The rule is therefore about direction, not naming: **any type describing data flowing *into* the system uses `z.input`; any type describing data coming *out* uses `z.infer`.** `journal.schemas.ts` now exports both `BlockContent` (stored) and `BlockContentInput` (supplied), and `UpdateBlockInput` is `z.input`. `MemoryJournalRepository.updateBlock` parses at the boundary so defaults are applied before storage, matching `createBlock`.

When a new type is introduced, ask which direction it travels before choosing the helper.

---

## 3. `WorkspaceState` owns reading position; `BookDetails` does not

**Decision.** `BookDetails.currentPage` and `BookDetails.currentChapter` are removed. `WorkspaceState.activeLocation` is the single canonical reading position. v1 `books.currentPage` maps into `WorkspaceState` during migration.

**Why.** Neither field appears in handoff §9.2 — they were v1 concepts that leaked into v2. Two stores of the same fact will diverge, and the Read Aloud model in decision 7 adds two more positions on top. Three positions built over an already-contradictory pair would be unrecoverable.

**Cost.** A query that only wants "what page is this book on" must load `WorkspaceState` rather than `BookDetails`. Acceptable: that record has to be loaded to open the source anyway.

---

## 4. Claim promotion links rather than transforms

**Decision.** Journal claim blocks remain ordinary journal content. A block may be **promoted** to a canonical `EpistemicClaim`: the claim is created, the block gains `epistemicClaimId`, and nothing else about the block changes. The Atlas and argument-map views reference the same `EpistemicClaim`. Nothing is promoted automatically.

**Why.** PDD §7.5 describes transformation in place, retaining the block's ID. That works for paragraph-to-question, but it cannot express **one claim asserted at several passages across several sources** — which is the normal case for a claim worth formalising. Linking preserves each block's journal identity while letting many blocks share one claim, via `originBlockIds`.

Evidence, objections and competing interpretations attach through `Connection` records rather than arrays on the claim, so INV-007 continues to hold: backlinks are queried, never stored.

**Cost.** Two records where a transform would have kept one, and a `getByOriginBlock` lookup rather than a field read. Both are cheap; the alternative loses information that cannot be reconstructed.

---

## 5. `EntityId` accepts UUID versions 1–8

**Decision.** `EntityIdSchema` validates against a regex accepting UUID versions 1–8 plus the nil UUID. Generation stays in `lib/id.ts` and currently emits v4 via `crypto.randomUUID()`.

**Why.** Handoff §9.1 names UUIDv7 as a candidate and requires one decision. Zod's built-in `.uuid()` only accepts versions 1–5, so the existing validator would have **rejected UUIDv7** — silently foreclosing the option it was supposed to leave open. Widening the validator now means switching generators later is a one-line change in `lib/id.ts` with no schema migration and no data rewrite.

ULID is not adopted: it would need a runtime dependency during Phase 0B and a different validator.

**Cost.** Slightly weaker validation — a v6 or v8 UUID would pass. Irrelevant in practice, since only `createEntityId` mints them.

---

## 6. Temporal precision and uncertainty are separate axes

**Decision.** `TemporalPoint` carries `precision` (millennium … time) and `uncertainty` (`exact`, `circa`, `inferred`, `disputed`, `unknown`) as independent fields. Direction is carried by `era`, not by a negative year.

**Why.** These are routinely conflated and they are not the same thing. "The 3rd century" is imprecise but certain; "c. 1204" is year-precise but doubtful. One field cannot express both, and the distinction is unrecoverable once flattened — re-encoding every Atlas record later is the most expensive mistake available in this phase.

Positive years with an explicit era avoid the year-zero problem: historians' 1 BCE is immediately followed by 1 CE, with no year zero. `toComparableYear` handles the shift for ordering, and is explicitly not for persistence.

**Cost.** Two fields instead of one, and callers must not assume `precision: 'year'` implies certainty.

---

## 7. Read Aloud domain readiness without playback

**Decision.** The domain can express three positions (`activeLocation`, `listenLocation`, `furthestLocation`), an activity mode (`reading` / `listening` / `mixed`), `listenedSeconds`, `listenedLocations`, sentence-level anchors, a `listen` layout mode, an `awayMode` flag, a `playbackCapability` field, and a disposable `playbackPositionCache`. **No text-to-speech, no playback, no OCR is implemented.**

**Why.** These are additive schema fields whose absence would later require a migration. Adding them now is free.

Three points of substance:

- **`listen` is a layout mode, not a route.** Listen-Only hides the source pane but remains the same Study Workspace at `/study/:sourceId`. A route would create a fourth destination and violate INV-001 and IA-001.
- **Audio offsets are a cache, never an anchor.** Offsets shift with voice and playback speed, so a note anchored to one would point at the wrong words after a voice change. The sentence-level `TextAnchor` — quote, prefix, suffix — is authoritative.
- **`listenedSeconds` is a subset of `focusedSeconds`, not an addition.** A follow-along session is simultaneously read and listened, so summing them would double-count.

**Cost.** Fields that are unused until Read Aloud ships. Their defaults make them invisible until then.

---

## 8. Playback capability is detected at runtime and persisted

**Decision.** `playbackCapability` is `unknown` | `web-best-effort` | `desktop-reliable`, detected at runtime and persisted as a last-known value.

**Why.** The web build can only make a best effort: browsers throttle or suspend speech on hidden tabs, and behaviour differs by engine. A desktop build can guarantee background playback. Runtime detection means the same domain record survives the desktop wrap unchanged — a build-time constant would need the record to change when the packaging does.

**Cost.** A persisted value can be stale if the user moves between builds. It is advisory, and re-detected on load.

---

## 9. Fractional indexing is hand-rolled, not a dependency

**Decision.** `lib/rank.ts` implements base-62 fractional indexing. No runtime package is added.

**Why.** The previous `generateRank` returned `Date.now() + random` and ignored its `afterBlockId` argument entirely, so inserting between two blocks was impossible — block ordering was effectively broken. The replacement is about sixty lines with thirty tests, and Phase 0B should not add runtime dependencies for something that small.

Base-62 in ASCII order means plain string comparison matches rank order, so adapters sort with a comparator rather than a custom collation.

**Cost.** Code we own and must maintain. Ranks lengthen under repeated insertion at the same position; the tests cover sixty consecutive insertions between one pair of neighbours.

---

## 10. `UnitOfWork` is declared before it is needed

**Decision.** A `UnitOfWork` interface provides a cross-repository transaction boundary. The memory adapter implements it as a pass-through. `importPdf` and `promoteBlockToClaim` run inside it.

**Why.** `importPdf` writes to six places. Without a boundary, a failure part-way through leaves an asset with no source, or a source with no journal. Handoff §10 requires transactions to cross related records, and §11.1 requires rollback or a recovery record after binary storage fails.

Declaring it now means use cases are written against the boundary from the start. The memory adapter makes it invisible; Dexie will not, and retrofitting it into working code is harder than starting with it.

**Cost.** An abstraction with no teeth until Phase 0C. The interface is four lines.

---

## 11. The `application/` layer is ratified

**Decision.** Use cases live in `src/application/`. Handoff §8's `domain/<area>/*.service.ts` is superseded for orchestration logic; domain modules hold schemas and pure functions only.

**Why.** The layer already exists, has a `@application/*` path alias, and separates orchestration from domain vocabulary cleanly. Without ratification a future agent would "correct" it back toward §8.

`*.types.ts` files are also not created: types are inferred from Zod schemas via `z.infer`, which is what amendment 7 established and is strictly better than maintaining both.

**Cost.** A documented deviation from the handoff's target tree.

---

## 12. Soft deletion is real

**Decision.** `JournalBlock` and `EpistemicClaim` carry `deletedAt`. `softDeleteBlock` marks; `restoreBlock` unmarks; `listBlocks` and `getBlockCount` exclude deleted records; `listDeletedBlocks` exposes them.

**Why.** The previous `softDeleteBlock` called `Map.delete` — a hard delete under a name promising otherwise. That contradicts PDD §19.3 and NFR-008, which require a recovery path for every destructive action.

**Cost.** Every query must filter on `deletedAt`. The contract suite tests this for both adapters.

---

## 13. Atlas SDD reconciliation

**Decision.** After the Atlas System Design Document became readable, four changes were made — all primitives, no entity modelling.

**13.1 `KnowledgeEntityKind` gains `period`, `conflict` and `institution`.** The SDD's Knowledge Objects list names all three. Declaring a kind is *not* modelling an entity: this enum only says "the Atlas will have things of this sort, and here is how to point at one". Whether `conflict` ends up as its own record or an Event with a subtype is an open question for the Atlas modelling phase, and answering it differently later does not require changing this enum.

**13.2 `Source` and `Claim` are NOT added.** The SDD lists both as Knowledge Objects, but both are already first-class CNTKNW entities with their own `Reference` endpoints (`source`, `epistemic-claim`). Atlas-specific copies would fork the source and claim models — the outcome decision 4 exists to prevent. The Atlas gets both for free.

**13.3 Routes stay one kind.** The SDD lists "Trade route" and "Migration route" separately. They are the same shape — a path with waypoints and a period of use — so splitting them at reference level would force every consumer to handle two kinds that behave identically. Trade versus migration is an attribute of the Route entity when it is modelled.

**13.4 `StudyStatus` is separate from `KnowledgeStatus`.** The SDD's Knowledge filter list — *studied / not studied / needs review / disputed / personal interpretation* — mixes two different questions. `StudyStatus` answers "have I engaged with this yet"; `KnowledgeStatus` answers "how settled is the claim". A claim can be thoroughly studied and still contested, and an unstudied claim is not thereby unsettled. Collapsing them would repeat, in a different place, the precision-versus-uncertainty conflation that decision 6 exists to avoid. "Disputed" maps to `KnowledgeStatus.contested`; "personal interpretation" is expressed by an `EpistemicClaim` whose `originBlockIds` point at the user's own blocks, not by a status value.

**13.5 `GeoGeometryRef` gains `validFor` and `attribution`.** The SDD requires that *"historical borders must be time-aware and must not pretend certainty"*. A border is not a fact about a place; it is a fact about a place during an interval, usually a contested one. Geometry with no temporal extent silently asserts the shape is timeless, which for any historical boundary is false. `validFor` is optional — absent means "not time-scoped", never "valid for all time", which keeps modern coastlines honest. Uncertainty rides on the extent's own `TemporalPoint`s, so a border known only to "sometime in the 1880s" expresses that without inventing precision.

**Cost.** Three enum members and two optional fields. All additive; no migration, since no data exists in these shapes.

**Still not modelled:** Place, Person, Event, Organisation, Movement, Polity, Religion, Ideology, Commodity, Route, Region, Period, Conflict, Institution. Only the vocabulary for referring to them exists.

**Deferred to the Atlas modelling phase:**

- Place identity over time — stable identity with time-sliced names, borders and sovereignty. `validFor` on geometry is the enabling primitive; the entity shape is not decided.
- Whether `conflict` is its own record or an Event subtype.
- Whether `institution` is distinct from `organisation`.
- Whether `period` is an entity or a named `TemporalExtent`.
- Filters versus Layers as a saved-view model — the SDD draws a real distinction (filters decide what appears, layers decide how), and the Phase 1 saved-view record will need to persist both independently.

---

## Consequences

- Handoff §19 (build order), §8 (repository structure), §9.1 (`EntityId`) and §9.2 (`BookDetails`) are amended by this ADR.
- No product invariant (INV-001 … INV-015) is weakened.
- **Correction, 25 July 2026.** An earlier revision of this section claimed decisions 3, 4, 7 and 12 "strengthen INV-007, INV-013 and NFR-008". That was an overclaim on two of the three and is withdrawn:
  - **INV-007** (connections produce backlinks) — upheld, and repository-contract-tested including undirected connections.
  - **INV-013** (schema changes include migrations) — **not satisfied.** No persistence and no migration exists. A phase without an adapter cannot meet a migration requirement. Phase 0C.
  - **NFR-008** (recovery path for destructive actions) — **partially satisfied.** Soft deletion covers journal blocks and epistemic claims. Sources, annotations, connections, concepts, glossary entries and sessions still hard-delete.
- Atlas entities remain unmodelled. Only shared primitives were added.
- Read Aloud remains unimplemented. Only domain fields were added.

## Open, deferred beyond Phase 0B

- Atlas entity schemas — blocked on a readable Atlas System Design Document.
- `BlockContent.doc` versus `.text` — resolve at the editor spike (Phase 0E).
- `AnnotationGeometry` discrimination by kind — Phase 3.
- Optimistic-concurrency revision checking — Phase 0C, alongside Dexie.
- Playwright and end-to-end tests — closes the outstanding Phase 0A gap.
