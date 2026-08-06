/**
 * The pdf.js boundary.
 *
 * Every import of `pdfjs-dist` in the application goes through this
 * module. pdf.js is a large, fast-moving dependency with a worker, a
 * global configuration object and a habit of changing its build
 * layout between majors; confining it to one file means a version
 * bump is one file to fix rather than a search across features.
 *
 * It also keeps the reader components testable: they receive a
 * `LoadedDocument`, and nothing about that type mentions pdf.js.
 */
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
// `?url` gives Vite the hashed asset path rather than inlining a
// half-megabyte worker into the main bundle.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface LoadedDocument {
  pageCount: number;
  /** From the PDF's own metadata, when it has any. Often absent or wrong. */
  title: string | undefined;
  author: string | undefined;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  getOutline(): Promise<unknown[] | null>;
  getPageIndex(dest: unknown): Promise<number>;
  searchDocument(query: string, abortSignal: AbortSignal): AsyncGenerator<SearchResult>;
  destroy(): Promise<void>;
}

export interface SearchResult {
  pageNumber: number;
  matches: number;
}

/** Make PDF text and user queries comparable without changing word boundaries. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();
}

function joinTextItems(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  return items.reduce((text, item, index) => {
    const value = item.str ?? '';
    if (index === 0) return value;
    const previous = items[index - 1]?.str ?? '';
    if (items[index - 1]?.hasEOL || previous.endsWith('\n')) return `${text}\n${value}`;
    const needsSpace =
      !/\s$/u.test(previous) &&
      !/^\s/u.test(value) &&
      !/[.,!?;:)\]}%'’”]/u.test(value) &&
      !/[([{\u2018\u201c$]/u.test(previous);
    return `${text}${needsSpace ? ' ' : ''}${value}`;
  }, '');
}

function countOccurrences(text: string, query: string): number {
  if (!query) return 0;
  let matches = 0;
  let from = 0;
  while (from <= text.length - query.length) {
    const index = text.indexOf(query, from);
    if (index === -1) break;
    matches += 1;
    from = index + query.length;
  }
  return matches;
}

export function countSearchMatches(
  items: Array<{ str?: string; hasEOL?: boolean }>,
  query: string,
): number {
  return countOccurrences(
    normalizeSearchText(joinTextItems(items)),
    normalizeSearchText(query),
  );
}

/**
 * Render a page's text into a container, positioned over its canvas.
 *
 * pdf.js emits absolutely-positioned transparent spans whose geometry
 * matches the painted glyphs. That is what makes the page selectable,
 * searchable by the browser's own find, and readable by a screen
 * reader — a canvas alone is a picture of a page, not a page.
 *
 * It is also the foundation Phase 3 needs: an annotation anchored to
 * a quote requires real text nodes to anchor to.
 *
 * @returns a cancel function. Text rendering is asynchronous, so a
 *   zoom change or a scroll away mid-render must be able to abandon
 *   it; otherwise spans land in a container that has already been
 *   re-laid-out at a different scale.
 */
export type PageViewport = ReturnType<PDFPageProxy['getViewport']>;

export async function renderTextLayer(
  page: PDFPageProxy,
  container: HTMLElement,
  viewport: PageViewport,
): Promise<() => void> {
  const textContentSource = await page.getTextContent();

  container.replaceChildren();
  // The spans pdf.js emits are sized in CSS pixels multiplied by this
  // variable. Without it every glyph box is wrong by the zoom factor,
  // and a selection lands nowhere near the visible text.
  container.style.setProperty('--scale-factor', String(viewport.scale));
  container.style.width = `${Math.floor(viewport.width)}px`;
  container.style.height = `${Math.floor(viewport.height)}px`;

  const layer = new pdfjs.TextLayer({ textContentSource, container, viewport });
  await layer.render();
  return () => layer.cancel();
}

/**
 * Open a PDF from bytes already in memory.
 *
 * The buffer is copied before being handed to pdf.js, which
 * transfers ownership of what it is given and detaches the original.
 * Without the copy, the same `ArrayBuffer` read back from the asset
 * repository would be unusable on a second open — a bug that only
 * appears the second time a source is opened in one session, which
 * is exactly when it is hardest to attribute.
 */
export async function loadPdfDocument(
  data: ArrayBuffer,
): Promise<LoadedDocument> {
  const task = pdfjs.getDocument({ data: data.slice(0) });
  const document: PDFDocumentProxy = await task.promise;

  let title: string | undefined;
  let author: string | undefined;
  try {
    const metadata = await document.getMetadata();
    const info = metadata.info as { Title?: unknown; Author?: unknown };
    title = typeof info.Title === 'string' && info.Title.trim() ? info.Title.trim() : undefined;
    author =
      typeof info.Author === 'string' && info.Author.trim() ? info.Author.trim() : undefined;
  } catch {
    // Metadata is optional and frequently malformed. A document that
    // renders perfectly well should not fail to open because its
    // info dictionary is broken.
  }

  return {
    pageCount: document.numPages,
    title,
    author,
    getPage: (pageNumber) => document.getPage(pageNumber),
    getOutline: () => document.getOutline(),
    getPageIndex: async (dest: unknown) => {
      let explicitDest = dest;
      if (typeof dest === 'string') {
        explicitDest = await document.getDestination(dest);
      }
      if (Array.isArray(explicitDest) && explicitDest.length > 0) {
        const ref = explicitDest[0];
        if (ref !== null && typeof ref === 'object') {
          // pdf.js getPageIndex returns a 0-based index. Our domain is 1-based.
          const pageIndex = await document.getPageIndex(ref);
          return pageIndex + 1;
        }
      }
      throw new Error('Invalid destination');
    },
    searchDocument: async function* (query: string, abortSignal: AbortSignal) {
      const normalizedQuery = normalizeSearchText(query);
      if (!normalizedQuery) return;
      
      for (let i = 1; i <= document.numPages; i++) {
        if (abortSignal.aborted) break;
        try {
          const page = await document.getPage(i);
          if (abortSignal.aborted) break;
          const textContent = await page.getTextContent();
          if (abortSignal.aborted) break;
          const matches = countSearchMatches(
            textContent.items as Array<{ str?: string; hasEOL?: boolean }>,
            normalizedQuery,
          );
          
          if (matches > 0) {
            yield { pageNumber: i, matches };
          }
        } catch (err) {
          if (abortSignal.aborted) break;
          throw err;
        }
      }
    },
    destroy: () => document.destroy(),
  };
}

export type { PDFPageProxy };
