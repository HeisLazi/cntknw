import type { EntityId, WorkspaceState } from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface WorkspaceStateRepository {
  getBySource(sourceId: EntityId): Promise<WorkspaceState | null>;
  /**
   * One state per source, keyed by `sourceId`.
   *
   * `expectedRevision` guards against a background autosave landing
   * on top of a newer state written by the workspace itself — the
   * clearest case for the check, because the read and the write are
   * separated by user time.
   */
  upsert(
    state: WorkspaceState,
    expectedRevision?: ExpectedRevision,
  ): Promise<WorkspaceState>;
  delete(sourceId: EntityId): Promise<void>;
}
