/**
 * In-memory repository adapter.
 *
 * Reference implementation and test double. The same contract test
 * suite runs against this and, later, the IndexedDB adapter
 * (handoff §20.2).
 *
 * Create inputs are parsed through their schemas at the repository
 * boundary, which both validates them and applies declared defaults
 * — handoff §10 requires repository methods to accept validated
 * domain inputs. Because create-input TYPES are now z.input,
 * defaults are optional for callers and guaranteed present after
 * parsing.
 */
import { createEntityId } from '../../../lib/id';
import { compareRank } from '../../../lib/rank';
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
  referencesMatch,
} from '@domain/index';
import type {
  ConcurrencyGuard,
  SourceRepository,
  JournalRepository,
  AssetRepository,
  AnnotationRepository,
  ConnectionRepository,
  SessionRepository,
  WorkspaceStateRepository,
  ConceptRepository,
  GlossaryRepository,
  EpistemicClaimRepository,
  UnitOfWork,
} from '../../repositories';
import { assertRevision } from '../../repositories/concurrency';
import { RecordAlreadyExistsError, RecordNotFoundError } from '../../errors';

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

// ─── Sources ─────────────────────────────────────────────────────

export class MemorySourceRepository implements SourceRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly sources = new Map<EntityId, Source>();
  /** @internal exposed for UnitOfWork snapshots */
  readonly bookDetails = new Map<EntityId, BookDetails>();
  /** @internal exposed for UnitOfWork snapshots */
  readonly artworkDetails = new Map<EntityId, ArtworkDetails>();

  async getById(id: EntityId): Promise<Source | null> {
    return this.sources.get(id) ?? null;
  }
  async getAll(): Promise<Source[]> {
    return Array.from(this.sources.values());
  }
  async getActive(): Promise<Source[]> {
    return Array.from(this.sources.values()).filter(
      (s) => s.archivedAt === undefined,
    );
  }
  async getByType(type: 'book' | 'artwork'): Promise<Source[]> {
    return Array.from(this.sources.values()).filter((s) => s.type === type);
  }
  async create(input: CreateSourceInput): Promise<Source> {
    const parsed = CreateSourceInputSchema.parse(input);
    const source: Source = { ...parsed, ...baseFields() };
    this.sources.set(source.id, source);
    return source;
  }
  async update(
    id: EntityId,
    updates: Partial<Source>,
    guard: ConcurrencyGuard,
  ): Promise<Source> {
    const existing = this.sources.get(id);
    if (!existing) throw new RecordNotFoundError('Source', id);
    assertRevision('Source', id, existing.revision, guard);
    const updated: Source = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
      revision: existing.revision + 1,
    };
    this.sources.set(id, updated);
    return updated;
  }
  async archive(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.sources.get(id);
    if (!existing) return;
    assertRevision('Source', id, existing.revision, guard);
    this.sources.set(id, {
      ...existing,
      archivedAt: now(),
      updatedAt: now(),
      revision: existing.revision + 1,
    });
  }
  async unarchive(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.sources.get(id);
    if (!existing) return;
    assertRevision('Source', id, existing.revision, guard);
    const { archivedAt: _removed, ...rest } = existing;
    this.sources.set(id, {
      ...rest,
      updatedAt: now(),
      revision: existing.revision + 1,
    });
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.sources.get(id);
    // Absent is idempotent: there is no newer revision to destroy.
    if (!existing) return;
    assertRevision('Source', id, existing.revision, guard);
    this.sources.delete(id);
    this.bookDetails.delete(id);
    this.artworkDetails.delete(id);
  }

  async getBookDetails(sourceId: EntityId): Promise<BookDetails | null> {
    return this.bookDetails.get(sourceId) ?? null;
  }
  async upsertBookDetails(
    sourceId: EntityId,
    input: CreateBookDetailsInput,
  ): Promise<BookDetails> {
    const parsed = CreateBookDetailsInputSchema.parse(input);
    const existing = this.bookDetails.get(sourceId);
    const details: BookDetails = existing
      ? { ...existing, ...parsed, sourceId }
      : { ...parsed, sourceId };
    this.bookDetails.set(sourceId, details);
    return details;
  }

  async getArtworkDetails(sourceId: EntityId): Promise<ArtworkDetails | null> {
    return this.artworkDetails.get(sourceId) ?? null;
  }
  async upsertArtworkDetails(
    sourceId: EntityId,
    input: Partial<ArtworkDetails>,
  ): Promise<ArtworkDetails> {
    const existing = this.artworkDetails.get(sourceId);
    // Parsed rather than cast. The previous `...(input as any)`
    // bypassed domain typing, which handoff §26 prohibits outright.
    const { sourceId: _ignored, ...rest } = input;
    const parsed = CreateArtworkDetailsInputSchema.partial().parse(rest);
    const details: ArtworkDetails = existing
      ? { ...existing, ...parsed, sourceId }
      : { ...parsed, sourceId };
    this.artworkDetails.set(sourceId, details);
    return details;
  }
}

// ─── Journals ────────────────────────────────────────────────────

export class MemoryJournalRepository implements JournalRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly journals = new Map<EntityId, Journal>();
  /** @internal exposed for UnitOfWork snapshots */
  readonly blocks = new Map<EntityId, JournalBlock>();

  async getJournalForSource(sourceId: EntityId): Promise<Journal | null> {
    for (const journal of this.journals.values()) {
      if (journal.sourceId === sourceId) return journal;
    }
    return null;
  }
  async getOrCreateJournalForSource(
    sourceId: EntityId,
    title: string,
  ): Promise<Journal> {
    // Atomic in JS since there is no `await` between check and creation.
    let existing = Array.from(this.journals.values()).find(j => j.sourceId === sourceId);
    if (!existing) {
      const parsed = CreateJournalInputSchema.parse({ sourceId, title, kind: 'source' });
      existing = { ...parsed, ...baseFields() };
      this.journals.set(existing.id, existing);
    }
    return existing;
  }
  async getJournalById(id: EntityId): Promise<Journal | null> {
    return this.journals.get(id) ?? null;
  }
  async createJournal(input: CreateJournalInput): Promise<Journal> {
    const parsed = CreateJournalInputSchema.parse(input);
    const journal: Journal = { ...parsed, ...baseFields() };
    this.journals.set(journal.id, journal);
    return journal;
  }

  async listBlocks(journalId: EntityId): Promise<JournalBlock[]> {
    return Array.from(this.blocks.values())
      .filter((b) => b.journalId === journalId && b.deletedAt === undefined)
      .sort((a, b) => compareRank(a.rank, b.rank) || a.id.localeCompare(b.id));
  }
  async listBlocksByPage(
    journalId: EntityId,
    page: number,
  ): Promise<JournalBlock[]> {
    return Array.from(this.blocks.values())
      .filter(
        (b) =>
          b.journalId === journalId &&
          b.deletedAt === undefined &&
          b.sourceLocation?.pdf?.page === page,
      )
      .sort((a, b) => compareRank(a.rank, b.rank) || a.id.localeCompare(b.id));
  }
  async getBlockById(id: EntityId): Promise<JournalBlock | null> {
    return this.blocks.get(id) ?? null;
  }
  async createBlock(input: CreateBlockInput): Promise<JournalBlock> {
    const parsed = CreateBlockInputSchema.parse(input);
    const block: JournalBlock = { ...parsed, ...baseFields() };
    this.blocks.set(block.id, block);
    return block;
  }
  async updateBlock(
    input: UpdateBlockInput,
    guard: ConcurrencyGuard,
  ): Promise<JournalBlock> {
    // Parsed at the boundary so any supplied content has its
    // defaults applied before it is stored.
    const parsed = UpdateBlockInputSchema.parse(input);
    const existing = this.blocks.get(parsed.id);
    if (!existing) throw new RecordNotFoundError('JournalBlock', parsed.id);
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
    this.blocks.set(parsed.id, updated);
    return updated;
  }
  async moveBlock(
    input: MoveBlockInput,
    guard: ConcurrencyGuard,
  ): Promise<void> {
    const existing = this.blocks.get(input.blockId);
    if (!existing) throw new RecordNotFoundError('JournalBlock', input.blockId);
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
    this.blocks.set(input.blockId, updated);
  }
  async softDeleteBlock(
    blockId: EntityId,
    guard: ConcurrencyGuard,
  ): Promise<void> {
    const existing = this.blocks.get(blockId);
    if (!existing) return;
    assertRevision('JournalBlock', blockId, existing.revision, guard);
    // Marked, not removed. The previous implementation called
    // Map.delete here, which made recovery impossible and
    // contradicted PDD §19.3 and NFR-008 (audit defect A-6).
    this.blocks.set(blockId, {
      ...existing,
      deletedAt: now(),
      updatedAt: now(),
      revision: existing.revision + 1,
    });
  }
  async restoreBlock(
    blockId: EntityId,
    guard: ConcurrencyGuard,
  ): Promise<void> {
    const existing = this.blocks.get(blockId);
    if (!existing) return;
    assertRevision('JournalBlock', blockId, existing.revision, guard);
    const { deletedAt: _removed, ...rest } = existing;
    this.blocks.set(blockId, {
      ...rest,
      updatedAt: now(),
      revision: existing.revision + 1,
    });
  }
  async listDeletedBlocks(journalId: EntityId): Promise<JournalBlock[]> {
    return Array.from(this.blocks.values()).filter(
      (b) => b.journalId === journalId && b.deletedAt !== undefined,
    );
  }
  async getBlockCount(journalId: EntityId): Promise<number> {
    return (await this.listBlocks(journalId)).length;
  }
  async transact<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

// ─── Assets ──────────────────────────────────────────────────────

export class MemoryAssetRepository implements AssetRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly assets = new Map<EntityId, Asset>();
  /** @internal exposed for UnitOfWork snapshots */
  readonly binaries = new Map<EntityId, ArrayBuffer>();
  /** @internal exposed for UnitOfWork snapshots */
  readonly sourceAssets = new Map<string, SourceAsset>();

  async getById(id: EntityId): Promise<Asset | null> {
    return this.assets.get(id) ?? null;
  }
  async create(input: CreateAssetInput): Promise<Asset> {
    const parsed = CreateAssetInputSchema.parse(input);
    // Asset has createdAt but no updatedAt/revision: a stored binary
    // is immutable (audit defect A-3).
    const asset: Asset = {
      ...parsed,
      id: createEntityId(),
      createdAt: now(),
    };
    this.assets.set(asset.id, asset);
    return asset;
  }
  async delete(id: EntityId): Promise<void> {
    this.assets.delete(id);
    this.binaries.delete(id);
    for (const [key, link] of this.sourceAssets.entries()) {
      if (link.assetId === id) this.sourceAssets.delete(key);
    }
  }
  async storeBinary(id: EntityId, data: ArrayBuffer): Promise<void> {
    this.binaries.set(id, data);
  }
  async getBinary(id: EntityId): Promise<ArrayBuffer | null> {
    return this.binaries.get(id) ?? null;
  }
  async linkToSource(
    sourceId: EntityId,
    assetId: EntityId,
    role: AssetRole,
  ): Promise<SourceAsset> {
    // SourceAsset is a pure join record with no identity of its own
    // (audit defect A-4).
    const link: SourceAsset = { sourceId, assetId, role };
    this.sourceAssets.set(`${sourceId}_${assetId}`, link);
    return link;
  }
  async getAssetsForSource(
    sourceId: EntityId,
  ): Promise<(Asset & { role: AssetRole })[]> {
    const result: (Asset & { role: AssetRole })[] = [];
    for (const link of this.sourceAssets.values()) {
      if (link.sourceId !== sourceId) continue;
      const asset = this.assets.get(link.assetId);
      if (asset) result.push({ ...asset, role: link.role });
    }
    return result;
  }
  async getPrimaryAsset(sourceId: EntityId): Promise<Asset | null> {
    for (const link of this.sourceAssets.values()) {
      if (link.sourceId === sourceId && link.role === 'primary') {
        return this.assets.get(link.assetId) ?? null;
      }
    }
    return null;
  }
}

// ─── Annotations ─────────────────────────────────────────────────

export class MemoryAnnotationRepository implements AnnotationRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly annotations = new Map<EntityId, Annotation>();

  async getById(id: EntityId): Promise<Annotation | null> {
    return this.annotations.get(id) ?? null;
  }
  async getBySourceAndPage(
    sourceId: EntityId,
    page: number,
  ): Promise<Annotation[]> {
    // Annotation carries `page` directly. The previous
    // implementation read `a.location.pdf?.page`, a property that
    // does not exist on the schema (audit defect A-2).
    return Array.from(this.annotations.values()).filter(
      (a) => a.sourceId === sourceId && a.page === page,
    );
  }
  async getBySource(sourceId: EntityId): Promise<Annotation[]> {
    return Array.from(this.annotations.values()).filter(
      (a) => a.sourceId === sourceId,
    );
  }
  async create(input: CreateAnnotationInput): Promise<Annotation> {
    const parsed = CreateAnnotationInputSchema.parse(input);
    const annotation: Annotation = { ...parsed, ...baseFields() };
    this.annotations.set(annotation.id, annotation);
    return annotation;
  }
  async update(
    id: EntityId,
    updates: Partial<Annotation>,
    guard: ConcurrencyGuard,
  ): Promise<Annotation> {
    const existing = this.annotations.get(id);
    if (!existing) throw new RecordNotFoundError('Annotation', id);
    assertRevision('Annotation', id, existing.revision, guard);
    const updated: Annotation = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
      revision: existing.revision + 1,
    };
    this.annotations.set(id, updated);
    return updated;
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.annotations.get(id);
    if (!existing) return;
    assertRevision('Annotation', id, existing.revision, guard);
    this.annotations.delete(id);
  }
}

// ─── Connections ─────────────────────────────────────────────────

export class MemoryConnectionRepository implements ConnectionRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly connections = new Map<EntityId, Connection>();

  async getById(id: EntityId): Promise<Connection | null> {
    return this.connections.get(id) ?? null;
  }
  async create(input: CreateConnectionInput): Promise<Connection> {
    const parsed = CreateConnectionInputSchema.parse(input);
    const connection: Connection = { ...parsed, ...baseFields() };
    this.connections.set(connection.id, connection);
    return connection;
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.connections.get(id);
    if (!existing) return;
    assertRevision('Connection', id, existing.revision, guard);
    this.connections.delete(id);
  }
  async getConnectionsFrom(ref: Reference): Promise<Connection[]> {
    // referencesMatch replaces the previous `(r as any).id` cast,
    // which handoff §26 prohibits (audit defect A-7).
    return Array.from(this.connections.values()).filter((c) =>
      referencesMatch(c.from, ref),
    );
  }
  async getConnectionsTo(ref: Reference): Promise<Connection[]> {
    return Array.from(this.connections.values()).filter((c) =>
      referencesMatch(c.to, ref),
    );
  }
  async getBacklinks(ref: Reference): Promise<Connection[]> {
    // Backlinks are derived from Connection records, never stored
    // as a mutable array on the endpoint (INV-007). Undirected
    // connections backlink from either side.
    return Array.from(this.connections.values()).filter(
      (c) =>
        referencesMatch(c.to, ref) ||
        (c.direction === 'undirected' && referencesMatch(c.from, ref)),
    );
  }
}

// ─── Concepts ────────────────────────────────────────────────────

export class MemoryConceptRepository implements ConceptRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly concepts = new Map<EntityId, Concept>();

  async getById(id: EntityId): Promise<Concept | null> {
    return this.concepts.get(id) ?? null;
  }
  async getAll(): Promise<Concept[]> {
    return Array.from(this.concepts.values());
  }
  async findByTitle(title: string): Promise<Concept | null> {
    const needle = title.trim().toLowerCase();
    for (const concept of this.concepts.values()) {
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
    this.concepts.set(concept.id, concept);
    return concept;
  }
  async update(
    id: EntityId,
    updates: Partial<Concept>,
    guard: ConcurrencyGuard,
  ): Promise<Concept> {
    const existing = this.concepts.get(id);
    if (!existing) throw new RecordNotFoundError('Concept', id);
    assertRevision('Concept', id, existing.revision, guard);
    const updated: Concept = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
      revision: existing.revision + 1,
    };
    this.concepts.set(id, updated);
    return updated;
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.concepts.get(id);
    if (!existing) return;
    assertRevision('Concept', id, existing.revision, guard);
    this.concepts.delete(id);
  }
}

// ─── Glossary ────────────────────────────────────────────────────

export class MemoryGlossaryRepository implements GlossaryRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly entries = new Map<EntityId, GlossaryEntry>();

  async getById(id: EntityId): Promise<GlossaryEntry | null> {
    return this.entries.get(id) ?? null;
  }
  async getAll(): Promise<GlossaryEntry[]> {
    return Array.from(this.entries.values());
  }
  async findByTerm(
    term: string,
    language = 'en',
  ): Promise<GlossaryEntry | null> {
    const needle = term.trim().toLowerCase();
    for (const entry of this.entries.values()) {
      if (
        entry.term.trim().toLowerCase() === needle &&
        entry.language === language
      ) {
        return entry;
      }
    }
    return null;
  }
  async create(input: CreateGlossaryEntryInput): Promise<GlossaryEntry> {
    const parsed = CreateGlossaryEntryInputSchema.parse(input);
    const entry: GlossaryEntry = { ...parsed, ...baseFields() };
    this.entries.set(entry.id, entry);
    return entry;
  }
  async update(
    id: EntityId,
    updates: Partial<GlossaryEntry>,
    guard: ConcurrencyGuard,
  ): Promise<GlossaryEntry> {
    const existing = this.entries.get(id);
    if (!existing) throw new RecordNotFoundError('GlossaryEntry', id);
    assertRevision('GlossaryEntry', id, existing.revision, guard);
    const updated: GlossaryEntry = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
      revision: existing.revision + 1,
    };
    this.entries.set(id, updated);
    return updated;
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.entries.get(id);
    if (!existing) return;
    assertRevision('GlossaryEntry', id, existing.revision, guard);
    this.entries.delete(id);
  }
  async listPronunciations(): Promise<GlossaryEntry[]> {
    return Array.from(this.entries.values()).filter(
      (e) => e.preferredPronunciation !== undefined,
    );
  }
}

// ─── Epistemic Claims ────────────────────────────────────────────

export class MemoryEpistemicClaimRepository
  implements EpistemicClaimRepository
{
  /** @internal exposed for UnitOfWork snapshots */
  readonly claims = new Map<EntityId, EpistemicClaim>();

  async getById(id: EntityId): Promise<EpistemicClaim | null> {
    return this.claims.get(id) ?? null;
  }
  async getAll(): Promise<EpistemicClaim[]> {
    return Array.from(this.claims.values()).filter(
      (c) => c.deletedAt === undefined,
    );
  }
  async getByStatus(status: KnowledgeStatus): Promise<EpistemicClaim[]> {
    return (await this.getAll()).filter((c) => c.status === status);
  }
  async getByOriginBlock(blockId: EntityId): Promise<EpistemicClaim[]> {
    return (await this.getAll()).filter((c) =>
      c.originBlockIds.includes(blockId),
    );
  }
  async getByInterpretationThread(thread: string): Promise<EpistemicClaim[]> {
    return (await this.getAll()).filter(
      (c) => c.interpretationThread === thread,
    );
  }
  async create(input: CreateEpistemicClaimInput): Promise<EpistemicClaim> {
    const parsed = CreateEpistemicClaimInputSchema.parse(input);
    const claim: EpistemicClaim = { ...parsed, ...baseFields() };
    this.claims.set(claim.id, claim);
    return claim;
  }
  async update(
    id: EntityId,
    updates: Partial<EpistemicClaim>,
    guard: ConcurrencyGuard,
  ): Promise<EpistemicClaim> {
    const existing = this.claims.get(id);
    if (!existing) throw new RecordNotFoundError('EpistemicClaim', id);
    assertRevision('EpistemicClaim', id, existing.revision, guard);
    const updated: EpistemicClaim = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
      revision: existing.revision + 1,
    };
    this.claims.set(id, updated);
    return updated;
  }
  async softDelete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.claims.get(id);
    if (!existing) return;
    assertRevision('EpistemicClaim', id, existing.revision, guard);
    this.claims.set(id, {
      ...existing,
      deletedAt: now(),
      updatedAt: now(),
      revision: existing.revision + 1,
    });
  }
  async restore(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.claims.get(id);
    if (!existing) return;
    assertRevision('EpistemicClaim', id, existing.revision, guard);
    const { deletedAt: _removed, ...rest } = existing;
    this.claims.set(id, {
      ...rest,
      updatedAt: now(),
      revision: existing.revision + 1,
    });
  }
}

// ─── Sessions ────────────────────────────────────────────────────

export class MemorySessionRepository implements SessionRepository {
  /** @internal exposed for UnitOfWork snapshots */
  readonly sessions = new Map<EntityId, StudySession>();

  async getById(id: EntityId): Promise<StudySession | null> {
    return this.sessions.get(id) ?? null;
  }
  async getBySource(sourceId: EntityId): Promise<StudySession[]> {
    return Array.from(this.sessions.values()).filter(
      (s) => s.sourceId === sourceId,
    );
  }
  async getAll(): Promise<StudySession[]> {
    return Array.from(this.sessions.values());
  }
  async create(input: CreateSessionInput): Promise<StudySession> {
    const parsed = CreateSessionInputSchema.parse(input);
    // StudySession has no createdAt/updatedAt — startedAt and
    // endedAt describe its lifetime (audit defect A-5).
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
    this.sessions.set(session.id, session);
    return session;
  }
  async update(
    id: EntityId,
    updates: Partial<StudySession>,
    guard: ConcurrencyGuard,
  ): Promise<StudySession> {
    const existing = this.sessions.get(id);
    if (!existing) throw new RecordNotFoundError('StudySession', id);
    assertRevision('StudySession', id, existing.revision, guard);
    const updated: StudySession = {
      ...existing,
      ...updates,
      id: existing.id,
      revision: existing.revision + 1,
    };
    this.sessions.set(id, updated);
    return updated;
  }
  async delete(id: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.sessions.get(id);
    if (!existing) return;
    assertRevision('StudySession', id, existing.revision, guard);
    this.sessions.delete(id);
  }
}

// ─── Workspace State ─────────────────────────────────────────────

export class MemoryWorkspaceStateRepository
  implements WorkspaceStateRepository
{
  /** @internal exposed for UnitOfWork snapshots */
  readonly states = new Map<EntityId, WorkspaceState>();

  async getBySource(sourceId: EntityId): Promise<WorkspaceState | null> {
    return this.states.get(sourceId) ?? null;
  }
  async create(state: WorkspaceState): Promise<WorkspaceState> {
    const existing = this.states.get(state.sourceId);
    if (existing) {
      throw new RecordAlreadyExistsError('WorkspaceState', state.sourceId);
    }
    const created: WorkspaceState = {
      ...state,
      id: state.id ?? createEntityId(),
      createdAt: state.createdAt ?? now(),
      updatedAt: now(),
      revision: 0,
    };
    this.states.set(state.sourceId, created);
    return created;
  }
  async update(
    state: WorkspaceState,
    guard: ConcurrencyGuard,
  ): Promise<WorkspaceState> {
    const existing = this.states.get(state.sourceId);
    if (!existing) {
      throw new RecordNotFoundError('WorkspaceState', state.sourceId);
    }
    assertRevision('WorkspaceState', state.sourceId, existing.revision, guard);
    const updated: WorkspaceState = {
      ...state,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
      revision: existing.revision + 1,
    };
    this.states.set(state.sourceId, updated);
    return updated;
  }
  async delete(sourceId: EntityId, guard: ConcurrencyGuard): Promise<void> {
    const existing = this.states.get(sourceId);
    if (!existing) return;
    assertRevision('WorkspaceState', sourceId, existing.revision, guard);
    this.states.delete(sourceId);
  }
}

// ─── Unit of Work ────────────────────────────────────────────────

/**
 * Pass-through. The memory adapter has no real transaction, so this
 * exists to keep use cases written against the boundary from day
 * one. The Dexie adapter will implement it for real.
 */
export class MemoryUnitOfWork implements UnitOfWork {
  private depth = 0;

  constructor(private readonly stores: () => ReadonlyArray<Map<string, unknown>>) {}

  /**
   * Snapshot every store on entry, restore on failure.
   *
   * A pass-through unit of work is worse than none: it advertises
   * atomicity it does not provide. Snapshotting means rollback is
   * testable against BOTH adapters — if it were only testable
   * against Dexie, this adapter would drift and the contract suite
   * would stop being a contract (ADR-0002 §5).
   *
   * Nested calls join the outer transaction rather than taking
   * their own snapshot, matching Dexie's behaviour.
   */
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      this.depth += 1;
      try {
        return await operation();
      } finally {
        this.depth -= 1;
      }
    }

    const stores = this.stores();
    const snapshots = stores.map((store) => new Map(store));
    this.depth = 1;
    try {
      return await operation();
    } catch (error) {
      stores.forEach((store, index) => {
        store.clear();
        for (const [key, value] of snapshots[index]!) store.set(key, value);
      });
      throw error;
    } finally {
      this.depth = 0;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────

export function createMemoryRepositories() {
  const sources = new MemorySourceRepository();
  const journals = new MemoryJournalRepository();
  const assets = new MemoryAssetRepository();
  const annotations = new MemoryAnnotationRepository();
  const connections = new MemoryConnectionRepository();
  const concepts = new MemoryConceptRepository();
  const glossary = new MemoryGlossaryRepository();
  const claims = new MemoryEpistemicClaimRepository();
  const sessions = new MemorySessionRepository();
  const workspaceStates = new MemoryWorkspaceStateRepository();

  const allStores = (): ReadonlyArray<Map<string, unknown>> =>
    [
      sources.sources, sources.bookDetails, sources.artworkDetails,
      journals.journals, journals.blocks,
      assets.assets, assets.binaries, assets.sourceAssets,
      annotations.annotations,
      connections.connections,
      concepts.concepts,
      glossary.entries,
      claims.claims,
      sessions.sessions,
      workspaceStates.states,
    ] as unknown as ReadonlyArray<Map<string, unknown>>;

  return {
    sources, journals, assets, annotations, connections,
    concepts, glossary, claims, sessions, workspaceStates,
    unitOfWork: new MemoryUnitOfWork(allStores),
  };
}

export type MemoryRepositories = ReturnType<typeof createMemoryRepositories>;
