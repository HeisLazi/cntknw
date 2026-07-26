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
  destroy(): Promise<void>;
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
    destroy: () => document.destroy(),
  };
}

export type { PDFPageProxy };
