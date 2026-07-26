# CNTKNW v0.2 - Read This First

This package is the canonical documentation set for CNTKNW as of 24 July 2026.

## Read order

1. `CNTKNW_Product_Design_Document_v0.2.md`
2. `CNTKNW_AI_Implementation_Handoff_v0.2.md`
3. `CNTKNW_Requirements_v0.2.json`

The DOCX and PDF versions are for human review and presentation. The Markdown and JSON files are the preferred context for coding agents.

## Source-of-truth order

1. The user's latest explicit decision.
2. Product Design Document v0.2.
3. AI Implementation Handoff v0.2.
4. Approved later Architecture Decision Records.
5. Existing prototype behaviour.

## First safe engineering step

Do not begin with 3D, chess, AI, or additional feature pages. Begin with the Phase 0 foundation reset and migration dry run described in the handoff.

## Important limitation

These documents reduce ambiguity and provide gates, tests, and data contracts. They cannot guarantee defect-free implementation. Agents must inspect the real repository, run tests, and report failures honestly.


---

# PART I - PRODUCT DESIGN

# CNTKNW Product Design Document

**Version:** 0.2  
**Status:** Canonical living specification  
**Owner:** Lazarus Petrus  
**Updated:** 24 July 2026  
**Supersedes:** CNTKNW Product Design Document v0.1

> **Source-of-truth rule:** Future prompts, design proposals, code changes, and AI-agent plans must surface any conflict with this document. Requirements may not be silently removed, weakened, renamed, or reinterpreted.

> **Scope of certainty:** This document is designed to remove ambiguity and implementation drift. It cannot guarantee that software will be built without defects. It defines the architecture, sequencing, tests, and guardrails required to make defects less likely and easier to detect.

## 1. Executive Summary

CNTKNW is a local-first personal knowledge museum and study studio. It combines serious source reading, visual analysis, journaling, drawing, vocabulary learning, and connected thinking without forcing the user to jump between a PDF reader, dictionary, whiteboard, notes app, and mind-map tool.

The product has only three primary destinations:

1. **Library** - books, papers, PDFs, collections, timelines, and the future immersive library.
2. **Gallery** - artworks, art history, comparison, visual annotation, and the future immersive museum.
3. **Notes** - complete journals, individual blocks, themes, glossary, connections, and visual maps.

Books and artworks open into one shared **Study Workspace**. The source appears beside one continuous journal. New text, quotations, drawings, questions, definitions, annotations, and links automatically inherit the active source context. While the user studies page 5, new journal material belongs to page 5 without asking the user to categorise it again.

CNTKNW's central advantage is not the number of features. It is the removal of context switching:

```text
Open a source
-> read, look up, highlight, draw, question, connect, and reflect
-> close the source
-> return later to the exact intellectual context
```

## 2. Product Vision

### 2.1 Vision statement

CNTKNW is a place where a person's reading, visual study, vocabulary, questions, drawings, and connections remain attached to the sources that produced them while becoming part of one growing intellectual archive.

### 2.2 The problem

Existing tools split the study process:

- PDF readers preserve the source but treat thinking as comments in the margin.
- word processors support writing but lose source location and visual context;
- mind-map tools support spatial thinking but often duplicate or isolate the original notes;
- knowledge-management tools support linking but ask users to build and maintain elaborate systems;
- dictionaries and web searches break concentration and often lose the original passage;
- productivity timers count interaction rather than thought;
- beautiful note apps can become presentation tools rather than thinking tools.

CNTKNW should preserve flow while still creating durable, searchable structure.

### 2.3 Primary user outcomes

A user should be able to:

- import a large PDF and begin reading immediately;
- resume at the exact page, zoom, layout, and journal position;
- write or draw beside the source without deciding where the work belongs;
- inspect a book's complete journal in page order;
- connect page 5 to page 100, another book, an artwork, or a concept;
- define unfamiliar words offline without leaving the workspace;
- move between linear journal, outline, cards, and mind-map views without copying content;
- study an artwork with the same depth and continuity used for a book;
- review real study behaviour without being pressured to read faster;
- trust that their library still works when disconnected from the internet.

## 3. Product Principles

| Principle | Product rule |
|---|---|
| Source-aware by default | The active page, passage, artwork, region, game, or move supplies context automatically. |
| One canonical piece of content | Journal, outline, card, graph, and mind-map views render the same blocks rather than creating duplicates. |
| Think first, organise later | Capture must be immediate. Themes, links, types, and layout may be added during review. |
| Never leave the source to understand it | Dictionary, notes, annotations, search, and context remain inside the Study Workspace. |
| Local-first by design | Reading, writing, annotation, search, dictionary, and backup must work without an account or network. |
| Immersion plus speed | First-person spaces add discovery but never become the only route to content. |
| Depth over gamification | Statistics describe study; they do not reward rushing, punish rereading, or manufacture streak anxiety. |
| Progressive disclosure | A beginner sees a calm notebook. Advanced controls appear only when relevant. |
| Durable and portable | User data must be exportable, versioned, recoverable, and understandable outside the app where practical. |
| Visual restraint | Beauty comes from typography, rhythm, hierarchy, texture, and motion, not a rainbow of block colours. |
| Explicit relationships | A meaningful connection has an optional type and backlink, not merely a matching tag. |
| AI is optional and subordinate | Generated material must never replace source text or the user's interpretation silently. |

## 4. Research Synthesis: Why Users Adopt Thinking Tools

This section converts current productivity, journaling, PKM, whiteboard, and mind-map patterns into CNTKNW design decisions.

### 4.1 What successful products consistently do well

#### Immediate capture

Users stay with tools that let them begin before they have designed an organisational system. Capacities explicitly uses daily notes as a low-friction inbox and encourages later review; Craft lets structure emerge by grouping blocks into pages. CNTKNW should provide the same freedom, but the active source location becomes the automatic inbox.

**CNTKNW decision:** opening a book and typing must create a valid page-linked block immediately. No mandatory title, category, tag, or template dialog.

#### Atomic, movable units

Craft treats paragraphs and media as independent blocks. Tana turns nodes into typed objects through supertags. This flexibility allows content to gain structure later.

**CNTKNW decision:** all journal content is represented by stable, addressable blocks. A block can be moved, embedded, linked, transformed, or displayed in another view while retaining identity and history.

#### One dataset, several useful views

Notion databases can display the same records as tables, lists, galleries, calendars, timelines, and charts. Xmind can switch between a visual map and an outline. These products succeed when a view changes presentation rather than creating a second copy of the data.

**CNTKNW decision:** Journal, Outline, Cards, Connections, and Mind Map are projections of the same blocks and relationships.

#### Explicit objects and backlinks

Capacities reduces folder maintenance by treating books, people, topics, and other entities as object types. Backlinks reveal where an object was referenced and preserve context.

**CNTKNW decision:** Book, Artwork, Concept, Glossary Entry, Author, Artist, Period, and future Chess Game are typed entities. Every explicit link produces a backlink with source context.

#### Spatial organisation without abandoning text

Heptabase organises note cards on whiteboards; Obsidian Canvas can place notes, media, PDFs, and text cards spatially; Miro combines mind maps, diagrams, notes, and other objects on a large canvas.

**CNTKNW decision:** spatial layout is a saved view over canonical blocks. It may add frames, positions, colours, and edges, but it must not own the only copy of important writing.

#### Ownership and offline trust

Obsidian's local files and Anytype's local-first architecture appeal to users who care about offline access, privacy, and long-term ownership.

**CNTKNW decision:** core capability has no CDN or cloud requirement. Binary assets, notes, dictionary packs, indexes, and backups are local. Sync can be added later as an optional layer.

#### Visual polish that requires little design skill

Craft emphasises beautiful defaults, typography, covers, cards, and media without requiring users to become designers. Users adopt polished tools because their work feels valuable immediately.

**CNTKNW decision:** provide excellent default typography and block treatments. Customisation should be bounded by a coherent design system rather than unlimited per-block decoration.

#### Focus modes

Xmind provides Zen mode and hides peripheral controls. Serious writing and reading tools create calm by removing chrome instead of adding motivational clutter.

**CNTKNW decision:** Source Focus, Journal Focus, Deep Reading, and Presentation modes should be first-class workspace states.

### 4.2 Repeated sources of frustration

Community discussion and product behaviour reveal several predictable failure modes:

- quick capture becomes slow when users must choose folders, vaults, schemas, or properties first;
- extensive plugins and configuration create a powerful tool that feels like a project to maintain;
- beautiful databases become clumsy for tiny thoughts or mobile capture;
- graphs become decorative noise when links are created for volume rather than meaning;
- canvas-only notes become hard to search, reuse, export, or review linearly;
- cloud dependence weakens trust and offline reliability;
- separate mobile and desktop interaction models can make a system feel inconsistent;
- sync conflicts and invisible state changes damage confidence;
- too many block types or colours make a journal look fragmented rather than expressive;
- AI-generated structure can overwhelm personal thinking and make provenance unclear.

### 4.3 What CNTKNW should adopt

| Pattern | Adopted form in CNTKNW |
|---|---|
| Craft-style atomic blocks | Stable JournalBlock records with rich presentation and nesting. |
| Capacities-style typed objects | Sources, people, concepts, glossary terms, periods, and future games. |
| Tana-style later typing | A plain text block may later become a question, claim, definition, or concept without replacement. |
| Notion-style multiple views | The same source collection or blocks shown as list, timeline, cards, journal, or map. |
| Heptabase-style spatial synthesis | Saved canvases made from canonical blocks and sources. |
| Obsidian-style backlinks and ownership | Contextual backlinks, local data, export, and no core cloud dependency. |
| Xmind outline-map duality | One-click switching between hierarchical outline and mind map. |
| Miro-style direct manipulation | Drag, connect, group, frame, zoom, and navigate naturally on canvases. |
| Craft-style visual defaults | Editorial typography, strong spacing, premium motion, and visually legible block types. |

### 4.4 What CNTKNW should avoid

- A blank graph as a headline feature before meaningful links exist.
- A separate whiteboard database that duplicates journal content.
- A slash menu with dozens of equal-priority choices.
- Mandatory folder or tag decisions during reading.
- A plugin-dependent core experience.
- A first-person world that makes opening a book slower.
- Flattened PNG-only drawings that cannot be edited.
- Cloud-hosted PDF workers or dictionary lookups in an offline product.
- Colour-coding every block type so aggressively that a journal resembles a dashboard.
- AI that writes into journals without a visible origin, review state, or user action.

## 5. Information Architecture

### 5.1 Three primary destinations

```text
CNTKNW
|
+-- Library
|   +-- Collection view
|   +-- Timeline view
|   +-- Search and quick open
|   +-- Immersive library (later)
|   +-- Book/PDF -> Study Workspace
|
+-- Gallery
|   +-- Collection and timeline views
|   +-- Search, rooms, artists, periods
|   +-- Immersive museum (later)
|   +-- Artwork -> Study Workspace
|
+-- Notes
    +-- Journals
    +-- All blocks
    +-- Themes and concepts
    +-- Connections and backlinks
    +-- Glossary
    +-- Maps and canvases
    +-- Standalone notes
```

### 5.2 Secondary global tools

The following live in contextual menus, overlays, or settings rather than permanent main tabs:

- universal search and command palette;
- timer and session controls;
- recent and resume;
- dictionary pack management;
- import, export, and backup;
- application settings;
- future Chess Room access through the Library world.

### 5.3 Primary navigation requirement

**IA-001:** No new primary tab may be added without an explicit product-design revision. A coding agent may not promote Sessions, Whiteboard, PDF Reader, Dictionary, Export, Settings, or Chess to permanent top-level destinations.

## 6. Shared Study Workspace

The Study Workspace is the central interaction surface for books and artworks.

```text
+--------------------------------+--------------------------------+
| SOURCE PANE                    | JOURNAL PANE                   |
|                                |                                |
| PDF or artwork                 | Current context header         |
| Text/visual annotation layer   | Page-linked journal blocks     |
| Search, contents, navigation   | Drawings, maps, concepts       |
| Zoom, view mode, compare       | Backlinks and connections      |
|                                |                                |
+--------------------------------+--------------------------------+
| Source location | Focus 43:21 | Autosaved | Dictionary | View |
+-----------------------------------------------------------------+
```

### 6.1 Workspace states

| State | Behaviour |
|---|---|
| Split | Source and journal visible side by side. |
| Source focus | Source uses most of the screen; journal remains one action away. |
| Journal focus | Journal expands for long-form writing while location remains visible. |
| Compare | Two sources or two source locations appear with one journal context. |
| Deep reading | Non-essential chrome hides; timer and location remain subtle. |
| Review | Complete source journal opens in reading order with source previews. |

### 6.2 Resume contract

For every source, CNTKNW must persist:

- exact source location;
- zoom and view mode;
- source and journal scroll positions;
- split-panel dimensions and collapsed state;
- active journal block and text selection where feasible;
- selected annotation tool;
- open dictionary or connection panel;
- last active timestamp.

**WS-001:** reopening a source restores its previous workspace state rather than resetting to page 1.

### 6.3 Save behaviour

- Every durable edit autosaves.
- A visible state communicates `Saving`, `Saved locally`, `Backup needed`, or `Write failed`.
- Related changes use transactions where possible.
- Failure never clears the editor.
- Recovery snapshots protect against crashes and accidental deletion.

## 7. The Infinite Source-Linked Journal

### 7.1 Locked behaviour

Each source has one continuous journal. Journal content is grouped by populated source locations.

While PDF page 5 is active:

- a paragraph belongs to page 5;
- a quote belongs to page 5 and its selected text range;
- a drawing belongs to page 5;
- a question belongs to page 5;
- a definition belongs to page 5;
- a connection created from the passage begins at page 5.

Changing to page 6 changes the active context. It does not erase page 5 and does not create an empty page 6 section until content is added.

### 7.2 Canonical block model

A JournalBlock is the atomic unit. Every block has:

- stable ID;
- journal ID;
- block type;
- source location;
- canonical content payload;
- order and optional parent block;
- created and updated timestamps;
- provenance and author type;
- version/revision metadata;
- optional concept and connection references.

### 7.3 Block types

| Type | Purpose | Default appearance |
|---|---|---|
| Paragraph | Long or short reflection. | Quiet body text. |
| Heading | User-created structure. | Editorial serif or strong sans heading. |
| Quote | Captured source text. | Indented paper card with source marker. |
| Question | Unresolved inquiry. | Subtle question marker; not a loud coloured box. |
| Claim | Proposition the user is advancing. | Strong left rule and label. |
| Evidence | Material supporting a claim. | Compact source-aware block. |
| Objection | Challenge to a claim. | Contrasting rule and relationship field. |
| Definition | General, source-specific, or personal meaning. | Term-forward dictionary card. |
| Drawing | Editable vector sketch or diagram. | Embedded canvas with preview. |
| Argument map | Structured claims and typed logical edges. | Embedded graph with outline fallback. |
| Image | Imported or captured visual. | Caption and source controls. |
| Connection embed | Preview of another block, page, source, or concept. | Compact backlink card. |
| Divider | Visual rhythm. | Thin editorial separator. |
| Callout | Deliberately emphasised note. | Restrained neutral surface. |

### 7.4 Capture menu

The primary `+` menu is ordered by likely study action:

1. Write
2. Quote selection
3. Question
4. Draw
5. Define
6. Connect
7. More: claim, evidence, objection, image, map, timeline, comparison

Typing immediately creates a paragraph. The user never has to choose a type first.

### 7.5 Transform rather than recreate

A paragraph can later be transformed into a question, claim, definition, card, or concept while retaining:

- the same ID;
- backlinks;
- source location;
- revision history;
- comments or relationships;
- placement on maps.

## 8. Journal Views and Mind Maps

### 8.1 Same information, different views

| View | Best for |
|---|---|
| Journal | Reading the user's thought process in source order. |
| Outline | Understanding hierarchy and collapsing detail. |
| Cards | Reviewing selected insights, quotes, concepts, or questions. |
| Connections | Inspecting explicit links and backlinks with context. |
| Mind Map | Developing a central concept through branches. |
| Free Canvas | Spatial synthesis across unrelated or cross-source material. |
| Argument Map | Testing support, objection, contradiction, and conclusion. |

### 8.2 Mind-map architecture

A mind map must not duplicate note text. It stores a layout record that references canonical nodes.

```text
MindMapView
  id
  title
  rootNodeRef
  nodePlacements[] -> JournalBlock | Concept | SourceLocation | Source
  edgePresentations[] -> Connection or view-only hierarchy
  frames[]
  viewport
  collapsedNodeIds[]
  stylePreset
```

### 8.3 Automatic map generation

CNTKNW can generate an initial map from:

- a concept and its direct connections;
- a page block and related pages;
- a book's themes;
- an argument block hierarchy;
- selected journal blocks;
- a search result set.

The generated layout is a starting point, not a permanent automatic rearrangement. Once the user edits positions, CNTKNW preserves the personal spatial layout.

### 8.4 Map interaction requirements

- drag nodes without altering canonical content order;
- edit a node in place and update the original block;
- expand and collapse branches;
- open source context beside the map;
- create typed connections by dragging ports;
- select multiple nodes and group them in a frame;
- zoom to selection, fit view, use minimap, and navigate by keyboard;
- switch the same map to outline view;
- distinguish canonical connections from view-only parent-child layout edges;
- avoid constant physics motion after placement;
- export an image while preserving an editable native format.

### 8.5 Argument maps

Argument maps use explicit semantics:

- supports;
- objects to;
- rebuts;
- qualifies;
- depends on;
- concludes;
- example of;
- definition of.

The map must also be reviewable as a nested textual outline for accessibility and long-form reasoning.

## 9. Visual and Interaction Design Bible

### 9.1 Desired feeling

CNTKNW should feel like a quiet private museum, an archival reading room, and a researcher's notebook - not a corporate project dashboard.

Keywords:

- scholarly;
- intimate;
- tactile;
- collected;
- calm;
- precise;
- premium;
- lived-in without becoming messy.

### 9.2 Visual hierarchy

Beauty should come from:

- generous but efficient spacing;
- strong typographic contrast;
- consistent alignment;
- legible text measure;
- subtle surfaces and borders;
- carefully cropped covers and artwork;
- meaningful density changes;
- restrained animation;
- context-aware previews.

### 9.3 Typography

Recommended system:

- **UI sans:** Inter, Geist, or an equivalent highly legible variable sans.
- **Editorial serif:** Source Serif 4, Literata, or an equivalent for journal headings, quotations, and reading-oriented display.
- **Monospace:** a legible code/data face for citations, identifiers, and technical excerpts.

Rules:

- body journal measure targets roughly 60-75 characters per line;
- source text and journal text have independent zoom controls;
- minimum default body size should remain comfortably readable on a laptop;
- headings use scale and spacing before decorative colour;
- italics and low-contrast text are not used for essential information.

### 9.4 Colour

Use a neutral dark foundation with warm paper-like reading surfaces and one primary accent. Context may have subtle secondary accents, but blocks should not become a rainbow.

Suggested semantic roles:

| Token role | Purpose |
|---|---|
| Canvas | Deep neutral application background. |
| Surface | Panels and toolbars. |
| Paper | Reading and journal writing plane. |
| Ink | Primary text. |
| Muted ink | Metadata and secondary labels. |
| Accent | Selection, focus, links, active tools. |
| Success | Saved and restored states. |
| Warning | Backup, storage, or inactivity attention. |
| Danger | Destructive action only. |

### 9.5 Block aesthetics

- Paragraphs remain mostly unboxed.
- Quotes use indentation, source markers, and subtle paper contrast.
- Questions use a small icon or label rather than a saturated card.
- Definitions prioritise the term and layer of meaning.
- Connections show direction and relationship label.
- Drawings and maps have minimal chrome until hovered or focused.
- Page/location headers are sticky, compact, and collapsible.
- Repeated cards use consistent corner radius and shadow depth.

### 9.6 Motion

Motion should explain state:

- a new block unfolds and focuses the cursor;
- a source selection becomes a quote card through a short spatial transition;
- opening a backlink reveals its origin rather than teleporting without context;
- panel resizing and collapse use quick, non-bouncy easing;
- autosave indicators fade rather than flash;
- reduced-motion preference disables non-essential transitions.

### 9.7 Iconography

Use one consistent outlined icon family. Icons should support labels until the interaction is familiar. Do not mix emoji, text symbols, and unrelated icon styles in production UI.

### 9.8 Empty states

Empty states should teach one next action:

- Library: `Import your first PDF` with a sample-book option.
- Page journal: `Start writing, quote the source, or draw.`
- Connections: explain that links appear only when meaningful.
- Mind map: invite selection of existing blocks rather than showing a meaningless demo graph.

## 10. Onboarding and Adoption

### 10.1 First-session path

1. Choose local library location or browser storage mode.
2. Import a PDF or open a built-in sample.
3. CNTKNW opens the Study Workspace directly.
4. A three-step contextual guide demonstrates write, quote, and return-to-source.
5. The app saves automatically and shows where data lives.
6. Mind maps, concepts, advanced annotations, and 3D are introduced later through use, not an upfront tour.

### 10.2 Adoption principles

- deliver value before asking for customisation;
- provide excellent defaults;
- reveal storage and backup status clearly;
- offer templates as optional starting structures, not mandatory systems;
- preserve common keyboard conventions;
- make undo reliable and visible;
- show a recent/resume surface on launch;
- use examples connected to the user's source, not generic productivity examples.

### 10.3 Beginner and advanced modes

Do not create two separate products. Use progressive disclosure:

- beginner sees writing, quote, question, draw, define, connect;
- advanced user can enable claims, argument semantics, custom block views, map controls, metadata editing, and automation.

## 11. Library

### 11.1 Core 2D Library

Required before 3D:

- search and quick open;
- recent and resume;
- shelf/card/list views;
- categories and collections;
- authors, dates, subjects, and reading state;
- timeline with selectable date dimension;
- import, archive, and metadata correction;
- per-book statistics and journal preview.

### 11.2 PDF import

Metadata precedence:

1. embedded PDF metadata;
2. title-page text extraction;
3. cleaned filename;
4. user correction.

Extract or infer where available:

- title;
- author;
- page count;
- subject and keywords;
- table of contents;
- creation/publication dates;
- language;
- cover thumbnail.

### 11.3 Reading modes

- continuous vertical scroll;
- single page;
- later two-page spread;
- deep reading/focus mode;
- side-by-side comparison;
- accessible text extraction view when available.

### 11.4 Future immersive library

- first-person WASD navigation;
- mouse and keyboard look controls;
- readable spines and covers;
- rooms generated from categories, eras, authors, or collections;
- direct interaction opens the same Study Workspace;
- search/teleport and 2D fallback always available;
- performance settings and reduced-motion options;
- Chess Room placed as an optional side room.

## 12. Gallery

### 12.1 Core Gallery

- artwork import and high-resolution storage;
- artist, title, date, period, movement, culture, location, medium, dimensions, and provenance metadata;
- timeline, location, collection, and comparison views;
- search and filters;
- favourite, studied, and collection states.

### 12.2 Artwork Study Workspace

- zoom, pan, fit, and high-resolution detail;
- non-destructive region and drawing annotations;
- region-linked journal blocks;
- optional analysis stages: observation, formal analysis, interpretation, context, evaluation, personal response;
- side-by-side artwork comparison;
- links to passages, concepts, artists, periods, and other works.

### 12.3 Future immersive museum

- walkable rooms organised by period, location, movement, or collection;
- artwork scale and spacing chosen for viewing rather than decorative crowding;
- room labels and contextual plaques;
- immediate switch to 2D collection or Study Workspace;
- accessibility route that does not depend on first-person navigation.

## 13. Notes

### 13.1 Notes views

| View | Contents |
|---|---|
| Journals | Complete book or artwork journals in source order. |
| All blocks | Filterable atomic content across sources. |
| Themes | Concepts, tags, and related material. |
| Connections | Explicit links, backlinks, and relationship filters. |
| Glossary | Looked-up words, source meanings, personal definitions. |
| Maps | Saved mind maps, argument maps, and canvases. |
| Standalone | Notes created before or outside a source. |

### 13.2 Filters

- source type;
- specific book or artwork;
- page, passage, or region;
- block type;
- theme or concept;
- relationship type;
- author or artist;
- date created, edited, or studied;
- saved vocabulary;
- questions unresolved or resolved.

### 13.3 Review behaviour

Review should support:

- expanding source preview beside a block;
- jumping to exact passage or visual region;
- turning an unstructured block into a concept;
- merging duplicate concepts safely;
- connecting distant pages;
- selecting blocks and creating a map;
- preserving the original journal order after thematic grouping.

## 14. Connections and Knowledge Model

### 14.1 Connection endpoints

A connection can target:

- source;
- source location;
- journal block;
- annotation;
- concept;
- glossary entry;
- author or artist;
- artwork region;
- future chess game, move, or position.

### 14.2 Relationship types

Initial set:

- same theme;
- supports;
- contradicts;
- develops;
- resolves;
- example of;
- influenced by;
- question answered by;
- visually represents;
- comparison with;
- custom.

### 14.3 Link quality

CNTKNW should encourage `link for meaning, not for volume`:

- unlinked mentions may be suggested separately;
- explicit backlinks represent deliberate relationships;
- graph defaults filter weak metadata links;
- repeated automatic links do not flood the journal.

## 15. Offline Dictionary, Glossary, and Concept Cards

### 15.1 Dictionary interaction

Selecting or double-clicking a word may show:

- definition;
- part of speech;
- pronunciation;
- alternative senses;
- synonyms and antonyms;
- etymology;
- usage examples;
- related words.

The user may:

- close without saving;
- save the lookup;
- add a personal meaning;
- define how the source uses the term;
- create or link a concept;
- view occurrences in the current source or library.

### 15.2 Three layers of meaning

1. **Dictionary meaning** - general language definition.
2. **Source meaning** - how a book, author, period, or discipline uses the term.
3. **Personal concept** - the user's evolving interpretation and cross-source connections.

### 15.3 Offline packs

- primary English dictionary pack;
- optional philosophy terminology;
- art-history terminology;
- literary terminology;
- theology and mythology;
- historical-period packs;
- future language packs.

Licences, attribution, update mechanism, package size, and search index format must be documented before distribution.

## 16. PDF and Annotation Requirements

### 16.1 PDF requirements

- core rendering works offline;
- worker assets are bundled locally;
- large PDFs render incrementally;
- text layer supports selection and search;
- page thumbnails load lazily;
- page and workspace state persist;
- table of contents is retained or derived where possible;
- original binary remains unmodified;
- scanned PDFs may later use optional local OCR.

### 16.2 Annotation model

Annotations are separate from PDF binary content and use normalised coordinates.

Supported types:

- text highlight;
- underline;
- strikethrough;
- freehand pen;
- rectangle and ellipse;
- arrow and line;
- text callout;
- region selection;
- bookmark.

Every annotation stores:

- source and asset IDs;
- page;
- type;
- normalised geometry;
- style;
- optional exact text anchor and quote;
- linked journal block IDs;
- timestamps and revision.

### 16.3 Drawing requirement

Editable drawing data is canonical. A raster preview may be cached, but CNTKNW must not store only a flattened PNG.

## 17. Search and Retrieval

### 17.1 Universal search

Search across:

- book and artwork metadata;
- journal text;
- block titles and types;
- glossary and concepts;
- explicit connections;
- extracted PDF text;
- captured quotes;
- annotation callouts;
- future OCR text.

### 17.2 Search experience

- instant command palette for navigation and actions;
- result grouping by source and type;
- passage snippets with highlighted terms;
- keyboard navigation;
- filters without leaving the result page;
- exact return to source location;
- saved searches as optional review views;
- no network requirement for core index.

## 18. Timer, Sessions, and Statistics

### 18.1 Timing modes

| Mode | Behaviour |
|---|---|
| Manual focus | Default. Counts until the user pauses or ends. Quiet rereading counts. |
| Assisted auto-pause | Optional. Detects inactivity and asks before removing time. |
| 25/5 | Classic Pomodoro. |
| 50/10 | Deep reading default. |
| Custom | User-defined focus, breaks, and cycles. |
| Stopwatch | Open-ended manual session. |

Activity includes reading interactions, page navigation, dictionary use, search, writing, drawing, annotation, and connection work. Lack of interaction is not proof of inactivity.

### 18.2 StudySession

A session captures:

- source type and ID;
- start and end times;
- focused, break, manual-pause, and removed-idle seconds;
- start and end source locations;
- locations visited;
- blocks, annotations, dictionary lookups, and connections created;
- timer mode;
- optional reflection.

### 18.3 Statistics

Book statistics:

- focused time and sessions;
- current and highest page;
- pages studied and revisited;
- average and longest session;
- journal blocks, quotes, questions, drawings, and connections;
- vocabulary and concepts;
- page-range activity heatmap.

Artwork statistics:

- viewing and analysis time;
- revisits;
- observations, annotations, questions, and connections;
- analysis stages completed;
- comparison activity;
- artists, periods, movements, and media explored.

Stats are descriptive and may be hidden. They do not score the quality of thought.

## 19. Local-First Storage, Privacy, and Backup

### 19.1 Storage principles

- domain records and binary assets are separated;
- schemas are versioned;
- every schema change has a migration;
- core actions work offline;
- component code does not write directly to arbitrary object stores;
- local full-text indexes can be rebuilt from canonical data;
- storage quota and write errors are visible;
- future sync is optional and cannot become the only source of truth.

### 19.2 Backup levels

| Backup | Contents |
|---|---|
| Notes-only | Metadata, journals, concepts, glossary, connections, sessions, settings. |
| Portable library | Notes plus PDFs, artwork, annotations, editable drawings, indexes manifest. |
| Incremental archive | Changes since the last snapshot. |
| Markdown export | Human-readable journals and metadata with stable link references. |

### 19.3 Recovery

- block revision history;
- soft deletion and trash;
- database transaction recovery;
- import validation before writes;
- conflict report rather than silent overwrite;
- backup verification and restore test;
- visible last-successful-backup status.

## 20. Accessibility and Device Behaviour

### 20.1 Accessibility

- all core actions keyboard-accessible;
- semantic headings and landmarks;
- screen-reader text alternatives for maps and drawings;
- visible focus states;
- sufficient contrast;
- colour never carries meaning alone;
- reduced-motion support;
- resizable text and panels;
- alt text and captions for artwork;
- outline alternative for every mind or argument map.

### 20.2 Responsive strategy

Desktop/laptop is the complete experience. Tablet supports reading, annotation, drawing, and review. Phone focuses on capture, reading, dictionary, recent items, and lightweight review rather than forcing a miniature desktop canvas.

## 21. Future Chess Room

### 21.1 Scope

Chess is a later optional room inside the immersive Library. It is not a fourth primary tab and is not required for the core product release.

Modes:

- break;
- casual play;
- lessons;
- scenarios and puzzles;
- game review;
- historical-game archive.

### 21.2 Bot personas

Bots should combine:

- target rating band;
- search limits;
- error distribution;
- opening repertoire;
- time behaviour;
- style: tactical, positional, aggressive, defensive, endgame-focused, unpredictable;
- optional teaching behaviour.

Initial production versions should use original fictional Library characters. Real living players, photographs, voices, recognisable likenesses, names, or implied endorsements require appropriate permission and asset rights. Licensed grandmaster packs may be added later.

### 21.3 Knowledge integration

Chess notes may attach to games, moves, positions, openings, lessons, and personal mistakes. A chess book may open with the PDF on one side and an interactive board beside the journal. Chess play, chess study, and reading-break time remain distinct in statistics.

## 22. Data Model Overview

### 22.1 Core entities

```text
Source
  BookSource
  ArtworkSource
  Future ChessSource

Asset
  PdfAsset
  ImageAsset
  DictionaryPack

WorkspaceState
Journal
JournalBlock
Annotation
Connection
Concept
GlossaryEntry
MindMapView
StudySession
Collection
Person / Creator
```

### 22.2 Universal source location

```ts
type SourceLocation = {
  sourceType: 'book' | 'artwork' | 'chess-game' | 'chess-position';
  sourceId: string;
  pdf?: { page: number; textAnchor?: TextAnchor };
  artwork?: { region?: NormalizedRect };
  chess?: { moveNumber?: number; fen?: string };
};
```

### 22.3 Page sections are computed

A page section is not a second copy of journal content. It is computed by grouping blocks with matching source IDs and PDF page numbers. Only groups containing visible blocks appear.

## 23. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-001 | Core reading, editing, annotation, dictionary, and search function offline. |
| NFR-002 | Autosaved text should survive ordinary application crashes and refreshes. |
| NFR-003 | Opening a large PDF must not load every rendered page into memory. |
| NFR-004 | Scrolling and typing should remain responsive during indexing and autosave. |
| NFR-005 | All schema changes include deterministic migrations and rollback/recovery instructions. |
| NFR-006 | No core runtime dependency is fetched from a CDN. |
| NFR-007 | Search index can be rebuilt from canonical records. |
| NFR-008 | Every destructive action has undo, trash, confirmation, or an equivalent recovery path. |
| NFR-009 | The application reports storage, import, export, and backup failures clearly. |
| NFR-010 | Core user data can be exported without a subscription or network connection. |

## 24. Delivery Roadmap

| Phase | Scope | Exit condition |
|---|---|---|
| 0. Foundation reset | TypeScript, routing, design tokens, repository layer, schemas, migrations, tests. | App shell builds; no direct component DB writes; legacy data can be read. |
| 1. Reliable PDF core | Import, metadata, local worker, text layer, search, resume, lazy rendering. | Large PDF opens offline and resumes exactly. |
| 2. Infinite journal | Canonical blocks, page context, autosave, block editor, journal review. | Page 5 work always returns under page 5. |
| 3. Annotation and drawing | Text highlights, vector overlays, editable drawing blocks, exact source links. | Annotations survive zoom, mode changes, and reopen. |
| 4. Connections and concepts | Typed links, backlinks, concept cards, relationship review. | Distant pages and sources connect bidirectionally. |
| 5. Dictionary and glossary | Offline pack, lookup, source meaning, personal meaning, occurrences. | A difficult word can be understood and saved offline. |
| 6. Notes, search, and maps | Global views, local index, outline, cards, mind map, argument map. | Same blocks switch views without duplication. |
| 7. Artwork study | Gallery metadata, viewer, analysis, annotations, comparisons. | Artwork uses the shared workspace model. |
| 8. Sessions and statistics | Manual timer, assisted pause, sessions, source stats. | Timing is transparent and source-aware. |
| 9. Production polish | Accessibility, performance, recovery, onboarding, backups, responsive layouts. | Daily-use release candidate. |
| 10. Immersive worlds | Library/museum 3D scenes and 2D fallback. | 3D reads stable catalogue APIs only. |
| 11. Chess Room | Bots, break integration, lessons, scenarios, review. | Optional expansion after core stability. |

## 25. Acceptance Criteria

| ID | Acceptance criterion |
|---|---|
| AC-001 | Importing a PDF creates or attaches a book and opens it without requiring the network. |
| AC-002 | Reopening a book restores its exact page, zoom, panel state, and journal context. |
| AC-003 | Text, drawing, quote, question, or definition created while page 5 is active inherits page 5 automatically. |
| AC-004 | Navigating to page 6 creates no visible empty journal section. |
| AC-005 | Page 5 may link to page 100 with a typed relationship and both endpoints show context-rich backlinks. |
| AC-006 | A selected word can be defined offline, saved, given a personal meaning, and reopened at the original passage. |
| AC-007 | PDF annotations remain aligned after zoom, resize, reopen, and view-mode change. |
| AC-008 | Editable drawings retain vector/object data rather than only raster output. |
| AC-009 | A block edited from a mind map updates the same block in the journal. |
| AC-010 | Switching between journal, outline, cards, and map creates no duplicate content records. |
| AC-011 | Manual timing continues through quiet rereading until the user pauses or ends it. |
| AC-012 | Assisted auto-pause asks before removing time unless immediate pause is explicitly enabled. |
| AC-013 | Notes-only and full portable-library backups validate and restore successfully. |
| AC-014 | Library and Gallery remain fully usable without 3D navigation. |
| AC-015 | Core actions are keyboard-accessible and maps have outline alternatives. |
| AC-016 | Chess may be disabled and never contaminates reading or art statistics. |

## 26. Explicit Non-Goals for the Core Release

- team collaboration and multiplayer editing;
- public social network or content feed;
- a universal project-management replacement;
- cloud-only sync;
- mandatory AI summaries;
- automatic evaluation of philosophical correctness;
- immersive 3D before the 2D core is reliable;
- real-player chess likenesses without licensing;
- a plugin marketplace before stable extension contracts exist;
- full desktop/mobile feature parity in the first release.

## 27. Open Product Decisions

- final brand stylisation and pronunciation;
- web-first installable PWA versus desktop-first Tauri packaging;
- browser IndexedDB library versus user-selected filesystem library for the first production release;
- Tiptap/ProseMirror versus another extensible block editor after a short technical spike;
- exact vector-canvas library shared between PDF overlays and journal drawings;
- OCR inclusion in the first public release;
- dictionary dataset and licence;
- default immersive art direction;
- optional local or cloud AI scope;
- public product, private personal tool, or both;
- whether licensed chess partners become a commercial expansion.

## 28. Research References

The recommendations above were derived from official product documentation and current community discussion. Product features can change; implementation agents should verify current APIs before choosing dependencies.

1. Obsidian Help - Canvas and JSON Canvas: https://obsidian.md/help/plugins/canvas
2. Capacities Documentation - Getting started, objects, backlinks, networked notes, and daily notes: https://docs.capacities.io/tutorials/getting-started
3. Capacities Documentation - Backlinks: https://docs.capacities.io/reference/backlinks
4. Craft Help Center - Blocks and Pages: https://support.craft.do/en/write-and-edit/blocks-and-pages
5. Notion Help Center - Intro to databases and multiple views: https://www.notion.com/help/intro-to-databases
6. Anytype Documentation - local-first and user-controlled data: https://doc.anytype.io/anytype-docs
7. Tana Outliner - Supertags and typed nodes: https://outliner.tana.inc/learn/features/supertags
8. Xmind User Guide - outline, Zen, and Pitch modes: https://xmind.com/user-guide/intro-new
9. Miro Help Center - diagrams and mind maps: https://help.miro.com/hc/en-us/articles/28782102127890-Miro-AI-with-Diagrams-and-mindmaps
10. Heptabase Help Center - whiteboards, cards, mindmaps, and knowledge context: https://support.heptabase.com/
11. Community discussions examined included quick-capture friction, local ownership, mobile task complexity, and handwriting versus typing trade-offs on Reddit note-taking communities.

## 29. Change Log

| Version | Date | Change |
|---|---|---|
| 0.1 | 24 July 2026 | Initial canonical product vision. |
| 0.2 | 24 July 2026 | Added research-backed journal and mind-map design, visual design bible, onboarding/adoption rules, same-data multi-view architecture, accessibility, non-functional requirements, expanded acceptance criteria, and implementation sequencing. |


---

# PART II - AI IMPLEMENTATION HANDOFF

# CNTKNW AI Implementation Handoff

**Version:** 0.2  
**Audience:** Claude Code, Codex, Cursor agents, Antigravity, and human developers  
**Owner:** Lazarus Petrus  
**Updated:** 24 July 2026  
**Required companion:** `CNTKNW_Product_Design_Document_v0.2.md`

> **Operating rule:** Read the complete Product Design Document before modifying code. This handoff defines how to implement it. When repository reality conflicts with this handoff, inspect and report the conflict before changing architecture.

> **No false guarantee:** No handoff can ensure zero software issues. The required process is designed to minimise ambiguity, prevent architectural drift, and catch defects through small migrations, tests, build gates, and explicit acceptance criteria.

## 1. Mission

Build CNTKNW as a local-first personal knowledge museum and study studio with only three primary destinations: Library, Gallery, and Notes. All books and artworks open into one shared Study Workspace. The source and journal are coordinated. Content created while a source location is active inherits that context automatically.

The first engineering goal is not 3D, AI, or chess. It is a reliable local domain model that preserves source location, journal blocks, annotations, connections, workspace state, and backups.

## 2. Source Precedence

When instructions conflict, use this order:

1. Latest explicit user decision in the current conversation.
2. `CNTKNW_Product_Design_Document_v0.2.md`.
3. This implementation handoff.
4. Architecture Decision Records approved after v0.2.
5. Existing code behaviour.
6. Agent assumptions.

Existing code is evidence of the prototype, not the product specification.

## 3. Non-Negotiable Product Invariants

| ID | Invariant |
|---|---|
| INV-001 | Exactly three primary destinations: Library, Gallery, Notes. |
| INV-002 | PDF reader, artwork viewer, journal, drawing, dictionary, timer, and connections are tools inside the shared Study Workspace. |
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

Stop and report before implementing any change that would violate an invariant.

## 4. Verified Repository Snapshot

The uploaded prototype is located in `philosophy-journal-complete` and currently contains:

```text
src/
  App.jsx
  db.js
  index.css
  main.jsx
  components/
    ArtGallery.jsx
    BookDetail.jsx
    BookLibrary.jsx
    ConfirmModal.jsx
    ExportImport.jsx
    NoteSystem.jsx
    PDFReader.jsx
    SessionTracker.jsx
    Settings.jsx
    Sidebar.jsx
    Toast.jsx
    Whiteboard.jsx
```

`package.json` declares:

```json
{
  "react": "^19.2.7",
  "react-dom": "^19.2.7",
  "idb": "^8.0.0",
  "fabric": "^6.6.1",
  "pdfjs-dist": "^4.10.38",
  "uuid": "^11.1.0",
  "vite": "^8.1.1"
}
```

The extracted archive includes `node_modules`, but its native Vite/Rolldown optional binding is for a different or incomplete environment. The archive does not currently produce a valid build in this environment without reinstalling dependencies. Treat bundled `node_modules` as disposable.

## 5. Verified Prototype Problems

### 5.1 Architecture fragmentation

`App.jsx` uses a single `view` string to render separate mini-apps:

- library;
- book detail;
- notes;
- PDF reader;
- art gallery;
- whiteboard;
- sessions;
- export;
- settings.

This conflicts with the required three-destination architecture and shared Study Workspace.

### 5.2 Prop contract mismatch

`App.jsx` passes `bookId` to `PDFReader` and `NoteSystem`, but those components expect `selectedBookId`. The reader therefore does not receive its selected book through the declared prop.

### 5.3 Annotation store mismatch

`db.js` creates `pdfAnnotations` indexed by `pdfId` and `page`. `PDFReader.jsx` writes and reads an `annotations` store indexed by `bookId`. That store does not exist.

### 5.4 Note schema mismatch

`NoteSystem.jsx` stores and reads `note.text`. `PDFReader.jsx` and `ExportImport.jsx` display or export `note.content`. `BookDetail.jsx` expects `n.text`. There is no canonical note shape.

### 5.5 Styling inconsistency

Some components use large inline-style objects. `PDFReader.jsx` and `Whiteboard.jsx` use Tailwind-style class names, but Tailwind is not declared or configured. The resulting UI cannot have a reliable design system.

### 5.6 Whiteboard data loss risk

Fabric is declared but unused. The whiteboard uses a raw HTML canvas, stores history and final drawings as raster data URLs, and cannot preserve editable objects. Resizing also redraws bitmap content rather than maintaining a stable logical coordinate system.

### 5.7 PDF offline and resume problems

- PDF.js worker is loaded from a CDN.
- The reader initialises page state without a reliable source-specific resume contract.
- annotations are not attached to the actual PDF record consistently.
- no complete metadata extraction pipeline exists.

### 5.8 Backup defects

- `exportAllData()` excludes PDFs and image assets.
- `ExportImport.jsx` passes a JavaScript object directly into `Blob` instead of serialising JSON.
- import does not establish a strong parsed and schema-validated boundary.
- no manifest, migration, checksum, or conflict report exists.

### 5.9 Direct persistence from components

Components import generic `put`, `getAll`, and `deleteItem` and construct records independently. This guarantees schema drift as features grow.

## 6. Migration Strategy

Do not rewrite everything in one destructive branch and do not keep patching the current stores indefinitely.

### 6.1 Controlled strangler migration

1. Freeze legacy stores as read-only compatibility inputs.
2. Introduce a typed v2 domain model and repository layer.
3. Add deterministic migration functions from each legacy record shape.
4. Build the new shell and Study Workspace against v2 repositories.
5. Migrate one feature vertical at a time.
6. Validate counts, IDs, binaries, and relationships.
7. Keep a rollback backup until migration is verified.
8. Remove legacy components only after replacement acceptance tests pass.

### 6.2 Never mutate v1 data in place

Migration should write to new stores or a new database version. Preserve the original database until the user confirms a successful migration and backup.

### 6.3 Suggested legacy mapping

| Legacy | v2 target | Notes |
|---|---|---|
| `books` | `sources` + `books` | Generate stable source ID; retain legacy ID in migration metadata. |
| `pdfs` | `assets` + `sourceAssets` | Hash binary where practical; retain original filename and MIME type. |
| `notes` | `journals` + `journalBlocks` | Accept both `text` and `content`; infer block type and source page. |
| `pdfAnnotations` | `annotations` | Map `pdfId`; normalise geometry if available. |
| broken `annotations` references | recovery report | Scan only if store exists in a real user DB. |
| `drawings` | `drawingDocuments` + block refs | Raster-only data becomes a locked legacy image block, not fake editable vectors. |
| `sessions` | `studySessions` | Map book to source and preserve duration. |
| `artworks` | `sources` + `artworks` + assets | Move analysis fields into journal blocks where appropriate. |
| `appState` | `settings` + `workspaceStates` | Split global settings from source-specific resume state. |

## 7. Recommended Technology Direction

The agent must verify current package compatibility before installation. Do not assume version numbers from memory.

### 7.1 Baseline

- React with TypeScript;
- Vite;
- React Router for real URLs and nested layouts;
- Zod for runtime schema validation;
- Dexie or a similarly migration-friendly IndexedDB wrapper for web storage;
- repository and service interfaces that can later target SQLite/Tauri;
- Tiptap/ProseMirror technical spike for the block journal;
- PDF.js with locally bundled worker;
- `@xyflow/react` or equivalent for mind/argument maps;
- an editable vector library after a focused comparison spike;
- Zustand for transient UI state only, not as the canonical database;
- MiniSearch/FlexSearch or another local index behind a search interface;
- Vitest and React Testing Library;
- Playwright for critical end-to-end flows;
- ESLint, TypeScript strict mode, and a formatter.

### 7.2 Why repository abstraction matters

Browser IndexedDB is acceptable for an early web release. A large personal library may later benefit from Tauri, a user-selected folder, SQLite, and filesystem assets. Domain services must not depend directly on Dexie so the persistence adapter can change.

### 7.3 Libraries that must remain later-phase

- React Three Fiber/Drei for immersive worlds;
- `chess.js` and Stockfish WASM for the Chess Room;
- OCR engine;
- AI SDKs;
- sync or collaboration frameworks.

Do not install them during Phase 0 unless a small isolated spike is explicitly requested.

## 8. Target Repository Structure

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    routes/
      LibraryRoute.tsx
      GalleryRoute.tsx
      NotesRoute.tsx
      StudyWorkspaceRoute.tsx
  domain/
    sources/
      source.types.ts
      source.schemas.ts
      source.service.ts
    journals/
      journal.types.ts
      journal.schemas.ts
      journal.service.ts
    annotations/
    connections/
    concepts/
    glossary/
    sessions/
    maps/
    search/
  data/
    db/
      database.ts
      migrations/
      schemaVersions.ts
    repositories/
      SourceRepository.ts
      JournalRepository.ts
      AnnotationRepository.ts
      ConnectionRepository.ts
      SessionRepository.ts
      AssetRepository.ts
    adapters/
      indexeddb/
      memory/
  features/
    library/
    gallery/
    study-workspace/
      source-pane/
      journal-pane/
      workspace-toolbar/
    pdf/
    artwork-viewer/
    journal-editor/
    annotations/
    dictionary/
    connections/
    maps/
    sessions/
    notes/
  components/
    ui/
    layout/
  design/
    tokens.css
    typography.css
    motion.css
  hooks/
  lib/
  tests/
    fixtures/
    factories/
  legacy/
    v1-readers/
    v1-migration/
```

Feature folders may import domain services and UI components. They must not import adapter implementation details directly.

## 9. Canonical TypeScript Contracts

These are conceptual contracts. Keep names stable unless an approved ADR changes them.

### 9.1 Shared primitives

```ts
type EntityId = string;
type ISODateTime = string;
type Revision = number;

type NormalizedPoint = { x: number; y: number };
type NormalizedRect = { x: number; y: number; width: number; height: number };

type TextAnchor = {
  page: number;
  startOffset?: number;
  endOffset?: number;
  quote: string;
  prefix?: string;
  suffix?: string;
};
```

Use UUIDv7 or ULID after one decision. Do not combine timestamp strings, book IDs, and page numbers as record IDs.

### 9.2 Source

```ts
type SourceType = 'book' | 'artwork' | 'chess-game' | 'chess-position';

type Source = {
  id: EntityId;
  type: SourceType;
  title: string;
  subtitle?: string;
  creatorIds: EntityId[];
  collectionIds: EntityId[];
  tagIds: EntityId[];
  archivedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
  legacy?: { database: string; recordId: string };
};

type BookDetails = {
  sourceId: EntityId;
  authorText?: string;
  language?: string;
  publicationDate?: string;
  pageCount?: number;
  isbn?: string;
  subject?: string;
  currentStatus: 'unread' | 'reading' | 'paused' | 'completed';
};

type ArtworkDetails = {
  sourceId: EntityId;
  artistText?: string;
  creationDate?: string;
  period?: string;
  movement?: string;
  medium?: string;
  dimensions?: string;
  culture?: string;
  placeCreated?: string;
  currentLocation?: string;
};
```

### 9.3 Asset

```ts
type Asset = {
  id: EntityId;
  kind: 'pdf' | 'image' | 'thumbnail' | 'dictionary-pack' | 'legacy-raster';
  mimeType: string;
  originalName?: string;
  sizeBytes: number;
  checksum?: string;
  storageKey: string;
  createdAt: ISODateTime;
};

type SourceAsset = {
  sourceId: EntityId;
  assetId: EntityId;
  role: 'primary' | 'cover' | 'thumbnail' | 'supplement';
};
```

Binary data does not belong inside metadata records as base64 unless a small temporary import boundary requires it.

### 9.4 Source location

```ts
type SourceLocation = {
  sourceType: SourceType;
  sourceId: EntityId;
  pdf?: {
    page: number;
    textAnchor?: TextAnchor;
  };
  artwork?: {
    region?: NormalizedRect;
  };
  chess?: {
    moveNumber?: number;
    fen?: string;
  };
};
```

PDF pages are one-based at the domain/UI boundary. If PDF.js uses zero-based indexes internally, convert in one adapter and test it.

### 9.5 Workspace state

```ts
type WorkspaceState = {
  id: EntityId;
  sourceId: EntityId;
  activeLocation: SourceLocation;
  sourceView: {
    mode: 'continuous' | 'single' | 'spread' | 'artwork';
    zoom: number;
    scrollOffset?: number;
  };
  journalView: {
    scrollOffset: number;
    activeBlockId?: EntityId;
  };
  layout: {
    mode: 'split' | 'source-focus' | 'journal-focus' | 'compare';
    splitRatio: number;
    sourceCollapsed: boolean;
    journalCollapsed: boolean;
  };
  openPanel?: 'dictionary' | 'connections' | 'search' | 'contents';
  updatedAt: ISODateTime;
  revision: Revision;
};
```

### 9.6 Journal and blocks

```ts
type Journal = {
  id: EntityId;
  sourceId?: EntityId;
  title: string;
  kind: 'source' | 'standalone';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
};

type BlockKind =
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'question'
  | 'claim'
  | 'evidence'
  | 'objection'
  | 'definition'
  | 'drawing'
  | 'argument-map'
  | 'image'
  | 'connection-embed'
  | 'divider'
  | 'callout';

type JournalBlock = {
  id: EntityId;
  journalId: EntityId;
  kind: BlockKind;
  sourceLocation?: SourceLocation;
  parentBlockId?: EntityId;
  rank: string;
  content: BlockContent;
  conceptIds: EntityId[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
  provenance: 'user' | 'imported' | 'migration' | 'ai-draft';
};
```

`BlockContent` must be a discriminated union validated by Zod. Never use a single optional-field object for every block type.

Example:

```ts
type ParagraphContent = { type: 'paragraph'; doc: ProseMirrorJSON };
type QuoteContent = {
  type: 'quote';
  quote: string;
  anchor?: TextAnchor;
  commentary?: ProseMirrorJSON;
};
type DefinitionContent = {
  type: 'definition';
  term: string;
  dictionaryEntryId?: EntityId;
  sourceMeaning?: string;
  personalMeaning?: string;
};
```

### 9.7 Annotation

```ts
type Annotation = {
  id: EntityId;
  sourceId: EntityId;
  assetId: EntityId;
  page: number;
  kind: 'highlight' | 'underline' | 'strike' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'region' | 'bookmark';
  geometry: unknown; // discriminated and normalised by kind
  style: AnnotationStyle;
  textAnchor?: TextAnchor;
  linkedBlockIds: EntityId[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
};
```

Coordinates are normalised to the unrotated PDF page space. Store page rotation separately and transform only in the rendering adapter.

### 9.8 Connection

```ts
type Reference =
  | { type: 'source'; id: EntityId }
  | { type: 'location'; location: SourceLocation }
  | { type: 'block'; id: EntityId }
  | { type: 'annotation'; id: EntityId }
  | { type: 'concept'; id: EntityId }
  | { type: 'glossary-entry'; id: EntityId };

type Connection = {
  id: EntityId;
  from: Reference;
  to: Reference;
  relationship: string;
  direction: 'directed' | 'undirected';
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
};
```

Backlinks are queried from Connection records. Do not store a second mutable backlinks array on every entity.

### 9.9 Concepts and glossary

```ts
type Concept = {
  id: EntityId;
  title: string;
  summary?: string;
  aliases: string[];
  parentConceptIds: EntityId[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
};

type GlossaryEntry = {
  id: EntityId;
  term: string;
  language: string;
  dictionaryPackId?: EntityId;
  dictionarySenseIds: string[];
  sourceMeanings: Array<{ sourceId: EntityId; meaning: string }>;
  personalMeaning?: string;
  occurrenceLocations: SourceLocation[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
};
```

### 9.10 Mind maps

```ts
type MapNodeRef =
  | { type: 'block'; id: EntityId }
  | { type: 'concept'; id: EntityId }
  | { type: 'source'; id: EntityId }
  | { type: 'location'; location: SourceLocation };

type MindMapView = {
  id: EntityId;
  title: string;
  kind: 'mind-map' | 'argument-map' | 'free-canvas';
  nodes: Array<{
    id: EntityId;
    ref: MapNodeRef;
    x: number;
    y: number;
    width?: number;
    height?: number;
    collapsed?: boolean;
  }>;
  edges: Array<{
    id: EntityId;
    connectionId?: EntityId;
    sourceNodeId: EntityId;
    targetNodeId: EntityId;
    viewRelationship?: string;
  }>;
  viewport: { x: number; y: number; zoom: number };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: Revision;
};
```

Map nodes reference canonical entities. Do not copy full block text into map storage.

### 9.11 Sessions

```ts
type StudySession = {
  id: EntityId;
  sourceId: EntityId;
  mode: 'manual' | 'pomodoro-25' | 'deep-50' | 'custom' | 'stopwatch';
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  focusedSeconds: number;
  breakSeconds: number;
  manualPauseSeconds: number;
  removedIdleSeconds: number;
  startLocation: SourceLocation;
  endLocation?: SourceLocation;
  visitedLocations: SourceLocation[];
  createdBlockIds: EntityId[];
  createdAnnotationIds: EntityId[];
  createdConnectionIds: EntityId[];
  dictionaryLookupIds: EntityId[];
  reflection?: string;
  revision: Revision;
};
```

## 10. Repository Interfaces

Define interfaces before adapters.

```ts
interface JournalRepository {
  getJournalForSource(sourceId: EntityId): Promise<Journal | null>;
  listBlocks(journalId: EntityId): Promise<JournalBlock[]>;
  createBlock(input: CreateBlockInput): Promise<JournalBlock>;
  updateBlock(input: UpdateBlockInput): Promise<JournalBlock>;
  moveBlock(input: MoveBlockInput): Promise<void>;
  softDeleteBlock(blockId: EntityId): Promise<void>;
  transact<T>(operation: () => Promise<T>): Promise<T>;
}
```

Add equivalent repositories for sources, assets, workspace state, annotations, connections, concepts, glossary, maps, sessions, settings, and backup manifests.

Rules:

- repository methods accept validated domain inputs;
- adapters map storage records to domain records;
- components call use cases/services, not repositories directly where business rules exist;
- generic `put(storeName, object)` is prohibited outside migration tooling;
- transactions cross related records through a unit-of-work boundary.

## 11. Core Use Cases

Implement and test use cases independently from UI.

### 11.1 Import PDF

```text
select file
-> validate MIME/signature and size
-> create asset
-> parse metadata/page count/outline
-> create or attach Book source
-> create source journal
-> create initial workspace state
-> queue text indexing and cover generation
-> open workspace
```

Failure after binary storage must roll back metadata or mark an import recovery record.

### 11.2 Create page-linked block

```text
active workspace location = book A, page 5
user starts typing
-> ensure source journal exists
-> create paragraph block with page 5 SourceLocation
-> insert rank after current block or at end of page group
-> persist
-> update journal view
```

The UI does not ask for the page. The use case receives it from WorkspaceContext.

### 11.3 Capture quote

```text
selected PDF text
-> build resilient TextAnchor with quote/prefix/suffix
-> create quote block at active location
-> optionally create highlight annotation in same transaction
-> maintain reciprocal block/annotation references
```

### 11.4 Create connection

```text
from reference + to reference + relationship
-> validate both endpoints
-> create one Connection record
-> invalidate backlink queries for both endpoints
-> update map/search indexes asynchronously
```

### 11.5 Resume source

```text
open source
-> load WorkspaceState
-> load source asset and source details
-> render saved location
-> load journal blocks near active context
-> restore panel state
-> mark recently opened
```

Never set page to 1 after loading a valid saved state.

## 12. Workspace Context

Create one typed WorkspaceContext or equivalent controller that owns:

- source ID and details;
- asset ID;
- active SourceLocation;
- current text selection;
- workspace layout;
- active tool;
- current session;
- save state;
- commands for creating contextual content.

Journal, dictionary, annotation, and connection features consume this context. They must not each maintain independent page state.

## 13. Editor Architecture

### 13.1 Technical spike before commitment

Time-box a spike comparing at least two viable editors against these requirements:

- custom block/node types;
- stable block IDs;
- JSON document storage;
- collaboration not required now;
- source-location metadata per top-level block;
- drag/reorder;
- nested blocks;
- keyboard navigation;
- paste handling;
- custom React node views;
- large-document performance;
- history and recovery;
- accessibility.

Tiptap/ProseMirror is the recommended baseline to test first.

### 13.2 Page grouping

Do not create one editor document per PDF page. That would fragment the journal and make cross-page writing difficult.

Recommended approach:

- one source journal;
- top-level blocks have source locations;
- UI groups visible blocks by page/location;
- virtualise page groups in review mode;
- active page group opens or is created lazily;
- blocks may be manually moved to another page with an explicit action.

### 13.3 Autosave

- debounce ordinary text writes;
- flush on blur, page navigation, source close, visibility change, and before unload where possible;
- retain local editor history between saves;
- use optimistic concurrency revision checks;
- never silently overwrite a newer revision;
- surface recoverable conflicts.

## 14. PDF Architecture

### 14.1 Worker

Bundle PDF.js worker as a local build asset. CDN worker URLs violate offline requirements.

### 14.2 Rendering

- virtualise continuous pages;
- render visible and adjacent pages only;
- cache page dimensions and thumbnails;
- keep text, annotation, and canvas layers separate;
- apply zoom through deterministic coordinate transforms;
- cancel obsolete render tasks;
- move heavy extraction/indexing to a worker.

### 14.3 Text anchors

Text positions may shift across PDF.js versions or extraction differences. Store:

- page;
- quote text;
- prefix and suffix context;
- offsets where available.

On reopen, resolve by offsets first and quote-context matching second. Mark unresolved anchors rather than guessing silently.

### 14.4 Annotation coordinates

Use page-space normalised coordinates. Add unit tests for:

- zoom in/out;
- rotated pages;
- viewport resize;
- continuous/single mode;
- reopening;
- high-DPI screens.

## 15. Drawing and Canvas Architecture

### 15.1 Separate purposes

- PDF annotation overlay: constrained to a PDF page coordinate system.
- Drawing block: embedded editable canvas inside the journal.
- Mind/argument map: graph of canonical refs and typed edges.
- Free canvas: spatial composition of canonical refs, frames, images, and drawing elements.

Do not force one library to solve every mode if it weakens data fidelity.

### 15.2 Persistence

Store a versioned object document. Cache PNG/SVG previews for lists and export. Never make the preview the only source.

### 15.3 Undo

Use operation history or library-native object history. Do not snapshot the full canvas as a base64 bitmap on every pointer-up event.

## 16. Search Architecture

Define a `SearchService` with replaceable index adapters.

Index documents derived from canonical entities:

- source metadata;
- block plain text;
- concepts and aliases;
- glossary terms and meanings;
- PDF extracted pages;
- annotation text;
- connection relationships.

Index updates are asynchronous but observable. The app can rebuild the entire index from canonical storage. Index data is excluded from mandatory backups or marked disposable.

## 17. Backup Format

Use a versioned manifest.

```json
{
  "format": "cntknw-portable-library",
  "version": 1,
  "createdAt": "ISO-8601",
  "appVersion": "...",
  "schemaVersion": 2,
  "records": {
    "sources": "data/sources.jsonl",
    "journalBlocks": "data/journal-blocks.jsonl"
  },
  "assets": [
    { "id": "...", "path": "assets/...pdf", "checksum": "..." }
  ]
}
```

Requirements:

- serialise explicitly;
- validate every imported file;
- verify checksums where supplied;
- produce a dry-run import report;
- state added, updated, skipped, and conflicting records;
- never overwrite newer local content without explicit resolution;
- test restoration into an empty database.

## 18. Design System Implementation

### 18.1 Tokens first

Create CSS custom properties for:

- colour roles;
- typography;
- spacing;
- radius;
- border;
- shadow;
- motion duration/easing;
- z-index layers;
- panel and reading widths.

Do not mix unconfigured utility classes with large inline-style objects.

### 18.2 Component primitives

Implement and document:

- Button;
- IconButton;
- Input, Select, Textarea;
- Dialog and ConfirmDialog;
- Popover and Tooltip;
- CommandPalette;
- Tabs for local subviews only;
- SplitPane;
- Surface/Card;
- Toast/Status;
- EmptyState;
- Menu;
- ScrollArea;
- ResizablePanel;
- FocusRing.

### 18.3 Story and state coverage

Each primitive should demonstrate default, hover, focus, active, disabled, loading, error, and reduced-motion behaviour. Storybook is optional; a local component-lab route is sufficient initially.

## 19. Exact Build Order

### Phase 0A - Clean reproducible build

1. Delete bundled `node_modules` from the working copy.
2. Use the package manager selected by the owner and generate a clean lock file.
3. Add TypeScript and strict configuration.
4. Add lint, unit-test, and E2E scripts.
5. Confirm clean install and build in a new directory or CI environment.

**Gate:** install, typecheck, lint, unit tests, and production build succeed.

### Phase 0B - Shell and routing

1. Add real router.
2. Build Library, Gallery, Notes layouts.
3. Add nested Study Workspace route such as `/study/:sourceId`.
4. Create design tokens and primitives.
5. Remove separate top-level reader/whiteboard/session routes from navigation.

**Gate:** three primary destinations only; route refresh works.

### Phase 0C - Domain and persistence

1. Add Zod schemas and TypeScript contracts.
2. Implement repositories and in-memory test adapters.
3. Implement v2 IndexedDB adapter with migrations.
4. Add legacy v1 readers and migration dry run.
5. Add transaction and error reporting.

**Gate:** repository contract tests pass against memory and IndexedDB adapters.

### Phase 1 - PDF vertical slice

1. import one PDF;
2. create source and asset;
3. render with local worker;
4. navigate pages;
5. persist and restore workspace state;
6. extract metadata/page count;
7. add lazy page rendering and basic text layer.

**Gate:** AC-001 and AC-002 pass in Playwright offline mode.

### Phase 2 - Journal vertical slice

1. source journal creation;
2. contextual paragraph block;
3. page grouping;
4. autosave and recovery;
5. quote block from PDF selection;
6. complete journal review.

**Gate:** AC-003 and AC-004 pass; no `text`/`content` ambiguity exists.

### Phase 3 - Annotation and drawing

1. highlight and text anchor;
2. normalised geometry;
3. pen/shapes overlay;
4. editable journal drawing block;
5. save/reopen/zoom tests.

**Gate:** AC-007 and AC-008 pass.

### Phase 4 - Connections and concepts

1. generic Reference union;
2. Connection service;
3. backlinks;
4. concept cards;
5. page-to-page and cross-source linking.

**Gate:** AC-005 passes.

### Phase 5 - Dictionary

1. choose licensed dataset;
2. pack importer and local index;
3. selection lookup;
4. save glossary entry;
5. personal/source meanings;
6. occurrence navigation.

**Gate:** AC-006 passes with network disabled.

### Phase 6 - Notes, search, and maps

1. unified Notes queries;
2. local search index;
3. journal/outline/cards projections;
4. mind-map view referencing canonical blocks;
5. argument edge semantics;
6. accessible outline.

**Gate:** AC-009, AC-010, and AC-015 pass.

### Phase 7 onward

Continue with artwork, sessions, production hardening, immersive worlds, then Chess Room exactly in the Product Design Document order.

## 20. Testing Strategy

### 20.1 Unit tests

Test pure functions and schemas:

- source-location equality and grouping;
- PDF page index conversion;
- normalised coordinate transforms;
- rank ordering and block movement;
- connection endpoint validation;
- backlink queries;
- session duration accounting;
- migration mapping;
- import manifest validation;
- text-anchor resolution;
- stats aggregation.

### 20.2 Repository contract tests

Run the same suite against:

- in-memory adapter;
- IndexedDB adapter using a browser test environment.

Test transactions, revision conflicts, soft deletion, migration, and failed writes.

### 20.3 Component tests

- source context propagation;
- block menu and transformations;
- save status;
- dictionary popup;
- connection creator;
- page group rendering;
- keyboard navigation;
- reduced motion;
- focus restoration after dialogs.

### 20.4 End-to-end tests

Critical Playwright journeys:

1. import PDF offline, write on page 5, close, reopen, confirm page and block;
2. navigate to page 100, create connection, verify backlinks at both ends;
3. select word, define offline, save meaning, jump to original passage;
4. highlight text, zoom, resize, switch view, reopen, verify alignment;
5. create drawing, edit objects after reopen;
6. change journal block from map, verify journal update and no duplicate;
7. start manual session, wait without interaction, verify timer continues;
8. export full backup, clear test DB, restore, verify binaries and records;
9. use keyboard only for import, reading, writing, and search;
10. run core flow with network requests blocked.

### 20.5 Migration tests

Maintain representative v1 fixtures containing:

- note using `text`;
- note using `content`;
- PDF and book records;
- raster drawing;
- sessions;
- artwork analysis;
- missing or malformed fields.

The migration report must be deterministic and count every source record as migrated, skipped with reason, or failed.

## 21. Performance Budgets

Initial targets to validate on a typical mid-range laptop:

- launch shell usable without loading all assets;
- typing remains responsive during autosave and indexing;
- continuous PDF mode renders visible and adjacent pages only;
- opening a book does not load the complete journal into one DOM tree when extremely large;
- maps virtualise or simplify distant nodes;
- binary files are not repeatedly converted to base64;
- background workers handle PDF extraction, indexing, and heavy analysis;
- memory use is profiled with a large synthetic library.

Do not hard-code performance claims without measurement. Add benchmarks and record the test device.

## 22. Error and Recovery Rules

Every durable command returns a typed result or throws a typed domain error.

User-visible categories:

- storage unavailable or full;
- asset missing;
- unsupported or corrupt PDF;
- write conflict;
- dictionary pack unavailable;
- backup validation failed;
- migration incomplete;
- search index rebuilding.

Never use `console.error` as the only failure handling. Preserve unsaved editor state and provide a recovery action.

## 23. Security and Privacy

- do not upload user sources or notes without explicit opt-in;
- do not add analytics by default;
- do not log source text or journal content to remote services;
- validate imported filenames and archive paths;
- prevent zip-slip during backup import;
- sanitise rich-text HTML and pasted content;
- use Content Security Policy compatible with bundled workers;
- document any third-party dictionary, OCR, AI, or sync data flow;
- keep secrets out of frontend bundles.

## 24. AI Feature Guardrails

AI is not part of the initial core. When added:

- generated text is labelled as an AI draft;
- source quotes remain distinct from generation;
- the user explicitly accepts content into a journal;
- local and cloud modes disclose data handling;
- the model receives only the context the user selects;
- AI cannot silently create hundreds of links or concepts;
- every generated connection exposes its basis;
- AI content can be removed without damaging user-authored records.

## 25. Agent Operating Protocol

Before coding:

1. Read both v0.2 Markdown documents fully.
2. Inspect the repository and report actual files, dependencies, and build status.
3. State the phase, requirement IDs, and acceptance criteria being implemented.
4. Identify assumptions and conflicts.
5. Create a small implementation plan.

During coding:

1. Keep changes within the active phase.
2. Add or update tests with the implementation.
3. Do not invent new domain shapes inside components.
4. Use migrations for schema changes.
5. Run typecheck, lint, unit tests, relevant E2E tests, and build.
6. Preserve user data and legacy fixtures.
7. Update documentation when an approved decision changes.

After coding:

1. Summarise files changed.
2. Report test commands and exact outcomes.
3. Map completed work to requirement IDs.
4. List known limitations and deferred items.
5. Do not claim completion when a gate is failing.

## 26. Prohibited Shortcuts

- No new main tabs.
- No direct component calls such as `put('notes', arbitraryObject)`.
- No single untyped `Note` record shared by unrelated features.
- No storing annotations by `bookId` when the actual PDF asset is required.
- No page-1 reset after async load.
- No CDN worker for PDF.js.
- No flattened-only drawing persistence.
- No canvas nodes containing independent copies of journal text.
- No 3D catalogue with a second book model.
- No `any` to bypass core domain typing.
- No deleting v1 data before verified migration and backup.
- No unvalidated JSON import.
- No asynchronous work hidden behind optimistic success messages.
- No fake AI explanations presented as dictionary or source content.

## 27. Definition of Done

A task is done only when:

- product invariants remain intact;
- relevant acceptance criteria pass;
- TypeScript strict checks pass;
- lint passes;
- unit and repository tests pass;
- relevant Playwright journeys pass;
- production build passes from a clean install;
- offline behaviour is tested when relevant;
- keyboard and focus behaviour is checked;
- persistence survives reload;
- schema changes have migrations;
- errors have user-visible recovery;
- documentation and requirement status are updated;
- no hidden console error remains in the tested flow.

## 28. Checkpoint Report Template

```text
Phase:
Requirements implemented:
Acceptance criteria:

Repository observations:
- ...

Changes:
- ...

Data/schema changes:
- migration version ...
- rollback/recovery ...

Verification:
- install:
- typecheck:
- lint:
- unit tests:
- E2E tests:
- production build:
- offline test:

Known limitations:
- ...

Next safe step:
- ...
```

## 29. Copy-Paste Master Prompt for a Coding Agent

```text
You are implementing CNTKNW, a local-first personal knowledge museum and study studio.

Before editing code, read these files completely:
1. CNTKNW_Product_Design_Document_v0.2.md
2. CNTKNW_AI_Implementation_Handoff_v0.2.md
3. CNTKNW_Requirements_v0.2.json

Then inspect the actual repository. Do not assume the existing code matches the product specification.

Non-negotiable rules:
- The only primary destinations are Library, Gallery, and Notes.
- Books and artworks open in one shared Study Workspace.
- Each source has one continuous journal.
- New journal blocks inherit the active source location automatically.
- Empty pages do not create visible journal sections.
- Journal, outline, cards, and maps render the same canonical blocks.
- Explicit links are first-class Connection records with backlinks.
- Editable drawings and annotations may not be stored only as flattened images.
- Core reading, writing, annotation, dictionary, and search are offline-capable.
- Components do not write arbitrary records directly to database stores.
- Every schema change includes a migration.
- Do not work on immersive 3D or chess before the core phases pass.

For this task:
1. State the current phase and requirement IDs.
2. Audit the relevant existing files.
3. Identify conflicts or missing information.
4. Implement the smallest complete vertical slice.
5. Add tests before claiming completion.
6. Run clean install/build, typecheck, lint, unit tests, relevant E2E tests, and offline checks.
7. Report exact results and known limitations.

Never hide failures, invent completed work, or weaken a requirement silently.
```

## 30. First Assignment for the Agent

The first implementation assignment should be **Phase 0A-0C only**:

1. create a clean branch and reproducible dependency install;
2. migrate the app shell to TypeScript;
3. establish Library, Gallery, Notes, and nested Study Workspace routing;
4. create design tokens and basic UI primitives;
5. define Zod schemas and repository interfaces;
6. create memory and IndexedDB adapters;
7. implement a read-only v1 audit and migration dry-run report;
8. add unit, repository, and basic route tests;
9. do not yet build the full journal, 3D, chess, or AI.

The output of the first assignment must include an architecture report and a tested migration plan before any destructive data operation.

## 31. Handoff Change Log

| Version | Date | Change |
|---|---|---|
| 0.2 | 24 July 2026 | Initial implementation handoff based on the v0.2 product design and verified uploaded prototype audit. |
