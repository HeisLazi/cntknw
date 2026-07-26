import type { EntityId, StudySession, CreateSessionInput } from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

export interface SessionRepository {
  getById(id: EntityId): Promise<StudySession | null>;
  getBySource(sourceId: EntityId): Promise<StudySession[]>;
  getAll(): Promise<StudySession[]>;
  create(input: CreateSessionInput): Promise<StudySession>;

  /**
   * A session accumulates focused and listened seconds while it is
   * open, so it is the mutable record a running timer writes back
   * to. Its read and its write are separated by user time, which is
   * exactly the window a guard exists to close.
   *
   * @param guard mandatory — see ADR-0003.
   */
  update(
    id: EntityId,
    updates: Partial<StudySession>,
    guard: ConcurrencyGuard,
  ): Promise<StudySession>;

  /** Idempotent when already absent; guarded whenever present. */
  delete(id: EntityId, guard: ConcurrencyGuard): Promise<void>;
}
