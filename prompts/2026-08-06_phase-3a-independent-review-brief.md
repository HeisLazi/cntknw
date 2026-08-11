# Phase 3A — Independent Read-Only Adversarial Review (MiniMax M3)

You are the independent reviewer for CNTKNW Phase 3A (Annotation Geometry
Architecture). Work read-only: do NOT modify, create, or delete any file, and
do NOT run any command that writes. You may read files and run read-only
commands (`git diff`, `git status`, `grep`, `npx vitest run <file>` for
INSPECTION is allowed, but never in a way that changes the tree).

## Context

- Repo: `<repo-root>` (HeisLazi/cntknw), branch `main`
- Base SHA: `8197d3683f60d5d0d503dcd6888e0d6888d44413` (chore(ai): optimize model routing)
- Implementation: UNCOMMITTED working tree (do not rely on commit SHAs)
- Start with `git status --short` and `git diff --stat` to see the change set.
- Read `AGENTS.md`, `docs/CNTKNW_ADR_0007_Canonical_Annotation_Geometry.md`
  (the ADR under review), and the PDD acceptance criteria
  (`docs/CNTKNW_Product_Design_Document_v0.2.md` §16.2, and AC-003/AC-007/
  AC-008/AC-009/AC-010/AC-015).

## Files to inspect

1. `docs/CNTKNW_ADR_0007_Canonical_Annotation_Geometry.md` — decisions A–J
2. `src/domain/annotations/annotation.schemas.ts` — anchor discriminated union
3. `src/lib/geometry/index.ts` — pure viewport↔canonical conversion
4. `src/lib/geometry/geometry.test.ts` — property tests
5. `src/data/db/annotationMigration.ts` + `.test.ts` — v1→v2 migration
6. `src/data/db/schemaVersions.ts`, `src/data/db/database.ts` — schema v2 wiring
7. `src/data/adapters/memory/index.ts`, `src/data/adapters/indexeddb/index.ts` — updated update path
8. `e2e/harness/geometry-probe.tsx`, `e2e/harness/geometry-probe.html` — test-only probe
9. `e2e/shell/annotation-geometry.spec.ts` — zoom / virtualization / reload proof
10. `e2e/harness/harness.ts` — harness additions
11. `src/app/architecture.test.ts` — existing boundaries that must still hold

## Reader architecture (background)

`PdfReader` mounts a bounded virtualized window (5 pages, PAGE_WINDOW 2,
spacers otherwise). `PdfPage` renders `page.getViewport({ scale: zoom })`,
canvas backing store × devicePixelRatio, CSS size = floor(viewport dims).
Text layer via `new pdfjs.TextLayer(...)` with `--scale-factor`. Pages are
1-based at the domain boundary. E2E runs against a harness page that mounts
the REAL PdfReader and REAL pdf.js, driven via `window.__cntknwProbe`;
IndexedDB is origin-scoped; production build (`vite.config.ts`) must never
include `e2e/` content.

## Attack points (address each explicitly)

1. zoom invariance
2. rotation (90/180/270; coordinate orientation)
3. coordinate orientation (origin, axes, y-flip)
4. multi-line selections (rects[])
5. devicePixelRatio confusion (CSS vs backing pixels)
6. asset identity (sourceId+assetId+page)
7. source vs asset replacement semantics
8. virtualization/remount (no retained DOM identity)
9. persistence/reload (schema v2 migration safety, transactionality)
10. canonical-record duplication (annotation vs journal vs map)
11. editable drawing compatibility (vector ink, no bitmap flattening)
12. schema migration safety (no silent loss; recovery path)
13. floating-point drift (tolerances, epsilon clamping)
14. accidental dependence on DOM geometry (purity of the library)
15. future artwork applicability (same workspace for books/artworks)

## Deliverable

Return a classified findings list. Every finding: ID, category
(CRITICAL/HIGH/MEDIUM/LOW), file:line, explanation, and suggested fix.
Be adversarial: attack the math, the migration edge cases, the identity
semantics, and the architecture boundaries. Do not rubber-stamp. If you find
nothing CRITICAL or HIGH, say so explicitly and justify. End with a verdict
paragraph: APPROVED / APPROVED WITH NON-BLOCKING FINDINGS / NOT APPROVED.
