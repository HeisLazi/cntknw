# Phase 3A Closure — Exact-Asset Annotation Retrieval (narrow correction)

**Date:** 2026-08-06
**Issued by:** Hermes (manager) to Codex CLI (implementer)
**Model:** gpt-5.6-terra, model_reasoning_effort="high"
**Base:** eb1785f5991944cee2783f4ab0a8dc210a962d50 (HEAD == origin/main)

## Context

ADR-0007 establishes canonical annotation identity `(sourceId, assetId, page,
annotationId)` and requires annotations attached to an old/replaced PDF asset
never to silently render on a replacement asset. But `AnnotationRepository`
still exposes `getBySourceAndPage(sourceId, page)` — a per-page query with no
assetId — which creates an unsafe access path (a renderer displaying
asset B/page N could receive annotations belonging to asset A/page N unless
every caller remembers an extra filter). The Phase 3A closure pass replaces
this with an exact-asset retrieval contract.

Verified facts (do not re-derive):
- `getBySourceAndPage` has NO production callers. Only the contract test
  (`src/data/adapters/repository-contract.test.ts:423-424`) uses it.
- Memory adapter: `src/data/adapters/memory/index.ts:445-455` (Map filter on
  sourceId + page).
- IndexedDB adapter: `src/data/adapters/indexeddb/index.ts:533-538` (uses the
  `[sourceId+page]` compound index).
- The `[sourceId+page]` index is declared in
  `src/data/db/schemaVersions.ts` for the `annotations` store.
- The contract test runs BOTH adapters in a loop (`for (const adapter of
  adapters)` at line 75); annotation tests live in the
  `AnnotationRepository` describe block (~line 405-444).
- Application use-case tests use `createMemoryRepositories()` directly, e.g.
  `src/application/application.test.ts` (imports from `@data/adapters/memory`).
- Asset API shape (see contract test ~lines 380-400): `repos.assets.create`,
  `repos.assets.linkToSource(assetId, sourceId, 'primary')`,
  `repos.assets.getAssetsForSource(sourceId)`.

## Scope — code and tests ONLY

1. **Repository interface** (`src/data/repositories/AnnotationRepository.ts`):
   REPLACE `getBySourceAndPage(sourceId: EntityId, page: number)` with:
   `getBySourceAssetAndPage(sourceId: EntityId, assetId: EntityId, page: number): Promise<Annotation[]>`.
   Document it as the exact-asset page query the Phase 3B reader/rendering
   path must use.

2. **Memory adapter** (`src/data/adapters/memory/index.ts`): implement
   `getBySourceAssetAndPage` filtering on sourceId AND assetId AND page.
   Drop the old method and its historical A-2 comment (no longer relevant).

3. **IndexedDB adapter** (`src/data/adapters/indexeddb/index.ts`): implement
   `getBySourceAssetAndPage` using the EXISTING `[sourceId+page]` index
   (`where('[sourceId+page]').equals([sourceId, page])`) and then filter
   results by `assetId` in JS. Do NOT bump the Dexie schema, do NOT add a
   `[sourceId+assetId+page]` index, do NOT create a v3 migration — the
   stakeholder explicitly prefers the smallest sound implementation, and
   filtering over the existing compound index preserves correctness and
   contract identity.

4. **Remove** `getBySourceAndPage` everywhere (interface + both adapters).
   Nothing genuinely needs cross-asset page retrieval; the preferred outcome
   is removal. Keep `getBySource` unchanged (source-wide retrieval must keep
   intentionally returning annotations from ALL assets of a source).

5. **Contract tests** (`src/data/adapters/repository-contract.test.ts`):
   Replace the "queries by source and page" test (~lines 406-426) with the
   adversarial two-asset proof, still inside the per-adapter loop so it runs
   against BOTH Memory and IndexedDB:
   - one source S
   - two exact PDF assets A and B belonging to S
   - annotation A1 on A/page 7
   - annotation B1 on B/page 7
   - annotation A2 on A/page 8
   - prove:
     1. exact retrieval S+A+7 returns A1 and never B1;
     2. exact retrieval S+B+7 returns B1 and never A1;
     3. page mismatch does not leak (S+A+8 returns A2 only; S+A+9 is empty);
     4. source-wide `getBySource(S)` still returns annotations from BOTH
        assets (length 3, contains A1, B1, A2);
     5. both adapters behave identically (the loop guarantees this).
   - Keep the "rejects a non-positive page" test unchanged.

6. **Application use-case test**: add one focused test (or small describe
   block) to `src/application/application.test.ts` that makes asset
   replacement safety hard to regress, using `createMemoryRepositories()`:
   - create source S; create two assets A and B; link both to S;
   - create A1 on A/page 7 and B1 on B/page 7 (use the canonical anchor
     shapes from the existing tests);
   - assert the exact-asset path a future renderer must use —
     `repos.annotations.getBySourceAssetAndPage(S, B, 7)` — returns ONLY B1,
     i.e. an annotation from replaced asset A can never enter the render
     path for B. Comment that this is the Phase 3B renderer seam.
   Do NOT create a new application module; a test in the existing
   application.test.ts file is sufficient.

7. **Comment cleanup** (`src/data/db/database.ts` header, ~lines 1-15):
   The header says this module "never migrates v1 data" / "there is no apply
   path". Clarify (comments only, do NOT change migration semantics): the
   module never destructively migrates the separate legacy
   philosophy-journal database; it DOES run declared schema upgrades inside
   the cntknw v2 database (currently the version-2 annotation upgrade).
   Adjust the wording so future agents are not confused.

## Constraints

- Do NOT touch: domain schemas, migration logic, geometry library, e2e
  probe/specs, docs (Hermes reconciles docs), ADR-0007.
- Do NOT commit, stage, or push — leave the working tree uncommitted.
- Do NOT modify `docs/CNTKNW_Canonical_Documentation_Package_v0.2.zip`.
- Preserve every unrelated untracked file.
- Keep style conventions: existing adapter patterns, `guarded()` wrappers in
  IndexedDB, `annotationFromStorage` mapping, `CreateAnnotationInputSchema`
  validation on create.

## Verification (run these)

1. `npx vitest run src/data/adapters/repository-contract.test.ts` — PASS
2. `npx vitest run src/application/application.test.ts` — PASS
3. `npx vitest run` (full unit suite) — PASS, report totals
4. `npm run typecheck` — PASS
5. `npm run lint` — PASS

## Report format (final message)

- files changed (with line references)
- the new interface signature and both adapter implementations
- whether getBySourceAndPage was removed (yes) and why (no production callers)
- the two-asset adversarial test results
- the application-level replacement-safety test result
- full unit suite totals
- typecheck/lint results
- confirm nothing staged/committed and the ZIP untouched
