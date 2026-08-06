/**
 * Storage record shapes and domain mapping.
 *
 * Storage records are NOT domain records. They differ deliberately:
 *
 *   1. Flattened index columns. IndexedDB cannot index through an
 *      optional nested path, so `sourceLocation.pdf.page` becomes a
 *      top-level `pdfPage`, and a `Reference` discriminated union
 *      becomes a `fromKey` / `toKey` string.
 *   2. Explicit `undefined` handling. IndexedDB stores `undefined`
 *      but will not index it, so optional indexed fields are
 *      normalised rather than left absent.
 *
 * Every read is validated, not cast. IndexedDB returns whatever was
 * written — including records from an older version, a partial
 * migration, or a bug. Trusting them because they came from our own
 * database is how corruption spreads quietly (ADR-0002 §3).
 */
import { z } from 'zod';
import type {
  Source,
  BookDetails,
  ArtworkDetails,
  Asset,
  SourceAsset,
  Journal,
  JournalBlock,
  Annotation,
  Connection,
  Concept,
  GlossaryEntry,
  EpistemicClaim,
  StudySession,
  WorkspaceState,
  PomodoroTimerRecord,
} from '@domain/index';
import {
  SourceSchema,
  BookDetailsSchema,
  ArtworkDetailsSchema,
  AssetSchema,
  SourceAssetSchema,
  JournalSchema,
  JournalBlockSchema,
  AnnotationSchema,
  ConnectionSchema,
  ConceptSchema,
  GlossaryEntrySchema,
  EpistemicClaimSchema,
  StudySessionSchema,
  WorkspaceStateSchema,
  PomodoroTimerRecordSchema,
  referenceKey,
} from '@domain/index';
import { MalformedRecordError } from '../errors';

// ─── Index sentinels ─────────────────────────────────────────────

/**
 * IndexedDB will not index `undefined`, so a record with an absent
 * indexed field simply vanishes from that index. Using an empty
 * string as the "not set" marker keeps deleted-versus-live queries
 * honest: `.where('deletedAt').equals('')` finds live records, and
 * `.above('')` finds deleted ones.
 */
export const NOT_SET = '';

const orNotSet = (value: string | undefined): string => value ?? NOT_SET;
const fromNotSet = (value: string): string | undefined =>
  value === NOT_SET ? undefined : value;

// ─── Record shapes ───────────────────────────────────────────────

export type StoredSource = Source & { archivedAt: string };
export type StoredBookDetails = BookDetails;
export type StoredArtworkDetails = ArtworkDetails;
export type StoredAsset = Asset;
export type StoredAssetBinary = { assetId: string; data: ArrayBuffer };
export type StoredSourceAsset = SourceAsset;
export type StoredJournal = Journal;

export type StoredJournalBlock = Omit<JournalBlock, 'deletedAt'> & {
  /** Flattened from sourceLocation.pdf.page for the page-group index. */
  pdfPage: number;
  deletedAt: string;
  epistemicClaimId: string;
};

export type StoredAnnotation = Annotation;

export type StoredConnection = Connection & {
  /** Flattened reference keys — a union cannot be indexed directly. */
  fromKey: string;
  toKey: string;
};

export type StoredConcept = Concept;
export type StoredGlossaryEntry = GlossaryEntry & {
  preferredPronunciation: string;
};
export type StoredEpistemicClaim = Omit<EpistemicClaim, 'deletedAt'> & {
  deletedAt: string;
  interpretationThread: string;
};
export type StoredStudySession = StudySession;
export type StoredWorkspaceState = WorkspaceState;
export type StoredMeta = { key: string; value: unknown };

export const POMODORO_META_KEY = 'app:pomodoro-timer';

/** Page number used when a block has no PDF location. Never a real page (1-based). */
export const NO_PAGE = 0;

// ─── Validation helper ───────────────────────────────────────────

/**
 * Generic over the SCHEMA, not over a bare output type.
 *
 * `z.ZodType<T>` lets TypeScript infer `T` from the schema's INPUT
 * side, so every defaulted field comes back optional and nothing
 * matches the domain type. `z.output<S>` names the parsed side
 * explicitly — the same input-versus-output distinction as
 * ADR-0001 §2, in a different disguise.
 */
function parseStored<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  store: string,
  id?: string,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new MalformedRecordError(
      store,
      id,
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      { cause: result.error },
    );
  }
  return result.data;
}

// ─── Source ──────────────────────────────────────────────────────

export function sourceToStorage(source: Source): StoredSource {
  return { ...source, archivedAt: orNotSet(source.archivedAt) };
}

export function sourceFromStorage(record: unknown): Source {
  const raw = record as StoredSource;
  const archivedAt = fromNotSet(raw?.archivedAt ?? NOT_SET);
  const candidate = { ...raw, archivedAt };
  if (archivedAt === undefined) delete (candidate as { archivedAt?: string }).archivedAt;
  return parseStored(SourceSchema, candidate, 'sources', raw?.id);
}

// ─── Book / artwork details ──────────────────────────────────────

export const bookDetailsToStorage = (d: BookDetails): StoredBookDetails => d;
export const bookDetailsFromStorage = (r: unknown): BookDetails =>
  parseStored(BookDetailsSchema, r, 'bookDetails', (r as BookDetails)?.sourceId);

export const artworkDetailsToStorage = (d: ArtworkDetails): StoredArtworkDetails => d;
export const artworkDetailsFromStorage = (r: unknown): ArtworkDetails =>
  parseStored(
    ArtworkDetailsSchema,
    r,
    'artworkDetails',
    (r as ArtworkDetails)?.sourceId,
  );

// ─── Asset ───────────────────────────────────────────────────────

export const assetToStorage = (a: Asset): StoredAsset => a;
export const assetFromStorage = (r: unknown): Asset =>
  parseStored(AssetSchema, r, 'assets', (r as Asset)?.id);

export const sourceAssetToStorage = (l: SourceAsset): StoredSourceAsset => l;
export const sourceAssetFromStorage = (r: unknown): SourceAsset =>
  parseStored(SourceAssetSchema, r, 'sourceAssets', undefined);

// ─── Journal ─────────────────────────────────────────────────────

export const journalToStorage = (j: Journal): StoredJournal => j;
export const journalFromStorage = (r: unknown): Journal =>
  parseStored(JournalSchema, r, 'journals', (r as Journal)?.id);

export function journalBlockToStorage(block: JournalBlock): StoredJournalBlock {
  return {
    ...block,
    pdfPage: block.sourceLocation?.pdf?.page ?? NO_PAGE,
    deletedAt: orNotSet(block.deletedAt),
    epistemicClaimId: orNotSet(block.epistemicClaimId),
  };
}

export function journalBlockFromStorage(record: unknown): JournalBlock {
  const raw = record as StoredJournalBlock;
  const {
    pdfPage: _pdfPage,
    deletedAt,
    epistemicClaimId,
    ...rest
  } = raw ?? ({} as StoredJournalBlock);

  const candidate: Record<string, unknown> = { ...rest };
  const restoredDeletedAt = fromNotSet(deletedAt ?? NOT_SET);
  const restoredClaimId = fromNotSet(epistemicClaimId ?? NOT_SET);
  if (restoredDeletedAt !== undefined) candidate.deletedAt = restoredDeletedAt;
  if (restoredClaimId !== undefined) candidate.epistemicClaimId = restoredClaimId;

  return parseStored(JournalBlockSchema, candidate, 'journalBlocks', raw?.id);
}

// ─── Annotation ──────────────────────────────────────────────────

export const annotationToStorage = (a: Annotation): StoredAnnotation => a;
export const annotationFromStorage = (r: unknown): Annotation =>
  parseStored(AnnotationSchema, r, 'annotations', (r as Annotation)?.id);

// ─── Connection ──────────────────────────────────────────────────

export function connectionToStorage(connection: Connection): StoredConnection {
  return {
    ...connection,
    fromKey: referenceKey(connection.from),
    toKey: referenceKey(connection.to),
  };
}

export function connectionFromStorage(record: unknown): Connection {
  const raw = record as StoredConnection;
  const { fromKey: _f, toKey: _t, ...rest } = raw ?? ({} as StoredConnection);
  return parseStored(ConnectionSchema, rest, 'connections', raw?.id);
}

// ─── Concept / glossary ──────────────────────────────────────────

export const conceptToStorage = (c: Concept): StoredConcept => c;
export const conceptFromStorage = (r: unknown): Concept =>
  parseStored(ConceptSchema, r, 'concepts', (r as Concept)?.id);

export function glossaryEntryToStorage(entry: GlossaryEntry): StoredGlossaryEntry {
  return {
    ...entry,
    preferredPronunciation: orNotSet(entry.preferredPronunciation),
  };
}

export function glossaryEntryFromStorage(record: unknown): GlossaryEntry {
  const raw = record as StoredGlossaryEntry;
  const { preferredPronunciation, ...rest } = raw ?? ({} as StoredGlossaryEntry);
  const candidate: Record<string, unknown> = { ...rest };
  const restored = fromNotSet(preferredPronunciation ?? NOT_SET);
  if (restored !== undefined) candidate.preferredPronunciation = restored;
  return parseStored(GlossaryEntrySchema, candidate, 'glossaryEntries', raw?.id);
}

// ─── Epistemic claim ─────────────────────────────────────────────

export function epistemicClaimToStorage(claim: EpistemicClaim): StoredEpistemicClaim {
  return {
    ...claim,
    deletedAt: orNotSet(claim.deletedAt),
    interpretationThread: orNotSet(claim.interpretationThread),
  };
}

export function epistemicClaimFromStorage(record: unknown): EpistemicClaim {
  const raw = record as StoredEpistemicClaim;
  const { deletedAt, interpretationThread, ...rest } =
    raw ?? ({} as StoredEpistemicClaim);
  const candidate: Record<string, unknown> = { ...rest };
  const restoredDeleted = fromNotSet(deletedAt ?? NOT_SET);
  const restoredThread = fromNotSet(interpretationThread ?? NOT_SET);
  if (restoredDeleted !== undefined) candidate.deletedAt = restoredDeleted;
  if (restoredThread !== undefined) candidate.interpretationThread = restoredThread;
  return parseStored(EpistemicClaimSchema, candidate, 'epistemicClaims', raw?.id);
}

// ─── Session / workspace ─────────────────────────────────────────

export const studySessionToStorage = (s: StudySession): StoredStudySession => s;
export const studySessionFromStorage = (r: unknown): StudySession =>
  parseStored(StudySessionSchema, r, 'studySessions', (r as StudySession)?.id);

export const workspaceStateToStorage = (w: WorkspaceState): StoredWorkspaceState => w;
export const workspaceStateFromStorage = (r: unknown): WorkspaceState =>
  parseStored(
    WorkspaceStateSchema,
    r,
    'workspaceStates',
    (r as WorkspaceState)?.sourceId,
  );

export function pomodoroTimerToStorage(
  timer: PomodoroTimerRecord,
): StoredMeta {
  return { key: POMODORO_META_KEY, value: timer };
}

export function pomodoroTimerFromStorage(record: unknown): PomodoroTimerRecord {
  const raw = record as StoredMeta;
  return parseStored(
    PomodoroTimerRecordSchema,
    raw?.value,
    'meta',
    POMODORO_META_KEY,
  );
}
