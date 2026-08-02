/**
 * IndexedDB repository adapter, backed by Dexie.
 *
 * Contract-identical to the memory adapter: the same suite runs
 * against both, and any divergence is a defect (handoff §20.2).
 *
 * Three rules hold throughout:
 *
 *   1. Create inputs are parsed at the boundary, which validates
 *      them and applies declared defaults.
 *   2. Stored records are validated on the way OUT as well as in.
 *      IndexedDB returns whatever was written.
 *   3. Every repository call routes through the active Dexie
 *      transaction when one is open, so a UnitOfWork rolls back
 *      every participant rather than just the last one.
 */
import Dexie from 'dexie';
import { createEntityId } from '@lib/id';
import { compareRank } from '@lib/rank';
import type {
  EntityId,
  Source, BookDetails, ArtworkDetails,
  CreateSourceInput, CreateBookDetailsInput,
  Journal, JournalBlock, CreateJournalInput, CreateBlockInput,
  UpdateBlockInput, MoveBlockInput,
  Asset, SourceAsset, CreateAssetInput, AssetRole,
  Annotation, CreateAnnotationInput,
  Connection, CreateConnectionInput, Reference,
  Concept, CreateConceptInput,
  GlossaryEntry, CreateGlossaryEntryInput,
  EpistemicClaim, CreateEpistemicClaimInput, KnowledgeStatus,
  StudySession, CreateSessionInput,
  WorkspaceState,
} from '@domain/index';
import {
  CreateSourceInputSchema,
  CreateBookDetailsInputSchema,
  CreateArtworkDetailsInputSchema,
  CreateJournalInputSchema,
  CreateBlockInputSchema,
  UpdateBlockInputSchema,
  CreateAssetInputSchema,
  CreateAnnotationInputSchema,
  CreateConnectionInputSchema,
  CreateConceptInputSchema,
  CreateGlossaryEntryInputSchema,
  CreateEpistemicClaimInputSchema,
  CreateSessionInputSchema,
  referenceKey,
} from '@domain/index';
import type {
  SourceRepository, JournalRepository, AssetRepository,
  AnnotationRepository, ConnectionRepository, SessionRepository,
  WorkspaceStateRepository, ConceptRepository, GlossaryRepository,
  EpistemicClaimRepository, UnitOfWork, ConcurrencyGuard,
} from '../../repositories';
import { assertRevision } from '../../repositories/concurrency';
import {
  RecordAlreadyExistsError,
  RecordNotFoundError,
  classifyStorageFailure,
} from '../../errors';
import type { CntknwDatabase } from '../../db/database';
import { getDatabase } from '../../db/database';
import { ALL_STORES } from '../../db/schemaVersions';
import {
  NOT_SET as UNSET,
  NO_PAGE,
  sourceToStorage, sourceFromStorage,
  bookDetailsToStorage, bookDetailsFromStorage,
  artworkDetailsToStorage, artworkDetailsFromStorage,
  assetToStorage, assetFromStorage,
  sourceAssetToStorage, sourceAssetFromStorage,
  journalToStorage, journalFromStorage,
  journalBlockToStorage, journalBlockFromStorage,
  annotationToStorage, annotationFromStorage,
  connectionToStorage, connectionFromStorage,
  conceptToStorage, conceptFromStorage,
  glossaryEntryToStorage, glossaryEntryFromStorage,
  epistemicClaimToStorage, epistemicClaimFromStorage,
  studySessionToStorage, studySessionFromStorage,
  workspaceStateToStorage, workspaceStateFromStorage,
} from '../../db/storageRecords';

const now = () => new Date().toISOString();

function baseFields() {
  const timestamp = now();
  return {
    id: createEntityId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 0,
  };
}

/**
 * Run an operation, converting raw Dexie/IndexedDB failures into
 * typed domain errors. Quota and unavailability arrive as
 * `DOMException`s with names rather than types, so they must be
 * classified at the boundary before a caller can act on them.
 */
async function guarded<T>(context: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw classifyStorageFailure(error, context);
  }
}

// ─── Sources ─────────────────────────────────────────────────────

export class DexieSourceRepository implements SourceRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<Source | null> {
    const record = await guarded('Reading a source', () => this.db.sources.get(id));
    return record ? sourceFromStorage(record) : null;
  }
  async getAll(): Promise<Source[]> {
    const records = await guarded('Listing sources', () => this.db.sources.toArray());
    return records.map(sourceFromStorage);
  }
  async getActive(): Promise<Source[]> {
    // `archivedAt` is stored as '' when unset, because IndexedDB
    // will not index `undefined` — an absent value would drop the
    // record out of the index entirely.
    const records = await guarded('Listing active sources', () =>
      this.db.sources.where('archivedAt').equals(UNSET).toArray(),
    );
    return records.map(sourceFromStorage);
  }
  async getByType(type: 'book' | 'artwork'): Promise<Source[]> {
    const records = await guarded('Listing sources by type', () =>
      this.db.sources.where('type').equals(type).toArray(),
    );
    return records.map(sourceFromStorage);
  }
  async create(input: CreateSourceInput): Promise<Source> {
    const parsed = CreateSourceInputSchema.parse(input);
    const source: Source = { ...parsed, ...baseFields() };
    await guarded('Creating a source', () =>
      this.db.sources.add(sourceToStorage(source)),
    );
    return source;
  }
  async update(
    id: EntityId,
    updates: Partial<Source>,
    guard: ConcurrencyGuard,
  ): Promise<Source> {
    return guarded('Updating a source', async () => {
      const existingRecord = await this.db.sources.get(id);
      if (!existingRecord) throw new RecordNotFoundError('Source', id);
      const existing = sourceFromStorage(existingRecord);
      assertRevision('Source', id, existing.revision, guard);

      const updated: Source = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      await this.db.sources.put(sourceToStorage(updated));
      return updated;
    });
  }
  async archive(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    await this.update(id, { archivedAt: now() }, guard);
  }
  async unarchive(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    return guarded('Unarchiving a source', async () => {
      const record = await this.db.sources.get(id);
      if (!record) return;
      const existing = sourceFromStorage(record);
      assertRevision('Source', id, existing.revision, guard);
      const { archivedAt: _removed, ...rest } = existing;
      await this.db.sources.put(
        sourceToStorage({
          ...rest,
          updatedAt: now(),
          revision: existing.revision + 1,
        }),
      );
    });
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting a source', async () => {
      const record = await this.db.sources.get(id);
      // Absent is idempotent: there is no newer revision to destroy.
      if (!record) return;
      assertRevision('Source', id, sourceFromStorage(record).revision, guard);
      await this.db.sources.delete(id);
      await this.db.bookDetails.delete(id);
      await this.db.artworkDetails.delete(id);
    });
  }

  async getBookDetails(sourceId: EntityId): Promise<BookDetails | null> {
    const record = await guarded('Reading book details', () =>
      this.db.bookDetails.get(sourceId),
    );
    return record ? bookDetailsFromStorage(record) : null;
  }
  async upsertBookDetails(
    sourceId: EntityId,
    input: CreateBookDetailsInput,
  ): Promise<BookDetails> {
    const parsed = CreateBookDetailsInputSchema.parse(input);
    return guarded('Saving book details', async () => {
      const existingRecord = await this.db.bookDetails.get(sourceId);
      const existing = existingRecord ? bookDetailsFromStorage(existingRecord) : null;
      const details: BookDetails = existing
        ? { ...existing, ...parsed, sourceId }
        : { ...parsed, sourceId };
      await this.db.bookDetails.put(bookDetailsToStorage(details));
      return details;
    });
  }

  async getArtworkDetails(sourceId: EntityId): Promise<ArtworkDetails | null> {
    const record = await guarded('Reading artwork details', () =>
      this.db.artworkDetails.get(sourceId),
    );
    return record ? artworkDetailsFromStorage(record) : null;
  }
  async upsertArtworkDetails(
    sourceId: EntityId,
    input: Partial<ArtworkDetails>,
  ): Promise<ArtworkDetails> {
    const { sourceId: _ignored, ...rest } = input;
    const parsed = CreateArtworkDetailsInputSchema.partial().parse(rest);
    return guarded('Saving artwork details', async () => {
      const existingRecord = await this.db.artworkDetails.get(sourceId);
      const existing = existingRecord
        ? artworkDetailsFromStorage(existingRecord)
        : null;
      const details: ArtworkDetails = existing
        ? { ...existing, ...parsed, sourceId }
        : { ...parsed, sourceId };
      await this.db.artworkDetails.put(artworkDetailsToStorage(details));
      return details;
    });
  }
}

// ─── Journals ────────────────────────────────────────────────────

export class DexieJournalRepository implements JournalRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getJournalForSource(sourceId: EntityId): Promise<Journal | null> {
    const record = await guarded('Reading a journal', () =>
      this.db.journals.where('sourceId').equals(sourceId).first(),
    );
    return record ? journalFromStorage(record) : null;
  }
  async getOrCreateJournalForSource(
    sourceId: EntityId,
    title: string,
  ): Promise<Journal> {
    return this.transact(async () => {
      const existing = await this.getJournalForSource(sourceId);
      if (existing) return existing;
      return this.createJournal({ sourceId, title, kind: 'source' });
    });
  }
  async getJournalById(id: EntityId): Promise<Journal | null> {
    const record = await guarded('Reading a journal', () => this.db.journals.get(id));
    return record ? journalFromStorage(record) : null;
  }
  async createJournal(input: CreateJournalInput): Promise<Journal> {
    return this.transact(async () => {
      const parsed = CreateJournalInputSchema.parse(input);
      if (parsed.sourceId) {
        const existing = await this.getJournalForSource(parsed.sourceId);
        if (existing) {
          throw new Error(`A journal already exists for source ${parsed.sourceId}`);
        }
      }
      const journal: Journal = { ...parsed, ...baseFields() };
      await guarded('Creating a journal', () =>
        this.db.journals.add(journalToStorage(journal)),
      );
      return journal;
    });
  }

  async listBlocks(journalId: EntityId): Promise<JournalBlock[]> {
    const records = await guarded('Listing journal blocks', () =>
      this.db.journalBlocks.where('journalId').equals(journalId).toArray(),
    );
    return records
      .filter((r) => r.deletedAt === UNSET)
      .map(journalBlockFromStorage)
      .sort((a, b) => compareRank(a.rank, b.rank));
  }
  async listBlocksByPage(
    journalId: EntityId,
    page: number,
  ): Promise<JournalBlock[]> {
    // `pdfPage` is flattened onto the record because IndexedDB
    // cannot index through the optional nested path
    // sourceLocation.pdf.page.
    const records = await guarded('Listing blocks for a page', () =>
      this.db.journalBlocks
        .where('[journalId+pdfPage]')
        .equals([journalId, page])
        .toArray(),
    );
    return records
      .filter((r) => r.deletedAt === UNSET)
      .map(journalBlockFromStorage)
      .sort((a, b) => compareRank(a.rank, b.rank));
  }
  async getBlockById(id: EntityId): Promise<JournalBlock | null> {
    const record = await guarded('Reading a block', () =>
      this.db.journalBlocks.get(id),
    );
    return record ? journalBlockFromStorage(record) : null;
  }
  async createBlock(input: CreateBlockInput): Promise<JournalBlock> {
    const parsed = CreateBlockInputSchema.parse(input);
    const block: JournalBlock = { ...parsed, ...baseFields() };
    await guarded('Creating a block', () =>
      this.db.journalBlocks.add(journalBlockToStorage(block)),
    );
    return block;
  }
  async updateBlock(
    input: UpdateBlockInput,
    guard: ConcurrencyGuard,
  ): Promise<JournalBlock> {
    const parsed = UpdateBlockInputSchema.parse(input);
    return guarded('Updating a block', async () => {
      const record = await this.db.journalBlocks.get(parsed.id);
      if (!record) throw new RecordNotFoundError('JournalBlock', parsed.id);
      const existing = journalBlockFromStorage(record);
      assertRevision('JournalBlock', parsed.id, existing.revision, guard);

      const { id: _id, parentBlockId, epistemicClaimId, ...changes } = parsed;
      const updated: JournalBlock = {
        ...existing,
        ...changes,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      if (parentBlockId === null) delete updated.parentBlockId;
      else if (parentBlockId !== undefined) updated.parentBlockId = parentBlockId;
      if (epistemicClaimId === null) delete updated.epistemicClaimId;
      else if (epistemicClaimId !== undefined) {
        updated.epistemicClaimId = epistemicClaimId;
      }
      await this.db.journalBlocks.put(journalBlockToStorage(updated));
      return updated;
    });
  }
  async moveBlock(
    input: MoveBlockInput,
    guard: ConcurrencyGuard,
  ): Promise<void> {
    await guarded('Moving a block', async () => {
      const record = await this.db.journalBlocks.get(input.blockId);
      if (!record) throw new RecordNotFoundError('JournalBlock', input.blockId);
      const existing = journalBlockFromStorage(record);
      assertRevision('JournalBlock', input.blockId, existing.revision, guard);
      const updated: JournalBlock = {
        ...existing,
        rank: input.newRank,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      if (input.newJournalId) updated.journalId = input.newJournalId;
      if (input.newParentBlockId === null) delete updated.parentBlockId;
      else if (input.newParentBlockId !== undefined) {
        updated.parentBlockId = input.newParentBlockId;
      }
      if (input.newSourceLocation) updated.sourceLocation = input.newSourceLocation;
      await this.db.journalBlocks.put(journalBlockToStorage(updated));
    });
  }
  async softDeleteBlock(
    blockId: EntityId,
    guard: ConcurrencyGuard,
  ): Promise<void> {
    await guarded('Deleting a block', async () => {
      const record = await this.db.journalBlocks.get(blockId);
      if (!record) return;
      const existing = journalBlockFromStorage(record);
      assertRevision('JournalBlock', blockId, existing.revision, guard);
      await this.db.journalBlocks.put(
        journalBlockToStorage({
          ...existing,
          deletedAt: now(),
          updatedAt: now(),
          revision: existing.revision + 1,
        }),
      );
    });
  }
  async restoreBlock(
    blockId: EntityId,
    guard: ConcurrencyGuard,
  ): Promise<void> {
    await guarded('Restoring a block', async () => {
      const record = await this.db.journalBlocks.get(blockId);
      if (!record) return;
      const existing = journalBlockFromStorage(record);
      assertRevision('JournalBlock', blockId, existing.revision, guard);
      const { deletedAt: _removed, ...rest } = existing;
      await this.db.journalBlocks.put(
        journalBlockToStorage({
          ...rest,
          updatedAt: now(),
          revision: existing.revision + 1,
        }),
      );
    });
  }
  async listDeletedBlocks(journalId: EntityId): Promise<JournalBlock[]> {
    const records = await guarded('Listing deleted blocks', () =>
      this.db.journalBlocks.where('journalId').equals(journalId).toArray(),
    );
    return records.filter((r) => r.deletedAt !== UNSET).map(journalBlockFromStorage);
  }
  async getBlockCount(journalId: EntityId): Promise<number> {
    return (await this.listBlocks(journalId)).length;
  }
  async transact<T>(operation: () => Promise<T>): Promise<T> {
    if (Dexie.currentTransaction) return operation();
    return guarded('Journal transaction', () =>
      this.db.transaction('rw', this.db.journals, this.db.journalBlocks, operation),
    );
  }
}

// ─── Assets ──────────────────────────────────────────────────────

export class DexieAssetRepository implements AssetRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<Asset | null> {
    const record = await guarded('Reading an asset', () => this.db.assets.get(id));
    return record ? assetFromStorage(record) : null;
  }
  async create(input: CreateAssetInput): Promise<Asset> {
    const parsed = CreateAssetInputSchema.parse(input);
    const asset: Asset = { ...parsed, id: createEntityId(), createdAt: now() };
    await guarded('Creating an asset', () => this.db.assets.add(assetToStorage(asset)));
    return asset;
  }
  async delete(id: EntityId): Promise<void> {
    await guarded('Deleting an asset', async () => {
      await this.db.assets.delete(id);
      await this.db.assetBinaries.delete(id);
      await this.db.sourceAssets.where('assetId').equals(id).delete();
    });
  }
  async storeBinary(id: EntityId, data: ArrayBuffer): Promise<void> {
    // Binaries live in their own store so listing assets never
    // pulls PDF bytes into memory (NFR-003).
    await guarded('Storing a file', () =>
      this.db.assetBinaries.put({ assetId: id, data }),
    );
  }
  async getBinary(id: EntityId): Promise<ArrayBuffer | null> {
    const record = await guarded('Reading a file', () =>
      this.db.assetBinaries.get(id),
    );
    return record?.data ?? null;
  }
  async linkToSource(
    sourceId: EntityId,
    assetId: EntityId,
    role: AssetRole,
  ): Promise<SourceAsset> {
    const link: SourceAsset = { sourceId, assetId, role };
    await guarded('Linking an asset', () =>
      this.db.sourceAssets.put(sourceAssetToStorage(link)),
    );
    return link;
  }
  async getAssetsForSource(
    sourceId: EntityId,
  ): Promise<(Asset & { role: AssetRole })[]> {
    return guarded('Listing assets for a source', async () => {
      const links = await this.db.sourceAssets
        .where('sourceId')
        .equals(sourceId)
        .toArray();
      const result: (Asset & { role: AssetRole })[] = [];
      for (const rawLink of links) {
        const link = sourceAssetFromStorage(rawLink);
        const record = await this.db.assets.get(link.assetId);
        if (record) result.push({ ...assetFromStorage(record), role: link.role });
      }
      return result;
    });
  }
  async getPrimaryAsset(sourceId: EntityId): Promise<Asset | null> {
    return guarded('Reading the primary asset', async () => {
      const link = await this.db.sourceAssets
        .where('[sourceId+role]')
        .equals([sourceId, 'primary'])
        .first();
      if (!link) return null;
      const record = await this.db.assets.get(link.assetId);
      return record ? assetFromStorage(record) : null;
    });
  }
}

// ─── Annotations ─────────────────────────────────────────────────

export class DexieAnnotationRepository implements AnnotationRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<Annotation | null> {
    const record = await guarded('Reading an annotation', () =>
      this.db.annotations.get(id),
    );
    return record ? annotationFromStorage(record) : null;
  }
  async getBySourceAndPage(sourceId: EntityId, page: number): Promise<Annotation[]> {
    const records = await guarded('Listing annotations for a page', () =>
      this.db.annotations.where('[sourceId+page]').equals([sourceId, page]).toArray(),
    );
    return records.map(annotationFromStorage);
  }
  async getBySource(sourceId: EntityId): Promise<Annotation[]> {
    const records = await guarded('Listing annotations', () =>
      this.db.annotations.where('sourceId').equals(sourceId).toArray(),
    );
    return records.map(annotationFromStorage);
  }
  async create(input: CreateAnnotationInput): Promise<Annotation> {
    const parsed = CreateAnnotationInputSchema.parse(input);
    const annotation: Annotation = { ...parsed, ...baseFields() };
    await guarded('Creating an annotation', () =>
      this.db.annotations.add(annotationToStorage(annotation)),
    );
    return annotation;
  }
  async update(
    id: EntityId,
    updates: Partial<Annotation>,
    guard: ConcurrencyGuard,
  ): Promise<Annotation> {
    return guarded('Updating an annotation', async () => {
      const record = await this.db.annotations.get(id);
      if (!record) throw new RecordNotFoundError('Annotation', id);
      const existing = annotationFromStorage(record);
      assertRevision('Annotation', id, existing.revision, guard);
      const updated: Annotation = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      await this.db.annotations.put(annotationToStorage(updated));
      return updated;
    });
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting an annotation', async () => {
      const record = await this.db.annotations.get(id);
      if (!record) return;
      assertRevision('Annotation', id, annotationFromStorage(record).revision, guard);
      await this.db.annotations.delete(id);
    });
  }
}

// ─── Connections ─────────────────────────────────────────────────

export class DexieConnectionRepository implements ConnectionRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<Connection | null> {
    const record = await guarded('Reading a connection', () =>
      this.db.connections.get(id),
    );
    return record ? connectionFromStorage(record) : null;
  }
  async create(input: CreateConnectionInput): Promise<Connection> {
    const parsed = CreateConnectionInputSchema.parse(input);
    const connection: Connection = { ...parsed, ...baseFields() };
    await guarded('Creating a connection', () =>
      this.db.connections.add(connectionToStorage(connection)),
    );
    return connection;
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting a connection', async () => {
      const record = await this.db.connections.get(id);
      if (!record) return;
      assertRevision('Connection', id, connectionFromStorage(record).revision, guard);
      await this.db.connections.delete(id);
    });
  }
  async getConnectionsFrom(ref: Reference): Promise<Connection[]> {
    const records = await guarded('Listing connections', () =>
      this.db.connections.where('fromKey').equals(referenceKey(ref)).toArray(),
    );
    return records.map(connectionFromStorage);
  }
  async getConnectionsTo(ref: Reference): Promise<Connection[]> {
    const records = await guarded('Listing connections', () =>
      this.db.connections.where('toKey').equals(referenceKey(ref)).toArray(),
    );
    return records.map(connectionFromStorage);
  }
  async getBacklinks(ref: Reference): Promise<Connection[]> {
    // Derived from Connection records, never a stored array
    // (INV-007). Undirected connections backlink from either side.
    return guarded('Listing backlinks', async () => {
      const key = referenceKey(ref);
      const incoming = await this.db.connections.where('toKey').equals(key).toArray();
      const outgoing = await this.db.connections
        .where('fromKey')
        .equals(key)
        .toArray();
      const undirected = outgoing.filter((c) => c.direction === 'undirected');
      return [...incoming, ...undirected].map(connectionFromStorage);
    });
  }
}

// ─── Concepts ────────────────────────────────────────────────────

export class DexieConceptRepository implements ConceptRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<Concept | null> {
    const record = await guarded('Reading a concept', () => this.db.concepts.get(id));
    return record ? conceptFromStorage(record) : null;
  }
  async getAll(): Promise<Concept[]> {
    const records = await guarded('Listing concepts', () =>
      this.db.concepts.toArray(),
    );
    return records.map(conceptFromStorage);
  }
  async findByTitle(title: string): Promise<Concept | null> {
    // Case-insensitive over title and aliases. The index cannot do
    // case folding, so the comparison happens after the fetch.
    const needle = title.trim().toLowerCase();
    const records = await guarded('Finding a concept', () =>
      this.db.concepts.toArray(),
    );
    for (const record of records) {
      const concept = conceptFromStorage(record);
      if (concept.title.trim().toLowerCase() === needle) return concept;
      if (concept.aliases.some((a) => a.trim().toLowerCase() === needle)) {
        return concept;
      }
    }
    return null;
  }
  async create(input: CreateConceptInput): Promise<Concept> {
    const parsed = CreateConceptInputSchema.parse(input);
    const concept: Concept = { ...parsed, ...baseFields() };
    await guarded('Creating a concept', () =>
      this.db.concepts.add(conceptToStorage(concept)),
    );
    return concept;
  }
  async update(
    id: EntityId,
    updates: Partial<Concept>,
    guard: ConcurrencyGuard,
  ): Promise<Concept> {
    return guarded('Updating a concept', async () => {
      const record = await this.db.concepts.get(id);
      if (!record) throw new RecordNotFoundError('Concept', id);
      const existing = conceptFromStorage(record);
      assertRevision('Concept', id, existing.revision, guard);
      const updated: Concept = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      await this.db.concepts.put(conceptToStorage(updated));
      return updated;
    });
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting a concept', async () => {
      const record = await this.db.concepts.get(id);
      if (!record) return;
      assertRevision('Concept', id, conceptFromStorage(record).revision, guard);
      await this.db.concepts.delete(id);
    });
  }
}

// ─── Glossary ────────────────────────────────────────────────────

export class DexieGlossaryRepository implements GlossaryRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<GlossaryEntry | null> {
    const record = await guarded('Reading a glossary entry', () =>
      this.db.glossaryEntries.get(id),
    );
    return record ? glossaryEntryFromStorage(record) : null;
  }
  async getAll(): Promise<GlossaryEntry[]> {
    const records = await guarded('Listing glossary entries', () =>
      this.db.glossaryEntries.toArray(),
    );
    return records.map(glossaryEntryFromStorage);
  }
  async findByTerm(term: string, language = 'en'): Promise<GlossaryEntry | null> {
    const needle = term.trim().toLowerCase();
    const records = await guarded('Finding a term', () =>
      this.db.glossaryEntries.toArray(),
    );
    for (const record of records) {
      const entry = glossaryEntryFromStorage(record);
      if (entry.term.trim().toLowerCase() === needle && entry.language === language) {
        return entry;
      }
    }
    return null;
  }
  async create(input: CreateGlossaryEntryInput): Promise<GlossaryEntry> {
    const parsed = CreateGlossaryEntryInputSchema.parse(input);
    const entry: GlossaryEntry = { ...parsed, ...baseFields() };
    await guarded('Creating a glossary entry', () =>
      this.db.glossaryEntries.add(glossaryEntryToStorage(entry)),
    );
    return entry;
  }
  async update(
    id: EntityId,
    updates: Partial<GlossaryEntry>,
    guard: ConcurrencyGuard,
  ): Promise<GlossaryEntry> {
    return guarded('Updating a glossary entry', async () => {
      const record = await this.db.glossaryEntries.get(id);
      if (!record) throw new RecordNotFoundError('GlossaryEntry', id);
      const existing = glossaryEntryFromStorage(record);
      assertRevision('GlossaryEntry', id, existing.revision, guard);
      const updated: GlossaryEntry = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      await this.db.glossaryEntries.put(glossaryEntryToStorage(updated));
      return updated;
    });
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting a glossary entry', async () => {
      const record = await this.db.glossaryEntries.get(id);
      if (!record) return;
      assertRevision(
        'GlossaryEntry',
        id,
        glossaryEntryFromStorage(record).revision,
        guard,
      );
      await this.db.glossaryEntries.delete(id);
    });
  }
  async listPronunciations(): Promise<GlossaryEntry[]> {
    const records = await guarded('Listing pronunciations', () =>
      this.db.glossaryEntries.where('preferredPronunciation').above(UNSET).toArray(),
    );
    return records.map(glossaryEntryFromStorage);
  }
}

// ─── Epistemic claims ────────────────────────────────────────────

export class DexieEpistemicClaimRepository implements EpistemicClaimRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<EpistemicClaim | null> {
    const record = await guarded('Reading a claim', () =>
      this.db.epistemicClaims.get(id),
    );
    return record ? epistemicClaimFromStorage(record) : null;
  }
  async getAll(): Promise<EpistemicClaim[]> {
    const records = await guarded('Listing claims', () =>
      this.db.epistemicClaims.where('deletedAt').equals(UNSET).toArray(),
    );
    return records.map(epistemicClaimFromStorage);
  }
  async getByStatus(status: KnowledgeStatus): Promise<EpistemicClaim[]> {
    return (await this.getAll()).filter((c) => c.status === status);
  }
  async getByOriginBlock(blockId: EntityId): Promise<EpistemicClaim[]> {
    // Multi-entry index: one claim may originate from several
    // blocks (ADR-0001 §4).
    const records = await guarded('Finding claims for a block', () =>
      this.db.epistemicClaims.where('originBlockIds').equals(blockId).toArray(),
    );
    return records
      .filter((r) => r.deletedAt === UNSET)
      .map(epistemicClaimFromStorage);
  }
  async getByInterpretationThread(thread: string): Promise<EpistemicClaim[]> {
    const records = await guarded('Listing rival claims', () =>
      this.db.epistemicClaims.where('interpretationThread').equals(thread).toArray(),
    );
    return records
      .filter((r) => r.deletedAt === UNSET)
      .map(epistemicClaimFromStorage);
  }
  async create(input: CreateEpistemicClaimInput): Promise<EpistemicClaim> {
    const parsed = CreateEpistemicClaimInputSchema.parse(input);
    const claim: EpistemicClaim = { ...parsed, ...baseFields() };
    await guarded('Creating a claim', () =>
      this.db.epistemicClaims.add(epistemicClaimToStorage(claim)),
    );
    return claim;
  }
  async update(
    id: EntityId,
    updates: Partial<EpistemicClaim>,
    guard: ConcurrencyGuard,
  ): Promise<EpistemicClaim> {
    return guarded('Updating a claim', async () => {
      const record = await this.db.epistemicClaims.get(id);
      if (!record) throw new RecordNotFoundError('EpistemicClaim', id);
      const existing = epistemicClaimFromStorage(record);
      assertRevision('EpistemicClaim', id, existing.revision, guard);
      const updated: EpistemicClaim = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      await this.db.epistemicClaims.put(epistemicClaimToStorage(updated));
      return updated;
    });
  }
  async softDelete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting a claim', async () => {
      const record = await this.db.epistemicClaims.get(id);
      if (!record) return;
      const existing = epistemicClaimFromStorage(record);
      assertRevision('EpistemicClaim', id, existing.revision, guard);
      await this.db.epistemicClaims.put(
        epistemicClaimToStorage({
          ...existing,
          deletedAt: now(),
          updatedAt: now(),
          revision: existing.revision + 1,
        }),
      );
    });
  }
  async restore(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Restoring a claim', async () => {
      const record = await this.db.epistemicClaims.get(id);
      if (!record) return;
      const existing = epistemicClaimFromStorage(record);
      assertRevision('EpistemicClaim', id, existing.revision, guard);
      const { deletedAt: _removed, ...rest } = existing;
      await this.db.epistemicClaims.put(
        epistemicClaimToStorage({
          ...rest,
          updatedAt: now(),
          revision: existing.revision + 1,
        }),
      );
    });
  }
}

// ─── Sessions ────────────────────────────────────────────────────

export class DexieSessionRepository implements SessionRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getById(id: EntityId): Promise<StudySession | null> {
    const record = await guarded('Reading a session', () =>
      this.db.studySessions.get(id),
    );
    return record ? studySessionFromStorage(record) : null;
  }
  async getBySource(sourceId: EntityId): Promise<StudySession[]> {
    const records = await guarded('Listing sessions', () =>
      this.db.studySessions.where('sourceId').equals(sourceId).toArray(),
    );
    return records.map(studySessionFromStorage);
  }
  async getAll(): Promise<StudySession[]> {
    const records = await guarded('Listing sessions', () =>
      this.db.studySessions.toArray(),
    );
    return records.map(studySessionFromStorage);
  }
  async create(input: CreateSessionInput): Promise<StudySession> {
    const parsed = CreateSessionInputSchema.parse(input);
    const session: StudySession = {
      ...parsed,
      id: createEntityId(),
      focusedSeconds: 0,
      listenedSeconds: 0,
      breakSeconds: 0,
      manualPauseSeconds: 0,
      removedIdleSeconds: 0,
      visitedLocations: [],
      listenedLocations: [],
      createdBlockIds: [],
      createdAnnotationIds: [],
      createdConnectionIds: [],
      dictionaryLookupIds: [],
      revision: 0,
    };
    await guarded('Creating a session', () =>
      this.db.studySessions.add(studySessionToStorage(session)),
    );
    return session;
  }
  async update(
    id: EntityId,
    updates: Partial<StudySession>,
    guard: ConcurrencyGuard,
  ): Promise<StudySession> {
    return guarded('Updating a session', async () => {
      const record = await this.db.studySessions.get(id);
      if (!record) throw new RecordNotFoundError('StudySession', id);
      const existing = studySessionFromStorage(record);
      assertRevision('StudySession', id, existing.revision, guard);
      const updated: StudySession = {
        ...existing,
        ...updates,
        id: existing.id,
        revision: existing.revision + 1,
      };
      await this.db.studySessions.put(studySessionToStorage(updated));
      return updated;
    });
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting a session', async () => {
      const record = await this.db.studySessions.get(id);
      if (!record) return;
      assertRevision(
        'StudySession',
        id,
        studySessionFromStorage(record).revision,
        guard,
      );
      await this.db.studySessions.delete(id);
    });
  }
}

// ─── Workspace state ─────────────────────────────────────────────

export class DexieWorkspaceStateRepository implements WorkspaceStateRepository {
  constructor(private readonly db: CntknwDatabase) {}

  async getBySource(sourceId: EntityId): Promise<WorkspaceState | null> {
    const record = await guarded('Reading workspace state', () =>
      this.db.workspaceStates.get(sourceId),
    );
    return record ? workspaceStateFromStorage(record) : null;
  }
  async create(state: WorkspaceState): Promise<WorkspaceState> {
    return guarded('Saving workspace state', async () => {
      const record = await this.db.workspaceStates.get(state.sourceId);
      if (record) {
        throw new RecordAlreadyExistsError('WorkspaceState', state.sourceId);
      }
      const created: WorkspaceState = {
        ...state,
        id: state.id ?? createEntityId(),
        createdAt: state.createdAt ?? now(),
        updatedAt: now(),
        revision: 0,
      };
      await this.db.workspaceStates.put(workspaceStateToStorage(created));
      return created;
    });
  }
  async update(
    state: WorkspaceState,
    guard: ConcurrencyGuard,
  ): Promise<WorkspaceState> {
    return guarded('Saving workspace state', async () => {
      const record = await this.db.workspaceStates.get(state.sourceId);
      if (!record) {
        throw new RecordNotFoundError('WorkspaceState', state.sourceId);
      }
      const existing = workspaceStateFromStorage(record);
      assertRevision('WorkspaceState', state.sourceId, existing.revision, guard);
      const updated: WorkspaceState = {
        ...state,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
        revision: existing.revision + 1,
      };
      await this.db.workspaceStates.put(workspaceStateToStorage(updated));
      return updated;
    });
  }
  async delete(sourceId: EntityId, guard: ConcurrencyGuard): Promise<void> {
    await guarded('Deleting workspace state', async () => {
      const record = await this.db.workspaceStates.get(sourceId);
      if (!record) return;
      assertRevision(
        'WorkspaceState',
        sourceId,
        workspaceStateFromStorage(record).revision,
        guard,
      );
      await this.db.workspaceStates.delete(sourceId);
    });
  }
}

// ─── Unit of work ────────────────────────────────────────────────

/**
 * A single Dexie `readwrite` transaction spanning every store.
 *
 * Repository calls made inside `run` join this transaction, because
 * Dexie binds the active transaction to the async context. A
 * failure therefore rolls back every participant — not merely the
 * last write (ADR-0002 §5).
 *
 * Nesting is transparent: an inner `run` reuses the outer
 * transaction rather than opening an independent one that could
 * commit while the outer rolled back.
 */
export class DexieUnitOfWork implements UnitOfWork {
  constructor(private readonly db: CntknwDatabase) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (Dexie.currentTransaction) return operation();
    const tables = ALL_STORES.map((name) => this.db.table(name));
    try {
      return await this.db.transaction('rw', tables, operation);
    } catch (error) {
      throw classifyStorageFailure(error, 'Transaction');
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────

export function createIndexedDbRepositories(db: CntknwDatabase = getDatabase()) {
  return {
    sources: new DexieSourceRepository(db),
    journals: new DexieJournalRepository(db),
    assets: new DexieAssetRepository(db),
    annotations: new DexieAnnotationRepository(db),
    connections: new DexieConnectionRepository(db),
    concepts: new DexieConceptRepository(db),
    glossary: new DexieGlossaryRepository(db),
    claims: new DexieEpistemicClaimRepository(db),
    sessions: new DexieSessionRepository(db),
    workspaceStates: new DexieWorkspaceStateRepository(db),
    unitOfWork: new DexieUnitOfWork(db),
  };
}

export type IndexedDbRepositories = ReturnType<typeof createIndexedDbRepositories>;
export { UNSET as NOT_SET, NO_PAGE };
