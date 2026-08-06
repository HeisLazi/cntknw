import { describe, expect, it } from 'vitest';
import type { PageViewportLike, PdfPageBox } from '@lib/geometry';
import {
  captureRegionAnchor,
  captureTextSelection,
  rectFromRegionDrag,
} from './annotationCapture';

const PAGE_BOX: PdfPageBox = [0, 0, 400, 600];

function viewport(scale = 1): PageViewportLike {
  return {
    width: 400 * scale,
    height: 600 * scale,
    convertToPdfPoint: (x, y) => [x / scale, 600 - y / scale],
    convertToViewportPoint: (x, y) => [x * scale, (600 - y) * scale],
    convertToViewportRectangle: ([left, bottom, right, top]) => [
      left! * scale,
      (600 - bottom!) * scale,
      right! * scale,
      (600 - top!) * scale,
    ],
  };
}

describe('annotation capture', () => {
  it('captures a single-line quote in page-local canonical coordinates', () => {
    const captured = captureTextSelection({
      quote: '  source text  ',
      clientRects: [{ left: 120, top: 240, width: 160, height: 24 }],
      pageOrigin: { left: 40, top: 60 },
      viewport: viewport(),
      pageBox: PAGE_BOX,
    });

    expect(captured?.kind).toBe('text');
    expect(captured?.quote).toBe('source text');
    expect(captured?.rects[0]?.x).toBeCloseTo(0.2);
    expect(captured?.rects[0]?.y).toBeCloseTo(0.3);
    expect(captured?.rects[0]?.width).toBeCloseTo(0.4);
    expect(captured?.rects[0]?.height).toBeCloseTo(0.04);
    expect(captured?.boundingRect.x).toBeCloseTo(captured?.rects[0]?.x ?? -1);
    expect(captured?.boundingRect.y).toBeCloseTo(captured?.rects[0]?.y ?? -1);
    expect(captured?.boundingRect.width).toBeCloseTo(
      captured?.rects[0]?.width ?? -1,
    );
    expect(captured?.boundingRect.height).toBeCloseTo(
      captured?.rects[0]?.height ?? -1,
    );
  });

  it('preserves each rectangle in a multiline selection', () => {
    const captured = captureTextSelection({
      quote: 'first line second line',
      clientRects: [
        { left: 50, top: 70, width: 200, height: 20 },
        { left: 50, top: 95, width: 120, height: 20 },
      ],
      pageOrigin: { left: 10, top: 10 },
      viewport: viewport(),
      pageBox: PAGE_BOX,
    });

    expect(captured?.rects).toHaveLength(2);
    expect(captured?.boundingRect.x).toBeCloseTo(0.1);
    expect(captured?.boundingRect.y).toBeCloseTo(0.1);
    expect(captured?.boundingRect.width).toBeCloseTo(0.5);
    expect(captured?.boundingRect.height).toBeCloseTo(0.075);
  });

  it.each([
    { quote: '   ', rects: [{ left: 0, top: 0, width: 20, height: 10 }] },
    { quote: 'text', rects: [] },
    { quote: 'text', rects: [{ left: 0, top: 0, width: 0, height: 10 }] },
  ])('returns null for empty or degenerate selection %#', ({ quote, rects }) => {
    expect(
      captureTextSelection({
        quote,
        clientRects: rects,
        pageOrigin: { left: 0, top: 0 },
        viewport: viewport(),
        pageBox: PAGE_BOX,
      }),
    ).toBeNull();
  });

  it('normalizes a reverse region drag and converts it to an area anchor', () => {
    expect(rectFromRegionDrag({ x: 220, y: 180 }, { x: 60, y: 60 })).toEqual({
      x: 60,
      y: 60,
      width: 160,
      height: 120,
    });
    expect(
      captureRegionAnchor(
        { x: 220, y: 180 },
        { x: 60, y: 60 },
        viewport(),
        PAGE_BOX,
      ),
    ).toEqual({
      kind: 'area',
      rect: { x: 0.15, y: 0.1, width: 0.4, height: 0.2 },
    });
  });

  it('quietly ignores a region drag smaller than four CSS pixels', () => {
    expect(rectFromRegionDrag({ x: 10, y: 10 }, { x: 13, y: 30 })).toBeNull();
    expect(
      captureRegionAnchor(
        { x: 10, y: 10 },
        { x: 13, y: 30 },
        viewport(),
        PAGE_BOX,
      ),
    ).toBeNull();
  });
});
