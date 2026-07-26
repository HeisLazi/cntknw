---
issued: 2026-07-25
issued_by: Lazarus Petrus
subject: Handoff to Claude Code — Phase 0C closure (Part A) then Phase 0D (Part B)
status: Issued. Supersedes the in-session execution of the 0C-closure/0D brief.
note: >
  Written because Cowork was consuming too much usage for a build this long.
  This is a self-contained brief: it carries the true repository state, what
  the previous session completed, and the two environment limits it hit.
---

# CNTKNW — Phase 0C closure and Phase 0D

Paste this into Claude Code with the repository open at `philosophy-journal-complete`.

---

## Who you are

Senior implementation engineer and audit owner for **CNTKNW**, a local-first personal knowledge museum and study studio.

Two ordered parts:

- **Part A** — close the remaining Phase 0C blockers and correct the documentation.
- **Part B** — Phase 0D: shell, routing, providers, design tokens, UI primitives.

**Do not start Part B until every Part A gate passes.** If a gate fails, stop, report Phase 0C incomplete, and do not begin Part B.

---

## 1. Read first

In `docs/`, in this order:

1. `CNTKNW_Documentation_Index.md` — read order, phase sequence in force, editing rules
2. `CNTKNW_Current_Implementation_Status.md` — what exists
3. `CNTKNW_Product_Design_Document_v0.2.md`
4. `CNTKNW_AI_Implementation_Handoff_v0.2.md`
5. `CNTKNW_Requirements_v0.2.json`
6. `CNTKNW_ADR_0001_Phase_0B_Foundations.md` — 13 decisions
7. `CNTKNW_ADR_0002_Phase_0C_Persistence.md` — 10 decisions
8. `CNTKNW_Phase_0C_Checkpoint_Report.md`
9. `CNTKNW_Amendments_Register_v0.2.md`
10. `CNTKNW_Atlas_System_Design_Document_v0.1.md` and `CNTKNW_Read_Aloud_System_Design_Document_v0.1.md` — both approved
11. `prompts/2026-07-25_phase-0b-audit-and-phase-0c-brief.md` and `prompts/2026-07-25_phase-0c-audit-closure-and-phase-0d.md` — the audits driving this work

**Handoff §19's build order is superseded** by ADR-0001 §1. The order in force is: 0A build → **0B domain contracts** → **0C persistence** → **0D shell and routing** → 0E editor spike.

**Nine files in `docs/` are checksummed** by `CNTKNW_CHECKSUMS_v0.2.sha256` and all currently verify. Do not edit them in place. Put supplemental material in new documents. Verify with `cd docs && sha256sum -c CNTKNW_CHECKSUMS_v0.2.sha256`.

Precedence: latest owner decision → PDD v0.2 → Handoff v0.2 → approved ADRs and register entries → approved supplemental specs → existing code → assumptions. **Code is evidence, never the specification.**

---

## 2. True state right now

Phase 0B complete and verified. Phase 0C **implementation** complete and verified under `fake-indexeddb`, **but the phase gate is not met**.

Last full run — Node v22.22.3, npm 10.9.8, Linux, clean install:

```
npm ci              PASS
npm run typecheck   PASS   0 errors
npm run lint        PASS   0 errors, 0 warnings
npm run test        PASS   331/331, 9 files, 0 skipped
npm run build       PASS   190.89 kB (60.22 kB gzipped)
npm audit --omit=dev       0 vulnerabilities
npm audit                  5 high, all dev-only (ESLint transitive)
```

Contract suite: memory 53/53, indexeddb 53/53 — identical cases.

### Two environment limits the previous session hit — read before planning

**There is no Git repository.** `git status` returns *not a repository*, and there is no `.git`. The audit asks for a Git-derived file inventory; that is currently impossible.

> **Do this first:** `git init`, commit the current tree as the Phase 0C baseline, and tag it (`phase-0c-impl`). Every later inventory requirement then works. Report the baseline commit in your checkpoint.

**Playwright browsers could not be installed in the previous environment.** `npx playwright install --with-deps chromium` failed — sudo is blocked by a `no-new-privileges` flag. `@playwright/test@1.62.0` installed fine; only the browser binaries failed.

> Try `npx playwright install chromium` without `--with-deps` on your machine. If browsers still will not install, **stop and report** — do not fake the browser gate, and do not proceed to Part B.

---

## 3. Part A — Phase 0C closure

Five findings. C-01 and C-02 are blocking.

### C-01 (blocking) — Phase status contradicts the missing browser gate

Docs call Phase 0C "complete and verified" while also admitting Playwright is absent and browser persistence is unproven. `fake-indexeddb` does not prove real reload persistence, browser transaction lifetime, or browser-specific IndexedDB behaviour.

Until the browser gate passes, everywhere state:

> Phase 0C implementation complete; browser and concurrency closure pending.

After it passes:

> Phase 0C complete and verified in both contract and real-browser environments.

### C-02 (blocking) — optional concurrency leaves a silent-overwrite path

ADR-0002 §4 makes `expectedRevision` optional, and omission means last-write-wins. That leaves an ordinary repository path that can silently overwrite newer user content.

Replace it with a mandatory guard:

```ts
type ConcurrencyGuard =
  | { mode: 'expected'; revision: Revision }
  | { mode: 'unconditional'; reason: 'migration' | 'repair' };
```

Rules:

- `create` needs no guard.
- `update`, `delete` and `restore` on revisioned records **require** one.
- Application code uses `expected` mode.
- `unconditional` is explicit and confined to migration/repair.
- **Omission must never mean last-write-wins.**
- Stale → `RevisionConflictError`; stored data unchanged.
- Memory and IndexedDB behave identically.
- Update every call site. No `any`.

Cover: Source, Journal, JournalBlock, Annotation, Connection, Concept, GlossaryEntry, EpistemicClaim, mutable StudySession, WorkspaceState.

Tests: valid update, stale update, stale delete, stale restore, data unchanged after conflict, both revisions reported, explicit override, adapter parity.

Record as **ADR-0003** (supersede ADR-0002 §4 rather than editing it silently) and add a register entry.

Existing `assertRevision` lives in `src/data/repositories/concurrency.ts`. Adapters: `src/data/adapters/memory/index.ts`, `src/data/adapters/indexeddb/index.ts`.

### C-03 — "structurally write-incapable" is overclaimed

`src/legacy/v1/readers.ts` is read-only by module boundary, but that is not proof the connection physically cannot write. Use:

> v1 access is read-only by module boundary and public API; no schema upgrade is declared and no raw database or table handle escapes the reader module.

Verify no `.version()` for v1, no exported read-write helper, no raw handle escaping. Add an import-boundary or architecture test where practical.

### C-04 — annotation-loss wording too absolute

The 0C checkpoint says every v1 annotation was lost. The inspected `PDFReader.jsx:252` path targets an undeclared store and does fail — but that does not prove every real v1 database is empty. Use:

> The inspected v1 annotation save path failed. Migration scans `pdfAnnotations` and any phantom `annotations` store separately; unexpected populated data is reported and preserved for inspection.

The scanning code is already correct. Only the wording needs fixing.

### C-05 — file inventory counts wrong

The 0C checkpoint says 11 new / 10 modified; the actual lists total 12 and 11. Regenerate from Git after `git init`.

### C-06 — test terminology

Use the runner's exact terms: test files, tests, skipped. Do not call 106 tests "106 assertions" without a measured assertion count.

### Then run the closure gate

```bash
npm ci && npm run typecheck && npm run lint && npm run test \
  && npm run test:e2e && npm run build && npm audit --omit=dev && npm audit
```

Required: all unit and contract tests pass; memory and fake-indexeddb contracts stay identical; **all five browser tests pass in Chromium**; real rollback and real revision-conflict preservation pass; build passes; no skipped required tests; no production-reachable high-severity advisory.

### Required browser tests

Use public application/repository composition boundaries — **not raw IndexedDB calls from the Playwright test**. A test-only harness route is fine. Isolate the database per test.

- **BV-001** Persistence across reload — create Source, Journal, JournalBlock, WorkspaceState through public APIs; reload; recreate composition; read back. Assert identity, content, revision, source-location context.
- **BV-002** Real transaction rollback — multi-store UnitOfWork, ≥2 writes, throw after an intermediate write, reload, prove no partial record survived.
- **BV-003** Real revision conflict — one valid update, then a stale one; assert `RevisionConflictError`; reload; prove newer content intact.
- **BV-004** Nested transaction — inner UnitOfWork joins the outer browser transaction and rolls back with it.
- **BV-005** Database separation — v2 writes only to `cntknw` (or a test-isolated v2 database) and never upgrades or deletes `philosophy-journal`.

### Documents to update in Part A

`CNTKNW_Current_Implementation_Status.md`, `CNTKNW_Phase_0C_Checkpoint_Report.md`, new `CNTKNW_ADR_0003_*`, `CNTKNW_Amendments_Register_v0.2.md`, `CNTKNW_Documentation_Index.md`.

---

## 4. Part B — Phase 0D

**Only after Part A passes.**

### Scope

Build: composition root and providers; a real router with stable URLs; exactly three primary destinations; the shared Study Workspace route; route-level loading / error / missing-source / not-found states; design tokens, typography and motion; reusable UI primitives; responsive shell; a development-only component lab; accessibility, component, routing and Playwright tests.

Do **not** build: PDF rendering or PDF.js; journal editor or ProseMirror/Tiptap; annotations or drawing; dictionary or search; Atlas entities or UI; Read Aloud playback; migration apply; backup/restore; 3D, chess, AI.

### Router dependency

`react-router-dom` was **removed** in Phase 0C. It carried the only two production-reachable advisories (React Router RSC-mode CSRF bypass, GHSA-qwww-vcr4-c8h2), `@latest` at the time (7.18.1) was still inside the vulnerable range `7.12.0 – 8.2.0`, and it was imported nowhere. That dropped production vulnerabilities 7 → 0.

Check current versions and advisories **at implementation time**. Install a safe compatible version only. If none exists, stop and propose an ADR comparing alternatives — **do not silently switch router libraries**.

### Routes

```
/                    redirect or landing
/library
/gallery
/notes
/study/:sourceId
/components          development-only
/settings            secondary route or overlay
*                    not found
```

Permanent primary navigation contains **only Library, Gallery, Notes** (INV-001, IA-001). Never promote Sessions, Whiteboard, PDF Reader, Dictionary, Export, Settings, Chess or Atlas to a fourth primary destination. Books and artworks use the **same** `/study/:sourceId` route.

### Composition

```
App
└── ErrorBoundary
    └── Repository/ApplicationServices Provider
        └── RouterProvider
            └── AppShell
```

UI must not import `adapters/indexeddb`. UI consumes interfaces through typed hooks/context. One composition module picks the production adapter. Tests inject the memory adapter. React context is not a second database — durable state stays in repositories; only transient UI state is local.

### Design direction

Dark-mode first. Quiet museum / editorial language — scholarly, intimate, calm, precise. Strong typography and spacing, restrained accents. No dashboard aesthetic, no rainbow block palette, **no cloud-hosted fonts** (NFR-006). Semantic tokens must allow a future light mode. See PDD §9 for the full design bible.

Tokens as CSS custom properties: colour and surface roles, typography families and scale, spacing, radius, borders, shadows, motion duration/easing, z-index layers, panel and reading widths, focus-ring dimensions.

### Primitives

Button, IconButton, Input, Select, Textarea, Dialog, ConfirmDialog, Popover, Tooltip, CommandPalette, Tabs (local only — never replacing the three routes), SplitPane, Surface/Card, Toast/Status, EmptyState, Menu, ScrollArea, ResizablePanel, FocusRing.

Cover default, hover, focus-visible, active, disabled, loading, invalid/error, keyboard and reduced-motion states. Prefer native semantics and established accessible primitives over custom reimplementation.

### Accessibility

Semantic headings and landmarks, skip navigation, keyboard-accessible everything, visible focus, sufficient contrast, **no colour-only meaning**, reduced-motion support, resizable text and panels, usable touch targets, responsive tablet and phone navigation. Desktop is the complete shell; phone prioritises navigation and light route content rather than imitating the desktop workspace.

### Phase 0D gate

Exactly three primary destinations; stable URLs survive refresh; shared Study Workspace route exists; no forbidden tool is a primary destination; tokens are the styling source of truth; required primitives exist and are documented; keyboard and reduced-motion tests pass; **all Phase 0C browser tests remain green**; typecheck, lint, tests, Playwright, build and audits pass; documentation updated.

Playwright: direct navigation and refresh on `/library`, `/gallery`, `/notes`, `/study/:sourceId`; exactly three visible primary links; settings and component lab are not primary tabs; visible keyboard focus; narrow-viewport navigation; unknown route and missing source both recoverable.

---

## 5. Standing rules

- No `any` to bypass domain typing.
- No generic `put(storeName, object)` outside migration tooling.
- Never mutate or delete v1 data.
- Never silently overwrite a newer revision.
- No fake transaction wrappers.
- No auto-running destructive migration.
- No E2E claims from unit tests.
- No `npm audit fix --force`.
- **No completion claim while a required gate fails.**
- Report failures honestly; do not soften a gate to make it pass.
- Types flowing *in* use `z.input`; types coming *out* use `z.infer` (ADR-0001 §2) — this caused a whole class of bugs already.

---

## 6. Deliverable

One checkpoint report covering: Phase 0C closure changes and the new ADR; Playwright and browser results; corrected documentation and Git-derived file inventory; Phase 0D routes, providers, shell, tokens, primitives, component lab, accessibility, responsive behaviour; exact commands, exit codes, test files, test counts, skipped tests, browser projects, build result, audit result; requirement mapping using **contract-tested / browser-tested / component-tested / E2E-accepted / deferred**; known limitations; next approved phase.

Do not begin the PDF or editor vertical slice.

---

## 7. Open decisions carried forward

| # | Decision | Blocks |
|---|---|---|
| 4 | Is `conflict` its own record or an Event subtype? | Atlas modelling |
| 5 | Is `institution` distinct from `organisation`? | Atlas modelling |
| 6 | Is `period` an entity or a named `TemporalExtent`? | Atlas modelling |
| 7 | `BlockContent.doc` versus `.text` duplication | Phase 0E editor spike |

None blocks Phase 0D.
