# CNTKNW Repository Review - 2026-08-02

This living audit document tracks the findings and resolutions from the adversarial review of the CNTKNW repository prior to the continuation of Phase 2.

**Baseline Details:**
- **Reviewed Commit**: `2052207518060f17b41ed9c60fa62fedf7a7ed41`
- **Local State**: Clean working tree on `main` branch.
- **Initial Verification**: Run at beginning of hardening pass (`npm run verify && npm audit --omit=dev`).

---

## Finding 1: Conflict Recovery Still Loses User Text
**Severity**: CRITICAL
**Status**: TO DO
**Description**: The current `JournalPane` conflict reload behavior clears the local draft, silently picking the remote version. ADR-0004 intent requires both Truth A (remote) and Truth B (local) to remain visible/recoverable.
**Action**: Implement an explicit resolution UI (keep saved, use local, copy local text). Add acceptance tests for draft recovery.

## Finding 2: Journal Read Failure Pretends the Journal is Empty
**Severity**: CRITICAL
**Status**: TO DO
**Description**: `listBlocks()` catches read errors and defaults to an empty array `[]`, showing "Nothing written yet".
**Action**: Render a safe error/retry affordance instead of masking storage errors.

## Finding 3: Journal Write Failure Needs a Visible Recovery Path
**Severity**: HIGH
**Status**: TO DO
**Description**: `flush()` removes items from the pending list before awaiting repository writes. Generic write errors can silently fail, abandoning the user's intent.
**Action**: Retain the pending state until persistence completes. Surface write failures visibly and allow retries. Distinguish conflict from quota/unavailable errors.

## Finding 4: Enforce Block Kind/Content Consistency
**Severity**: HIGH
**Status**: TO DO
**Description**: Zod schemas do not constrain `kind` to match `content.type`.
**Action**: Use discriminated unions or refinements in Zod to make mismatched records unrepresentable. Test all 14 kinds.

## Finding 5: Do Not Integrate JournalBlockView With the Current Paragraph Save Path
**Severity**: HIGH
**Status**: DEFERRED (Milestone 5)
**Description**: `JournalPane` currently saves every block with `content.type = paragraph`.
**Action**: Build a kind-aware save path preserving kind-specific metadata before integrating `JournalBlockView`.

## Finding 6: ProseMirror Boundary is Documented But Not Enforced
**Severity**: MEDIUM
**Status**: TO DO
**Description**: Architecture tests do not explicitly forbid `prosemirror-*` imports from leaking into `src/domain`, `src/data`, or `src/application`.
**Action**: Add architectural guards enforcing this boundary.

## Finding 7: One Journal Per Source Is Not Database-Unique
**Severity**: MEDIUM
**Status**: FIXED
**Description**: IndexedDB uses `sourceId` as an index, but `getOrCreateJournalForSource` relies on read-then-create rather than structural identity, risking duplicate source journals.
**Action**: Wrapped the check-and-create sequence inside a Dexie transaction, leveraging IndexedDB transaction strict serialization to structurally guarantee atomicity and uniqueness. MemoryAdapter similarly refactored for synchronous atomicity.

## Finding 8: Rank Insertion With a Stale Anchor
**Severity**: MEDIUM
**Status**: FIXED
**Description**: `createPageLinkedBlock` inserts before all siblings (null anchor) if the requested `afterBlockId` doesn't exist.
**Action**: Missing/stale anchors are now handled by appending safely to the end of the block group. Added `id` string comparison tiebreaker to block ordering across the repository to enforce deterministic sorting for concurrent equal-rank fractional insertions.

## Finding 9: Workspace Conflict Retry Reapplies Too Much State
**Severity**: MEDIUM
**Status**: FIXED
**Description**: Workspace state conflict retries read the record and reapply the entire old state, overwriting unrelated concurrent changes.
**Action**: Introduced an in-memory `pendingChanges` diff in `useWorkspacePersistence`. On `RevisionConflictError`, the exact diff is applied over the freshly fetched remote state, safely merging independent concurrent operations.

## Finding 10: Position-Buffer Implementation Fix is Good; Regression Test is Weak
**Severity**: MEDIUM
**Status**: FIXED
**Description**: `bv-007-position-buffer-scope.spec.ts` manually sets `localStorage` instead of exercising `stashPosition()`.
**Action**: Deleted the manual UI E2E test and added rigorous direct component tests for `stashPosition`, `recoverPosition`, `clearPosition`, including malformed records and expiry in `positionBuffer.test.ts`.

## Finding 11: Make PDF Scrolling Actually Continuous
**Severity**: HIGH PRODUCT/UX
**Status**: TO DO
**Description**: PDF scrolling only tracks `scrollTop` and does not auto-advance the page window, breaking the continuous scrolling requirement (NFR-003).
**Action**: Implement visible-page tracking through Intersection Observers to move the bounded window forward/backward smoothly.

## Finding 12: Direct Page Navigation Must Move the Reader, Not Only State
**Severity**: MEDIUM
**Status**: TO DO
**Description**: Tests for direct page, outline, and search navigation do not assert the spatial consequence of the navigation.
**Action**: Strengthen tests to ensure the physical page mounts and is visible in the viewport.

## Finding 13: Search Semantics Need Hardening
**Severity**: MEDIUM
**Status**: TO DO
**Description**: Search concatenation lacks spacing rules, discarding `matches` counts.
**Action**: Implement honest "Pages containing this text" semantics. Fix text normalization. Add cancellation tests.

## Finding 14: PDF Outline Needs Failure Handling
**Severity**: LOW/MEDIUM
**Status**: TO DO
**Description**: `PdfOutline` lacks an error path for `getOutline()` rejection.
**Action**: Implement explicit quiet failure paths.

## Finding 15: Large PDF Import Memory
**Severity**: PERFORMANCE
**Status**: TO DO
**Description**: The import pipeline copies the full File ArrayBuffer multiple times.
**Action**: Create a realistic large PDF probe. Measure peak memory and duplicate reads. Optimize only if justified.

## Finding 16: Notes Primary Destination Currently Lies About its Data
**Severity**: HIGH PRODUCT TRUST
**Status**: TO DO
**Description**: `NotesRoute` claims to show everything but only loads epistemic claims, lying to users with "Nothing written yet".
**Action**: Temporarily label it as incomplete (or implement a canonical block list without duplicating databases).

## Finding 17: Documentation Requires a Complete Reconciliation
**Severity**: HIGH
**Status**: TO DO
**Description**: `CNTKNW_Current_Implementation_Status.md` contains contradictory/outdated state.
**Action**: Completely rewrite this document to match current capabilities.

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
