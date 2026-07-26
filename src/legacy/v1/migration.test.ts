/**
 * v1 mapping and dry-run tests.
 *
 * The mappings are pure, so they are tested directly against
 * fixtures rather than through a database. The dry run is tested
 * with an injected snapshot for the same reason: determinism is the
 * property that makes the report trustworthy.
 */
import { describe, it, expect } from 'vitest';
import {
  mapBook,
  mapNote,
  mapSession,
  mapPdf,
  mapDrawing,
  mapArtwork,
  classifyNote,
  type MappingContext,
} from './mappings';
import { dryRunMigration, createDeterministicIdFactory } from './dryRun';
import { emptyV1Snapshot } from './readers';
import type { V1Snapshot } from './types';
import { SourceSchema, JournalBlockSchema, StudySessionSchema, WorkspaceStateSchema } from '@domain/index';

const FIXED_TIME = '2026-07-25T12:00:00.000Z';

const context: MappingContext = {
  idFor: createDeterministicIdFactory(),
  fallbackTimestamp: FIXED_TIME,
};

// ─── Determinism ─────────────────────────────────────────────────

describe('deterministic id factory', () => {
  it('returns the same id for the same input, every time', () => {
    const a = createDeterministicIdFactory();
    const b = createDeterministicIdFactory();
    expect(a('source', 'book-1')).toBe(b('source', 'book-1'));
  });

  it('separates kinds so a book and its journal never collide', () => {
    expect(context.idFor('source', 'x')).not.toBe(context.idFor('journal', 'x'));
  });

  it('produces ids the domain accepts', () => {
    // Must satisfy EntityIdSchema, or a dry run would report ids
    // that the apply step could not actually write.
    const parsed = SourceSchema.safeParse({
      id: context.idFor('source', 'book-1'),
      type: 'book',
      title: 'x',
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
      revision: 0,
    });
    expect(parsed.success).toBe(true);
  });
});

// ─── books ───────────────────────────────────────────────────────

describe('mapBook', () => {
  it('maps a complete book', () => {
    const { value, findings } = mapBook(
      {
        id: 'book-1',
        title: 'The Wretched of the Earth',
        author: 'Frantz Fanon',
        publicationYear: '1961',
        totalPages: 251,
        currentPage: 42,
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      context,
    );
    expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
    expect(value?.source.title).toBe('The Wretched of the Earth');
    expect(value?.bookDetails.authorText).toBe('Frantz Fanon');
    expect(value?.bookDetails.pageCount).toBe(251);
  });

  it('moves reading position to WorkspaceState, not BookDetails', () => {
    const { value } = mapBook({ id: 'book-1', title: 'x', currentPage: 42 }, context);
    expect(value?.workspaceState?.activeLocation.pdf?.page).toBe(42);
    expect('currentPage' in (value?.bookDetails ?? {})).toBe(false);
  });

  it('produces a valid WorkspaceState', () => {
    const { value } = mapBook({ id: 'book-1', title: 'x', currentPage: 42 }, context);
    expect(WorkspaceStateSchema.safeParse(value?.workspaceState).success).toBe(true);
  });

  it('creates no workspace state when the book was never opened', () => {
    const { value } = mapBook({ id: 'book-1', title: 'x', currentPage: 0 }, context);
    expect(value?.workspaceState).toBeNull();
  });

  it('keeps publicationYear as free text without parsing it', () => {
    // "circa 1961" and "1961?" both occur in real form data.
    const { value } = mapBook(
      { id: 'b', title: 'x', publicationYear: 'circa 1961' },
      context,
    );
    expect(value?.bookDetails.publicationDate).toBe('circa 1961');
  });

  it('retains the legacy id for traceability', () => {
    const { value } = mapBook({ id: 'book-1', title: 'x' }, context);
    expect(value?.source.legacy).toEqual({
      database: 'philosophy-journal',
      recordId: 'book-1',
    });
  });

  it('maps an archived book to archivedAt', () => {
    const { value } = mapBook({ id: 'b', title: 'x', archived: true }, context);
    expect(value?.source.archivedAt).toBeTruthy();
    expect(value?.bookDetails.currentStatus).toBe('paused');
  });

  it('reports a book with no id as an error', () => {
    const { value, findings } = mapBook({ title: 'x' }, context);
    expect(value).toBeNull();
    expect(findings[0]?.severity).toBe('error');
  });

  it('warns but still migrates a book with no title', () => {
    const { value, findings } = mapBook({ id: 'b' }, context);
    expect(value?.source.title).toBe('Untitled');
    expect(findings.some((f) => f.code === 'missing-title')).toBe(true);
  });

  it('is deterministic across runs', () => {
    const book = { id: 'book-1', title: 'x', currentPage: 5 };
    expect(JSON.stringify(mapBook(book, context).value)).toBe(
      JSON.stringify(mapBook(book, context).value),
    );
  });
});

// ─── notes ───────────────────────────────────────────────────────

describe('classifyNote', () => {
  it('recognises the NoteSystem shape', () => {
    expect(classifyNote({ text: 'a thought' })).toBe('note-system');
  });
  it('recognises the PDFReader shape', () => {
    expect(classifyNote({ content: 'a thought' })).toBe('pdf-reader');
  });
  it('flags a note carrying both', () => {
    expect(classifyNote({ text: 'a', content: 'b' })).toBe('ambiguous');
  });
  it('flags an empty note', () => {
    expect(classifyNote({ text: '   ' })).toBe('empty');
  });
});

describe('mapNote', () => {
  // Real UUIDs: JournalBlockSchema validates both, so a placeholder
  // like 'journal-1' fails — which is the mapper output being
  // genuinely checked rather than assumed.
  const j = '018f3a5b-7c2d-7e1f-9a3b-000000000001';
  const s = '018f3a5b-7c2d-7e1f-9a3b-4c5d6e7f8a9b';

  it('maps the NoteSystem `text` shape', () => {
    const { value } = mapNote(
      { id: 'n1', bookId: 'b', text: 'A reflection.', page: 5 },
      j, s, 'a', context,
    );
    expect(value?.origin).toBe('note-system');
    expect(value?.block.content).toMatchObject({ text: 'A reflection.' });
    expect(value?.block.sourceLocation?.pdf?.page).toBe(5);
  });

  it('maps the PDFReader `content` shape', () => {
    const { value } = mapNote(
      { id: 'n2', bookId: 'b', content: 'From the reader.', page: 9 },
      j, s, 'a', context,
    );
    expect(value?.origin).toBe('pdf-reader');
    expect(value?.block.content).toMatchObject({ text: 'From the reader.' });
  });

  it('preserves both bodies when a note carries text and content', () => {
    // Neither is discarded — the handoff calls this out as the
    // ambiguity that has no canonical answer (§5.4).
    const { value, findings } = mapNote(
      { id: 'n3', bookId: 'b', text: 'primary', content: 'secondary' },
      j, s, 'a', context,
    );
    expect(value?.block.content).toMatchObject({
      text: 'primary\n\nsecondary',
    });
    expect(findings.some((f) => f.code === 'ambiguous-note')).toBe(true);
  });

  it('maps a question category to a question block', () => {
    const { value } = mapNote(
      { id: 'n4', bookId: 'b', text: 'Why?', category: 'Question' },
      j, s, 'a', context,
    );
    expect(value?.block.kind).toBe('question');
  });

  it('does not invent block kinds from unknown categories', () => {
    const { value } = mapNote(
      { id: 'n5', bookId: 'b', text: 'x', category: 'Marginalia' },
      j, s, 'a', context,
    );
    expect(value?.block.kind).toBe('paragraph');
  });

  it('marks migrated blocks with migration provenance', () => {
    const { value } = mapNote({ id: 'n6', bookId: 'b', text: 'x' }, j, s, 'a', context);
    expect(value?.block.provenance).toBe('migration');
  });

  it('produces a block the domain accepts', () => {
    const { value } = mapNote(
      { id: 'n7', bookId: 'b', text: 'x', page: 3 },
      j, s, 'a', context,
    );
    expect(JournalBlockSchema.safeParse(value?.block).success).toBe(true);
  });

  it('migrates a note with no page, without a source location', () => {
    const { value, findings } = mapNote(
      { id: 'n8', bookId: 'b', text: 'x' }, j, s, 'a', context,
    );
    expect(value?.block.sourceLocation).toBeUndefined();
    expect(findings.some((f) => f.code === 'note-without-page')).toBe(true);
  });

  it('skips an empty note', () => {
    const { value, findings } = mapNote({ id: 'n9', bookId: 'b' }, j, s, 'a', context);
    expect(value).toBeNull();
    expect(findings.some((f) => f.code === 'empty-note')).toBe(true);
  });
});

// ─── sessions ────────────────────────────────────────────────────

describe('mapSession', () => {
  const s = '018f3a5b-7c2d-7e1f-9a3b-4c5d6e7f8a9b';

  it('maps duration to focused seconds and marks it as reading', () => {
    const { value } = mapSession(
      { id: 's1', bookId: 'b', duration: 3600, startPage: 10, endPage: 25, date: FIXED_TIME },
      s, context,
    );
    expect(value?.focusedSeconds).toBe(3600);
    // v1 had no listening concept (RA-INV-008).
    expect(value?.activityMode).toBe('reading');
    expect(value?.listenedSeconds).toBe(0);
  });

  it('derives endedAt from startedAt plus duration', () => {
    const { value } = mapSession(
      { id: 's2', bookId: 'b', duration: 60, date: FIXED_TIME }, s, context,
    );
    expect(value?.endedAt).toBe('2026-07-25T12:01:00.000Z');
  });

  it('keeps session notes as a reflection', () => {
    const { value } = mapSession(
      { id: 's3', bookId: 'b', duration: 1, notes: 'Slow going.', date: FIXED_TIME },
      s, context,
    );
    expect(value?.reflection).toBe('Slow going.');
  });

  it('produces a session the domain accepts', () => {
    const { value } = mapSession(
      { id: 's4', bookId: 'b', duration: 10, date: FIXED_TIME }, s, context,
    );
    expect(StudySessionSchema.safeParse(value).success).toBe(true);
  });
});

// ─── pdfs and drawings ───────────────────────────────────────────

describe('mapPdf', () => {
  const s = '018f3a5b-7c2d-7e1f-9a3b-4c5d6e7f8a9b';

  it('maps a PDF with a binary payload', () => {
    const { value } = mapPdf(
      { id: 'p1', bookId: 'b', name: 'fanon.pdf', data: new ArrayBuffer(2048) },
      s, context,
    );
    expect(value?.asset.kind).toBe('pdf');
    expect(value?.asset.sizeBytes).toBe(2048);
    expect(value?.asset.originalName).toBe('fanon.pdf');
  });

  it('skips a PDF record with no binary rather than creating a dangling asset', () => {
    const { value, findings } = mapPdf({ id: 'p2', bookId: 'b' }, s, context);
    expect(value).toBeNull();
    expect(findings.some((f) => f.code === 'missing-binary')).toBe(true);
  });
});

describe('mapDrawing', () => {
  it('maps a raster drawing to a locked legacy image', () => {
    const { value, findings } = mapDrawing(
      { id: 'd1', name: 'sketch', canvasData: 'data:image/png;base64,AAAA' },
      context,
    );
    // Never a fake editable drawing — v1 stored no vector data
    // (INV-008, handoff §6.3).
    expect(value?.asset.kind).toBe('legacy-raster');
    expect(value?.blockKind).toBe('image');
    expect(findings.some((f) => f.code === 'raster-only')).toBe(true);
  });

  it('skips a drawing with no usable canvas data', () => {
    const { value } = mapDrawing({ id: 'd2', canvasData: 'not-a-data-url' }, context);
    expect(value).toBeNull();
  });
});

// ─── artworks ────────────────────────────────────────────────────

describe('mapArtwork', () => {
  it('turns analysis prose into journal blocks, not metadata columns', () => {
    const { value } = mapArtwork(
      {
        id: 'a1',
        title: 'Guernica',
        artist: 'Picasso',
        analysis: {
          description: 'Monochrome, fractured.',
          interpretation: 'A response to bombing.',
          evaluation: '',
          context: 'Spanish Civil War.',
        },
      },
      context,
    );
    expect(value?.analysisBlocks).toHaveLength(3);
    expect(value?.analysisBlocks.map((b) => b.stage)).toEqual([
      'description', 'interpretation', 'context',
    ]);
    expect(value?.artworkDetails.artistText).toBe('Picasso');
  });

  it('warns about artwork annotations of unknown shape', () => {
    const { findings } = mapArtwork(
      { id: 'a2', title: 'x', annotations: { some: 'thing' } },
      context,
    );
    expect(findings.some((f) => f.code === 'artwork-annotations-unmapped')).toBe(true);
  });
});

// ─── dry run ─────────────────────────────────────────────────────

function snapshotWith(overrides: Partial<V1Snapshot>): V1Snapshot {
  return { ...emptyV1Snapshot(), storesFound: [], ...overrides };
}

describe('dryRunMigration', () => {
  const now = () => FIXED_TIME;

  it('reports nothing to do when v1 is absent', async () => {
    const report = await dryRunMigration({ snapshot: emptyV1Snapshot(), now });
    expect(report.safeToApply).toBe(true);
    expect(Object.values(report.recordsScanned).every((n) => n === 0)).toBe(true);
  });

  it('counts scanned, mappable and skipped records', async () => {
    const report = await dryRunMigration({
      now,
      snapshot: snapshotWith({
        books: [
          { id: 'b1', title: 'One' },
          { id: 'b2', title: 'Two' },
          { title: 'No id' },
        ],
      }),
    });
    expect(report.recordsScanned.books).toBe(3);
    expect(report.recordsMappable.books).toBe(2);
    expect(report.recordsSkipped.books).toBe(1);
  });

  it('is not safe to apply when a record has a blocking error', async () => {
    const report = await dryRunMigration({
      now,
      snapshot: snapshotWith({ books: [{ title: 'no id' }] }),
    });
    expect(report.safeToApply).toBe(false);
    expect(report.errors).not.toHaveLength(0);
  });

  it('reports a note pointing at a missing book as a broken reference', async () => {
    const report = await dryRunMigration({
      now,
      snapshot: snapshotWith({
        books: [{ id: 'b1', title: 'One' }],
        notes: [{ id: 'n1', bookId: 'does-not-exist', text: 'orphan' }],
      }),
    });
    expect(report.brokenReferences).toHaveLength(1);
    expect(report.recordsSkipped.notes).toBe(1);
  });

  it('ranks migrated notes in creation order', async () => {
    const report = await dryRunMigration({
      now,
      snapshot: snapshotWith({
        books: [{ id: 'b1', title: 'One' }],
        notes: [
          { id: 'n2', bookId: 'b1', text: 'second', createdAt: '2026-02-01T00:00:00.000Z' },
          { id: 'n1', bookId: 'b1', text: 'first', createdAt: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    });
    expect(report.recordsMappable.notes).toBe(2);
  });

  it('counts note origins so the two v1 shapes are visible', async () => {
    const report = await dryRunMigration({
      now,
      snapshot: snapshotWith({
        books: [{ id: 'b1', title: 'One' }],
        notes: [
          { id: 'n1', bookId: 'b1', text: 'a' },
          { id: 'n2', bookId: 'b1', content: 'b' },
          { id: 'n3', bookId: 'b1', text: 'c', content: 'd' },
        ],
      }),
    });
    expect(report.noteOrigins['note-system']).toBe(1);
    expect(report.noteOrigins['pdf-reader']).toBe(1);
    expect(report.noteOrigins.ambiguous).toBe(1);
  });

  it('explains that v1 annotations were never persisted', async () => {
    const report = await dryRunMigration({ now, snapshot: emptyV1Snapshot() });
    expect(report.summary.join(' ')).toContain('silently discarded');
  });

  it('flags an unexpected populated annotations store', async () => {
    const report = await dryRunMigration({
      now,
      snapshot: snapshotWith({
        phantomAnnotations: [{ id: 'x', bookId: 'b', pageNum: 1 }],
      }),
    });
    expect(report.warnings.some((w) => w.code === 'phantom-store-present')).toBe(true);
  });

  it('states plainly that nothing was written', async () => {
    const report = await dryRunMigration({ now, snapshot: emptyV1Snapshot() });
    expect(report.summary.join(' ')).toContain('Nothing was written');
  });

  it('produces an identical report for identical input', async () => {
    const snapshot = snapshotWith({
      books: [{ id: 'b1', title: 'One', currentPage: 12 }],
      notes: [{ id: 'n1', bookId: 'b1', text: 'x', page: 12 }],
    });
    const first = await dryRunMigration({ snapshot, now });
    const second = await dryRunMigration({ snapshot, now });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
