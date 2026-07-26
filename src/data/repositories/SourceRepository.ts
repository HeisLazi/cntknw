import type { EntityId, Source, BookDetails, ArtworkDetails, CreateSourceInput, CreateBookDetailsInput } from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface SourceRepository {
  getById(id: EntityId): Promise<Source | null>;
  getAll(): Promise<Source[]>;
  getActive(): Promise<Source[]>; // non-archived
  getByType(type: 'book' | 'artwork'): Promise<Source[]>;
  create(input: CreateSourceInput): Promise<Source>;
  update(
    id: EntityId,
    updates: Partial<Source>,
    expectedRevision?: ExpectedRevision,
  ): Promise<Source>;
  archive(id: EntityId): Promise<void>;
  unarchive(id: EntityId): Promise<void>;
  delete(id: EntityId): Promise<void>;
  // Book details
  getBookDetails(sourceId: EntityId): Promise<BookDetails | null>;
  upsertBookDetails(sourceId: EntityId, input: CreateBookDetailsInput): Promise<BookDetails>;
  // Artwork details
  getArtworkDetails(sourceId: EntityId): Promise<ArtworkDetails | null>;
  upsertArtworkDetails(sourceId: EntityId, input: Partial<ArtworkDetails>): Promise<ArtworkDetails>;
}
