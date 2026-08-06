import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createIndexedDbRepositories } from '../adapters/indexeddb';
import { migrateAnnotationV1ToV2 } from './annotationMigration';
import { createTestDatabase } from './database';
import { META_KEYS, STORES, dexieStores } from './schemaVersions';

const MAPPED_ID = '00000000-0000-4000-8000-000000000001';
const FALLBACK_ID = '00000000-0000-4000-8000-000000000002';
const SOURCE_ID = '00000000-0000-4000-8000-000000000003';
const ASSET_ID = '00000000-0000-4000-8000-000000000004';
const NOW = '2026-08-06T00:00:00.000Z';

function legacyAnnotation(
  id: string,
  kind: 'region' | 'bookmark',
  geometry: Record<string, unknown>,
) {
  return {
    id,
    sourceId: SOURCE_ID,
    assetId: ASSET_ID,
    page: 1,
    kind,
    geometry,
    style: {},
    linkedBlockIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
  };
}

describe('annotation schema-v1 to schema-v2 migration', () => {
  let databaseName: string | undefined;

  afterEach(async () => {
    if (databaseName) await Dexie.delete(databaseName);
  });

  it('transactionally converts every legacy record and advances meta', async () => {
    databaseName = `annotation-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(databaseName);
    legacy.version(1).stores(dexieStores(1));
    await legacy.open();
    await legacy.table(STORES.annotations).bulkPut([
      {
        id: MAPPED_ID,
        sourceId: SOURCE_ID,
        assetId: ASSET_ID,
        page: 3,
        kind: 'highlight',
        geometry: {
          normalized: false,
          data: { rects: [{ x: 100, y: 200, w: 300, h: 20 }] },
          viewportWidth: 1000,
          viewportHeight: 2000,
        },
        textAnchor: {
          page: 3,
          quote: 'legacy selected words',
          startOffset: 10,
          endOffset: 31,
          prefix: 'before',
          suffix: 'after',
        },
        style: { color: '#ffff00', opacity: 0.4 },
        linkedBlockIds: [],
        createdAt: NOW,
        updatedAt: NOW,
        revision: 4,
      },
      {
        id: FALLBACK_ID,
        sourceId: SOURCE_ID,
        assetId: ASSET_ID,
        page: 9,
        kind: 'region',
        geometry: {
          normalized: false,
          data: { proprietaryShape: 'not interpretable' },
        },
        style: {},
        linkedBlockIds: [],
        createdAt: NOW,
        updatedAt: NOW,
        revision: 1,
      },
    ]);
    await legacy.table(STORES.meta).put({
      key: META_KEYS.schemaVersion,
      value: 1,
    });
    legacy.close();

    const upgraded = createTestDatabase(databaseName);
    await upgraded.open();
    const repositories = createIndexedDbRepositories(upgraded);
    const mapped = await repositories.annotations.getById(MAPPED_ID);
    const fallback = await repositories.annotations.getById(FALLBACK_ID);

    expect(await upgraded.annotations.count()).toBe(2);
    expect(mapped).toMatchObject({
      id: MAPPED_ID,
      sourceId: SOURCE_ID,
      assetId: ASSET_ID,
      page: 3,
      revision: 4,
      anchor: {
        kind: 'text',
        quote: 'legacy selected words',
        startOffset: 10,
        endOffset: 31,
        prefix: 'before',
        suffix: 'after',
      },
      legacyMigration: { fromSchemaVersion: 1, geometryStatus: 'converted' },
    });
    expect(mapped?.anchor.kind).toBe('text');
    if (mapped?.anchor.kind === 'text') {
      expect(mapped.anchor.rects).toHaveLength(1);
      expect(mapped.anchor.rects[0]?.x).toBeCloseTo(0.1, 8);
      expect(mapped.anchor.rects[0]?.y).toBeCloseTo(0.1, 8);
      expect(mapped.anchor.rects[0]?.width).toBeCloseTo(0.3, 8);
      expect(mapped.anchor.rects[0]?.height).toBeCloseTo(0.01, 8);
      expect(mapped.anchor.boundingRect.width).toBeCloseTo(0.3, 8);
      expect(mapped.anchor.boundingRect.height).toBeCloseTo(0.01, 8);
    }
    expect(fallback).toMatchObject({
      id: FALLBACK_ID,
      page: 9,
      anchor: {
        kind: 'area',
        rect: { x: 0, y: 0, width: 0, height: 0 },
      },
      legacyMigration: { fromSchemaVersion: 1, geometryStatus: 'fallback' },
    });
    expect(await upgraded.meta.get(META_KEYS.schemaVersion)).toEqual({
      key: META_KEYS.schemaVersion,
      value: 2,
    });
    expect(upgraded.verno).toBe(2);
    upgraded.close();
  });

  it('unions every converted rectangle for a legacy area anchor', () => {
    const migrated = migrateAnnotationV1ToV2(
      legacyAnnotation('00000000-0000-4000-8000-000000000005', 'region', {
        normalized: true,
        data: {
          rects: [
            { x: 0.1, y: 0.2, width: 0.2, height: 0.1 },
            { x: 0.5, y: 0.6, width: 0.25, height: 0.2 },
          ],
        },
      }),
    );

    expect(migrated.legacyMigration?.geometryStatus).toBe('converted');
    expect(migrated.anchor.kind).toBe('area');
    if (migrated.anchor.kind === 'area') {
      expect(migrated.anchor.rect.x).toBeCloseTo(0.1, 8);
      expect(migrated.anchor.rect.y).toBeCloseTo(0.2, 8);
      expect(migrated.anchor.rect.width).toBeCloseTo(0.65, 8);
      expect(migrated.anchor.rect.height).toBeCloseTo(0.6, 8);
    }
  });

  it('marks an area-centroid bookmark anchor as fallback geometry', () => {
    const migrated = migrateAnnotationV1ToV2(
      legacyAnnotation('00000000-0000-4000-8000-000000000006', 'bookmark', {
        normalized: true,
        data: { rect: { x: 0.2, y: 0.3, width: 0.4, height: 0.2 } },
      }),
    );

    expect(migrated.anchor).toEqual({
      kind: 'point',
      point: { x: 0.4, y: 0.4 },
    });
    expect(migrated.legacyMigration?.geometryStatus).toBe('fallback');
  });

  it('keeps a directly stored bookmark point as converted geometry', () => {
    const migrated = migrateAnnotationV1ToV2(
      legacyAnnotation('00000000-0000-4000-8000-000000000007', 'bookmark', {
        normalized: true,
        data: { point: { x: 0.25, y: 0.75 } },
      }),
    );

    expect(migrated.anchor).toEqual({
      kind: 'point',
      point: { x: 0.25, y: 0.75 },
    });
    expect(migrated.legacyMigration?.geometryStatus).toBe('converted');
  });
});
