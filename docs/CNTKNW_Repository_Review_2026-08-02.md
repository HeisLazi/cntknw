# CNTKNW Repository Review - 2026-08-02

This living audit document tracks the findings and resolutions from the adversarial review of the CNTKNW repository prior to the continuation of Phase 2.

**Baseline Details:**
- **Reviewed Commit**: `51c4861`
- **Local State**: `main` branch, with the preserved unrelated ZIP untracked and untouched.
- **Verification**: Milestone 3B full gate passed after implementation (`npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`, `npm audit --omit=dev`).

---

## Finding 1: Conflict Recovery Still Loses User Text
**Severity**: CRITICAL
**Status**: FIXED AND VERIFIED
**Description**: The current `JournalPane` conflict reload behavior clears the local draft, silently picking the remote version. ADR-0004 intent requires both Truth A (remote) and Truth B (local) to remain visible/recoverable.
**Action**: Implemented an explicit resolution UI (keep saved, use local, copy local text). Added acceptance tests for draft recovery.

## Finding 2: Journal Read Failure Pretends the Journal is Empty
**Severity**: CRITICAL
**Status**: FIXED AND VERIFIED
**Description**: `listBlocks()` catches read errors and defaults to an empty array `[]`, showing "Nothing written yet".
**Action**: Render a safe error/retry affordance instead of masking storage errors.

## Finding 3: Journal Write Failure Needs a Visible Recovery Path
**Severity**: HIGH
**Status**: FIXED AND VERIFIED
**Description**: `flush()` removes items from the pending list before awaiting repository writes. Generic write errors can silently fail, abandoning the user's intent.
**Action**: Retained the pending state until persistence completes. Surfaced write failures visibly and allow retries. Distinguished conflict from quota/unavailable errors.

## Finding 4: Enforce Block Kind/Content Consistency
**Severity**: HIGH
**Status**: FIXED AND VERIFIED
**Description**: Zod schemas do not constrain `kind` to match `content.type`.
**Action**: Used refinements in Zod (`JournalBlockSchema = BaseJournalBlockSchema.refine(...)`) to make mismatched records unrepresentable.

## Finding 5: Do Not Integrate JournalBlockView With the Current Paragraph Save Path
**Severity**: HIGH
**Status**: FIXED AND VERIFIED
**Description**: `JournalPane` currently saves every block with `content.type = paragraph`.
**Action**: Built a kind-aware save path preserving kind-specific metadata (`textOfEditableContent`, `withEditedText`, `contentForKind`) before integrating `JournalBlockView`.

## Finding 6: ProseMirror Boundary is Documented But Not Enforced
**Severity**: MEDIUM
**Status**: FIXED AND VERIFIED
**Description**: Architecture tests do not explicitly forbid `prosemirror-*` imports from leaking into `src/domain`, `src/data`, or `src/application`.
**Action**: Added architectural guards enforcing this boundary (`src/app/architecture.test.ts`).

### [V] FINDING 7: Journal Uniqueness Invariant Bypassed
**Status: FIXED AND VERIFIED**
- Both Memory and Dexie adapters correctly wrap `getOrCreateJournalForSource` in transactional guards.
- Adversarial hardening check (August 2, 2026): Verified that `createJournal` explicitly enforces the `sourceId` uniqueness invariant in both adapters, completely preventing creation of duplicate journals even if called directly bypassing `getOrCreateJournalForSource`.

### [V] FINDING 8: Fractional Rank Collision and Stale Anchor Handling
**Status: FIXED AND VERIFIED**
- Fractional ranking model was hardened. The pure mathematical fractional algebraic sorting was retained.
- Adversarial hardening check (August 2, 2026): A full unit test simulating three concurrent connections proves that structural serialization inside the database transaction boundary (`deps.journals.transact`) guarantees robust allocation. `rankAfter` is invoked atomically inside `createPageLinkedBlock`, preventing identical rank allocation in concurrent insertions. No fallback ID comparisons or random jitter hacks are necessary.

### [V] FINDING 9: Silent Nested Object Clobbering in Autosave
**Status: FIXED AND VERIFIED**
- Deep diff logic introduced to compute explicitly changed scalar leaves inside nested objects like `sourceView` and `layout`.
- Deep merge logic applies accumulated changes on top of remotely-resolved states.
- Adversarial hardening check (August 2, 2026): A full unit test proves that two windows concurrently editing `scrollOffset` and `zoom` respectively will both perfectly preserve their edits across conflict resolution. `pendingChanges` diff in `useWorkspacePersistence`. On `RevisionConflictError`, the exact diff is applied over the freshly fetched remote state, safely merging independent concurrent operations.

## Finding 10: Position-Buffer Implementation Fix is Good; Regression Test is Weak
**Severity**: MEDIUM
**Status**: FIXED
**Description**: `bv-007-position-buffer-scope.spec.ts` manually sets `localStorage` instead of exercising `stashPosition()`.
**Action**: Deleted the manual UI E2E test and added rigorous direct component tests for `stashPosition`, `recoverPosition`, `clearPosition`, including malformed records and expiry in `positionBuffer.test.ts`.

## Finding 11: Make PDF Scrolling Actually Continuous
**Severity**: HIGH PRODUCT/UX
**Status**: RESOLVED — Milestone 3A
**Description**: PDF scrolling previously only tracked `scrollTop` and did not auto-advance the page window, breaking the continuous scrolling requirement (NFR-003).
**Action**: Implemented viewport visibility tracking with IntersectionObserver-backed geometry selection, a bounded five-page window, stable virtual spacers, and first/last-page boundary handling. Playwright proves forward and backward natural scrolling plus the 500-page mount bound.

## Finding 12: Direct Page Navigation Must Move the Reader, Not Only State
**Severity**: MEDIUM
**Status**: RESOLVED — Milestone 3A
**Description**: Tests for direct page, outline, and search navigation previously did not assert the spatial consequence of the navigation.
**Action**: Navigation now requests the target window, waits for its measured page element, scrolls the bounded reader to it, and verifies viewport intersection. Playwright covers direct page entry, outline destinations, and source-search results.

## Finding 13: Search Semantics Need Hardening
**Severity**: MEDIUM
**Status**: RESOLVED — Milestone 3B
**Description**: Search concatenation lacks spacing rules, discarding `matches` counts.
**Action**: Search now joins PDF text items with punctuation-aware spacing and line boundaries, applies Unicode/whitespace/case normalization, reports per-page non-overlapping match counts, propagates extraction failures, and treats cancellation as silent. The search UI retains counts, reports real failures, and guards results/navigation/loading state by search generation so stale searches cannot overwrite newer results. Unit coverage proves normalization, counts, failure handling, cancellation and stale-result suppression; Playwright covers real-document navigation and count display.

## Finding 14: PDF Outline Needs Failure Handling
**Severity**: LOW/MEDIUM
**Status**: RESOLVED — Milestone 3A
**Description**: `PdfOutline` previously lacked an error path for `getOutline()` rejection.
**Action**: Added explicit loading, no-outline, and outline-unavailable states. Rejected extraction is quiet and honest, exposes retry, and is covered by unit tests; valid PDFs with no outline remain distinct.

## Finding 15: Large PDF Import Memory
**Severity**: PERFORMANCE
**Status**: RESOLVED — Milestone 3B
**Description**: The import pipeline copies the full File ArrayBuffer multiple times.
**Action**: Added a deterministic 8 MiB duplicate-read probe. The import UI's metadata inspection and transactional persistence now share the already-read bytes, reducing `File.arrayBuffer()` reads from two to one while retaining pre-write `%PDF-` signature validation and transactional persistence. Browser peak-memory measurement is not portable in this environment; no speculative peak-memory claim or complexity was added.

## Finding 16: Notes Primary Destination Currently Lies About its Data
**Severity**: HIGH PRODUCT TRUST
**Status**: TO DO
**Description**: `NotesRoute` claims to show everything but only loads epistemic claims, lying to users with "Nothing written yet".
**Action**: Temporarily label it as incomplete (or implement a canonical block list without duplicating databases).

## Finding 17: Documentation Requires a Complete Reconciliation
**Severity**: HIGH
**Status**: RESOLVED
**Description**: `CNTKNW_Current_Implementation_Status.md` contains contradictory/outdated state.
**Action**: Completely rewritten to match Phase 2 closure state, identifying Phase 1 PDF reader hardening as the next milestone.

## Finding 18: README Must Match the Actual Architecture
**Severity**: MEDIUM
**Status**: TO DO
**Description**: `README.md` implies all UI durable actions flow through use cases, which contradicts architectural tests allowing direct repository interaction.
**Action**: Correct the documentation boundary claim.

## Finding 19: Consider GitHub CI
**Severity**: DEVELOPMENT HYGIENE
**Status**: TO DO
**Description**: The repo lacks a CI pipeline to independently observe verifiable green builds.
**Action**: Add a basic `.github/workflows/verify.yml` executing the gate.

## Finding 20: Browser Coverage
**Severity**: DEFERRED HARDENING
**Status**: DEFERRED
**Description**: Playwright runs only in Chromium.
**Action**: Document this limitation. Firefox/WebKit testing is deferred until public release candidate phase.

## Finding 21: Phase 2 Acceptance Hardening Run
**Severity**: CLOSURE
**Status**: RESOLVED
**Description**: Phase 2 required final evidence that it safely handles concurrent rank allocation, persistent paragraph formatting over block kind changes, and data integrity invariant checks at the final boundaries.
**Action**: 
- Validated concurrent transactional rank reallocation explicitly to resolve IDB overlap edge cases.
- Ensured formatting UI gracefully manages and preserves draft text across unexpected block transformations (`changeBlockKind`).
- Verified IndexedDB and Memory adapters strictly enforce domain invariants when assembling merged records before commit.
- Final failure-safe conflict resolution implemented at `9094220`. Retains local truth (draft, edits, conflict UI) safely without discarding it before remote fetching succeeds.
- Real gate (Typecheck, Lint, Test, E2E, Build) verified as passing. Phase 2 closure achieved.
