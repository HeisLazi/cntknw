# CNTKNW Phase 0C Closure and Phase 0D — Checkpoint Report

**Date:** 26 July 2026
**Phases:** 0C closure (Part A) and 0D — shell, routing, providers, design tokens, UI primitives (Part B)
**ADRs in force:** ADR-0001, ADR-0002 (§4 superseded), **ADR-0003** (new)
**Verification:** **PASSED.** Full gate in §12, including `test:e2e`.

---

## 1. What was asked, and what happened

Two ordered parts, with an instruction not to begin Part B until every
Part A gate passed.

**Part A — Phase 0C closure.** Five audit findings, two blocking. All five
are closed. The blocking pair — C-01, the browser gate, and C-02, the
silent-overwrite path — are closed with running code and passing tests, not
with wording changes.

**Part B — Phase 0D.** Built in full: composition root, providers, router,
three primary destinations, the shared Study Workspace, route-level states,
design tokens, nineteen UI primitives, a development-only component lab,
responsive shell, and accessibility, component, routing and Playwright tests.

**Nothing was deferred or scaled down.** Two environment limits the brief
warned about did not apply on this machine, and are recorded in §2.

---

## 2. The two environment limits, resolved

The brief flagged two blockers from the previous session. Both were
environmental, and neither survived contact with this machine.

**Git.** There was no repository. `git init` was run, the working tree was
committed unmodified as the Phase 0C baseline, and it was tagged.

| Tag | Commit | Meaning |
|---|---|---|
| `phase-0c-impl` | `4494f24` | The tree exactly as Phase 0C left it |
| `phase-0c-closed` | `c99ae5b` | Part A complete; browser gate green |

Every inventory from that tag onward is Git-derived. **Nothing before it is**,
and §10 says so rather than implying otherwise: there is no pre-0C commit, so
Git cannot reconstruct which files Phase 0C added versus modified.

**Playwright.** `npx playwright install chromium` succeeded without
`--with-deps`. Chrome Headless Shell 151.0.7922.34 installed and launched on
the first attempt; the `no-new-privileges` sudo restriction that blocked the
previous session is a property of that environment, not of the task.

---

## 3. Part A — the five findings

### C-01 (blocking) — phase status contradicted the missing browser gate

**Closed by building the gate.** `@playwright/test` 1.62.0 with Chromium
151.0.7922.34; eight tests across five specs, all passing.

| ID | What it proves |
|---|---|
| BV-001 | A source, journal, block, workspace state and binary survive a **real reload**, with identity, content, revisions and source-location context intact — plus a second reload, so a first pass cannot succeed by caching |
| BV-002 | A five-write, four-store unit of work rolls back in a real IndexedDB transaction, re-checked after a reload |
| BV-003 | A stale write is rejected and the newer content survives on disk; the explicit override still lands |
| BV-004 | A nested unit of work joins the outer browser transaction instead of committing independently |
| BV-005 | v2 leaves `philosophy-journal` at version 1 with its records intact, and creates no other database |

Every spec drives the **public composition** — `importPdf`,
`createPageLinkedBlock`, `resumeSource`, the repositories, the unit of work —
through a development-only harness page. Raw IndexedDB appears twice, both
fixtures rather than the system under test: staging the legacy database, which
CNTKNW has no writer for and must never acquire one, and reading
`indexedDB.databases()` to observe what v2 did *not* touch. Each test gets its
own v2 database, because IndexedDB is origin-global.

**The suite was validated against a deliberate defect.** `DexieUnitOfWork.run`
was temporarily reduced to a pass-through — exactly what ADR-0002 §5 warns
about — and BV-002 and BV-004 both failed, BV-002 reporting a surviving source
where it expected none. The change was reverted and the suite re-run green.
Without that check, "8 passed" would only have shown that the assertions ran.

The status wording is now, everywhere:

> Phase 0C complete and verified in both contract and real-browser environments.

### C-02 (blocking) — optional concurrency left a silent-overwrite path

**Closed by ADR-0003**, which supersedes ADR-0002 §4 in full.

```ts
type ConcurrencyGuard =
  | { mode: 'expected'; revision: Revision }
  | { mode: 'unconditional'; reason: 'migration' | 'repair' };
```

- `create` takes no guard. `update`, `delete`, `softDelete`, `restore`,
  `archive`, `unarchive` and `moveBlock` **require** one.
- Application code uses `expectedRevision(n)`; `unconditionally(...)` is the
  only override and must be written out at the call site.
- **Omission cannot mean last-write-wins.** It is a compile error, and
  `assertRevision` also rejects a missing or malformed guard at runtime — so
  the rule survives a JavaScript caller, a bad cast, or a value from
  `JSON.parse`. That runtime half is contract-tested; without it, "mandatory"
  would be a claim about the compiler rather than about the system.

**The change was not merely typed — it closed two real windows.** ADR-0002 §4
argued that Phase 0B's use cases read and write inside one transaction. Two did
not: `promoteBlockToClaim` and `linkBlockToExistingClaim` both read a record
*before* opening the transaction and wrote it inside. Both now guard on the
revision they actually read.

`WorkspaceState.upsert` is split into `create` and `update`. An upsert cannot
honour a mandatory guard on its insert branch — there is no stored revision the
caller could have read, so any guard it passed would be a fiction. Adds
`RecordAlreadyExistsError`.

Coverage is stated exactly in ADR-0003 §4, including what is deliberately
**not** guarded and why: `Asset`, `SourceAsset`, `BookDetails` and
`ArtworkDetails` carry no revision, so there is nothing for a guard to check.
`Journal` is revisioned but has no mutating method in this phase; the interface
records the rule so one cannot be added without meeting it.

### C-03 — "structurally write-incapable" was an overclaim

Withdrawn. `readV1Snapshot` holds a live Dexie handle while it runs, and a
Dexie handle can write. The claim is now the narrower, true one:

> v1 access is read-only by module boundary and public API; no schema upgrade
> is declared, and no raw database or table handle escapes the reader module.

And it is **checked**, in `src/legacy/v1/read-only-boundary.test.ts` — five
tests: no `.version()`; no Dexie write, delete, upgrade or `'rw'` verb; exactly
three exports, none returning a `Dexie` or `Table`, with `openV1` private and
its handle closed in a `finally`; no module outside `legacy/v1` naming the v1
database; and `applyMigration` absent from the whole tree.

### C-04 — annotation-loss wording was too absolute

"Every annotation a v1 user drew was discarded" is not supported by reading one
broken write path in one build. Corrected to:

> The inspected v1 annotation save path failed. Migration scans
> `pdfAnnotations` and any phantom `annotations` store separately; unexpected
> populated data is reported and preserved for inspection.

**No code changed.** The scanning was already correct; only the description was
wrong.

### C-05 — file inventory counts were wrong

The 0C checkpoint §10 stated "New (11)" above a list of twelve and
"Modified (10)" above a list of eleven, and within that list called eight
repository interfaces seven. All three corrected, verified against the tag.

The limit is now stated plainly rather than worked around: **Git cannot derive
the Phase 0C new-versus-modified split**, because that boundary predates the
first commit. Pre-tag lists are hand-corrected and labelled as such; everything
after the tag is Git-derived.

### C-06 — test terminology

"106 assertions" was the runner's *test* count for one file, and no assertion
count was ever measured. Every figure in both reports now uses the runners' own
terms: test files, tests, skipped, browser projects.

---

## 4. Part B — Phase 0D composition

```
App
└── ErrorBoundary            outermost, so it catches a failure in the
    └── RepositoryProvider   providers or the router, not only in a route
        └── ToastProvider
            └── RouterProvider
                └── AppShell (rendered by the route table)
```

**`app/composition/production.ts` is the only module that names a concrete
storage adapter.** Everything above it depends on the `Repositories`
interface and cannot reach IndexedDB, Dexie or a table name even by accident.
That is what makes INV-014 — *"UI components do not directly write arbitrary
database records"* — a structural property rather than a rule someone has to
remember, and `architecture.test.ts` fails if a second module imports an
adapter.

Repositories are **injected**, never constructed by the provider. Production
passes the graph from the composition root; every test passes the memory
adapter through `renderWithProviders`. No test touches IndexedDB and no
repository is mocked.

React context here is a dependency-injection channel, **not a second
database**. It carries interfaces; nothing durable lives in it.

---

## 5. Routes

```
/                    → redirect to /library
/library             ┐
/gallery             ├ exactly three primary destinations (INV-001, IA-001)
/notes               ┘
/study/:sourceId       shared Study Workspace, books AND artworks (INV-002)
/settings              secondary
/components            development-only
*                      not found
```

**Three primary destinations, and the number is enforced.**
`PRIMARY_DESTINATIONS` is asserted to have length three; a further test walks a
list of things that must never be promoted — Sessions, Whiteboard, PDF Reader,
Dictionary, Export, Settings, Chess, Atlas, Components, Home, Dashboard, Search
— and fails if any appears. This is the invariant most likely to erode by good
intentions, because every future feature will feel like it deserves a tab.

**One workspace route.** A `/gallery/:id` viewer would fork every capability
built into the workspace — journal, annotations, connections, Read Aloud. Read
Aloud's Listen-Only remains a *layout mode* of this route (ADR-0001 §7).

**`/` redirects rather than landing.** A home page would be a fourth
destination in everything but name.

**Route-level states**: loading, error with retry, missing source, not found.
A missing source is reported as missing, **not** as a 404 — the route is valid
and the id well-formed, so "page not found" would be false, and the recovery is
different. Both dead-end cases offer a way back.

### Router dependency

`react-router-dom@latest` is **still 7.18.1**, inside the advisory range
`7.12.0 – 8.2.0`, and is only a wrapper depending on `react-router` at the same
version. `react-router` itself is at **8.3.0**, above the range's ceiling.

Installed `react-router@8.3.0` directly. This is not a silent switch of router
library: from v7 onward `react-router` *is* the package and `react-router-dom`
is a compatibility shim. Peer requirements (`react >= 19.2.7`) are met.
**Production vulnerabilities remain 0.**

---

## 6. Design system

`src/design/tokens.css` is the styling source of truth, in two layers:
`--cn-palette-*` raw values that no component may use, and `--cn-*` semantic
roles that components consume. Covered: colour and surface roles, typography
families and a 1.2 minor-third scale, spacing, radius, borders, shadows, motion
duration and easing, z-index layers, panel and reading widths, focus-ring
dimensions, and a 44px minimum touch target.

Dark-mode first, per PDD §9. Warm neutrals rather than blue-grey — a cool grey
reads as software, and the reading planes need to feel like paper under a lamp.
One accent, a muted verdigris, because PDD §9.4 asks for one and blocks must not
become a rainbow. No cloud-hosted fonts (NFR-006); system stacks, with the first
family of each stack the only thing that changes when self-hosted files land.

**Light mode redefines only the semantic layer** — no component rule is
duplicated. It ships now not as a finished design but as proof the token
structure can carry one.

**Reduced motion is collapsed at the token level**, so a component that
animates through the tokens is compliant by construction. 1ms rather than 0, so
`transitionend` still fires and nothing waiting on it hangs.

**The tokens are checked, not trusted.** `design-tokens.test.ts` fails the
build on a colour literal outside the token file, a hard-coded transition or
animation duration, or a `z-index` that is not a named token. Without it, "the
tokens are the source of truth" would be an intention.

### Primitives (19)

Button, IconButton, Input, Select, Textarea, Dialog, ConfirmDialog, Popover,
Tooltip, CommandPalette, Tabs, SplitPane, ResizablePanel, Surface/Card,
Toast/Status, EmptyState, Menu, ScrollArea, FocusRing.

Three rules throughout:

1. **Native semantics first.** `<button>`, `<dialog>`, `<select>`, `<label>`.
   `showModal()` gives focus trapping, Escape, the top layer and inertness —
   four things a div-based modal must reimplement and usually gets one wrong.
2. **Every visual value is a token.**
3. **Meaning is never carried by colour alone.** An invalid field is
   `aria-invalid` with a glyph and a message; a loading button is `aria-busy`
   and says so in words; a toast carries a glyph and a visually hidden tone
   word; the selected tab has weight and an underline; the active palette
   option has a leading marker.

States covered: default, hover, focus-visible, active, disabled, loading,
invalid, keyboard, reduced-motion.

**Component lab** at `/components`, development-only, showing every primitive
in every state — states only reachable by driving the real application are the
states that quietly rot.

---

## 7. Accessibility and responsive behaviour

Skip link as the first tab stop, moving real focus to `#cn-main`. One `main`
landmark and one `<h1>` per route. Named navigation landmark. `aria-current`
from `NavLink`, with the stylesheet selecting on that attribute rather than a
class, so what is announced and what is highlighted cannot drift apart.

Focus moves to `main` after a client-side navigation — without it, a
single-page navigation leaves focus on the link, announces nothing, and makes
keyboard users tab through the whole nav again every time.

Every separator (`SplitPane`, `ResizablePanel`) is a real `role="separator"`
with arrow-key, Home and End support and `aria-valuenow`. A split that can only
be dragged cannot be used without a mouse.

Responsive: desktop is the complete shell; tablet narrows the rail to icons
with labels; **phone moves navigation to a bottom bar** and drops the wordmark
and secondary links rather than any of the three destinations. The study
workspace stacks below 40rem instead of showing two ~180px panes. Verified in
the browser: no sideways scroll at 375px, 44px+ touch targets, and the shell
intact at a 24px root font size.

---

## 8. Requirement mapping

Labels per the Phase 0B checkpoint §6.

| Requirement | Status |
|---|---|
| INV-001 — exactly three primary destinations | **component-tested** and **E2E-accepted** |
| IA-001 — no forbidden tool promoted to primary | **component-tested** (12-item deny list) and **E2E-accepted** |
| INV-002 — books and artworks share one workspace | **component-tested** and **E2E-accepted** |
| INV-014 — components do not write arbitrary records | **architecture-tested** — no UI module can import an adapter |
| Stable URLs survive refresh | **E2E-accepted** — five routes, direct navigation and reload |
| Unknown route recoverable | **component-tested** and **E2E-accepted** |
| Missing source recoverable, and distinct from 404 | **component-tested** and **E2E-accepted** |
| Tokens are the styling source of truth | **contract-tested** — literals, durations and z-index all fail the build |
| Required primitives exist and are documented | **component-tested** (26 tests) and documented in the lab |
| Keyboard access and visible focus | **E2E-accepted** — computed outline asserted, not assumed |
| Reduced motion | **E2E-accepted**, with a positive control so it cannot pass vacuously |
| Responsive navigation | **E2E-accepted** at 1280px and 375px |
| Resizable text | **E2E-accepted** at a 24px root font size |
| Phase 0C browser tests remain green | **browser-tested** — all 8 pass in the same run |
| INV-006 — one set of canonical blocks | **deferred** — Phase 6 builds the alternate views |
| AC-001 — PDF import offline | **deferred** — persistence-ready; no import UI until Phase 1 |
| AC-002 — exact workspace resume | **component-tested** through the router; **E2E-deferred** until a reader exists |
| NFR-008 — recovery for destructive actions | **partial**, unchanged from 0C |
| PDD §24 Phase 0 exit — shell builds, no direct component DB writes, legacy readable | **met** |

---

## 9. Files

### 9.1 Git-derived — the whole of this work

`git diff --name-status phase-0c-impl..HEAD`: **52 added, 28 modified.**

Part B alone (`phase-0c-closed..HEAD`): 48 files changed, 6,641 insertions,
48 deletions; 39 files new.

### 9.2 Part A

**New (7):** `src/legacy/v1/read-only-boundary.test.ts`, `playwright.config.ts`,
`vite.e2e.config.ts`, `tsconfig.e2e.json`, `e2e/harness/index.html`,
`e2e/harness/harness.ts`, `e2e/browser/harness-client.ts`, plus five
`bv-00N-*.spec.ts` specs and `docs/CNTKNW_ADR_0003_*.md`.

**Modified:** `data/repositories/concurrency.ts` and all eight repository
interfaces, both adapters, `data/errors.ts`, `application/import-pdf.ts`,
`application/promote-block-to-claim.ts`, both test suites, `package.json`,
`eslint.config.js`, `.gitignore`, and four documents.

### 9.3 Part B

**New (39):** `src/design/{tokens,base}.css` and `design-tokens.test.ts`;
`src/app/{App.tsx,architecture.test.ts,navigation.test.tsx}`;
`src/app/composition/production.ts`; `src/app/providers/*` (3);
`src/app/hooks/useAsyncResource.ts`; `src/app/routes/*` (9 including
`routes.test.tsx`); `src/components/primitives/*` (12);
`src/components/shell/*` (3); `src/tests/renderWithProviders.tsx`;
`e2e/shell/{routing,accessibility}.spec.ts`.

**Modified:** `src/main.tsx`, `src/data/repositories/index.ts` (adds the
`Repositories` interface), `tsconfig.json`, `vite.config.ts`,
`vite.e2e.config.ts`, `eslint.config.js`, `package.json`.

---

## 10. Verification

Node v22.16.0, npm 10.9.2, Windows 11 (10.0.26200) x64, clean `npm ci`.

```text
npm ci                PASS   exit 0
npm run typecheck     PASS   exit 0, 0 errors          (src/ and e2e/)
npm run lint          PASS   exit 0, 0 errors, 0 warnings
npm run test          PASS   exit 0, 417 tests, 15 test files, 0 skipped
npm run test:e2e      PASS   exit 0, 34 tests, 1 browser project (chromium), 0 skipped
npm run build         PASS   exit 0, 489.87 kB (149.06 kB gzipped)
npm audit --omit=dev  PASS   0 vulnerabilities
npm audit             exit 1, 5 high, all dev-only (ESLint transitive)
```

`npm audit`'s non-zero exit is the advisory count, not a gate failure: the gate
requires no *production-reachable* high-severity advisory, and there are none.
`react-router`, `@playwright/test`, `eslint-plugin-react-hooks` and
`@testing-library/user-event` added no advisory; the same five ESLint-transitive
highs are the only ones reported, unchanged since Phase 0C.

### 10.1 Unit and contract tests — 417 across 15 files

| File | Tests |
|---|---|
| `data/adapters/repository-contract.test.ts` | 124 |
| `legacy/v1/migration.test.ts` | 46 |
| `domain/atlas-readiness.test.ts` | 43 |
| `application/application.test.ts` | 33 |
| `domain/domain.test.ts` | 28 |
| `domain/time/time.test.ts` | 26 |
| `components/primitives/primitives.test.tsx` | 26 |
| `domain/read-aloud-readiness.test.ts` | 25 |
| `lib/rank.test.ts` | 22 |
| `app/routes/routes.test.tsx` | 13 |
| `app/navigation.test.tsx` | 12 |
| `design/design-tokens.test.ts` | 7 |
| `app/architecture.test.ts` | 5 |
| `legacy/v1/read-only-boundary.test.ts` | 5 |
| `lib/id.test.ts` | 2 |
| **Total** | **417** |

Contract suite: 62 tests defined, run against both adapters — memory 62,
indexeddb 62, identical cases. +186 since Phase 0C's original 331.

### 10.2 Browser tests — 34, Chromium 151.0.7922.34

| Suite | Specs | Tests |
|---|---|---|
| Phase 0C persistence (BV-001 … BV-005) | 5 | 8 |
| Phase 0D routing | 1 | 12 |
| Phase 0D accessibility and responsive | 1 | 14 |
| **Total** | **7** | **34** |

One browser project, workers 1 — IndexedDB is origin-global, and concurrent
tests would make any failure order-dependent and therefore useless as evidence.

**Stability was measured, not assumed.** After a keyboard test was seen to fail
intermittently (§10.4, defect 4), the fix was confirmed with four consecutive
full-suite runs at 34/34. A gate that passes on the third attempt has not
passed.

### 10.3 Bundle

489.87 kB, 149.06 kB gzipped, up from 190.89 kB at Phase 0C. The increase is
explained rather than absorbed: Phase 0C's entry point was a placeholder that
imported nothing, so its build contained React alone. This is the first build
that includes the domain schemas (Zod), the persistence layer (Dexie), the
application layer and the router. It is one chunk; route-level code splitting
is the obvious next lever and is recorded in §11.

**No development-only surface ships.** `dist/` was searched for `__cntknw`,
`seedV1Database`, `Component lab` and `harness`; none is present.

### 10.4 Defects found by running

**Six.** Two carried from Phase 0C (§12.4 of that report), four new.

1. **The component lab shipped in the production bundle.** It was statically
   imported by the route table, so the bundler included it even though nothing
   routed to it. Not cosmetic: it ships demo content and interaction
   affordances to real users. Moved behind an `import.meta.env.DEV` branch the
   bundler eliminates, and `dist/` is now grepped to prove it.
2. **The shell stole focus on initial page load.** `useFocusMainOnNavigate`
   used a first-render flag; StrictMode's deliberate mount → unmount → mount
   cleared the flag on the first run and focused `main` on the second, moving
   the user past the skip link before they had touched anything. Found by the
   skip-link E2E test. Re-keyed on the pathname, which is also the true
   condition.
3. **Two `set-state-in-effect` violations**, in `useAsyncResource` and
   `CommandPalette`, found by adding `eslint-plugin-react-hooks`. Both were
   real: the first painted one frame of the previous source's data under the
   new URL; the second let `aria-activedescendant` name an id that was no
   longer in the DOM. Fixed at source — moved into render-time derivation —
   rather than suppressed.
4. **A flaky keyboard test.** The three tab-order tests failed roughly one
   full-suite run in four while the application was correct: the whole suite
   shares a browser, and when another page held the window, the first Tab went
   nowhere. Fixed by bringing the page to front before tabbing. The first
   attempt at a fix — blurring the active element and pressing Tab on the page
   — was *worse*, failing every time, because the key event still needs a focus
   context to move from; it was reverted rather than kept. Confirmed by four
   consecutive full runs at 34/34.

   Recorded because a flaky gate is not a passing gate. A suite that fails
   intermittently teaches people to re-run rather than to read, and the next
   real failure gets re-run too.

---

## 11. Known limitations

1. **One browser engine.** Chromium only. WebKit and Firefox have their own
   IndexedDB implementations and their own focus and layout behaviour; neither
   is exercised. Adding the projects is cheap and should precede any
   cross-browser claim.
2. **One bundle, 489.87 kB.** No route-level code splitting yet. It is under
   the 500 kB warning threshold by 10 kB, which is not a margin to rely on —
   the PDF reader arrives in Phase 1 and `pdfjs-dist` is large. Splitting
   should land with it.
3. **Automated accessibility checks are hand-written, not axe-driven.** The
   tests assert specific properties — landmarks, names, roles, focus, contrast
   of meaning — but no automated rule engine runs. An axe pass would catch a
   class of things these do not.
4. **Contrast ratios are unmeasured.** The palette was chosen for legibility
   and reviewed by eye; no test computes a WCAG ratio. That should be added
   with the light theme, when both need checking.
5. **No visual regression testing.** A layout that silently breaks would pass
   every test here.
6. **The light theme is structural, not designed.** It proves the tokens can
   carry a second theme. It has not been reviewed as a design and should not
   be exposed to users yet.
7. **Route data loading is per-component**, not router loaders. Fine at this
   size; revisit if waterfalls appear.
8. **Everything Phase 0C listed remains open** — soft deletion is still partial
   (NFR-008 not satisfied), `applyMigration` deliberately absent, `appState`
   unmapped, no storage-quota handling beyond classification.
9. **No PDF, editor, annotations, dictionary, search, Atlas entities, Read
   Aloud playback, migration apply, backup/restore, 3D, chess or AI.** Out of
   scope for 0D by instruction, and none was started.

---

## 12. Phase 0D gate

| Requirement | Result |
|---|---|
| Exactly three primary destinations | **PASS** — asserted in component and browser tests |
| Stable URLs survive refresh | **PASS** — 5 routes, direct navigation and reload |
| Shared Study Workspace route exists | **PASS** — `/study/:sourceId`, books and artworks |
| No forbidden tool is a primary destination | **PASS** — 12-item deny list |
| Tokens are the styling source of truth | **PASS** — enforced by test, not convention |
| Required primitives exist and are documented | **PASS** — 19 primitives, lab at `/components` |
| Keyboard and reduced-motion tests pass | **PASS** — with a positive control on reduced motion |
| All Phase 0C browser tests remain green | **PASS** — 8/8 in the same run |
| typecheck, lint, tests, Playwright, build, audits | **PASS** — §10 |
| Documentation updated | **PASS** — §13 |

---

## 13. Documents

**New:** `CNTKNW_ADR_0003_Mandatory_Concurrency_Guards.md`, this report.

**Revised:** `CNTKNW_Phase_0C_Checkpoint_Report.md` (§0 closure note plus the
five corrections), `CNTKNW_Current_Implementation_Status.md`,
`CNTKNW_Amendments_Register_v0.2.md` (A-016, A-017),
`CNTKNW_Documentation_Index.md` (read order, phase table, version-control
note).

**Unchanged and still verifying:** all nine checksummed v0.2 files, against
`CNTKNW_CHECKSUMS_v0.2.sha256`. Checked before and after this work.

---

## 14. Open decisions carried forward

| # | Decision | Blocks |
|---|---|---|
| 4 | Is `conflict` its own record or an Event subtype? | Atlas modelling |
| 5 | Is `institution` distinct from `organisation`? | Atlas modelling |
| 6 | Is `period` an entity or a named `TemporalExtent`? | Atlas modelling |
| 7 | `BlockContent.doc` versus `.text` duplication | Phase 0E editor spike |

None blocked Phase 0D. Decision 7 blocks the next phase.

---

## 15. Next approved phase

**Phase 0E — the editor spike**, then the journal vertical slice.

Open decision 7 (`BlockContent.doc` versus `.text`) must be resolved there; it
is the reason the spike exists, and choosing an editor before resolving it
would decide it by accident.

The PDF and editor vertical slices were **not** begun, per instruction.
