/** Test-only proof that ADR-0007 geometry composes with the real PdfReader. */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PdfReader } from '@features/reader/PdfReader';
import { loadPdfDocument, type LoadedDocument } from '@features/reader/pdfjs';
import {
  canonicalRectToViewport,
  viewportRectToCanonical,
  type PdfPageBox,
  type ViewportRect,
} from '@lib/geometry';
import type { AnnotationRect } from '@domain/annotations/annotation.schemas';
import '@design/tokens.css';
import '@design/base.css';

interface ProbeDocument {
  value: LoadedDocument;
  generation: number;
}

export interface ProbeDomGeometry {
  page: number;
  pageLeft: number;
  pageTop: number;
  pageWidth: number;
  pageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  scrollTop: number;
}

export interface CntknwGeometryProbe {
  openPdf(bytes: readonly number[], initialPage?: number): Promise<number>;
  defineRegion(page: number, rect: ViewportRect): Promise<AnnotationRect>;
  renderedRect(page: number, rect: AnnotationRect): Promise<ViewportRect>;
  setZoom(zoom: number): void;
  navigate(page: number): void;
  mountedPages(): number[];
  domGeometry(page: number): ProbeDomGeometry | null;
}

function pageBox(view: readonly number[]): PdfPageBox {
  if (view.length < 4) throw new RangeError('PDF page view has no page box');
  return [view[0]!, view[1]!, view[2]!, view[3]!];
}

function GeometryProbe() {
  const [loaded, setLoaded] = useState<ProbeDocument | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const documentRef = useRef<LoadedDocument | null>(null);
  const pageRef = useRef(1);
  const zoomRef = useRef(1);
  const generationRef = useRef(0);

  useEffect(() => {
    const api: CntknwGeometryProbe = {
      async openPdf(bytes, initialPage = 1) {
        const previous = documentRef.current;
        if (previous) await previous.destroy();
        const next = await loadPdfDocument(new Uint8Array(bytes).buffer);
        if (initialPage < 1 || initialPage > next.pageCount) {
          await next.destroy();
          throw new RangeError(`Page ${initialPage} is outside the PDF`);
        }
        generationRef.current += 1;
        documentRef.current = next;
        pageRef.current = initialPage;
        zoomRef.current = 1;
        setPage(initialPage);
        setZoom(1);
        setScrollOffset(0);
        setLoaded({ value: next, generation: generationRef.current });
        return next.pageCount;
      },

      async defineRegion(pageNumber, rect) {
        const current = documentRef.current;
        if (!current) throw new Error('Open a PDF first');
        const pdfPage = await current.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: zoomRef.current });
        return viewportRectToCanonical(rect, viewport, pageBox(pdfPage.view));
      },

      async renderedRect(pageNumber, rect) {
        const current = documentRef.current;
        if (!current) throw new Error('Open a PDF first');
        const pdfPage = await current.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: zoomRef.current });
        return canonicalRectToViewport(rect, viewport, pageBox(pdfPage.view));
      },

      setZoom(nextZoom) {
        if (!Number.isFinite(nextZoom) || nextZoom <= 0) {
          throw new RangeError('Zoom must be positive');
        }
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
      },

      navigate(nextPage) {
        const current = documentRef.current;
        if (!current || nextPage < 1 || nextPage > current.pageCount) {
          throw new RangeError(`Page ${nextPage} is outside the PDF`);
        }
        pageRef.current = nextPage;
        setPage(nextPage);
      },

      mountedPages() {
        return [...document.querySelectorAll<HTMLElement>('.cn-pdf-page[data-page]')]
          .map((element) => Number(element.dataset.page))
          .sort((left, right) => left - right);
      },

      domGeometry(pageNumber) {
        const element = document.querySelector<HTMLElement>(
          `.cn-pdf-page[data-page="${pageNumber}"]`,
        );
        const canvas = element?.querySelector('canvas');
        const scroll = element?.closest<HTMLElement>('.cn-reader__scroll');
        if (!element || !canvas || !scroll) return null;
        const pageRect = element.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        return {
          page: pageNumber,
          pageLeft: pageRect.left,
          pageTop: pageRect.top,
          pageWidth: pageRect.width,
          pageHeight: pageRect.height,
          canvasWidth: canvasRect.width,
          canvasHeight: canvasRect.height,
          scrollTop: scroll.scrollTop,
        };
      },
    };

    window.__cntknwProbe = api;
    document.body.dataset.probe = 'ready';
  }, []);

  useEffect(
    () => () => {
      void documentRef.current?.destroy();
    },
    [],
  );

  if (!loaded) {
    return <p role="status">Annotation geometry probe ready.</p>;
  }

  return (
    <PdfReader
      key={loaded.generation}
      document={loaded.value}
      page={page}
      zoom={zoom}
      scrollOffset={scrollOffset}
      onPageChange={(nextPage) => {
        pageRef.current = nextPage;
        setPage(nextPage);
      }}
      onZoomChange={(nextZoom) => {
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
      }}
      onScroll={setScrollOffset}
    />
  );
}

declare global {
  interface Window {
    __cntknwProbe: CntknwGeometryProbe;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Geometry probe root is missing');
createRoot(root).render(<GeometryProbe />);
