# CNTKNW Product and Launch Assessment

**Assessment date:** 1 August 2026  
**Repository:** `HeisLazi/cntknw` (private)  
**Assessed baseline:** `main@83cb22b0e9720c95cde4dfa0b9f91a93eea4ef96`  
**Assessment confidence:** High for architecture and implemented vertical slices; medium for external-user readiness because this pass did not run the application or conduct user testing.  
**Status:** Evidence baseline and reduced-alpha recommendation. Update at every completed product phase or user pilot.

## Decision summary

CNTKNW is materially further along than the initial portfolio description suggested. The repository contains a disciplined local-first foundation plus two user-visible core capabilities:

1. offline PDF import, reading, text selection, and exact resume;
2. a page-linked journal that automatically associates notes with the active page.

The latest commit reports 435 unit tests and 54 Chromium Playwright tests, with a clean build and no production audit findings. That makes CNTKNW the strongest low-cost fallback to InstaClip and the second project to maintain actively.

It is not ready for strangers' important data yet. Backup/restore and recovery are core launch blockers for a local-first journal, current status documentation is stale, a root README is absent, and the product has not proven that readers return or value the source-linked journal over familiar alternatives.

## Current owner direction

The near-term product is a focused read-and-learn workspace:

> Read a book or PDF beside a persistent journal, capture thoughts without losing the source location, and return later without forgetting where the thinking came from.

This direction aligns with the canonical CNTKNW invariants. The first external alpha does not need mind maps, art drawing, 3D, chess, AI, social features, or a broad personal-knowledge operating system.

## Evidence boundary

This assessment reviewed the canonical v0.2 product and handoff documents, requirements JSON, current status file, accepted ADR-0004, current routes, PDF/journal implementation, E2E tests, package manifest, and all twelve repository commits.

The untracked canonical-documentation ZIP was not assessed because its source Markdown and JSON are already present in the repository. No tests were rerun here; counts are taken from commit evidence.

## What is actually present

### Foundation

- Strict TypeScript/Vite/React application with injected repository interfaces.
- Zod domain schemas, Dexie IndexedDB storage, in-memory adapter parity, transactions, rollback, mandatory optimistic concurrency, and legacy-v1 read/migration dry-run support.
- Exactly three primary routes—Library, Gallery, Notes—and one shared `/study/:sourceId` workspace.
- Design tokens and accessible UI primitives, keyboard/focus behavior, reduced-motion support, and responsive shell tests.

### PDF reading core

- Local PDF import and IndexedDB storage.
- pdf.js rendering with windowed pages rather than one canvas for every page.
- Exact workspace resume and guarded autosave.
- Text layer for selection, find-in-page, and screen-reader access.
- Cancellation behavior for canvas/text rendering and geometry tests after zoom.

### Journal core

- One continuous source journal built from separate canonical blocks.
- Automatic page inheritance when a block is created.
- No visible empty-page sections.
- Minimal ProseMirror block editor with emphasis, strong, and code marks.
- Debounced revision-guarded autosave and visible conflict recovery rather than silent overwrite.
- E2E coverage of page-linked behavior in the real browser.

### Reported latest gate

The 1 August editor commit reports:

- typecheck and lint passing;
- 435 unit tests across 17 files, with one Node-24-specific route test skipped and covered in real Chromium;
- 54 Playwright tests passing in Chromium;
- clean production build;
- zero production dependency audit findings.

## Documentation and implementation drift

`docs/CNTKNW_Current_Implementation_Status.md` still says the editor spike is next and the PDF text layer is absent. Newer commits have implemented both. The document must be updated before another agent uses it as current truth.

The repository also has no root `README.md`. Canonical documents are strong, but a new developer or tester has no short entry point explaining how to install, run, verify, or evaluate the current build.

## Launch blockers and risks

1. **No trusted backup/restore loop.** Local-first storage without a simple export, restore, and recovery test exposes users to unacceptable loss.
2. **Status drift.** The current implementation document contradicts the latest code.
3. **No external-user onboarding.** The repository proves components and behavior, not a first-session path for a normal reader.
4. **Only Chromium is browser-verified.** Firefox, WebKit, and their IndexedDB behavior remain untested.
5. **Known autosave race.** The latest commit records a workspace/journal save race that can briefly revert the reader label after a save-then-click sequence; one E2E assertion was reduced while preserving the core page-link requirement.
6. **Retention and differentiation are unproven.** Technical correctness does not show that people write more useful notes or revisit them.
7. **Important later capabilities are absent.** Annotation/drawing, connections/backlinks, dictionary, cross-source search, maps, sessions/statistics, and portable backups remain future work. Most should remain out of the first alpha.

## Market implication

Readwise Reader already provides a mature cross-platform reading, highlighting, PDF, export, sync, and offline product. Its official [Reader page](https://readwise.io/read) lists a 30-day trial and pricing of USD 9.99/month billed annually or USD 12.99/month billed monthly, with a regional/student discount route.

CNTKNW should not initially compete on breadth or generic “read it later.” Its testable wedge is narrower:

- a calm two-pane study workspace;
- one continuous journal per source;
- automatic source/page provenance without manual filing;
- local-first ownership;
- later transformations and review built on the same canonical blocks.

## Launch target and non-goals

### Target: private reader alpha

A new user can import a PDF, read it, write page-linked blocks, close/reopen, browse the resulting notes, export a complete backup, restore it into a clean profile, and understand how their data is stored.

### Explicit non-goals

- AI summaries or tutors;
- mind maps and automatic graph generation;
- drawing, canvas, image annotation, or full Gallery study;
- 3D library/museum;
- Chess Room;
- cloud sync, collaboration, accounts, or subscriptions;
- broad web capture/read-it-later parity;
- large editor feature set.

The Gallery and Notes destinations remain because they are canonical information architecture, but the alpha promise should center on Library plus the shared Study Workspace.

## Next smallest implementation slice

**Slice: Data-Safe Reader Alpha**

1. Update the current implementation status and add a root README/tester entry point.
2. Resolve or tightly reproduce the workspace/journal autosave race.
3. Implement complete portable backup and restore for sources, assets, workspace state, journals, and blocks.
4. Add checksum/version validation and a clean-profile restore E2E test.
5. Polish only the first-session path: import, open, write, resume, notes, backup.
6. Create a static/private alpha build and test it with five readers.

Do not add maps, AI, chess, 3D, or drawing before the source-linked journal's repeated value is proven.

## Pilot measures

Track:

- successful import-to-first-note completion without help;
- whether page attribution is understood without explanation;
- resume accuracy after browser restart;
- backup and clean-profile restore success;
- notes written per real reading session, without rewarding quantity for its own sake;
- note revisit or source reopening within seven days;
- whether users choose CNTKNW for a second document;
- the specific moment the two-pane/page-linked behavior is more useful than their current tool;
- willingness to pay only after repeated use.

## Portfolio implication

CNTKNW is not the strongest immediate revenue bet, but it is the cheapest technically credible product to keep moving. It requires no paid inference service for its core, has unusually strong engineering discipline for its age, and already demonstrates its central interaction. It should be the fallback focus if InstaClip's release-cost or Windows-distribution gates become unaffordable.

## Immediate next action

Bring documentation up to current commit truth, then build and E2E-verify backup/restore before inviting external readers.

## Update protocol

Record the assessed commit, current phase, exact tests and browsers run, implemented acceptance criteria, known data-loss/recovery risks, pilot document count, repeat-use result, and any owner decision that changes the three-destination or shared-workspace invariants.

