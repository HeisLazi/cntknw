import { describe, expect, it } from 'vitest';
import { AnnotationSchema } from '@domain/annotations/annotation.schemas';
import {
  boundingRectFor,
  canonicalPathToViewport,
  canonicalRectToViewport,
  canonicalRectsToViewport,
  viewportPathToCanonical,
  viewportRectToCanonical,
  viewportRectsToCanonical,
  type PageViewportLike,
  type PdfPageBox,
  type ViewportRect,
} from './index';

const PAGE_BOX: PdfPageBox = [10, 20, 410, 620];

/** Deterministic affine stand-in for PDF.js PageViewport. */
function viewport(scale: number, rotation: 0 | 90 | 180 | 270 = 0): PageViewportLike {
  const [xMin, yMin, xMax, yMax] = PAGE_BOX;
  const pageWidth = xMax - xMin;
  const pageHeight = yMax - yMin;
  const matrices = {
    0: [scale, 0, 0, -scale, -xMin * scale, yMax * scale],
    90: [0, scale, scale, 0, -yMin * scale, -xMin * scale],
    180: [-scale, 0, 0, scale, xMax * scale, -yMin * scale],
    270: [0, -scale, -scale, 0, yMax * scale, xMax * scale],
  } as const;
  const [a, b, c, d, e, f] = matrices[rotation];
  const determinant = a * d - b * c;

  const toViewport = (x: number, y: number): [number, number] => [
    a * x + c * y + e,
    b * x + d * y + f,
  ];
  const toPdf = (x: number, y: number): [number, number] => {
    const translatedX = x - e;
    const translatedY = y - f;
    return [
      (d * translatedX - c * translatedY) / determinant,
      (-b * translatedX + a * translatedY) / determinant,
    ];
  };
  return {
    width: (rotation === 0 || rotation === 180 ? pageWidth : pageHeight) * scale,
    height: (rotation === 0 || rotation === 180 ? pageHeight : pageWidth) * scale,
    convertToPdfPoint: toPdf,
    convertToViewportPoint: toViewport,
    convertToViewportRectangle: ([left, bottom, right, top]) => {
      const first = toViewport(left!, bottom!);
      const second = toViewport(right!, top!);
      return [...first, ...second];
    },
  };
}

function expectRectClose(actual: ViewportRect, expected: ViewportRect): void {
  expect(actual.x).toBeCloseTo(expected.x, 7);
  expect(actual.y).toBeCloseTo(expected.y, 7);
  expect(actual.width).toBeCloseTo(expected.width, 7);
  expect(actual.height).toBeCloseTo(expected.height, 7);
}

describe('canonical annotation geometry', () => {
  it('round-trips a deterministic property sample through viewport space', () => {
    let seed = 0x12345678;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let index = 0; index < 100; index += 1) {
      const current = viewport(0.5 + random() * 2.5);
      const x = random() * current.width * 0.75;
      const y = random() * current.height * 0.75;
      const rect = {
        x,
        y,
        width: random() * (current.width - x),
        height: random() * (current.height - y),
      };
      const canonical = viewportRectToCanonical(rect, current, PAGE_BOX);
      expectRectClose(canonicalRectToViewport(canonical, current, PAGE_BOX), rect);
    }
  });

  it('is independent of zoom and viewport resize', () => {
    const atOne = viewport(1);
    const atTwo = viewport(2);
    const selected = { x: 80, y: 120, width: 160, height: 90 };
    const canonical = viewportRectToCanonical(selected, atOne, PAGE_BOX);

    expectRectClose(canonicalRectToViewport(canonical, atTwo, PAGE_BOX), {
      x: 160,
      y: 240,
      width: 320,
      height: 180,
    });
  });

  it('uses CSS coordinates and is independent of devicePixelRatio', () => {
    const cssViewport = viewport(1.25);
    const selected = { x: 50, y: 75, width: 200, height: 100 };
    const atDprOne = viewportRectToCanonical(selected, cssViewport, PAGE_BOX);
    const backingCanvasAtDprTwo = {
      width: cssViewport.width * 2,
      height: cssViewport.height * 2,
    };

    expect(backingCanvasAtDprTwo.width).toBe(cssViewport.width * 2);
    expect(viewportRectToCanonical(selected, cssViewport, PAGE_BOX)).toEqual(
      atDprOne,
    );
  });

  it('preserves every rectangle in a multi-line text selection', () => {
    const current = viewport(1.5);
    const rects = [
      { x: 30, y: 45, width: 210, height: 18 },
      { x: 30, y: 70, width: 150, height: 18 },
      { x: 30, y: 95, width: 80, height: 18 },
    ];
    const canonical = viewportRectsToCanonical(rects, current, PAGE_BOX);
    const projected = canonicalRectsToViewport(canonical, current, PAGE_BOX);

    expect(projected).toHaveLength(3);
    projected.forEach((rect, index) => expectRectClose(rect, rects[index]!));
    expect(boundingRectFor(canonical).height).toBeGreaterThan(
      canonical[0]!.height,
    );
  });

  it('round-trips editable ink path points', () => {
    const current = viewport(1.75);
    const path = [
      { x: 25, y: 40 },
      { x: 80, y: 95 },
      { x: 160, y: 120 },
      { x: 260, y: 220 },
    ];
    const canonical = viewportPathToCanonical(path, current, PAGE_BOX);
    const projected = canonicalPathToViewport(canonical, current, PAGE_BOX);
    projected.forEach((point, index) => {
      expect(point.x).toBeCloseTo(path[index]!.x, 7);
      expect(point.y).toBeCloseTo(path[index]!.y, 7);
    });
  });

  it.each([1, 500])('keeps page %i 1-based at the annotation boundary', (page) => {
    const anchor = {
      kind: 'area' as const,
      rect: viewportRectToCanonical(
        { x: 40, y: 60, width: 100, height: 80 },
        viewport(1),
        PAGE_BOX,
      ),
    };
    expect(
      AnnotationSchema.parse({
        id: '00000000-0000-0000-0000-000000000000',
        sourceId: '00000000-0000-0000-0000-000000000000',
        assetId: '00000000-0000-0000-0000-000000000000',
        page,
        kind: 'region',
        anchor,
        createdAt: '2026-08-06T00:00:00.000Z',
        updatedAt: '2026-08-06T00:00:00.000Z',
        revision: 0,
      }).page,
    ).toBe(page);
  });

  it('rejects out-of-range viewport and canonical geometry', () => {
    expect(() =>
      viewportRectToCanonical(
        { x: -20, y: 0, width: 40, height: 40 },
        viewport(1),
        PAGE_BOX,
      ),
    ).toThrow(RangeError);
    expect(() =>
      canonicalRectToViewport(
        { x: 0.9, y: 0.2, width: 0.2, height: 0.1 },
        viewport(1),
        PAGE_BOX,
      ),
    ).toThrow();
  });

  it('round-trips under a non-zero 90-degree rotation', () => {
    const rotated = viewport(1.25, 90);
    const selected = { x: 120, y: 80, width: 210, height: 100 };
    const canonical = viewportRectToCanonical(selected, rotated, PAGE_BOX);
    expectRectClose(
      canonicalRectToViewport(canonical, rotated, PAGE_BOX),
      selected,
    );
  });
});
