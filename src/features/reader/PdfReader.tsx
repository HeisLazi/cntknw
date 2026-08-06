import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { IconButton } from '@components/primitives';
import type { AnnotationTool, EntityId } from '@domain/index';
import { PdfPage } from './PdfPage';
import { PdfSearch } from './PdfSearch';
import { clearDraftIntentsForSource } from './pendingAnnotationIntent';
import type { LoadedDocument } from './pdfjs';
import './reader.css';

export interface PdfReaderProps {
  document: LoadedDocument;
  sourceId: EntityId;
  assetId: EntityId;
  /** 1-based, as everywhere at the domain boundary. */
  page: number;
  zoom: number;
  scrollOffset: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onScroll: (offset: number) => void;
  annotationTool: AnnotationTool;
  onAnnotationToolChange: (tool: AnnotationTool) => void;
}

export interface PdfReaderHandle {
  /** Physically reveal a page requested by chrome outside the reader. */
  navigateTo: (page: number) => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
const PAGE_WINDOW = 2;
const DEFAULT_PAGE_HEIGHT = 792;

function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(page, 1), pageCount);
}

/** Keep a stable five-page window, including at the document boundaries. */
function pagesAround(anchor: number, pageCount: number): number[] {
  const windowSize = Math.min(pageCount, PAGE_WINDOW * 2 + 1);
  const first = Math.max(
    1,
    Math.min(anchor - PAGE_WINDOW, pageCount - windowSize + 1),
  );
  return Array.from({ length: windowSize }, (_, index) => first + index);
}

function nextZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.findIndex((step) => step >= current - 0.001);
  const target = (index === -1 ? ZOOM_STEPS.length - 1 : index) + direction;
  return ZOOM_STEPS[Math.min(Math.max(target, 0), ZOOM_STEPS.length - 1)]!;
}

/**
 * The source pane.
 *
 * Continuous scrolling with a **virtual, windowed** page list. Five
 * nearby pages are mounted; height-preserving spacers stand in for
 * the rest. IntersectionObserver chooses the current page from real
 * viewport overlap, while scroll-position estimates only move the
 * render window when someone drags rapidly across an unmounted span.
 * The estimate never becomes reading position — only a visible page
 * can call `onPageChange`.
 *
 * Scroll position and the current page are **reported upward, not
 * stored here.** They belong to `WorkspaceState` in the repository,
 * because AC-002 requires them to survive closing the app. Keeping
 * a second copy in component state is how the two drift apart.
 */
export const PdfReader = forwardRef<PdfReaderHandle, PdfReaderProps>(function PdfReader({
  document,
  sourceId,
  assetId,
  page,
  zoom,
  scrollOffset,
  onPageChange,
  onZoomChange,
  onScroll,
  annotationTool,
  onAnnotationToolChange,
}: PdfReaderProps, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(page);
  const positioning = useRef(true);
  const navigationTargetRef = useRef<number | null>(null);
  const [windowAnchor, setWindowAnchor] = useState(page);
  const [navigationTarget, setNavigationTarget] = useState<number | null>(null);
  const [measuredPages, setMeasuredPages] = useState<ReadonlyMap<number, number>>(
    () => new Map(),
  );
  const [pageGap, setPageGap] = useState(0);
  const restored = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [pageInput, setPageInput] = useState(String(page));
  const [previousPage, setPreviousPage] = useState(page);

  useEffect(
    () => () => {
      clearDraftIntentsForSource(sourceId);
    },
    [sourceId],
  );

  if (page !== previousPage) {
    setPreviousPage(page);
    setPageInput(String(page));
    setWindowAnchor(page);
  }

  const visiblePages = useMemo(
    () => pagesAround(windowAnchor, document.pageCount),
    [document.pageCount, windowAnchor],
  );

  const estimatedPageHeight = useMemo(() => {
    const heights = [...measuredPages.values()];
    if (heights.length === 0) return DEFAULT_PAGE_HEIGHT * zoom;
    return heights.reduce((sum, height) => sum + height, 0) / heights.length;
  }, [measuredPages, zoom]);

  const firstMountedPage = visiblePages[0] ?? 1;
  const lastMountedPage = visiblePages.at(-1) ?? document.pageCount;
  const spacerHeight = useCallback(
    (pageCount: number) =>
      pageCount === 0
        ? 0
        : Math.max(0, pageCount * (estimatedPageHeight + pageGap) - pageGap),
    [estimatedPageHeight, pageGap],
  );

  const beforeHeight = spacerHeight(firstMountedPage - 1);
  const afterHeight = spacerHeight(document.pageCount - lastMountedPage);

  const handleRendered = useCallback((pageNumber: number, height: number) => {
    setMeasuredPages((current) => {
      if (current.get(pageNumber) === height) return current;
      const next = new Map(current);
      next.set(pageNumber, height);
      return next;
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measuredGap = parseFloat(getComputedStyle(element).rowGap);
    if (Number.isFinite(measuredGap)) setPageGap(measuredGap);
  }, []);

  // Restore once, after the saved page has real geometry. The offset
  // is absolute within the virtual document, so it survives window
  // shifts rather than being reinterpreted inside a five-page slice.
  useEffect(() => {
    if (
      restored.current ||
      !visiblePages.every((pageNumber) => measuredPages.has(pageNumber))
    ) return;
    const element = scrollRef.current;
    if (!element) return;
    restored.current = true;

    requestAnimationFrame(() => {
      if (scrollOffset > 0) {
        positioning.current = true;
        element.scrollTop = scrollOffset;
        requestAnimationFrame(() => {
          element.scrollTop = scrollOffset;
          positioning.current = false;
        });
      } else {
        navigationTargetRef.current = page;
        setNavigationTarget(page);
      }
    });
  }, [measuredPages, page, scrollOffset, visiblePages]);

  const revealPage = useCallback(
    (target: number) => {
      const clamped = clampPage(target, document.pageCount);
      positioning.current = true;
      navigationTargetRef.current = clamped;
      setNavigationTarget(clamped);
      setWindowAnchor(clamped);
      return clamped;
    },
    [document.pageCount],
  );

  useImperativeHandle(ref, () => ({
    navigateTo: (target: number) => {
      currentPageRef.current = revealPage(target);
    },
  }), [revealPage]);

  const requestNavigation = useCallback(
    (target: number) => {
      const clamped = revealPage(target);
      if (clamped !== currentPageRef.current) {
        currentPageRef.current = clamped;
        onPageChange(clamped);
      }
    },
    [onPageChange, revealPage],
  );

  const handlePageSubmit = (event: React.FormEvent | React.FocusEvent) => {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= document.pageCount) {
      requestNavigation(parsed);
    } else {
      setPageInput(String(page));
    }
  };

  // A navigation claim is not fulfilled by state. Wait for the page
  // to render, then put its actual element inside the scrollport.
  useEffect(() => {
    if (navigationTarget === null || !measuredPages.has(navigationTarget)) return;
    const element = scrollRef.current;
    const target = element?.querySelector<HTMLElement>(
      `.cn-pdf-page[data-page="${navigationTarget}"]`,
    );
    if (!element || !target) return;

    const viewportBox = element.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const paddingTop = parseFloat(getComputedStyle(element).paddingTop) || 0;
    element.scrollTop += targetBox.top - viewportBox.top - paddingTop;

    requestAnimationFrame(() => {
      const nextViewport = element.getBoundingClientRect();
      const nextTarget = target.getBoundingClientRect();
      if (nextTarget.bottom > nextViewport.top && nextTarget.top < nextViewport.bottom) {
        setNavigationTarget(null);
        positioning.current = false;
      }
    });
  }, [measuredPages, navigationTarget]);

  // The current page comes only from actual viewport overlap. The
  // most-visible mounted page wins; ties favour the viewport centre.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const observed = visiblePages
      .map((pageNumber) =>
        root.querySelector<HTMLElement>(`.cn-pdf-page[data-page="${pageNumber}"]`),
      )
      .filter((element): element is HTMLElement => element !== null);

    const updateVisiblePage = () => {
      if (positioning.current) return;
      const rootBox = root.getBoundingClientRect();
      const rootCenter = rootBox.top + rootBox.height / 2;
      const candidates = observed
        .map((element) => {
          const box = element.getBoundingClientRect();
          const visibleHeight = Math.max(
            0,
            Math.min(box.bottom, rootBox.bottom) - Math.max(box.top, rootBox.top),
          );
          return {
            page: Number(element.dataset.page),
            visibleHeight,
            centerDistance: Math.abs(box.top + box.height / 2 - rootCenter),
          };
        })
        .filter((candidate) => candidate.visibleHeight > 0)
        .sort(
          (left, right) =>
            right.visibleHeight - left.visibleHeight ||
            left.centerDistance - right.centerDistance,
        );
      const next = candidates[0]?.page;
      if (next === undefined || next === currentPageRef.current) return;
      const current = candidates.find((candidate) => candidate.page === currentPageRef.current);
      if (current && candidates[0].visibleHeight <= current.visibleHeight + 64) return;

      currentPageRef.current = next;
      setWindowAnchor(next);
      onPageChange(next);
    };

    const observer = new IntersectionObserver(updateVisiblePage, {
      root,
      threshold: [0, 0.01, 0.25, 0.5, 0.75, 1],
    });
    observed.forEach((element) => observer.observe(element));
    updateVisiblePage();
    return () => observer.disconnect();
  }, [onPageChange, visiblePages]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element) return;
    if (event.nativeEvent.isTrusted) navigationTargetRef.current = null;
    onScroll(element.scrollTop);

    // A scrollbar thumb can cross hundreds of virtual pages without
    // intersecting the old five-page window. Move only that window
    // from the estimate; IntersectionObserver remains the authority
    // that turns a mounted, visible page into reading position.
    if (!positioning.current && navigationTargetRef.current === null) {
      const extent = estimatedPageHeight + pageGap;
      const estimated = clampPage(
        Math.floor((element.scrollTop + element.clientHeight / 2) / extent) + 1,
        document.pageCount,
      );
      if (estimated < firstMountedPage + 1 || estimated > lastMountedPage - 1) {
        setWindowAnchor(estimated);
      }
    }
  }, [
    document.pageCount,
    estimatedPageHeight,
    firstMountedPage,
    lastMountedPage,
    onScroll,
    pageGap,
  ]);

  return (
    <div className="cn-reader">
      <div className="cn-reader__toolbar">
        <div className="cn-reader__group">
          <IconButton
            label="Region annotation tool"
            icon="▱"
            size="sm"
            aria-pressed={annotationTool === 'region'}
            onClick={() =>
              onAnnotationToolChange(annotationTool === 'region' ? 'select' : 'region')
            }
          />
        </div>
        <div className="cn-reader__group" style={{ flex: 1, justifyContent: 'center' }}>
          <IconButton
            label="Previous page"
            icon="‹"
            size="sm"
            disabled={page <= 1}
            onClick={() => requestNavigation(page - 1)}
          />
          {/*
            A live region, so a screen reader hears the page change.
            Turning pages silently is the commonest way a PDF reader
            becomes unusable without sight.
            This span also serves as a test hook (.cn-reader__page).
          */}
          <span className="cn-reader__page sr-only" role="status" aria-live="polite">
            Page {page} of {document.pageCount}
          </span>
          <form className="cn-reader__page-form" onSubmit={handlePageSubmit}>
            <span className="cn-reader__page-count" aria-hidden="true" style={{ marginRight: '0.25rem' }}>Page</span>
            <input
              type="number"
              className="cn-reader__page-input"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              min={1}
              max={document.pageCount}
              aria-label={`Page ${page} of ${document.pageCount}`}
            />
            <span className="cn-reader__page-count" aria-hidden="true">
              of {document.pageCount}
            </span>
          </form>
          <IconButton
            label="Next page"
            icon="›"
            size="sm"
            disabled={page >= document.pageCount}
            onClick={() => requestNavigation(page + 1)}
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
        <div className="cn-reader__group">
          <IconButton
            label="Search document"
            icon="⌕"
            size="sm"
            onClick={() => setSearchOpen((s) => !s)}
          />
        </div>
      </div>

      {searchOpen && (
        <PdfSearch
          document={document}
          onNavigate={requestNavigation}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div className="cn-reader__body">
        <div
          ref={scrollRef}
          className="cn-reader__scroll cn-scroll-area"
          onKeyDown={(event) => {
            if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
              navigationTargetRef.current = null;
            }
          }}
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label="Source pages"
        >
          {beforeHeight > 0 ? (
            <div
              className="cn-reader__spacer"
              style={{ height: beforeHeight }}
              aria-hidden="true"
            />
          ) : null}
          {visiblePages.map((pageNumber) => (
            <PdfPage
              key={pageNumber}
              document={document}
              sourceId={sourceId}
              assetId={assetId}
              pageNumber={pageNumber}
              zoom={zoom}
              regionActive={annotationTool === 'region'}
              onRendered={(size) => handleRendered(pageNumber, size.height)}
            />
          ))}
          {afterHeight > 0 ? (
            <div
              className="cn-reader__spacer"
              style={{ height: afterHeight }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});
