# ADR-0006 — The Folio Margin

**Status:** Accepted
**Date:** 2 August 2026
**Owner:** Lazarus Petrus
**Implements:** PDD §9 (Visual and Interaction Design Bible), INV-003, INV-004, INV-005
**Supersedes:** the per-page journal pane built in Phase 0E

---

## 1. The decision

**Provenance is carried by position, not by metadata.**

The journal is one ruled leaf with a wide left margin. The page numeral is
printed in that margin, and a block belongs to page 41 for the same reason a
footnote belongs to the page it is printed on: it is set beneath the 41.

There is no field, no dropdown, no badge and no "page: 41" line, because there
is nothing to state. INV-004 — *new blocks inherit the active source location
automatically, the user is never asked* — stops being a rule the interface
politely follows and becomes the only thing the layout can express.

## 2. Structure

```
┌────────┬────────┬──────────────────────────────┐
│ folio  │  mark  │ prose                        │
│ 2.75rem│ 2.75rem│ max --cn-measure (68ch)      │
├────────┼────────┼──────────────────────────────┤
│  p.5   │        │ …a note written on page 5    │
│        │ CLAIM  │ …a claim, marked in the      │
│        │        │   margin, not tinted         │
│  ← seam: a hairline across the MARGIN only     │
│  p.41  │        │ …a note written on page 41   │
└────────┴────────┴──────────────────────────────┘
```

A **run** is one page numeral and the blocks written on that page. Both margin
lanes are 2.75rem, which is also the minimum touch target — the lanes are
usable, not merely decorative.

The prose column carries only prose. Block type lives in the mark lane
(`CLAIM`, `?`, a quote rule), so fourteen block types are distinguishable
without a single type-specific hue. PDD §9.4 asks for one accent and no
rainbow; this is how that is honoured while still telling a claim from an
objection.

## 3. Empty pages create nothing — structurally

**There is no page-header component that *could* render for an empty page.**
A run is constructed from blocks, so a page with no blocks produces no run.
INV-005 and AC-004 are therefore a property of the data structure rather than
a filter someone can forget to apply — which is why `groupBlocksByLocation`
lives in the domain and `groupForPage` returns `null` instead of an empty
group.

A 400-page book with notes on sixty pages shows sixty numerals. Not four
hundred headers with silence between them.

### The composing line

The one exception, and it persists nothing. The page the reader is *on*, if
nothing is written there yet, gets a single unsaved line at its sorted
position among the real runs — so its placement itself teaches the ordering.

It is one line of paper: a prompt in muted ink above a hairline. **The dashed
"Add a block" rectangle is deleted.** A dashed box repeated once per run reads
as a form; a ruled line reads as paper.

Leaving the page without typing leaves no trace, so INV-005 holds in the data
as well as in the view. This is checked: visit three pages, write on none,
reload, and exactly one run exists — the composing line for wherever you
landed.

## 4. Rhythm carries page distance

The gap between two runs is quantised by how far apart their pages are:
adjacent, near (2–9), far (10+). Deliberately **not** a readable quantity —
the numerals state the facts. It exists so that a jump from page 5 to page 41
*feels* like turning a sheaf, and two consecutive pages feel continuous.

## 5. Two ways to make a block, and conflating them is the trap

| | Location taken from |
|---|---|
| **Capturing** — the composing line | The page the reader is *on* |
| **Continuing** — Enter at the end of a block | The *originating block's* page |

The Phase 0E implementation used the active page for both. That is a bug
against INV-004: continuing a note about page 12 while the source shows page
40 would file the continuation under 40. Now `onSplit` inherits from the block
it was pressed in, and there is an end-to-end test that writes on page 3,
navigates to page 5, presses Enter in the page-3 note, and asserts the sibling
landed on 3.

## 6. Consequences

- **The journal is no longer keyed on the page.** Keying it was correct when
  the pane showed a single page's notes; with a continuous journal it
  remounted and re-read everything on every page turn, and dropped any edit
  still inside the save debounce.
- **`.cn-split__pane` clips instead of scrolling.** Each pane's content owns
  its own scrollport, because a `position: sticky` folio pins to its nearest
  scrolling ancestor — if the pane scrolled, every numeral would stick to the
  wrong container.
- **New tokens for the paper plane.** `--cn-border-subtle` is tuned for canvas
  and surface and is very nearly invisible against paper, so the reading plane
  gets `--cn-rule-paper`, `--cn-rule-paper-strong`, `--cn-paper-hover`,
  `--cn-paper-active` and `--cn-paper-inset`. All derived from `--cn-ink`, so
  they invert with the theme and need no light-mode redeclaration. Three of
  them *remove* `color-mix` values previously inlined in `journal.css`.
- **`--cn-delay-status` and `--cn-dwell-status` are deliberately not named
  `--cn-duration-*`** and are deliberately outside the reduced-motion collapse:
  they govern how long something stays *legible*, not how fast it moves.
  Shortening them would harm exactly the people that preference protects.

## 7. What was rejected

- **A page field, picker or badge on each block.** The entire idea. If a
  `combobox`, `spinbutton` or `select` ever appears in the journal, the first
  test in `journal.spec.ts` fails — the invariant is a promise about what the
  interface does *not* contain, so it is tested as an absence.
- **A full-width rule between runs.** It turns a journal into a stack of
  cards, which is the dashboard reading PDD §9.1 rejects. The seam crosses the
  margin only.
- **Type-specific colours for block kinds.** Fourteen hues is the rainbow
  PDD §9.4 forbids. Distinction comes from marginal marks, indentation,
  weight, rule texture and whitespace.
- **A page number in the running head.** It lives in the margin now. Printing
  it twice would make the header authoritative and the margin decorative,
  inverting the whole idea.

## 8. Provenance of this design

Produced by a panel of four independent design proposals judged against PDD §9
fidelity, implementability within the token system, and reading ergonomics.
The panel was cut short by a session limit after three proposals completed and
before the judging stage ran, so **the synthesis here is the agent's, not a
panel verdict** — this design is "The Folio Margin" proposal, adopted on its
merits and on its fit with the invariants, with the judging step never
performed. Recorded because a design presented as the output of a process that
did not finish would misrepresent how much scrutiny it has had.

The other two completed proposals — a reading-room angle and a library-at-scale
angle — remain unincorporated and are worth revisiting for the Library route.
