# ADR-0003 — Mandatory Concurrency Guards

**Status:** Accepted
**Date:** 26 July 2026
**Owner:** Lazarus Petrus
**Supersedes:** ADR-0002 §4 (Optimistic concurrency by expected revision)
**Depends on:** ADR-0001, ADR-0002
**Register entry:** A-016

---

## 1. The decision

Every mutating repository method that touches a **revisioned** record takes a
mandatory `ConcurrencyGuard`:

```ts
type ConcurrencyGuard =
  | { mode: 'expected'; revision: Revision }
  | { mode: 'unconditional'; reason: 'migration' | 'repair' };
```

- `create` takes no guard. There is nothing stored to overwrite.
- `update`, `delete`, `softDelete`, `restore`, `archive`, `unarchive` and
  `moveBlock` **require** one.
- Application code uses `expectedRevision(n)`.
- `unconditionally('migration' | 'repair')` is the only override, and it must
  be written out at the call site.
- **Omission never means last-write-wins.** There is no argument a caller can
  leave out to get the old behaviour back.
- A stale guard throws `RevisionConflictError`; the stored record is left
  exactly as it was.
- Memory and IndexedDB adapters behave identically, and the same contract
  suite proves it against both.

## 2. Why ADR-0002 §4 is superseded

ADR-0002 §4 made `expectedRevision` an optional final parameter and stated
that omitting it retained last-write-wins "for callers that genuinely do not
care". Its own **Cost** paragraph named the flaw: *"A guarantee that must be
opted into can be forgotten."* The mitigation offered — making the parameter
explicit in the interface rather than hiding it in an options bag — makes an
omission *visible to a reader*, which is not the same as *preventing* one.

That leaves an ordinary, fully typed, lint-clean, test-passing repository call
that silently overwrites newer user content. Handoff §13.3 requires that a
newer revision is never silently overwritten. A rule that holds only when
every author at every call site remembers it is not a rule the system
enforces; it is a convention, and conventions are what the audit exists to
find.

The reasoning in ADR-0002 §4 was also narrower than it appeared. It argued
that Phase 0B's use cases read and write inside one transaction and have no
stale-read window. Two of them did not:

- `promoteBlockToClaim` reads the block **before** opening the transaction and
  updates it inside — a genuine read-then-write gap across user time.
- `linkBlockToExistingClaim` does the same with both the block and the claim.

Both now pass `expectedRevision(...)` from the record they actually read. The
change did not merely satisfy a type; it closed two real windows in the only
two use cases that had one.

## 3. What "mandatory" means at runtime

TypeScript makes the argument required, and that is erased at build time. A
JavaScript caller, a bad cast, or a value that arrived through `JSON.parse`
would sail past it. `assertRevision` therefore rejects a missing or malformed
guard with a `TypeError` rather than treating it as permission to proceed.

The contract suite asserts this directly: an untyped call with the guard
omitted throws, and the stored record keeps its newer content. Without that
case, "mandatory" would be a claim about the compiler rather than about the
system.

## 4. Coverage, stated exactly

| Entity | Guarded methods | Note |
|---|---|---|
| `Source` | `update`, `archive`, `unarchive`, `delete` | archive/unarchive bump the revision, so they are updates in substance |
| `Journal` | — | revisioned, but **no mutating method exists** in this phase; see §6 |
| `JournalBlock` | `updateBlock`, `moveBlock`, `softDeleteBlock`, `restoreBlock` | |
| `Annotation` | `update`, `delete` | |
| `Connection` | `delete` | revisioned; no update method exists |
| `Concept` | `update`, `delete` | |
| `GlossaryEntry` | `update`, `delete` | |
| `EpistemicClaim` | `update`, `softDelete`, `restore` | |
| `StudySession` | `update`, `delete` | the mutable record a running timer writes back to |
| `WorkspaceState` | `create` (unguarded), `update`, `delete` | see §5 |

**Not guarded, and why:** `Asset` is immutable and carries no revision
(ADR-0001; a stored binary is replaced, never edited). `SourceAsset` is a pure
join record. `BookDetails` and `ArtworkDetails` are unrevisioned satellite
records keyed by `sourceId`. None of them has a revision for a guard to check,
so requiring one would be ceremony of exactly the kind ADR-0002 §4 warned
against — the difference is that here the absence is a property of the schema,
not a decision a caller can get wrong.

**Deletes are idempotent when the record is already absent.** Nothing stored
means no newer revision to destroy, so the guard has nothing to protect and
the call returns without error. The guard is enforced whenever a record *is*
present. `update` continues to throw `RecordNotFoundError` when the record is
absent, unchanged from Phase 0C.

## 5. `WorkspaceState.upsert` is split into `create` and `update`

An upsert cannot honour a mandatory guard. On the insert branch there is no
stored revision the caller could have read, so any guard it passed would be a
fiction; on the update branch a guard is required. Deciding which branch
applies by looking at whether a row happens to exist is the same read-then-write
race the guard exists to catch.

So the caller states its intent instead:

- `create(state)` — no guard, throws `RecordAlreadyExistsError` if a state is
  already stored for that source.
- `update(state, guard)` — guard required, throws `RecordNotFoundError` if
  none is stored yet.

`importPdf` mints the source a few lines above the call, so it uses `create`.
This is the clearest case for the guard in the codebase: a debounced autosave
and the workspace itself write the same record, separated by user time.

**Cost.** Callers must know which they are doing. That is the intent — a save
path that does not know whether it is creating or updating does not know
enough to be safe.

## 6. `Journal` has no unguarded write path

`Journal` is revisioned, and the audit brief lists it as requiring coverage.
There is no `updateJournal` or `deleteJournal` on `JournalRepository`: a
journal is created with its source and never edited or removed through this
interface. There is therefore no unguarded path to close, and none has been
invented to satisfy a checklist. The interface records the rule so a future
author cannot add one without meeting it.

## 7. Cost

A guard at every mutating call site is more typing, and every caller now has
to hold the revision it read. That is the price of the guarantee, and it is
the right one: the alternative is a guarantee that holds until somebody
forgets.

`RecordAlreadyExistsError` is added to the typed storage errors, with kind
`already-exists`.

## 8. Consequences

- ADR-0002 §4 is superseded in full. It is not edited; it stands as the record
  of what was decided and why it was wrong.
- The Phase 0C contract suite grows from 53 to 62 cases per adapter, adding
  stale delete, stale soft-delete, stale restore, explicit unconditional
  override, unguarded-call rejection, cross-entity guard parity, and the
  workspace create/update split.
- Handoff §13.3 moves from *convention* to *enforced*.
- No product invariant is weakened.

## 9. Deferred

- A helper for read-modify-write in one call (`updateWith(id, fn)`) that
  supplies the guard from the record it just read. Attractive, but it hides
  the revision again, and the point of this ADR is that the revision should be
  visible. Revisit once the autosave path exists in Phase 2.
