/**
 * Deterministic v1-to-v2 mapping.
 *
 * Every function here is PURE: same input, same output, no clock,
 * no random, no I/O. Determinism is what makes a dry run
 * trustworthy — a report that could differ from the eventual apply
 * would be worse than no report.
 *
 * IDs and timestamps are therefore injected rather than generated.
 */
import type {
  Source,
  BookDetails,
  ArtworkDetails,
  Journal,
  JournalBlock,
  StudySession,
  WorkspaceState,
  Asset,
  SourceLocation,
  BlockKind,
  BlockContentInput,
} from '@domain/index';
import type {
  V1Book,
  V1Note,
  V1Session,
  V1Pdf,
  V1Drawing,
  V1Artwork,
} from './types';

/** Injected so mapping stays pure and reproducible. */
export interface MappingContext {
  /** Stable v2 id for a given v1 id. Must be deterministic. */
  idFor: (kind: string, legacyId: string) => string;
  /** Timestamp for records whose v1 row carries none. */
  fallbackTimestamp: string;
}

export type FindingSeverity = 'info' | 'warning' | 'error';

export interface MigrationFinding {
  severity: FindingSeverity;
  store: string;
  recordId?: string;
  code: string;
  message: string;
}

export interface MappingResult<T> {
  value: T | null;
  findings: MigrationFinding[];
}

const ISO = /^\d{4}-\d{2}-\d{2}T/;

function timestamp(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && ISO.test(value) ? value : fallback;
}

// ─── books -> Source + BookDetails + WorkspaceState ──────────────

export interface MappedBook {
  source: Source;
  bookDetails: BookDetails;
  /** Present only when v1 recorded a reading position. */
  workspaceState: WorkspaceState | null;
  journal: Journal;
}

export function mapBook(
  book: V1Book,
  context: MappingContext,
): MappingResult<MappedBook> {
  const findings: MigrationFinding[] = [];

  if (!book.id) {
    findings.push({
      severity: 'error',
      store: 'books',
      code: 'missing-id',
      message: 'Book has no id and cannot be migrated.',
    });
    return { value: null, findings };
  }

  const title = book.title?.trim();
  if (!title) {
    findings.push({
      severity: 'warning',
      store: 'books',
      recordId: book.id,
      code: 'missing-title',
      message: 'Book has no title; using "Untitled".',
    });
  }

  const sourceId = context.idFor('source', book.id);
  const createdAt = timestamp(book.createdAt, context.fallbackTimestamp);
  const updatedAt = timestamp(book.updatedAt, createdAt);

  const source: Source = {
    id: sourceId,
    type: 'book',
    title: title || 'Untitled',
    creatorIds: [],
    collectionIds: [],
    tagIds: [],
    createdAt,
    updatedAt,
    revision: 0,
    legacy: { database: 'philosophy-journal', recordId: book.id },
    ...(book.archived ? { archivedAt: updatedAt } : {}),
  };

  const bookDetails: BookDetails = {
    sourceId,
    currentStatus: book.archived ? 'paused' : 'reading',
    ...(book.author ? { authorText: book.author } : {}),
    // Free text from a form field, never parsed — guessing a date
    // would fabricate precision the source never had (ADR-0002 §8.5).
    ...(book.publicationYear ? { publicationDate: book.publicationYear } : {}),
    ...(typeof book.totalPages === 'number' && book.totalPages > 0
      ? { pageCount: book.totalPages }
      : {}),
  };

  // v1 kept reading position on the book. v2 keeps it on
  // WorkspaceState, which is the single canonical holder
  // (ADR-0001 §3).
  let workspaceState: WorkspaceState | null = null;
  const page = typeof book.currentPage === 'number' ? book.currentPage : 0;
  if (page > 0) {
    const location: SourceLocation = {
      sourceType: 'book',
      sourceId,
      pdf: { page },
    };
    workspaceState = {
      id: context.idFor('workspaceState', book.id),
      sourceId,
      activeLocation: location,
      furthestLocation: location,
      sourceView: { mode: 'continuous', zoom: 1, scrollOffset: 0 },
      journalView: { scrollOffset: 0 },
      layout: {
        mode: 'split',
        splitRatio: 0.5,
        sourceCollapsed: false,
        journalCollapsed: false,
      },
      awayMode: false,
      playbackCapability: 'unknown',
      createdAt,
      updatedAt,
      revision: 0,
    };
    if (book.currentChapter?.trim()) {
      findings.push({
        severity: 'info',
        store: 'books',
        recordId: book.id,
        code: 'chapter-not-mapped',
        message:
          `Chapter "${book.currentChapter.trim()}" has no v2 equivalent yet; ` +
          'chapter detection arrives with Read Aloud Phase 2.',
      });
    }
  }

  const journal: Journal = {
    id: context.idFor('journal', book.id),
    sourceId,
    title: title || 'Untitled',
    kind: 'source',
    createdAt,
    updatedAt,
    revision: 0,
  };

  return { value: { source, bookDetails, workspaceState, journal }, findings };
}

// ─── notes -> JournalBlock ───────────────────────────────────────

/** Which v1 writer produced a note. Reported, not guessed at silently. */
export type NoteOrigin = 'note-system' | 'pdf-reader' | 'ambiguous' | 'empty';

export function classifyNote(note: V1Note): NoteOrigin {
  const hasText = typeof note.text === 'string' && note.text.trim() !== '';
  const hasContent = typeof note.content === 'string' && note.content.trim() !== '';
  if (hasText && hasContent) return 'ambiguous';
  if (hasText) return 'note-system';
  if (hasContent) return 'pdf-reader';
  return 'empty';
}

export interface MappedNote {
  block: JournalBlock;
  origin: NoteOrigin;
}

export function mapNote(
  note: V1Note,
  journalId: string,
  sourceId: string,
  rank: string,
  context: MappingContext,
): MappingResult<MappedNote> {
  const findings: MigrationFinding[] = [];

  if (!note.id) {
    findings.push({
      severity: 'error',
      store: 'notes',
      code: 'missing-id',
      message: 'Note has no id and cannot be migrated.',
    });
    return { value: null, findings };
  }

  const origin = classifyNote(note);
  if (origin === 'empty') {
    findings.push({
      severity: 'warning',
      store: 'notes',
      recordId: note.id,
      code: 'empty-note',
      message: 'Note has neither `text` nor `content`; skipped.',
    });
    return { value: null, findings };
  }
  if (origin === 'ambiguous') {
    findings.push({
      severity: 'warning',
      store: 'notes',
      recordId: note.id,
      code: 'ambiguous-note',
      message:
        'Note has both `text` and `content`. Using `text`; `content` is ' +
        'preserved in the block as a trailing paragraph.',
    });
  }

  const primary = (note.text ?? note.content ?? '').trim();
  const secondary =
    origin === 'ambiguous' ? (note.content ?? '').trim() : '';
  const body = secondary ? `${primary}\n\n${secondary}` : primary;

  // v1 categories were free text on a single note type. A question
  // stays a question; everything else becomes a paragraph, and the
  // original category is not invented into a block kind it never was.
  const category = note.category?.trim().toLowerCase();
  const kind: BlockKind = category === 'question' ? 'question' : 'paragraph';
  const content: BlockContentInput =
    kind === 'question'
      ? { type: 'question', text: body }
      : { type: 'paragraph', text: body };

  const createdAt = timestamp(note.createdAt, context.fallbackTimestamp);
  const page = typeof note.page === 'number' && note.page > 0 ? note.page : null;

  const block: JournalBlock = {
    id: context.idFor('block', note.id),
    journalId,
    kind,
    rank,
    content: content as JournalBlock['content'],
    conceptIds: [],
    provenance: 'migration',
    createdAt,
    updatedAt: timestamp(note.updatedAt, createdAt),
    revision: 0,
    ...(page
      ? { sourceLocation: { sourceType: 'book' as const, sourceId, pdf: { page } } }
      : {}),
  };

  if (!page) {
    findings.push({
      severity: 'info',
      store: 'notes',
      recordId: note.id,
      code: 'note-without-page',
      message:
        'Note has no page. It migrates to the journal without a source ' +
        'location, which is valid — it simply has no page group.',
    });
  }

  if (note.tags?.length || note.title?.trim() || note.chapter?.trim()) {
    findings.push({
      severity: 'info',
      store: 'notes',
      recordId: note.id,
      code: 'note-metadata-deferred',
      message:
        'Title, chapter and tags have no v2 block equivalent yet. They are ' +
        'not lost — they remain in v1, which is preserved.',
    });
  }

  return { value: { block, origin }, findings };
}

// ─── sessions -> StudySession ────────────────────────────────────

export function mapSession(
  session: V1Session,
  sourceId: string,
  context: MappingContext,
): MappingResult<StudySession> {
  const findings: MigrationFinding[] = [];

  if (!session.id) {
    findings.push({
      severity: 'error',
      store: 'sessions',
      code: 'missing-id',
      message: 'Session has no id and cannot be migrated.',
    });
    return { value: null, findings };
  }

  const startedAt = timestamp(
    session.date ?? session.createdAt,
    context.fallbackTimestamp,
  );
  const duration =
    typeof session.duration === 'number' && session.duration >= 0
      ? Math.floor(session.duration)
      : 0;

  const startPage =
    typeof session.startPage === 'number' && session.startPage > 0
      ? session.startPage
      : 1;
  const endPage =
    typeof session.endPage === 'number' && session.endPage > 0
      ? session.endPage
      : null;

  const mapped: StudySession = {
    id: context.idFor('session', session.id),
    sourceId,
    mode: 'manual',
    // v1 had no concept of listening; every migrated session is
    // visual reading (RA-INV-008).
    activityMode: 'reading',
    startedAt,
    endedAt: new Date(
      new Date(startedAt).getTime() + duration * 1000,
    ).toISOString(),
    focusedSeconds: duration,
    listenedSeconds: 0,
    breakSeconds: 0,
    manualPauseSeconds: 0,
    removedIdleSeconds: 0,
    startLocation: { sourceType: 'book', sourceId, pdf: { page: startPage } },
    visitedLocations: [],
    listenedLocations: [],
    createdBlockIds: [],
    createdAnnotationIds: [],
    createdConnectionIds: [],
    dictionaryLookupIds: [],
    revision: 0,
    ...(endPage
      ? {
          endLocation: {
            sourceType: 'book' as const,
            sourceId,
            pdf: { page: endPage },
          },
        }
      : {}),
    ...(session.notes?.trim() ? { reflection: session.notes.trim() } : {}),
  };

  return { value: mapped, findings };
}

// ─── pdfs -> Asset ───────────────────────────────────────────────

export interface MappedPdf {
  asset: Asset;
  sourceId: string;
  hasBinary: boolean;
}

export function mapPdf(
  pdf: V1Pdf,
  sourceId: string,
  context: MappingContext,
): MappingResult<MappedPdf> {
  const findings: MigrationFinding[] = [];

  if (!pdf.id) {
    findings.push({
      severity: 'error',
      store: 'pdfs',
      code: 'missing-id',
      message: 'PDF has no id and cannot be migrated.',
    });
    return { value: null, findings };
  }

  const hasBinary = pdf.data instanceof ArrayBuffer && pdf.data.byteLength > 0;
  if (!hasBinary) {
    findings.push({
      severity: 'error',
      store: 'pdfs',
      recordId: pdf.id,
      code: 'missing-binary',
      message:
        'PDF record has no binary payload. The metadata would migrate to an ' +
        'asset pointing at nothing, so it is skipped.',
    });
    return { value: null, findings };
  }

  const asset: Asset = {
    id: context.idFor('asset', pdf.id),
    kind: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: (pdf.data as ArrayBuffer).byteLength,
    storageKey: `asset/${context.idFor('asset', pdf.id)}`,
    createdAt: timestamp(pdf.createdAt, context.fallbackTimestamp),
    ...(pdf.name ? { originalName: pdf.name } : {}),
  };

  return { value: { asset, sourceId, hasBinary }, findings };
}

// ─── drawings -> locked legacy raster ────────────────────────────

export interface MappedDrawing {
  asset: Asset;
  /** The block that will embed it. Image, never a fake vector drawing. */
  blockKind: 'image';
  dataUrl: string;
}

export function mapDrawing(
  drawing: V1Drawing,
  context: MappingContext,
): MappingResult<MappedDrawing> {
  const findings: MigrationFinding[] = [];

  if (!drawing.id) {
    findings.push({
      severity: 'error',
      store: 'drawings',
      code: 'missing-id',
      message: 'Drawing has no id and cannot be migrated.',
    });
    return { value: null, findings };
  }

  const dataUrl = drawing.canvasData;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    findings.push({
      severity: 'error',
      store: 'drawings',
      recordId: drawing.id,
      code: 'missing-raster',
      message: 'Drawing has no usable canvas data; skipped.',
    });
    return { value: null, findings };
  }

  // Raster only. v1 stored a flattened PNG and no vector objects
  // exist to recover, so this becomes a locked legacy image rather
  // than a drawing block pretending to be editable
  // (handoff §6.3, INV-008).
  findings.push({
    severity: 'warning',
    store: 'drawings',
    recordId: drawing.id,
    code: 'raster-only',
    message:
      'v1 stored drawings as flattened PNG. No editable vector data exists, ' +
      'so this migrates to a locked legacy image and cannot be re-edited.',
  });

  const asset: Asset = {
    id: context.idFor('asset', drawing.id),
    kind: 'legacy-raster',
    mimeType: 'image/png',
    sizeBytes: Math.floor((dataUrl.length * 3) / 4),
    storageKey: `asset/${context.idFor('asset', drawing.id)}`,
    createdAt: timestamp(drawing.createdAt, context.fallbackTimestamp),
    ...(drawing.name ? { originalName: drawing.name } : {}),
  };

  return { value: { asset, blockKind: 'image', dataUrl }, findings };
}

// ─── artworks -> Source + ArtworkDetails + analysis blocks ───────

export interface MappedArtwork {
  source: Source;
  artworkDetails: ArtworkDetails;
  journal: Journal;
  /** Analysis prose becomes journal blocks, not metadata columns. */
  analysisBlocks: Array<{ stage: string; text: string }>;
}

export function mapArtwork(
  artwork: V1Artwork,
  context: MappingContext,
): MappingResult<MappedArtwork> {
  const findings: MigrationFinding[] = [];

  if (!artwork.id) {
    findings.push({
      severity: 'error',
      store: 'artworks',
      code: 'missing-id',
      message: 'Artwork has no id and cannot be migrated.',
    });
    return { value: null, findings };
  }

  const sourceId = context.idFor('source', artwork.id);
  const createdAt = timestamp(artwork.createdAt, context.fallbackTimestamp);
  const updatedAt = timestamp(artwork.updatedAt, createdAt);
  const title = artwork.title?.trim() || 'Untitled';

  const source: Source = {
    id: sourceId,
    type: 'artwork',
    title,
    creatorIds: [],
    collectionIds: [],
    tagIds: [],
    createdAt,
    updatedAt,
    revision: 0,
    legacy: { database: 'philosophy-journal', recordId: artwork.id },
  };

  const artworkDetails: ArtworkDetails = {
    sourceId,
    ...(artwork.artist ? { artistText: artwork.artist } : {}),
    ...(artwork.year ? { creationDate: artwork.year } : {}),
    ...(artwork.medium ? { medium: artwork.medium } : {}),
  };

  // Handoff §6.3: analysis fields become journal blocks. Keeping
  // them as artwork columns would make them unsearchable,
  // unlinkable and invisible to the journal.
  const analysisBlocks: Array<{ stage: string; text: string }> = [];
  for (const [stage, text] of Object.entries(artwork.analysis ?? {})) {
    if (typeof text === 'string' && text.trim()) {
      analysisBlocks.push({ stage, text: text.trim() });
    }
  }

  if (artwork.annotations) {
    findings.push({
      severity: 'warning',
      store: 'artworks',
      recordId: artwork.id,
      code: 'artwork-annotations-unmapped',
      message:
        'Artwork carries annotation data of unknown shape. It is not mapped ' +
        'in this phase and remains in v1.',
    });
  }

  return {
    value: { source, artworkDetails, journal: buildArtworkJournal(sourceId, title, createdAt, updatedAt, artwork.id, context), analysisBlocks },
    findings,
  };
}

function buildArtworkJournal(
  sourceId: string,
  title: string,
  createdAt: string,
  updatedAt: string,
  legacyId: string,
  context: MappingContext,
): Journal {
  return {
    id: context.idFor('journal', legacyId),
    sourceId,
    title,
    kind: 'source',
    createdAt,
    updatedAt,
    revision: 0,
  };
}
