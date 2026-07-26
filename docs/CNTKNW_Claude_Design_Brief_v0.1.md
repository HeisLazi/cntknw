# CNTKNW — Brief for Claude Design

**Date:** 27 July 2026
**Status:** Working brief. Not canonical; it restates approved decisions for a design tool.
**Use:** Paste §§1–9 into Claude Design. §10 lists the specific screens to ask for.

> **What this is for.** The engineering foundation is built and tested. What it
> lacks is *visual design* — layouts, hierarchy, the feel of the reading room.
> This brief gives Claude Design everything it needs to produce layouts that
> can actually be implemented against the existing token system, rather than
> mockups that would have to be argued with.
>
> **Two rules for whoever uses the output.** A layout that violates §4 is
> wrong, not a proposal — those are product invariants, not preferences. And
> every colour, size and duration in an implemented design must resolve to a
> token in §6; a design that needs a new value needs a new *token*, named and
> added, not a hex code in a component.

---

## 1. What CNTKNW is

A **local-first personal knowledge museum and study studio**, for one person
studying philosophy, history and art seriously over years.

Everything is on the user's own machine. No account, no sync, no cloud. You
import a PDF, read it, and write alongside it; what you write stays attached to
the page it came from, forever, and can be connected to anything else you have
written.

It is **not** a note-taking app with a PDF viewer bolted on, and not a research
dashboard. The closest real-world analogues are a private library, a museum's
study room, and a scholar's marginalia — not Notion, not Zotero, not a SaaS
product.

## 2. The feeling to design for

From the product design document, verbatim:

> CNTKNW should feel like a quiet private museum, an archival reading room, and
> a researcher's notebook — not a corporate project dashboard.

Keywords: **scholarly, intimate, tactile, collected, calm, precise, premium,
lived-in without becoming messy.**

Beauty should come from generous but efficient spacing; strong typographic
contrast; consistent alignment; legible text measure; subtle surfaces and
borders; carefully cropped covers and artwork; meaningful density changes;
restrained animation; context-aware previews.

**Explicitly rejected:** dashboard aesthetics, KPI cards, progress rings,
gamification, streaks, badges, a rainbow block palette, saturated status
chips, gradient hero sections, emoji as iconography, "Welcome back, Lazarus 👋".

**A useful test.** If a screen would look at home in a project-management tool,
it is wrong. If it would look at home printed and pinned above a desk in a
university library, it is close.

## 3. The person

One user. Not a team, not a persona set. He reads difficult books slowly and
returns to them over years. He is not in a hurry, he is not being measured, and
nothing in the interface should imply either. He is on a laptop most of the
time, occasionally a tablet, rarely a phone.

He will use this for a decade. Design for the state where the library has 400
sources and 20,000 journal blocks, not the empty state.

## 4. Invariants — a design that breaks these is wrong

These are product invariants with identifiers, enforced by automated tests in
the codebase. They are not open to design preference.

| ID | Invariant | What it means for layout |
|---|---|---|
| **INV-001** | **Exactly three primary destinations: Library, Gallery, Notes.** | Permanent navigation contains three items. Not four. Settings, Search, Sessions, Whiteboard, Dictionary, Export, Chess and Atlas are **never** promoted. |
| **INV-002** | **Books and artworks share ONE Study Workspace.** | There is no separate artwork viewer. Both open at the same route into the same two-pane layout. |
| **INV-003** | Each source has one continuous journal. | Not per-chapter notebooks. One scroll, from the first page to the last. |
| **INV-004** | New blocks inherit the active source location automatically. | The user never picks "which page is this note about". The UI must show the inherited location, never ask for it. |
| **INV-005** | Empty pages create no visible journal section. | The journal shows only where writing exists. No 400 empty page headers. |
| **INV-006** | Journal, outline, cards and maps use the same canonical blocks. | Alternate views are *views*, switched by local tabs inside a route. They never become destinations. |
| **INV-007** | Explicit connections produce backlinks. | Backlinks are shown, never authored. |
| **INV-009** | Core study capability works offline. | No design may depend on network state, avatars, or remote content. |
| **INV-010** | Manual focus timing is the default. | Timers are opt-in and quiet. Never a countdown, never a nag. |
| **INV-011** | 3D is optional and never gates content. | The immersive library is a later view, never the only way in. |

**The Atlas** — a geographical and temporal view of the same knowledge — is a
*room inside the Library*, not a fourth tab.

**Read Aloud's Listen-Only** is a *layout mode of the Study Workspace*, not a
destination. Entering it hides the source pane; the URL does not change.

## 5. Information architecture as built

```
/                    → redirects to /library
/library               Books. Primary destination 1.
/gallery               Artworks. Primary destination 2.
/notes                 Everything written, across all sources. Primary destination 3.
/study/:sourceId       The Study Workspace. Books AND artworks. Not primary.
/settings              Secondary.
```

**Study Workspace** is the centre of gravity — it is where the hours are spent.
Library, Gallery and Notes are ways in and out of it.

Current shell: a left rail on desktop (15rem, labelled links), a narrow icon
rail on tablet, and a bottom bar on phone. The wordmark and secondary links
drop on phone; the three destinations never do.

## 6. The token system — the design must land inside this

Implemented in `src/design/tokens.css`. Two layers: a raw palette nothing
consumes directly, and semantic roles that everything consumes. **Light mode
redefines only the semantic layer**, so a design must express itself in roles,
not in specific colours.

### Colour roles

| Role | Purpose |
|---|---|
| `canvas` | Deep neutral application background |
| `surface`, `surface-raised`, `surface-sunken` | Panels, cards, toolbars, wells |
| `paper` | The reading and writing plane |
| `ink`, `ink-strong`, `ink-muted`, `ink-subtle` | Text, by weight of importance |
| `border`, `border-strong`, `border-subtle` | Separation |
| `accent` | Selection, focus, links, active tools. **One accent.** |
| `success`, `warning`, `danger` | Saved states; storage attention; destructive only |

The palette is **warm neutral**, not blue-grey — hues between 30° and 45°, low
chroma. A cool grey reads as software; the reading planes need to feel like
paper under a lamp. The accent is a **muted verdigris** (library-binding
green), deliberately not hyperlink blue.

Dark mode is the primary design target. Light mode exists structurally and has
**not** been designed — designing it properly is a task worth asking for.

### Typography

- **UI sans** — Inter or equivalent, for chrome.
- **Editorial serif** — Source Serif 4 / Literata or equivalent, for headings,
  quotations and reading-oriented display. Headings currently use the serif.
- **Mono** — for citations, identifiers, page numbers.
- Scale: 1.2 minor third from a 16px base — 11, 12, 14, 16, 18, 22, 28, 36, 48.
- **Journal body measure: 60–75 characters** (`--cn-measure: 68ch`). This is a
  hard requirement, not a suggestion.
- Source text and journal text have **independent** zoom controls.
- Headings earn hierarchy through **scale and spacing before colour**.
- Italics and low-contrast text are never used for essential information.

**No cloud-hosted fonts** (NFR-006). Anything specified must be self-hostable.

### Spacing, radius, motion

Spacing 2 / 4 / 6 / 8 / 12 / 16 / 24 / 32 / 48 / 64px. Radius 2 / 4 / 6 / 10 /
16 / full. Motion 80 / 140 / 220 / 380ms, all non-bouncy easing, all collapsed
to 1ms under `prefers-reduced-motion`.

Motion must **explain state**: a new block unfolds and takes the cursor; a
selection becomes a quote card through a short spatial transition; a backlink
reveals its origin rather than teleporting; autosave indicators fade rather
than flash.

### Non-negotiable accessibility constraints

- **Meaning is never carried by colour alone.** Every state colour signals must
  also be signalled by a glyph, a weight, a border, or a label.
- Minimum touch target **44px**.
- Visible focus ring on everything, one ring everywhere.
- Text must survive the user setting a 24px browser default without clipping.
- Panels resizable by **keyboard** as well as by drag.

## 7. What already exists, visually

So that designs extend rather than contradict it.

**Primitives implemented:** Button (4 variants × 3 sizes), IconButton, Input,
Select, Textarea, Dialog, ConfirmDialog, Popover, Tooltip, CommandPalette,
Tabs, SplitPane, ResizablePanel, Surface/Card, Toast, EmptyState, Menu,
ScrollArea, FocusRing.

**Screens implemented, plainly:**

- **Library** — a header, a dashed drop zone with a "Choose a PDF" button, and
  a responsive grid of source cards showing title, author and reading progress.
- **Study Workspace** — a thin bar with the source title and a save indicator,
  then a draggable 50/50 split: PDF reader left (sticky toolbar with page
  controls, page counter, zoom controls; pages on a warm-white plane with a
  soft shadow), journal placeholder right on the `paper` plane.
- **Gallery, Notes, Settings** — headers and empty states only.

**These are functional, not designed.** They are correct and plain. The
opportunity is to make them feel like the room described in §2.

## 8. What is deliberately not built yet

Do not design around the assumption these exist: the journal editor, block
types, annotations and drawing, the dictionary, search, the mind map, the
Atlas, Read Aloud playback, sessions and statistics, backup and restore, the 3D
library, chess.

Designs *may* anticipate them — that is useful — but must be clear about what
is speculative.

## 9. How to hand designs back

For each screen, produce:

1. **Desktop layout at 1440×900** — the primary target.
2. **Tablet at 834×1112** and **phone at 375×812**, where they differ
   meaningfully. Phone is not a shrunken desktop: it prioritises navigation and
   light reading over imitating the two-pane workspace.
3. **A note per screen on which token roles are used where.** "Panel background
   = `surface-raised`, hairline = `border-subtle`" is directly implementable;
   "dark grey card" is not.
4. **Empty, loading and error states** for anything that loads. Each empty
   state teaches exactly one next action (PDD §9.8).
5. **A rationale paragraph** — what the layout is doing for a reader and why.
   If a choice trades something away, say what.

---

## 10. Screens to ask for, in priority order

### Priority 1 — the Study Workspace

The most-used screen by an order of magnitude. Everything else can wait.

- **The reading state.** Source pane and journal pane, split. How does the
  split feel — is the divider a hairline, a gutter, a handle? How does the
  journal's 68ch measure sit inside a resizable pane? Where do the page
  controls live so they are reachable without stealing attention from the text?
- **The relationship between the two panes.** A note written on page 5 belongs
  to page 5 (INV-004). How is that shown — a location marker on the block, a
  spatial alignment between pane and page, a sticky page header in the journal?
  This is the single most important design problem in the product.
- **Layout modes.** `split` (default), `source-focus`, `journal-focus`,
  `compare`, `listen`. How does one become another? Motion should explain the
  change.
- **The save indicator.** It must be reassuring and nearly invisible. PDD
  asks it to fade rather than flash.

### Priority 2 — Library

- The grid at **three sources and at four hundred**. The second is the real
  problem, and the one most designs skip.
- The source card: cover, title, author, progress, last read. What is on it,
  what is only on hover, what is only on the detail view.
- Import as a first-class, permanent affordance that does not shout.
- Sorting and grouping without adding a fourth destination or a filter bar that
  dominates the page.

### Priority 3 — the journal block system

Even though the editor is unbuilt, the *visual language* of blocks is worth
designing now, because it constrains everything after it. From PDD §9.5:

- Paragraphs mostly unboxed.
- Quotes: indentation, source markers, subtle paper contrast — not a card.
- Questions: a small icon or label, not a saturated card.
- Definitions: term first, then layers of meaning.
- Connections: direction and relationship label visible.
- Page/location headers: sticky, compact, collapsible.

Fourteen block types exist in the domain. The design problem is making them
distinguishable **without** a rainbow — hierarchy through indentation, weight,
marginal marks and whitespace.

### Priority 4 — Notes and Gallery

- **Notes** — everything written, across every source. The hard part is
  showing provenance (which source, which page) without the list becoming a
  table of metadata.
- **Gallery** — artworks. Different from Library because the image *is* the
  content. Crop and scale matter more than the card.

### Priority 5 — light mode

The token structure supports it; the design does not exist. "Paper under a
lamp" is the brief, and it is a different problem from inverting the dark
theme.

---

## 11. A short prompt, if you want to start narrow

> I am designing CNTKNW, a local-first personal knowledge museum and study
> studio for one person studying philosophy and art seriously over many years.
> It should feel like a quiet private museum, an archival reading room and a
> researcher's notebook — scholarly, intimate, calm, precise. Never a project
> dashboard: no KPI cards, no progress rings, no streaks, no saturated status
> chips.
>
> Design the **Study Workspace** at 1440×900, dark mode. A resizable split: a
> PDF reader on the left, and on the right a single continuous journal on a
> warm paper-coloured plane, its text set at a 68-character measure in an
> editorial serif.
>
> The central problem: a note written while page 5 is on screen *belongs* to
> page 5, permanently and automatically — the user is never asked which page a
> note is about. Show me how the journal expresses that relationship to the
> source, and how page boundaries appear in a continuous scroll **only where
> writing exists** — pages with no notes create no visible section at all.
>
> Palette: warm neutral darks (hues 30–45°, low chroma), one muted verdigris
> accent, warm off-white paper. Hierarchy from typographic scale, spacing and
> alignment — not from colour. One accent only. Meaning must never be carried
> by colour alone.
>
> Give me the layout, a note on which surface and text roles you used where,
> and a paragraph on what the design does for a reader.
