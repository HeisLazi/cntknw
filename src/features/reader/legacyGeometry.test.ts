import { describe, expect, it } from 'vitest';
import { AnnotationSchema, type Annotation } from '@domain/index';
import {
  isLegacyFallback,
  splitAnnotationsByLegacyGeometry,
} from './legacyGeometry';

const SOURCE_ID = '10000000-0000-4000-8000-000000000001';
const ASSET_ID = '20000000-0000-4000-8000-000000000001';

function annotation(
  id: string,
  geometryStatus?: 'converted' | 'fallback',
): Annotation {
  return AnnotationSchema.parse({
    id,
    sourceId: SOURCE_ID,
    assetId: ASSET_ID,
    page: 3,
    kind: 'highlight',
    anchor: {
      kind: 'text',
      quote: geometryStatus ? '' : 'Native quote',
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
      boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
    },
    style: {},
    linkedBlockIds: [],
    legacyMigration: geometryStatus
      ? { fromSchemaVersion: 1, geometryStatus }
      : undefined,
    createdAt: '2026-08-06T00:00:00.000Z',
    updatedAt: '2026-08-06T00:00:00.000Z',
    revision: 0,
  });
}

describe('legacy annotation geometry presentation policy', () => {
  it('classifies only explicit fallback migration records as fallback', () => {
    const native = annotation('30000000-0000-4000-8000-000000000001');
    const converted = annotation(
      '30000000-0000-4000-8000-000000000002',
      'converted',
    );
    const fallback = annotation(
      '30000000-0000-4000-8000-000000000003',
      'fallback',
    );

    expect(isLegacyFallback(native)).toBe(false);
    expect(isLegacyFallback(converted)).toBe(false);
    expect(isLegacyFallback(fallback)).toBe(true);
  });

  it('partitions mixed lists without changing order', () => {
    const native = annotation('30000000-0000-4000-8000-000000000011');
    const fallbackA = annotation(
      '30000000-0000-4000-8000-000000000012',
      'fallback',
    );
    const converted = annotation(
      '30000000-0000-4000-8000-000000000013',
      'converted',
    );
    const fallbackB = annotation(
      '30000000-0000-4000-8000-000000000014',
      'fallback',
    );

    expect(
      splitAnnotationsByLegacyGeometry([
        native,
        fallbackA,
        converted,
        fallbackB,
      ]),
    ).toEqual({
      positioned: [native, converted],
      fallback: [fallbackA, fallbackB],
    });
  });

  it('returns two empty partitions for an empty list', () => {
    expect(splitAnnotationsByLegacyGeometry([])).toEqual({
      positioned: [],
      fallback: [],
    });
  });
});
