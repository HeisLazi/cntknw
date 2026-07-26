import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton } from '@components/primitives';
import { PdfPage } from './PdfPage';
import type { LoadedDocument } from './pdfjs';
import './reader.css';

export interface PdfReaderProps {
  document: LoadedDocument;
  /** 1-based, as everywhere at the domain boundary. */
  page: number;
  zoom: number;
  scrollOffset: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onScroll: (offset: number) => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
const PAGE_WINDOW = 2;

function nextZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.findIndex((step) => step >= current - 0.001);
  const target = (index === -1 ? ZOOM_STEPS.length - 1 : index) + direction;
  return ZOOM_STEPS[Math.min(Math.max(target, 0), ZOOM_STEPS.length - 1)]!;
}

/**
 * The source pane.
 *
 * Continuous scrolling with a **windowed** page list: only pages
 * within `PAGE_WINDOW` of the current one are mounted. A 400-page
 * book rendered in full would allocate 400 canvases and exhaust
 * memory before it finished — NFR-003 asks that large PDFs are not
 * fully loaded, and this is where that promise is either kept or
 * quietly broken.
 *
 * Scroll position and the current page are **reported upward, not
 * stored here.** They belong to `WorkspaceState` in the repository,
 * because AC-002 requires them to survive closing the app. Keeping
 * a second copy in component state is how the two drift apart.
 */
export function PdfReader({
  document,
  page,
  zoom,
  scrollOffset,
  onPageChange,
  onZoomChange,
  onScroll,
}: PdfReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredFor = useRef<number | null>(null);
  const [pageHeight, setPageHeight] = useState(0);

  const visiblePages = useMemo(() => {
    const first = Math.max(1, page - PAGE_WINDOW);
    const last = Math.min(document.pageCount, page + PAGE_WINDOW);
    const pages: number[] = [];
    for (let n = first; n <= last; n += 1) pages.push(n);
    return pages;
  }, [document.pageCount, page]);

  // Restore the saved scroll offset once per source, after the first
  // page has a measured height. Doing it on every render would fight
  // the user for control of the scrollbar.
  useEffect(() => {
    if (pageHeight === 0) return;
    if (restoredFor.current === document.pageCount) return;
    restoredFor.current = document.pageCount;
    const element = scrollRef.current;
    if (element && scrollOffset > 0) element.scrollTop = scrollOffset;
  }, [pageHeight, scrollOffset, document.pageCount]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element) onScroll(element.scrollTop);
  }, [onScroll]);

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.min(Math.max(target, 1), document.pageCount);
      if (clamped !== page) onPageChange(clamped);
    },
    [document.pageCount, page, onPageChange],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'PageDown':
        event.preventDefault();
        goTo(page + 1);
        break;
      case 'PageUp':
        event.preventDefault();
        goTo(page - 1);
        break;
      case 'Home':
        event.preventDefault();
        goTo(1);
        break;
      case 'End':
        event.preventDefault();
        goTo(document.pageCount);
        break;
      default:
        break;
    }
  };

  return (
    <div className="cn-reader">
      <div className="cn-reader__toolbar">
        <div className="cn-reader__group">
          <IconButton
            label="Previous page"
            icon="‹"
            size="sm"
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
          />
          {/*
            A live region, so a screen reader hears the page change.
            Turning pages silently is the commonest way a PDF reader
            becomes unusable without sight.
          */}
          <span className="cn-reader__page" role="status" aria-live="polite">
            Page {page} of {document.pageCount}
          </span>
          <IconButton
            label="Next page"
            icon="›"
            size="sm"
            disabled={page >= document.pageCount}
            onClick={() => goTo(page + 1)}
          />
        </div>

        <div className="cn-reader__group">
          <IconButton
            label="Zoom out"
            icon="−"
            size="sm"
            disabled={zoom <= ZOOM_STEPS[0]!}
            onClick={() => onZoomChange(nextZoom(zoom, -1))}
          />
          <span className="cn-reader__zoom">{Math.round(zoom * 100)}%</span>
          <IconButton
            label="Zoom in"
            icon="+"
            size="sm"
            disabled={zoom >= ZOOM_STEPS.at(-1)!}
            onClick={() => onZoomChange(nextZoom(zoom, 1))}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="cn-reader__scroll cn-scroll-area"
        onScroll={handleScroll}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Source pages"
      >
        {visiblePages.map((pageNumber) => (
          <PdfPage
            key={pageNumber}
            document={document}
            pageNumber={pageNumber}
            zoom={zoom}
            onRendered={
              pageNumber === page ? (size) => setPageHeight(size.height) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
