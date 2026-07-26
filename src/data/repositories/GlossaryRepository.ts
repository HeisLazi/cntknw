import type {
  EntityId,
  GlossaryEntry,
  CreateGlossaryEntryInput,
} from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface GlossaryRepository {
  getById(id: EntityId): Promise<GlossaryEntry | null>;
  getAll(): Promise<GlossaryEntry[]>;
  findByTerm(term: string, language?: string): Promise<GlossaryEntry | null>;
  create(input: CreateGlossaryEntryInput): Promise<GlossaryEntry>;
  update(
    id: EntityId,
    updates: Partial<GlossaryEntry>,
    expectedRevision?: ExpectedRevision,
  ): Promise<GlossaryEntry>;
  delete(id: EntityId): Promise<void>;

  /**
   * Every term with a stored pronunciation, for the future Read
   * Aloud substitution pass (RA-014). No playback in this phase.
   */
  listPronunciations(): Promise<GlossaryEntry[]>;
}
