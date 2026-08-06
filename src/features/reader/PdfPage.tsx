import { useEffect, useRef, useState } from 'react';
import type { EntityId } from '@domain/index';
import type { PageViewportLike, PdfPageBox } from '@lib/geometry';
import type { LoadedDocument } from './pdfjs';
import { renderTextLayer } from './pdfjs';
import { pdfPageBox } from './annotationCapture';
import { PdfAnnotationLayer } from './PdfAnnotationLayer';
import './reader.css';

export interface PdfPageProps {
  document: LoadedDocument;
  pageNumber: number;
  /** Multiplier on the page's natural size at 96dpi. */
  zoom: number;
  sourceId: EntityId;
  assetId: EntityId;
  regionActive: boolean;
  /** Reported once the page has painted, so the container can size. */
  onRendered?: (size: { width: number; height: number }) => void;
}

/**
 * One rendered PDF page: a canvas for the pixels, a text layer for
 * the words.
 *
 * **The canvas alone is a picture of a page, not a page.** Without a
 * text layer nothing can be selected or copied, the browser's own
 * find-in-page finds nothing, and a screen reader gets an image with
 * a label. The transparent spans pdf.js positions over the canvas are
 * what make the document actually readable — and they are what
 * Phase 3 will anchor annotations to, since a quote anchor needs real
 * text nodes to attach to.
 *
 * Three details that are not incidental:
 *
 * **Cancellation, twice.** Both the canvas render and the text layer
 * return cancel handles. A zoom change mid-render otherwise leaves
 * two render tasks writing to one canvas, and text spans landing in a
 * container that has already been re-laid-out at a different scale.
 *
 * **Device pixel ratio** on the canvas backing store, constrained
 * back with CSS. Skipping it renders text blurry on every retina
 * display, which for a reading application is not cosmetic.
 *
 * **The canvas is `aria-hidden`.** Once the text layer exists, a
 * labelled canvas would make a screen reader announce "Page 3, image"
 * and then read the page — the label becomes noise in front of the
 * real content.
 */
export function PdfPage({
  document,
  pageNumber,
  zoom,
  sourceId,
  assetId,
  regionActive,
  onRendered,
}: PdfPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [textFailed, setTextFailed] = useState(false);
  const [projection, setProjection] = useState<{
    viewport: PageViewportLike;
    pageBox: PdfPageBox;
    zoom: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let cancelText: (() => void) | null = null;
    void (async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale: zoom });
        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const task = page.render({
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        renderTask = task;
        await task.promise;
        if (cancelled) return;

        onRendered?.({ width: viewport.width, height: viewport.height });
        setProjection({ viewport, pageBox: pdfPageBox(page.view), zoom });

        // Text after pixels: the page is readable the moment the
        // canvas lands, and the text layer arrives without holding it.
        const container = textRef.current;
        if (container) {
          try {
            cancelText = await renderTextLayer(page, container, viewport);
            if (!cancelled) setTextFailed(false);
          } catch {
            // A page whose text cannot be extracted — a pure scan, a
            // broken font map — still renders. Losing selection is a
            // degradation; losing the page would be a failure.
            if (!cancelled) setTextFailed(true);
          }
        }
      } catch (cause) {
        // A cancelled render is the expected outcome of scrolling
        // away, not a failure worth showing anyone.
        const name = cause instanceof Error ? cause.name : '';
        if (cancelled || name === 'RenderingCancelledException') return;
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      cancelText?.();
    };
    // `onRendered` is excluded: callers pass an inline closure, and
    // including it would re-render the page on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, pageNumber, zoom]);

  if (error) {
    return (
      <div className="cn-pdf-page cn-pdf-page--error" role="alert">
        <p>Page {pageNumber} could not be displayed.</p>
        <p className="cn-pdf-page__detail">{error}</p>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="cn-pdf-page" data-page={pageNumber}>
      {/* Announces where the reader is, before the page's own text. */}
      <span className="cn-visually-hidden">Page {pageNumber}</span>
      <canvas ref={canvasRef} className="cn-pdf-page__canvas" aria-hidden="true" />
      <div ref={textRef} className="cn-pdf-page__text" data-testid="text-layer" />
      {projection?.zoom === zoom ? (
        <PdfAnnotationLayer
          sourceId={sourceId}
          assetId={assetId}
          pageNumber={pageNumber}
          viewport={projection.viewport}
          pageBox={projection.pageBox}
          pageRef={pageRef}
          regionActive={regionActive}
        />
      ) : null}
      {textFailed ? (
        <span className="cn-visually-hidden">
          The text of page {pageNumber} could not be extracted. It may be a scan.
        </span>
      ) : null}
      <span className="cn-pdf-page__number" aria-hidden="true">
        {pageNumber}
      </span>
    </div>
  );
}
