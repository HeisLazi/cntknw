import type {
  EntityId,
  Journal,
  JournalBlock,
  CreateJournalInput,
  CreateBlockInput,
  UpdateBlockInput,
  MoveBlockInput,
} from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

export interface JournalRepository {
  getJournalForSource(sourceId: EntityId): Promise<Journal | null>;
  getOrCreateJournalForSource(sourceId: EntityId, title: string): Promise<Journal>;
  getJournalById(id: EntityId): Promise<Journal | null>;
  createJournal(input: CreateJournalInput): Promise<Journal>;

  // Journal itself is revisioned but has no mutating method in this
  // phase — a journal is created with a source and never edited or
  // deleted through this interface. There is therefore no unguarded
  // write path to close. Any future updateJournal/deleteJournal must
  // take a ConcurrencyGuard (ADR-0003).

  /** Live blocks only. Soft-deleted blocks are excluded. */
  listBlocks(journalId: EntityId): Promise<JournalBlock[]>;
  listBlocksByPage(journalId: EntityId, page: number): Promise<JournalBlock[]>;
  getBlockById(id: EntityId): Promise<JournalBlock | null>;

  createBlock(input: CreateBlockInput): Promise<JournalBlock>;

  /** @param guard mandatory — see ADR-0003. */
  updateBlock(
    input: UpdateBlockInput,
    guard: ConcurrencyGuard,
  ): Promise<JournalBlock>;

  /** Reordering rewrites the block and bumps its revision. */
  moveBlock(input: MoveBlockInput, guard: ConcurrencyGuard): Promise<void>;

  /**
   * Marks the block deleted. The record is retained so it can be
   * restored — PDD §19.3 and NFR-008 require a recovery path for
   * every destructive action.
   *
   * Idempotent when the block is already absent; guarded whenever it
   * is present.
   */
  softDeleteBlock(blockId: EntityId, guard: ConcurrencyGuard): Promise<void>;
  restoreBlock(blockId: EntityId, guard: ConcurrencyGuard): Promise<void>;
  listDeletedBlocks(journalId: EntityId): Promise<JournalBlock[]>;

  /** Live blocks only, matching listBlocks. */
  getBlockCount(journalId: EntityId): Promise<number>;

  transact<T>(operation: () => Promise<T>): Promise<T>;
}
