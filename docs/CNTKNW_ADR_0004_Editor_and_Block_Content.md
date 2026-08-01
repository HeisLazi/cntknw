# ADR-0004 — Editor and Block Content

**Status:** Accepted
**Date:** 1 August 2026
**Owner:** Lazarus Petrus
**Resolves:** Open decision 7 (`BlockContent.doc` versus `.text` duplication)
**Depends on:** ADR-0001, ADR-0002, ADR-0003

The editor spike closes the last open decision from Phase 0B. Five choices,
each stated with what it costs and what it prevents.

---

## 1. `doc` is authoritative; `text` is derived

**Decision.** For paragraph content, `doc` (a rich JSON document) is the source
of truth. `text` (a flat string) is a projection of it, computed by
`plainTextOf` and materialised at the write boundary.

**Why.** The two representations already existed side by side, marked
"resolved at the editor spike". Making them peer fields — either authored
separately — is the shortest path to them silently disagreeing. IndexedDB
cannot index through a JSON tree, and search, Read Aloud and list views need
plain text without parsing one; keeping `text` is not optional. What is
optional is who *writes* it, and the answer is nobody.

**Cost.** Every write to `doc` recomputes `text`. Cheap for a paragraph,
irrelevant beside the write itself.

**Enforced by construction.** The `CreateBlockInput` and `UpdateBlockInput`
schemas apply `deriveBlockText` as a Zod transform, so both adapters — memory
and IndexedDB — run it at the repository boundary. Every write path there is,
including a migration or an import, has `text` overwritten from `doc` before
the record lands. A caller that sets `text` directly is ignored, not honoured.

**Why a transform on the input schemas rather than on the content union.**
`BlockContent` is a `discriminatedUnion`, and Zod requires plain object
options. Adding a transform there would turn one option into an effect and
break discrimination for every other block type.

---

## 2. ProseMirror

**Decision.** ProseMirror for the rich text — `prosemirror-state`, `-view`,
`-model`, `-keymap`, `-commands`, `-history`.

**Why.** Tiptap and Lexical were the alternatives. Tiptap is a Vue-first
wrapper over ProseMirror that adds indirection without adding capability; a
philosophy journal will run for a decade and touch the schema more than
once, so working directly with the underlying model is a smaller ongoing
tax than working through a wrapper's abstractions. Lexical is Facebook's
newer editor with strong React ergonomics, but its model is opinionated in
ways that would fight this project's block architecture — its document is a
tree it owns, and CNTKNW's blocks are separate records with their own
identity that CNTKNW owns.

Contenteditable directly was considered. A philosophy journal needs
italics, emphasis, inline code for citations and, later, inline links to
concepts and passages — losing any of those is a real loss. Hand-rolled
contenteditable gets input methods, selection restoration and undo wrong on
mobile browsers in ways that are ruinous to debug.

**Cost.** ~140 kB added to the Study Workspace chunk (which is lazy — the
Library, Gallery and Notes routes pay nothing). One more mental model to
carry: ProseMirror's transactional state is not React's, and the two must not
both own the same DOM.

---

## 3. ProseMirror edits one block. It does not own the journal.

**Decision.** The editor schema declares one block-level node — `doc` →
`paragraph` — plus inline text and three marks (em, strong, code). It has no
list, no heading, no second paragraph. Pressing Enter in a block calls back
to CNTKNW to start the next block; the schema literally cannot split one.

**Why.** A ProseMirror document that owned the whole journal would
immediately fight the model everything else depends on. Blocks are separate
records with their own id, rank, revision, source location, concept links and
soft-delete state (INV-003, INV-004, INV-006). A single ProseMirror document
would either lose those or force them into node attributes, where a
repository cannot query them and a `ConcurrencyGuard` cannot protect them.

INV-004 alone is enough: **the location a block belongs to is inherited from
where the reader is on the page**. In CNTKNW that is a repository field on
the block record. Inside a single ProseMirror document there is no per-block
location — there are node positions relative to the doc, and no way for the
editor to know a page context that changes as the reader scrolls the source.

**Cost.** Block-level structure (headings, lists) needs component-level UI
rather than an editor keystroke. That is Phase 2 work, and it is where it
belongs.

---

## 4. React does not render the editable area

**Decision.** `BlockEditor` mounts a ProseMirror view into an empty container
once, in an effect. React never re-renders into that container after. Prop
changes flow through a callback ref that is synced in an effect, so the
handlers stay current without rebuilding the view.

**Why.** ProseMirror and React are both DOM authorities, and two authorities
over one DOM disagree. A component that re-rendered into the ProseMirror
container would destroy the selection on every keystroke. Rebuilding the view
on every prop change would lose focus and undo history, and interrupt input
mid-composition on languages that need it — the kind of bug that reproduces
only for people it is expensive to lose.

The `doc` prop is the *initial* value; after that the editor holds the
authority for its own text. Pushing a new document back in mid-typing would
move the caret to the start on every autosave round-trip.

**Cost.** A stale-closure trap without the effect-synced ref. Documented at
the ref declaration.

---

## 5. The stored doc is an open record; editor coupling stops at one module

**Decision.** `RichDocSchema` in the domain is `z.record(z.unknown())` —
untyped by ProseMirror. `plainTextOf` walks it structurally, expecting
`text` leaves and `content` arrays and nothing else.

**Why.** The domain must not depend on the editor. If ProseMirror is ever
replaced, `doc` stays a tree of nodes with text leaves and `plainTextOf`
keeps working. Tightening the domain to ProseMirror's exact node schema would
couple the *stored* shape to a library version.

The editor coupling is confined to `src/features/journal/`. Nothing in
`src/domain`, `src/data` or `src/application` imports from `prosemirror-*`,
and `architecture.test.ts` fails if that ever changes.

**Cost.** The domain type of `doc` is looser than it could be. A stored
document that is not valid ProseMirror JSON will fail to parse in the editor
— which is why `docFromJSON` returns a paragraph with the plain-text
fallback rather than throwing, so a block with unparseable formatting still
shows its words.

---

## 6. Autosave: same shape as workspace state, one deliberate difference

**Decision.** The journal uses the same debounced, guarded write pattern
established by `useWorkspacePersistence` — one save per block, held for
~700ms, guarded on the revision actually read.

**The difference.** Workspace state re-applies on conflict, because reading
position belongs to the window in use. **A journal block does not.** A
conflict surfaces to the user with a "reload the block" affordance, because
two windows editing the same sentence is a real disagreement, and picking a
winner silently would lose somebody's words.

**Why.** ADR-0003's coverage note explicitly said the auto-reapply pattern
in `useWorkspacePersistence` was specific to that one record and not a
template. This is the second use of the guard, and it takes the opposite
choice for the opposite reason.

**Cost.** A user editing the same block in two windows sees a warning and
has to pick. That is the right cost.

---

## 7. Consequences

- Open decision 7 is closed. `doc` authoritative, `text` derived, transform
  at the input boundary.
- The domain of `BlockContent` is unchanged; only the write path acquires a
  structural guarantee about the relationship between its fields.
- `docFromJSON` tolerates stored content that will not parse, so a schema
  change or a broken migration degrades gracefully instead of catastrophically.
- One new production dependency (six ProseMirror packages). `npm audit
  --omit=dev` remains 0.
- Study Workspace chunk grows by ~140 kB — carried by the route that needs
  it, not by the whole application.

## 8. Deferred

- Block-level structure (heading, quote, list) — Phase 2, on top of this.
- A menu bar or slash-commands for marks and block types — Phase 2.
- Selection-to-quote (a passage on the page becomes a quote block) — Phase 3,
  needs the annotation layer.
- Inline links to concepts and passages — Phase 4.
- Collaboration (`prosemirror-collab`) — never in scope for a local-first,
  single-user application. Recorded so it is not proposed again.
