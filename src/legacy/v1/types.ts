/**
 * Legacy v1 record shapes.
 *
 * Derived by reading `src/legacy-v1/` — the actual write sites —
 * not from the handoff's description of them. Where the two differ,
 * the code wins, and the difference is recorded in ADR-0002 §8.
 *
 * Every field is optional and weakly typed on purpose. These
 * describe records written by a prototype with no schema
 * validation: fields are missing, mistyped and inconsistent in real
 * databases, and a reader that assumes otherwise throws on the
 * first malformed row instead of reporting it.
 */

/** v1 store names, as created by `legacy-v1/db.js`. */
export const V1_STORES = [
  'books',
  'notes',
  'sessions',
  'pdfs',
  'pdfAnnotations',
  'artworks',
  'drawings',
  'appState',
] as const;

export type V1StoreName = (typeof V1_STORES)[number];

/**
 * A store PDFReader.jsx writes to that `db.js` never creates.
 *
 * Scanned for, but expected to be absent — see ADR-0002 §8.1.
 */
export const V1_PHANTOM_ANNOTATION_STORE = 'annotations';

// ─── Records ─────────────────────────────────────────────────────

export interface V1Book {
  id?: string;
  title?: string;
  author?: string;
  /** Free text from a form field. Never parsed as a date. */
  publicationYear?: string;
  totalPages?: number;
  currentChapter?: string;
  /** Maps to WorkspaceState, not BookDetails (ADR-0001 §3). */
  currentPage?: number;
  tags?: string[];
  coverUrl?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Two incompatible shapes share this store.
 *
 * `NoteSystem.jsx` writes `text` with title, category, chapter and
 * tags. `PDFReader.jsx` writes `content` with none of them. Neither
 * knew about the other (handoff §5.4).
 */
export interface V1Note {
  id?: string;
  bookId?: string;
  /** NoteSystem shape. */
  text?: string;
  /** PDFReader shape. */
  content?: string;
  title?: string;
  category?: string;
  chapter?: string;
  page?: number | null;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface V1Session {
  id?: string;
  bookId?: string;
  startPage?: number | null;
  endPage?: number | null;
  /** Seconds. */
  duration?: number;
  notes?: string;
  date?: string;
  createdAt?: string;
}

export interface V1Pdf {
  id?: string;
  bookId?: string;
  name?: string;
  data?: ArrayBuffer;
  createdAt?: string;
}

/** The store that exists but was never written to. */
export interface V1PdfAnnotation {
  id?: string;
  pdfId?: string;
  page?: number;
  [key: string]: unknown;
}

/** The shape PDFReader tried and failed to persist. */
export interface V1PhantomAnnotation {
  id?: string;
  bookId?: string;
  pageNum?: number;
  strokes?: unknown;
}

export interface V1Artwork {
  id?: string;
  title?: string;
  artist?: string;
  year?: string;
  medium?: string;
  imageUrl?: string;
  /** Prose that becomes journal blocks, not metadata columns. */
  analysis?: {
    description?: string;
    interpretation?: string;
    evaluation?: string;
    context?: string;
  } | null;
  annotations?: unknown;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** Raster only. No vector data exists to recover (handoff §6.3). */
export interface V1Drawing {
  id?: string;
  name?: string;
  bookId?: string;
  /** PNG data URL. */
  canvasData?: string;
  width?: number;
  height?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface V1AppState {
  key?: string;
  value?: unknown;
}

export interface V1Snapshot {
  books: V1Book[];
  notes: V1Note[];
  sessions: V1Session[];
  pdfs: V1Pdf[];
  pdfAnnotations: V1PdfAnnotation[];
  phantomAnnotations: V1PhantomAnnotation[];
  artworks: V1Artwork[];
  drawings: V1Drawing[];
  appState: V1AppState[];
  storesFound: string[];
  storesMissing: string[];
}
