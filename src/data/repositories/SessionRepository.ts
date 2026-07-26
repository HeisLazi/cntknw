import type { EntityId, StudySession, CreateSessionInput } from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface SessionRepository {
  getById(id: EntityId): Promise<StudySession | null>;
  getBySource(sourceId: EntityId): Promise<StudySession[]>;
  getAll(): Promise<StudySession[]>;
  create(input: CreateSessionInput): Promise<StudySession>;
  update(
    id: EntityId,
    updates: Partial<StudySession>,
    expectedRevision?: ExpectedRevision,
  ): Promise<StudySession>;
  delete(id: EntityId): Promise<void>;
}
