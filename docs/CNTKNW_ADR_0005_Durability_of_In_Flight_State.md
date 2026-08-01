# ADR-0005 — Durability of In-Flight State

**Status:** Accepted
**Date:** 1 August 2026
**Owner:** Lazarus Petrus
**Amends:** ADR-0003 §9 (deferred read-modify-write helper), ADR-0004 §6
**Prompted by:** a measured data-loss defect, not a design review

---

## 1. The defect

Reading position was persisted with a 600 ms debounce. A reload inside that
window did not merely leave the position stale — **the write never happened at
all**, and the source reopened at page 1.

Measured, not inferred. A probe reloaded the page at fixed delays after turning
to page 3:

| Delay before reload | Page on reopening |
|---|---|
| 0 ms | **Page 1** |
| 200 ms | **Page 1** |
| 400 ms | **Page 1** |
| 800 ms | Page 3 |
| 1500 ms | Page 3 |

A reader who turns a page and immediately closes the laptop is not doing
anything unusual. They are doing the single most common thing there is.

This surfaced as an apparently flaky end-to-end test, and had been recorded as
"a race between the workspace and journal autosave loops". **That diagnosis was
wrong.** There was no race between the two loops; there was one loop losing
writes, and the test was correct to fail. The wrong diagnosis is recorded here
because a plausible-sounding explanation that stops the investigation is more
dangerous than no explanation.

## 2. Not everything that changes is the same kind of change

**Decision.** Workspace state is written through two distinct paths:

| | `drift` | `commit` |
|---|---|---|
| For | Continuous change — scrolling, dragging a divider | Discrete, deliberate change — a page turn, a zoom step, a layout change |
| Behaviour | Debounced (600 ms) | Written promptly |
| Rationale | Dozens of events per second; one write each is a storm for no benefit | One event per decision; the user expects it to have counted |

**Why the distinction is in the API rather than in a flag.** A boolean
`immediate` parameter would be forgettable in exactly the way ADR-0003 showed
an optional concurrency guard was forgettable. Two named methods make the
caller state which kind of change they are making, and a reader of the call
site can see it without looking anything up.

**Cost.** Callers must classify their changes. That is the point — a caller who
cannot say whether a change is continuous or discrete does not yet understand
what they are persisting.

## 3. Writes are serialised

**Decision.** Outstanding writes chain through a single promise rather than
firing concurrently.

**Why.** Two overlapping writes each read the same `revision.current`, so the
second conflicts with the first — a self-inflicted `RevisionConflictError` that
the recovery path then has to clean up. Turning a page four times quickly is
enough to trigger it. Serialising removes the case rather than handling it.

**Cost.** None at this rate. Writes are user-paced.

## 4. Text cannot be fixed the same way, so it gets a write-ahead buffer

**Decision.** Journal text keeps a debounce — shortened from 700 ms to 400 ms —
and additionally writes every keystroke synchronously to `localStorage` under
`cntknw:journal-drafts:v1`. On load, any surviving draft is replayed through
the ordinary guarded save path. Each entry is deleted the moment its durable
write succeeds.

**Why not the §2 fix.** A repository write per keystroke would be absurd, so
text must be debounced, so there is always a window in which typed words exist
only in memory.

**Why `pagehide` alone is not enough.** An IndexedDB write started during
`pagehide` is asynchronous, and the browser may discard the page before it
completes. This was measured: with a `pagehide` flush in place, a reload
immediately after typing still lost the sentence. `localStorage` is the one
storage API that is **synchronous** — by the time the handler returns, the
write has either happened or not.

**This is not a second source of truth, and the design must keep it from
becoming one.** IndexedDB holds the journal. The buffer holds only keystrokes
that have not reached IndexedDB yet, it is emptied on every successful write,
and its normal state is empty. Recovery is not a privileged write path: a
replayed draft goes through the same `expectedRevision` guard as any other
edit.

**Failure is non-fatal by construction.** Private browsing, a storage quota, a
disabled API — every entry point swallows its error and degrades to "no
recovery". A failure to buffer must never become a failure to edit, and that is
tested directly.

**Cost.** One small piece of state outside the repositories, and the discipline
to keep it small. Justified because losing typed words is the worst failure
this application can have: everything else it stores can be recreated by
reading the book again.

## 5. Consequences

- The end-to-end test that had been weakened to a same-session assertion is
  restored to its full form: write on page 3, navigate, reload, and find both
  the position and the note where they belong.
- `e2e/shell/durability.spec.ts` reloads at 0 ms, 200 ms and 400 ms after a
  page turn. Those delays straddle the old debounce window deliberately: if
  anyone reintroduces debouncing on a discrete action, the first two fail.
- `useWorkspacePersistence` gains a `pagehide` and `visibilitychange` flush as
  a safety net under the real fix, not as the fix.
- 12 new tests: 4 on the workspace split and serialisation, 8 on the buffer.

## 6. What this changes about how the project reasons

Two rules earned by this defect, both general:

1. **A debounce is a decision about acceptable loss.** Every debounced write
   should be able to answer "what is lost if the process dies now, and is that
   acceptable?" For a scroll offset, yes. For a reading position, no. For a
   sentence, absolutely not.
2. **An intermittent test failure is a hypothesis about the product, not about
   the test.** This one was filed as test flakiness and was real data loss. The
   cost of investigating a flake is an hour; the cost of dismissing one is
   however long it takes a user to notice their work vanishing.
