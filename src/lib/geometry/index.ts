import {
  AnnotationPointSchema,
  AnnotationRectSchema,
  type AnnotationPoint,
  type AnnotationRect,
} from '@domain/annotations/annotation.schemas';

/** PDF page box `[xMin, yMin, xMax, yMax]` in unrotated PDF units. */
export type PdfPageBox = readonly [number, number, number, number];

/**
 * The rotation-aware portion of a PDF.js viewport used by this library.
 * Coordinates are page-local CSS pixels, never canvas backing pixels.
 */
export interface PageViewportLike {
  readonly width: number;
  readonly height: number;
  convertToPdfPoint(x: number, y: number): readonly number[];
  convertToViewportPoint(x: number, y: number): readonly number[];
  convertToViewportRectangle(rect: readonly number[]): readonly number[];
}

export interface ViewportPoint {
  x: number;
  y: number;
}

export interface ViewportRect extends ViewportPoint {
  width: number;
  height: number;
}

const FLOAT_EPSILON = 1e-9;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function pair(values: readonly number[], label: string): readonly [number, number] {
  const x = values[0];
  const y = values[1];
  if (x === undefined || y === undefined) {
    throw new RangeError(`${label} must return an x/y pair`);
  }
  return [finite(x, `${label} x`), finite(y, `${label} y`)];
}

function unit(value: number, label: string): number {
  finite(value, label);
  if (value < -FLOAT_EPSILON || value > 1 + FLOAT_EPSILON) {
    throw new RangeError(`${label} must be within the page`);
  }
  return Math.min(1, Math.max(0, value));
}

function pageDimensions(pageBox: PdfPageBox) {
  const [xMin, yMin, xMax, yMax] = pageBox.map((value) =>
    finite(value, 'PDF page-box coordinate'),
  ) as [number, number, number, number];
  const width = xMax - xMin;
  const height = yMax - yMin;
  if (width <= 0 || height <= 0) {
    throw new RangeError('PDF page box must have positive width and height');
  }
  return { xMin, yMin, xMax, yMax, width, height };
}

function assertViewport(viewport: PageViewportLike): void {
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    throw new RangeError('Viewport must have positive finite CSS dimensions');
  }
}

function assertViewportPoint(point: ViewportPoint): void {
  finite(point.x, 'Viewport x');
  finite(point.y, 'Viewport y');
}

function assertViewportRect(rect: ViewportRect): void {
  assertViewportPoint(rect);
  finite(rect.width, 'Viewport rectangle width');
  finite(rect.height, 'Viewport rectangle height');
  if (rect.width < 0 || rect.height < 0) {
    throw new RangeError('Viewport rectangle dimensions must be non-negative');
  }
}

/** Convert one page-local CSS point into canonical unrotated coordinates. */
export function viewportPointToCanonical(
  point: ViewportPoint,
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): AnnotationPoint {
  assertViewport(viewport);
  assertViewportPoint(point);
  const page = pageDimensions(pageBox);
  const [pdfX, pdfY] = pair(
    viewport.convertToPdfPoint(point.x, point.y),
    'convertToPdfPoint',
  );
  return AnnotationPointSchema.parse({
    x: unit((pdfX - page.xMin) / page.width, 'Normalized x'),
    y: unit((page.yMax - pdfY) / page.height, 'Normalized y'),
  });
}

/** Project one canonical point into the current page-local CSS viewport. */
export function canonicalPointToViewport(
  point: AnnotationPoint,
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): ViewportPoint {
  assertViewport(viewport);
  const canonical = AnnotationPointSchema.parse(point);
  const page = pageDimensions(pageBox);
  const pdfX = page.xMin + canonical.x * page.width;
  const pdfY = page.yMax - canonical.y * page.height;
  const [x, y] = pair(
    viewport.convertToViewportPoint(pdfX, pdfY),
    'convertToViewportPoint',
  );
  return { x, y };
}

/** Convert an axis-aligned page-local CSS rectangle into canonical geometry. */
export function viewportRectToCanonical(
  rect: ViewportRect,
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): AnnotationRect {
  assertViewport(viewport);
  assertViewportRect(rect);
  const page = pageDimensions(pageBox);
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
  ] as const;
  const pdfCorners = corners.map(([x, y]) =>
    pair(viewport.convertToPdfPoint(x, y), 'convertToPdfPoint'),
  );
  const xs = pdfCorners.map(([x]) => x);
  const ys = pdfCorners.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);

  return AnnotationRectSchema.parse({
    x: unit((left - page.xMin) / page.width, 'Normalized rectangle x'),
    y: unit((page.yMax - top) / page.height, 'Normalized rectangle y'),
    width: unit((right - left) / page.width, 'Normalized rectangle width'),
    height: unit((top - bottom) / page.height, 'Normalized rectangle height'),
  });
}

/** Project a canonical rectangle into the current page-local CSS viewport. */
export function canonicalRectToViewport(
  rect: AnnotationRect,
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): ViewportRect {
  assertViewport(viewport);
  const canonical = AnnotationRectSchema.parse(rect);
  const page = pageDimensions(pageBox);
  const pdfLeft = page.xMin + canonical.x * page.width;
  const pdfRight = pdfLeft + canonical.width * page.width;
  const pdfTop = page.yMax - canonical.y * page.height;
  const pdfBottom = pdfTop - canonical.height * page.height;
  const converted = viewport.convertToViewportRectangle([
    pdfLeft,
    pdfBottom,
    pdfRight,
    pdfTop,
  ]);
  if (converted.length < 4) {
    throw new RangeError('convertToViewportRectangle must return two points');
  }
  const [x1, y1] = pair(converted, 'convertToViewportRectangle');
  const [x2, y2] = pair(converted.slice(2), 'convertToViewportRectangle');
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function viewportRectsToCanonical(
  rects: readonly ViewportRect[],
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): AnnotationRect[] {
  return rects.map((rect) => viewportRectToCanonical(rect, viewport, pageBox));
}

export function canonicalRectsToViewport(
  rects: readonly AnnotationRect[],
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): ViewportRect[] {
  return rects.map((rect) => canonicalRectToViewport(rect, viewport, pageBox));
}

export function viewportPathToCanonical(
  points: readonly ViewportPoint[],
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): AnnotationPoint[] {
  return points.map((point) => viewportPointToCanonical(point, viewport, pageBox));
}

export function canonicalPathToViewport(
  points: readonly AnnotationPoint[],
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): ViewportPoint[] {
  return points.map((point) => canonicalPointToViewport(point, viewport, pageBox));
}

/** Smallest canonical rectangle containing all supplied rectangles. */
export function boundingRectFor(rects: readonly AnnotationRect[]): AnnotationRect {
  if (rects.length === 0) throw new RangeError('At least one rectangle is required');
  const parsed = rects.map((rect) => AnnotationRectSchema.parse(rect));
  const left = Math.min(...parsed.map((rect) => rect.x));
  const top = Math.min(...parsed.map((rect) => rect.y));
  const right = Math.max(...parsed.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...parsed.map((rect) => rect.y + rect.height));
  return AnnotationRectSchema.parse({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}
