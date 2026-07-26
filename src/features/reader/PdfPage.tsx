import { useEffect, useRef, useState } from 'react';
import type { LoadedDocument } from './pdfjs';
import './reader.css';

export interface PdfPageProps {
  document: LoadedDocument;
  pageNumber: number;
  /** Multiplier on the page's natural size at 96dpi. */
  zoom: number;
  /** Reported once the page has painted, so the container can size. */
  onRendered?: (size: { width: number; height: number }) => void;
}

/**
 * One rendered PDF page.
 *
 * Two things here are not incidental:
 *
 * **Cancellation.** `page.render()` returns a task that must be
 * cancelled if the component re-renders or unmounts before it
 * finishes. Without it, a fast scroll or a zoom change leaves several
 * render tasks writing to the same canvas, and pages tear or paint
 * the wrong content.
 *
 * **Device pixel ratio.** The canvas backing store is scaled by DPR
 * and then constrained back with CSS. Skipping that renders text
 * blurry on every retina display, which for a reading application is
 * not a cosmetic problem.
 */
export function PdfPage({ document, pageNumber, zoom, onRendered }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

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

        if (!cancelled) {
          onRendered?.({ width: viewport.width, height: viewport.height });
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
    <div className="cn-pdf-page" data-page={pageNumber}>
      {/*
        The canvas carries the page number as its accessible label.
        A text layer is Phase 3 work — until it exists, saying "page
        N of a PDF" is honest, where an unlabelled canvas would be
        an unexplained blank to a screen reader.
      */}
      <canvas
        ref={canvasRef}
        className="cn-pdf-page__canvas"
        role="img"
        aria-label={`Page ${pageNumber}`}
      />
      <span className="cn-pdf-page__number" aria-hidden="true">
        {pageNumber}
      </span>
    </div>
  );
}
