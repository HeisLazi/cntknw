# CNTKNW — Personal Knowledge Museum & Study Studio

A local-first, offline reading and annotation environment built around a continuous journal that ties your thoughts to exact page locations.

## The Pitch
You import a PDF or artwork. You read it. You write notes in a margin-driven, continuous journal beside it. Your thoughts automatically inherit the exact page they refer to. 

Everything stays on your machine. Data is stored durably in IndexedDB, with real transactions, schema versioning, and no arbitrary cloud sync.

## Project State
**Currently in Phase 2:** Infinite Journal and Reading Polish.
The reliable PDF core (Phase 1) is landed. The structural foundation (strict TS, Zod domain, repository layer with Dexie, React Router, design tokens) is mature and tested.

## Development

### Setup
1. `npm ci`
2. `npm run dev`

### The Quality Gate
Do not push without running the full gate:
```bash
npm run verify
```
*(Runs typecheck, lint, unit tests, and the build)*

For a complete pre-commit or phase boundary check, run:
```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit --omit=dev
```

### Architecture Constraints
- **Domain logic is pure:** Zod schemas are authoritative. See `src/domain/`.
- **UI doesn't write to DB:** Components call the `application` layer use-cases, which orchestrate the `repositories`.
- **Mandatory Concurrency:** Every repository mutation requires a `ConcurrencyGuard`. Last-write-wins is a compile error (ADR-0003).
- **No CDN dependencies:** Everything (fonts, PDF workers) is bundled locally.
- **The Folio Margin (ADR-0006):** Page provenance is spatial. No page selection dropdowns. Empty pages create no sections. 

## Documentation
Start at `docs/CNTKNW_READ_ME_FIRST_v0.2.md`. 
The canonical specs are the Product Design Document and the AI Implementation Handoff v0.2. 
See `docs/CNTKNW_Documentation_Index.md` for a reading guide to ADRs and supplements.
