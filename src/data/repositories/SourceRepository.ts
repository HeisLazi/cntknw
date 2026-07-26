import type { EntityId, Source, BookDetails, ArtworkDetails, CreateSourceInput, CreateBookDetailsInput } from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

export interface SourceRepository {
  getById(id: EntityId): Promise<Source | null>;
  getAll(): Promise<Source[]>;
  getActive(): Promise<Source[]>; // non-archived
  getByType(type: 'book' | 'artwork'): Promise<Source[]>;
  create(input: CreateSourceInput): Promise<Source>;

  /** @param guard mandatory — see ADR-0003. */
  update(
    id: EntityId,
    updates: Partial<Source>,
    guard: ConcurrencyGuard,
  ): Promise<Source>;

  /** Bumps the revision, so it carries a guard like any other write. */
  archive(id: EntityId, guard: ConcurrencyGuard): Promise<void>;
  unarchive(id: EntityId, guard: ConcurrencyGuard): Promise<void>;

  /**
   * Hard delete. Idempotent when the source is already absent — a
   * record that does not exist cannot have a newer revision to
   * overwrite — but guarded whenever one is present.
   */
  delete(id: EntityId, guard: ConcurrencyGuard): Promise<void>;

  // Book details.
  // BookDetails and ArtworkDetails are unrevisioned satellite records
  // keyed by sourceId, so there is no revision for a guard to check.
  getBookDetails(sourceId: EntityId): Promise<BookDetails | null>;
  upsertBookDetails(sourceId: EntityId, input: CreateBookDetailsInput): Promise<BookDetails>;
  // Artwork details
  getArtworkDetails(sourceId: EntityId): Promise<ArtworkDetails | null>;
  upsertArtworkDetails(sourceId: EntityId, input: Partial<ArtworkDetails>): Promise<ArtworkDetails>;
}
