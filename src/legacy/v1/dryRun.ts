/**
 * Migration dry run.
 *
 * Reads v1, maps everything, reports what WOULD happen — and writes
 * nothing. Not to v2, not to v1.
 *
 * There is deliberately no `applyMigration` in this phase. Its
 * absence is the guarantee: no import of this module can trigger a
 * destructive migration, accidentally or otherwise, because no code
 * path exists that could (ADR-0002 §7).
 */
import { V1_DATABASE_NAME, CURRENT_SCHEMA_VERSION } from '../../data/db/schemaVersions';
import { v1DatabaseExists, readV1Snapshot, emptyV1Snapshot } from './readers';
import { rankBetween } from '@lib/rank';
import {
  mapBook,
  mapNote,
  mapSession,
  mapPdf,
  mapDrawing,
  mapArtwork,
  classifyNote,
  type MappingContext,
  type MigrationFinding,
  type NoteOrigin,
} from './mappings';
import type { V1Snapshot } from './types';

export interface MigrationDryRunReport {
  sourceDatabase: string;
  targetSchemaVersion: number;
  startedAt: string;
  completedAt: string;

  v1Present: boolean;
  storesFound: string[];
  storesMissing: string[];

  recordsScanned: Record<string, number>;
  recordsMappable: Record<string, number>;
  recordsSkipped: Record<string, number>;

  warnings: MigrationFinding[];
  errors: MigrationFinding[];
  orphanedRecords: MigrationFinding[];
  brokenReferences: MigrationFinding[];

  noteOrigins: Record<NoteOrigin, number>;

  /** False when any error-severity finding exists. */
  safeToApply: boolean;

  /** Plain-language summary for a human deciding whether to proceed. */
  summary: string[];
}

export interface DryRunOptions {
  databaseName?: string;
  /** Injected for deterministic tests. */
  now?: () => string;
  snapshot?: V1Snapshot;
}

/**
 * Deterministic v2 ids derived from v1 ids.
 *
 * A dry run and a later apply must agree on every id, so they
 * cannot be random. This derives a stable UUID-shaped value from
 * the kind and legacy id — same input, same output, every run.
 */
export function createDeterministicIdFactory(): MappingContext['idFor'] {
  return (kind: string, legacyId: string): string => {
    const seed = `${kind}:${legacyId}`;
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < seed.length; i++) {
      const code = seed.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
    }
    const hex = (n: number) => n.toString(16).padStart(8, '0');
    const a = hex(h1);
    const b = hex(h2);
    const c = hex((h1 ^ h2) >>> 0);
    const d = hex(Math.imul(h1 + h2, 0xc2b2ae35) >>> 0);
    // Version 8, variant 8 — a valid UUID that is explicitly
    // name-derived rather than pretending to be random.
    return `${a}-${b.slice(0, 4)}-8${b.slice(5, 8)}-8${c.slice(1, 4)}-${c.slice(4)}${d}`;
  };
}

const zeroCounts = (): Record<string, number> => ({
  books: 0,
  notes: 0,
  sessions: 0,
  pdfs: 0,
  pdfAnnotations: 0,
  phantomAnnotations: 0,
  artworks: 0,
  drawings: 0,
  appState: 0,
});

export async function dryRunMigration(
  options: DryRunOptions = {},
): Promise<MigrationDryRunReport> {
  const databaseName = options.databaseName ?? V1_DATABASE_NAME;
  const clock = options.now ?? (() => new Date().toISOString());
  const startedAt = clock();

  const present =
    options.snapshot !== undefined ? true : await v1DatabaseExists(databaseName);
  const snapshot =
    options.snapshot ??
    (present ? await readV1Snapshot(databaseName) : emptyV1Snapshot());

  const context: MappingContext = {
    idFor: createDeterministicIdFactory(),
    fallbackTimestamp: startedAt,
  };

  const scanned = zeroCounts();
  const mappable = zeroCounts();
  const skipped = zeroCounts();
  const warnings: MigrationFinding[] = [];
  const errors: MigrationFinding[] = [];
  const orphanedRecords: MigrationFinding[] = [];
  const brokenReferences: MigrationFinding[] = [];
  const noteOrigins: Record<NoteOrigin, number> = {
    'note-system': 0,
    'pdf-reader': 0,
    ambiguous: 0,
    empty: 0,
  };

  const collect = (findings: MigrationFinding[]) => {
    for (const finding of findings) {
      if (finding.severity === 'error') errors.push(finding);
      else if (finding.severity === 'warning') warnings.push(finding);
    }
  };

  // ── books ──
  const bookIdToSourceId = new Map<string, string>();
  const bookIdToJournalId = new Map<string, string>();
  for (const book of snapshot.books) {
    scanned.books += 1;
    const { value, findings } = mapBook(book, context);
    collect(findings);
    if (value) {
      mappable.books += 1;
      bookIdToSourceId.set(book.id!, value.source.id);
      bookIdToJournalId.set(book.id!, value.journal.id);
    } else {
      skipped.books += 1;
    }
  }

  // ── notes ──
  // Ranked per journal in creation order, so a migrated journal
  // reads in the order the user wrote it.
  const lastRankByJournal = new Map<string, string>();
  const orderedNotes = [...snapshot.notes].sort((a, b) =>
    (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
  );
  for (const note of orderedNotes) {
    scanned.notes += 1;
    noteOrigins[classifyNote(note)] += 1;

    const sourceId = note.bookId ? bookIdToSourceId.get(note.bookId) : undefined;
    const journalId = note.bookId ? bookIdToJournalId.get(note.bookId) : undefined;

    if (!sourceId || !journalId) {
      skipped.notes += 1;
      const finding: MigrationFinding = {
        severity: 'warning',
        store: 'notes',
        recordId: note.id,
        code: note.bookId ? 'orphaned-note' : 'note-without-book',
        message: note.bookId
          ? `Note references book "${note.bookId}", which does not exist or could not be migrated.`
          : 'Note has no bookId and cannot be attached to a journal.',
      };
      warnings.push(finding);
      if (note.bookId) brokenReferences.push(finding);
      else orphanedRecords.push(finding);
      continue;
    }

    const previous = lastRankByJournal.get(journalId) ?? null;
    const rank = rankBetween(previous, null);
    const { value, findings } = mapNote(note, journalId, sourceId, rank, context);
    collect(findings);
    if (value) {
      mappable.notes += 1;
      lastRankByJournal.set(journalId, rank);
    } else {
      skipped.notes += 1;
    }
  }

  // ── sessions ──
  for (const session of snapshot.sessions) {
    scanned.sessions += 1;
    const sourceId = session.bookId
      ? bookIdToSourceId.get(session.bookId)
      : undefined;
    if (!sourceId) {
      skipped.sessions += 1;
      const finding: MigrationFinding = {
        severity: 'warning',
        store: 'sessions',
        recordId: session.id,
        code: 'orphaned-session',
        message: `Session references book "${session.bookId ?? '(none)'}", which was not migrated.`,
      };
      warnings.push(finding);
      brokenReferences.push(finding);
      continue;
    }
    const { value, findings } = mapSession(session, sourceId, context);
    collect(findings);
    if (value) mappable.sessions += 1;
    else skipped.sessions += 1;
  }

  // ── pdfs ──
  for (const pdf of snapshot.pdfs) {
    scanned.pdfs += 1;
    const sourceId = pdf.bookId ? bookIdToSourceId.get(pdf.bookId) : undefined;
    if (!sourceId) {
      skipped.pdfs += 1;
      const finding: MigrationFinding = {
        severity: 'warning',
        store: 'pdfs',
        recordId: pdf.id,
        code: 'orphaned-pdf',
        message:
          `PDF references book "${pdf.bookId ?? '(none)'}", which was not ` +
          'migrated. The file is not lost — it remains in v1.',
      };
      warnings.push(finding);
      orphanedRecords.push(finding);
      continue;
    }
    const { value, findings } = mapPdf(pdf, sourceId, context);
    collect(findings);
    if (value) mappable.pdfs += 1;
    else skipped.pdfs += 1;
  }

  // ── annotations ──
  scanned.pdfAnnotations = snapshot.pdfAnnotations.length;
  scanned.phantomAnnotations = snapshot.phantomAnnotations.length;

  if (snapshot.pdfAnnotations.length > 0) {
    warnings.push({
      severity: 'warning',
      store: 'pdfAnnotations',
      code: 'unexpected-annotations',
      message:
        `Found ${snapshot.pdfAnnotations.length} record(s) in "pdfAnnotations". ` +
        'v1 never wrote to this store, so these came from a variant we have ' +
        'not seen. They are NOT mapped in this phase.',
    });
  }
  if (snapshot.phantomAnnotations.length > 0) {
    warnings.push({
      severity: 'warning',
      store: 'annotations',
      code: 'phantom-store-present',
      message:
        `Found an "annotations" store with ${snapshot.phantomAnnotations.length} ` +
        'record(s). `db.js` never creates it, so this database differs from the ' +
        'known v1 schema. Not mapped in this phase.',
    });
  }

  // ── artworks ──
  for (const artwork of snapshot.artworks) {
    scanned.artworks += 1;
    const { value, findings } = mapArtwork(artwork, context);
    collect(findings);
    if (value) mappable.artworks += 1;
    else skipped.artworks += 1;
  }

  // ── drawings ──
  for (const drawing of snapshot.drawings) {
    scanned.drawings += 1;
    const { value, findings } = mapDrawing(drawing, context);
    collect(findings);
    if (value) mappable.drawings += 1;
    else skipped.drawings += 1;
  }

  // ── appState ──
  scanned.appState = snapshot.appState.length;
  if (snapshot.appState.length > 0) {
    warnings.push({
      severity: 'warning',
      store: 'appState',
      code: 'appstate-deferred',
      message:
        `${snapshot.appState.length} appState key(s) found. Splitting them into ` +
        'settings and workspace states needs a settings store, which does not ' +
        'exist yet. Deferred; nothing is lost.',
    });
  }

  const completedAt = clock();
  const safeToApply = errors.length === 0;

  return {
    sourceDatabase: databaseName,
    targetSchemaVersion: CURRENT_SCHEMA_VERSION,
    startedAt,
    completedAt,
    v1Present: present,
    storesFound: snapshot.storesFound,
    storesMissing: snapshot.storesMissing,
    recordsScanned: scanned,
    recordsMappable: mappable,
    recordsSkipped: skipped,
    warnings,
    errors,
    orphanedRecords,
    brokenReferences,
    noteOrigins,
    safeToApply,
    summary: buildSummary({
      present,
      scanned,
      mappable,
      skipped,
      errors,
      warnings,
      noteOrigins,
      snapshot,
    }),
  };
}

function buildSummary(input: {
  present: boolean;
  scanned: Record<string, number>;
  mappable: Record<string, number>;
  skipped: Record<string, number>;
  errors: MigrationFinding[];
  warnings: MigrationFinding[];
  noteOrigins: Record<NoteOrigin, number>;
  snapshot: V1Snapshot;
}): string[] {
  const lines: string[] = [];

  if (!input.present) {
    lines.push('No v1 database found. There is nothing to migrate.');
    return lines;
  }

  const total = Object.values(input.scanned).reduce((a, b) => a + b, 0);
  const migratable = Object.values(input.mappable).reduce((a, b) => a + b, 0);
  const dropped = Object.values(input.skipped).reduce((a, b) => a + b, 0);

  lines.push(
    `Scanned ${total} v1 record(s): ${migratable} would migrate, ${dropped} would be skipped.`,
  );

  if (input.noteOrigins.ambiguous > 0) {
    lines.push(
      `${input.noteOrigins.ambiguous} note(s) carry both \`text\` and \`content\`. ` +
        'Both are preserved in the migrated block.',
    );
  }
  if (input.noteOrigins['pdf-reader'] > 0) {
    lines.push(
      `${input.noteOrigins['pdf-reader']} note(s) use the PDFReader \`content\` shape ` +
        'and have no title, category or tags — that is expected, not data loss.',
    );
  }
  if (input.snapshot.drawings.length > 0) {
    lines.push(
      `${input.snapshot.drawings.length} drawing(s) are raster-only and will migrate ` +
        'as locked images. v1 never stored editable vector data.',
    );
  }
  if (input.snapshot.pdfAnnotations.length === 0) {
    lines.push(
      'No PDF annotations found — expected. v1 wrote annotations to a store it ' +
        'never created, so every annotation drawn in v1 was silently discarded ' +
        'at the time. There is nothing to recover.',
    );
  }

  lines.push(
    input.errors.length === 0
      ? 'No blocking errors. A migration could proceed once apply is implemented.'
      : `${input.errors.length} blocking error(s). Migration must not proceed.`,
  );
  lines.push(
    'This was a dry run. Nothing was written to either database, and v1 is unchanged.',
  );

  return lines;
}
