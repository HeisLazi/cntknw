import type {
  EntityId,
  Journal,
  JournalBlock,
  CreateJournalInput,
  CreateBlockInput,
  UpdateBlockInput,
  MoveBlockInput,
} from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface JournalRepository {
  getJournalForSource(sourceId: EntityId): Promise<Journal | null>;
  getOrCreateJournalForSource(sourceId: EntityId, title: string): Promise<Journal>;
  getJournalById(id: EntityId): Promise<Journal | null>;
  createJournal(input: CreateJournalInput): Promise<Journal>;

  /** Live blocks only. Soft-deleted blocks are excluded. */
  listBlocks(journalId: EntityId): Promise<JournalBlock[]>;
  listBlocksByPage(journalId: EntityId, page: number): Promise<JournalBlock[]>;
  getBlockById(id: EntityId): Promise<JournalBlock | null>;

  createBlock(input: CreateBlockInput): Promise<JournalBlock>;
  updateBlock(
    input: UpdateBlockInput,
    expectedRevision?: ExpectedRevision,
  ): Promise<JournalBlock>;
  moveBlock(input: MoveBlockInput): Promise<void>;

  /**
   * Marks the block deleted. The record is retained so it can be
   * restored — PDD §19.3 and NFR-008 require a recovery path for
   * every destructive action.
   */
  softDeleteBlock(blockId: EntityId): Promise<void>;
  restoreBlock(blockId: EntityId): Promise<void>;
  listDeletedBlocks(journalId: EntityId): Promise<JournalBlock[]>;

  /** Live blocks only, matching listBlocks. */
  getBlockCount(journalId: EntityId): Promise<number>;

  transact<T>(operation: () => Promise<T>): Promise<T>;
}
