import type {
  AreaAnnotationAnchor,
  TextAnnotationAnchor,
} from '@domain/annotations/annotation.schemas';
import {
  boundingRectFor,
  viewportRectToCanonical,
  viewportRectsToCanonical,
  type PageViewportLike,
  type PdfPageBox,
  type ViewportPoint,
  type ViewportRect,
} from '@lib/geometry';

export interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PageOrigin {
  left: number;
  top: number;
}

export interface TextSelectionCaptureInput {
  quote: string;
  clientRects: readonly ClientRectLike[];
  pageOrigin: PageOrigin;
  viewport: PageViewportLike;
  pageBox: PdfPageBox;
}

/** Capture browser selection rectangles only at the CSS-to-canonical boundary. */
export function captureTextSelection({
  quote,
  clientRects,
  pageOrigin,
  viewport,
  pageBox,
}: TextSelectionCaptureInput): TextAnnotationAnchor | null {
  const trimmedQuote = quote.trim();
  if (!trimmedQuote) return null;

  const localRects = clientRects
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: rect.left - pageOrigin.left,
      y: rect.top - pageOrigin.top,
      width: rect.width,
      height: rect.height,
    }));
  if (localRects.length === 0) return null;

  const rects = viewportRectsToCanonical(localRects, viewport, pageBox);
  return {
    kind: 'text',
    quote: trimmedQuote,
    rects,
    boundingRect: boundingRectFor(rects),
  };
}

/** Normalize an arbitrary-direction drag in page-local CSS coordinates. */
export function rectFromRegionDrag(
  start: ViewportPoint,
  end: ViewportPoint,
  minimumSize = 4,
): ViewportRect | null {
  const rect = {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
  return rect.width < minimumSize || rect.height < minimumSize ? null : rect;
}

export function captureRegionAnchor(
  start: ViewportPoint,
  end: ViewportPoint,
  viewport: PageViewportLike,
  pageBox: PdfPageBox,
): AreaAnnotationAnchor | null {
  const rect = rectFromRegionDrag(start, end);
  return rect
    ? { kind: 'area', rect: viewportRectToCanonical(rect, viewport, pageBox) }
    : null;
}

export function pdfPageBox(view: readonly number[]): PdfPageBox {
  if (view.length < 4) throw new RangeError('PDF page view has no page box');
  return [view[0]!, view[1]!, view[2]!, view[3]!];
}
