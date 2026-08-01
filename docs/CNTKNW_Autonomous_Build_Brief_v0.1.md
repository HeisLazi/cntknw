# CNTKNW — Autonomous Build Brief

**Issued:** 1 August 2026
**Issued by:** Lazarus Petrus (stakeholder)
**Executed by:** Claude Opus 5, autonomously
**Repository:** `https://github.com/HeisLazi/cntknw` (private), branch `main`

> **Source instruction.** *"Continue and go as far as you can in development.
> Use proper development principles to make sure your work is correct. Commit
> to the GitHub repo after major points. Work autonomously without any input
> from me; only ask me questions as the stakeholder."*

This document expands that into an executable brief. It exists so that a
reader six months from now — or a different agent — can tell what was
authorised, what was decided under that authority, and what was deliberately
left alone.

---

## 1. Standing authority granted

| Granted | Scope |
|---|---|
| **Autonomous execution** | Build, test, refactor and document without per-step approval. |
| **Push to `origin/main`** | The named repository, at major points. Not force-push; not any other remote. |
| **Technical decisions** | Library choices, schema shapes, test strategy, refactors — recorded in ADRs where they are load-bearing. |

**Not granted, and not assumed.** Anything outside the repository: publishing
publicly, changing repository visibility, adding collaborators, installing
global tooling, or touching the frozen `src/legacy-v1/` prototype and the v1
IndexedDB database. Force-pushing over the shared history is excluded even
though push is granted — it is a different act.

## 2. What "proper development principles" is taken to mean here

Not a slogan. The project already has an enforcement apparatus, and the brief
is to keep using it rather than to start being careful by hand:

1. **The gate is the definition of done.** `typecheck → lint → unit → e2e →
   build → audit`. A phase is not complete while any of them fails, and a
   softened assertion is not a pass.
2. **Invariants are enforced by tests, not by memory.** INV-001 (three
   destinations), INV-002 (one workspace), INV-014 (no UI writes to storage),
   the design-token rules, and the v1 read-only boundary all fail the build if
   violated. Anything new that is load-bearing gets the same treatment.
3. **Claims are checked, never asserted.** If a report says a thing works,
   there is a test that fails when it stops working. Where a test could pass
   vacuously, a negative control proves it can fail.
4. **A flaky gate is not a passing gate.** Intermittent failures get diagnosed
   and fixed, not re-run. Where the cause is environmental, it is recorded.
5. **Decisions are written down with their cost.** Load-bearing choices become
   ADRs stating what was rejected and why, so a future reader can disagree
   with the reasoning rather than guess at it.
6. **Honest reporting.** Failures reported as failures; deferrals named as
   deferrals; anything unproven labelled unproven.

## 3. State at the start of this brief

Complete and verified: Phases 0A–0E, and the core of Phase 1.

| Capability | State |
|---|---|
| Domain contracts, persistence, migration dry run | Complete; contract- and browser-tested |
| Shell, routing, design tokens, 19 UI primitives | Complete |
| PDF import, render, text layer, exact resume | AC-001 and AC-002 E2E-accepted |
| Journal blocks with inherited page context | AC-003 and AC-004 E2E-accepted |
| Rich-text editing (ProseMirror, one block) | Editor spike complete; ADR-0004 |

Gate at start: 435 unit tests (17 files), 54 Playwright tests, 0 production
vulnerabilities, main bundle 493 kB.

**Known defect carried in:** a race between the workspace autosave and the
journal autosave. Recorded, not hidden — and the first thing this brief fixes,
because building more autosave-adjacent state on top of a known race is how a
small bug becomes an unfindable one.

## 4. The plan

Phase order from PDD §24. Each phase exits on its own acceptance criteria plus
the full gate, and each is pushed to `origin/main` on completion.

| # | Phase | Acceptance criteria | Notes |
|---|---|---|---|
| **1.5** | Autosave race + Phase 1 completion | — | Fix the carried defect. Document outline, page-number entry, in-source search. |
| **2** | Infinite journal | AC-003, AC-004 | Block types beyond paragraph; continuous journal across pages; block reordering; soft-delete and restore UI. |
| **3** | Annotation and drawing | AC-007, AC-008 | Highlight anchored to the text layer; drawing that stays editable. Resolves the deferred `AnnotationGeometry` discrimination. |
| **4** | Connections and concepts | AC-005 | Typed connections; backlinks at both endpoints; concept extraction. |
| **5** | Dictionary and glossary | AC-006 | **Blocked on a stakeholder decision — see §5.** |
| **6** | Notes, search, and maps | AC-009, AC-010 | Cross-source search; the Notes route made real; mind-map view over canonical blocks. |
| **7** | Artwork study | — | Image sources in the same workspace (INV-002). |
| **8** | Sessions and statistics | AC-011, AC-012 | Manual timing default (INV-010). |
| **9** | Production hardening | AC-013, AC-015 | Backup and restore (INV-015); accessibility sweep; performance at scale. |
| **10** | Immersive worlds | AC-014 | 3D optional, never gating (INV-011). |
| **11** | Chess Room | AC-016 | Library content, never a main tab (INV-012). |

**Method per phase.** Understand the requirement from the PDD and handoff →
design and record load-bearing decisions → implement → test at the right level
(contract, component, browser) → run the full gate → adversarially review →
document → commit and push.

## 5. Stakeholder decisions

Three, put to the owner before execution rather than discovered mid-phase.

**D-1 — Scope ceiling.** How far to push: depth through the study core
(Phases 2–6), or breadth toward Phase 11 including 3D and chess.

**D-2 — Dictionary data source (Phase 5, AC-006).** The criterion requires
*offline* lookup, which rules out an API. The realistic options differ in
bundle size and licence, and the choice is the owner's rather than an
implementation detail.

**D-3 — Visual design.** The application is deliberately plain: correct,
tokenised, accessible, and not yet *designed*. A Claude Design brief was
produced for the owner. Whether to spend effort on visual design now or wait
for the owner's design output changes what gets built.

Recorded answers appear in §6 once given.

## 6. Decisions taken

### D-1 — Scope: the study core, deep (Phases 2–6)

**Owner decision, 1 August 2026.** Build Phases 2 through 6 properly — journal,
annotation and drawing, connections and concepts, dictionary and glossary,
search and maps — each with full test coverage, rather than reaching Phase 11
thinly.

**Consequence.** Phases 7–11 (artwork study, sessions, hardening, immersive
worlds, chess) are **out of scope for this brief** and are not started. The
3D library and Chess Room remain unbuilt; INV-011 and INV-012 already require
them to be optional and non-gating, so nothing depends on them.

### D-2 — Dictionary: bundled Wiktionary extract

**Owner decision, 1 August 2026.** Richer than WordNet: etymologies, multiple
languages, quotations — which matters for reading philosophy in translation,
where the etymology of a term is often the argument.

**Cost accepted:** a large data file, CC BY-SA attribution obligations, and a
messier parse than WordNet's structured database.

**Implementation consequence, decided under technical authority.** A
hundred-megabyte file cannot go into the JavaScript bundle, and must not — it
would be parsed and held in memory on every load. The extract is therefore
handled as *data*, not as code:

1. A parser and an import pipeline that ingests a Wiktionary extract into
   IndexedDB once, as a searchable store.
2. Lookup, save-to-glossary and reopen-at-passage (AC-006) built against that
   store, so they are complete and tested regardless of how much data is
   loaded.
3. A curated seed extract bundled for immediate use, with the full extract
   importable by the owner.

This keeps AC-006 honestly satisfiable offline. What is bundled versus what
must be imported will be stated exactly in the Phase 5 checkpoint rather than
blurred.

### D-3 — Design: full pass, agent judgment

**Owner decision, 1 August 2026.** Design the application properly against
PDD §9 — the quiet museum, the archival reading room — rather than waiting for
external design output.

**Consequence.** The design work is the agent's, made against the PDD design
bible and the existing token system. It may diverge from whatever the owner
later receives from a design tool; §9 of the PDD, not this agent's taste, is
the authority in any disagreement. Everything continues to resolve to tokens,
so a later redesign remains a change to the token layer plus component
structure rather than a rewrite.

## 7. Commit and push policy

- Conventional prose commit messages: what changed, why, what it prevents.
- Push at phase completion and at any point where the gate has just passed on
  a meaningful body of work.
- Tag at phase boundaries (`phase-N-complete`).
- Never push a failing gate. If the gate fails at a natural push point, the
  failure is fixed or the work is not pushed.
