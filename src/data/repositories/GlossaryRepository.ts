import type {
  EntityId,
  GlossaryEntry,
  CreateGlossaryEntryInput,
} from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

export interface GlossaryRepository {
  getById(id: EntityId): Promise<GlossaryEntry | null>;
  getAll(): Promise<GlossaryEntry[]>;
  findByTerm(term: string, language?: string): Promise<GlossaryEntry | null>;
  create(input: CreateGlossaryEntryInput): Promise<GlossaryEntry>;

  /** @param guard mandatory — see ADR-0003. */
  update(
    id: EntityId,
    updates: Partial<GlossaryEntry>,
    guard: ConcurrencyGuard,
  ): Promise<GlossaryEntry>;

  /** Idempotent when already absent; guarded whenever present. */
  delete(id: EntityId, guard: ConcurrencyGuard): Promise<void>;

  /**
   * Every term with a stored pronunciation, for the future Read
   * Aloud substitution pass (RA-014). No playback in this phase.
   */
  listPronunciations(): Promise<GlossaryEntry[]>;
}
