import { describe, expect, it } from 'vitest';
import {
  AnnotationAnchorSchema,
  AnnotationSchema,
  CreateAnnotationInputSchema,
  type CreateAnnotationInput,
} from './annotation.schemas';

const ID = '00000000-0000-0000-0000-000000000000';

function entity(anchor: unknown, kind = 'highlight') {
  return {
    id: ID,
    sourceId: ID,
    assetId: ID,
    page: 1,
    kind,
    anchor,
    createdAt: '2026-08-06T00:00:00.000Z',
    updatedAt: '2026-08-06T00:00:00.000Z',
    revision: 0,
  };
}

describe('AnnotationAnchorSchema', () => {
  it.each([
    {
      kind: 'text',
      quote: 'the selected words',
      rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.05 }],
      boundingRect: { x: 0.1, y: 0.2, width: 0.4, height: 0.05 },
    },
    { kind: 'area', rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.3 } },
    { kind: 'point', point: { x: 0.25, y: 0.75 } },
    {
      kind: 'ink',
      strokes: [{ points: [{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }] }],
    },
  ])('accepts the $kind anchor variant', (anchor) => {
    expect(AnnotationAnchorSchema.parse(anchor)).toEqual(anchor);
  });

  it('rejects empty text rectangles and empty ink strokes', () => {
    expect(
      AnnotationAnchorSchema.safeParse({
        kind: 'text',
        quote: 'words',
        rects: [],
        boundingRect: { x: 0, y: 0, width: 0, height: 0 },
      }).success,
    ).toBe(false);
    expect(
      AnnotationAnchorSchema.safeParse({ kind: 'ink', strokes: [] }).success,
    ).toBe(false);
  });

  it('rejects offsets in reverse order and a bounding rect that misses a line', () => {
    const result = AnnotationAnchorSchema.safeParse({
      kind: 'text',
      quote: 'words',
      startOffset: 9,
      endOffset: 3,
      rects: [{ x: 0.4, y: 0.4, width: 0.2, height: 0.1 }],
      boundingRect: { x: 0, y: 0, width: 0.1, height: 0.1 },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toHaveLength(2);
  });
});

describe('AnnotationSchema', () => {
  it('applies style and linked-block defaults', () => {
    const parsed = AnnotationSchema.parse(
      entity({
        kind: 'text',
        quote: 'words',
        rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
        boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
      }),
    );
    expect(parsed.style).toEqual({});
    expect(parsed.linkedBlockIds).toEqual([]);
  });

  it('rejects coordinates beyond the normalized page', () => {
    expect(
      AnnotationSchema.safeParse(
        entity(
          { kind: 'area', rect: { x: 0.8, y: 0.1, width: 0.3, height: 0.2 } },
          'region',
        ),
      ).success,
    ).toBe(false);
  });

  it('enforces the kind-to-anchor mapping', () => {
    expect(
      AnnotationSchema.safeParse(
        entity(
          { kind: 'point', point: { x: 0.5, y: 0.5 } },
          'highlight',
        ),
      ).success,
    ).toBe(false);
  });

  it('rejects an empty quote on a new text annotation', () => {
    expect(
      AnnotationSchema.safeParse(
        entity({
          kind: 'text',
          quote: '',
          rects: [{ x: 0.1, y: 0.2, width: 0.2, height: 0.05 }],
          boundingRect: { x: 0.1, y: 0.2, width: 0.2, height: 0.05 },
        }),
      ).success,
    ).toBe(false);
  });
});

describe('CreateAnnotationInputSchema', () => {
  it('keeps defaulted fields optional on input and strips entity-owned fields', () => {
    const input = {
      sourceId: ID,
      assetId: ID,
      page: 4,
      kind: 'bookmark' as const,
      anchor: { kind: 'point' as const, point: { x: 0.5, y: 0.5 } },
    } satisfies CreateAnnotationInput;

    expect(CreateAnnotationInputSchema.parse(input)).toMatchObject({
      ...input,
      style: {},
      linkedBlockIds: [],
    });
    expect(CreateAnnotationInputSchema.parse({ ...input, id: ID })).not.toHaveProperty(
      'id',
    );
  });
});
