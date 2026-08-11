# CNTKNW — Personal Knowledge Museum & Study Studio

CNTKNW is a local-first, offline reading and annotation environment. It treats PDFs and artworks as objects in a personal knowledge museum: you read, you write in a continuous journal bound to exact page locations, you annotate, you draw, and you study on a Zen workspace that projects your work without duplicating it.

## What works today

The current vertical slice is complete through **Phase 3 (annotations & drawing)** and **WORKSPACE UX-1 (Zen study desk)**:

- **Import a PDF** into a local library.
- **Read** with exact resume: reopening a source returns you to the same page and scroll position.
- **Write** in a continuous, source-bound journal. There is exactly one canonical journal per source; other views are projections, not duplicate stores.
- **Annotate** with text highlights and rectangular region tools. Annotations are keyboard-accessible, delete only after confirmation, and anchored with rotation-aware canonical geometry (ADR-0007).
- **Draw** freehand vector drawings in canvas-local drawing blocks backed by a typed SVG editor.
- **Study** in the Zen workspace: split/focus modes, an infinite whiteboard projection of the canonical journal, and a fully local Pomodoro timer.

All of the above is verified by the test suites described below.

## Feature highlights

- **PDF reading + exact resume.** PDF.js runs from a locally bundled worker; no CDN. Reading position, scale, and rotation are persisted.
- **Continuous page-provenance journal.** The journal is one canonical stream per source. Blocks inherit exact source locations (the Folio Margin, ADR-0006). Projected views — such as the whiteboard — reference the same underlying blocks.
- **Annotations.** Text highlight and region tools produce asset-bound, rotation-aware geometry. Deletion requires confirmation. Geometry is canonical per ADR-0007.
- **Drawing.** Drawing blocks store a typed canvas-local vector model and render with a lightweight SVG freehand editor.
- **Whiteboard.** An infinite, pan/zoom surface that projects the canonical journal. Conflicting edits are resolved by preserving both truths rather than overwriting (latest implementation: UX-1 S7).
- **Pomodoro.** Fully local, zero network, no per-second writes; timer state is durable but not chatty.
- **Offline by design.** Fonts, PDF workers, and all runtime assets are bundled locally.

## Local-first / privacy model

Everything lives in IndexedDB on your machine. There is no cloud sync, no telemetry, no analytics, and no remote dependency. The app is designed to work offline after the initial page load.

## Architecture & concurrency guarantees

- **Domain contracts** are authoritative Zod schemas in `src/domain/`.
- **Mandatory optimistic-concurrency guards:** every repository mutation carries a `ConcurrencyGuard`; last-write-wins is a compile error (ADR-0003).
- **Two contract-identical adapters:** an in-memory adapter for fast unit tests and a Dexie/IndexedDB adapter for the browser.
- **Schema versioning + transactional migration:** legacy v1 data is read-only and migrated forward.
- **Design tokens** are the styling source of truth; components consume tokens rather than ad-hoc values.

See `docs/CNTKNW_Documentation_Index.md` for the ADR reading order.

## Verified test evidence

The baseline on this tree:

- **Type check:** pass
- **Lint:** pass
- **Unit tests:** 46 files / 691 passed / 1 skipped
- **E2E tests:** 102 passed / 0 skipped (Chromium)
- **Build:** pass
- **npm audit --omit=dev:** 0 vulnerabilities

Coverage includes persistence across reload, rollback behavior, revision conflicts, annotation geometry correctness, drawing block persistence, and zero-network user journeys.

Run the full gate with:

```bash
npm run verify
```

`verify` runs typecheck, lint, unit tests, and build. For a complete phase boundary check, run each step explicitly:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit --omit=dev
```

## Setup

```bash
npm ci
npm run dev
```

Then open the local Vite URL in Chromium or a Chromium-based browser.

## Current limitations & roadmap

- Only Chromium is exercised in automated E2E tests; other browsers are untested.
- No sync or multi-device support.
- Atlas entities are primitives only.
- Read Aloud / TTS / OCR are not built.
- Phase 4 (connections, backlinks, graph/map, argument maps) has not started.
- Soft-delete is partial (NFR-008).
- Dictionary, cross-source search, and map features are not built.

Roadmap (per the Product Design Document v0.2): **Phase 4A connections → 4B graph/map → 4C argument maps**, followed by later phases as approved.

## AI-assisted development disclosure

This project was built with heavy AI assistance: agent-managed development, AI-generated implementation briefs archived in `prompts/`, AI-conducted reviews, and a model-routing operating contract recorded in `AGENTS.md`. The human owner remained the decision-maker and approver. The publication-readiness process is documented in `docs/CNTKNW_PUBLICATION_AUDIT.md` and will be summarized in `docs/CNTKNW_PUBLIC_READINESS_REPORT.md`.

## Documentation

Start with `docs/CNTKNW_READ_ME_FIRST_v0.2.md`. The canonical v0.2 package is checksummed and sealed; do not edit those files in place. `docs/CNTKNW_Documentation_Index.md` is the reading guide for ADRs, checkpoint reports, and approved amendments.

## License

CNTKNW is available under the [MIT License](LICENSE).
