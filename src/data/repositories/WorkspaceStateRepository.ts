import type { EntityId, WorkspaceState } from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

/**
 * One workspace state per source, keyed by `sourceId`.
 *
 * The previous single `upsert` is split into `create` and `update`.
 * Under ADR-0003 a guard is mandatory on every write to a revisioned
 * record, and an upsert cannot honour that: on the insert branch
 * there is no stored revision for the caller to have read, so any
 * guard it passed would be a fiction. Splitting states the caller's
 * intent instead of inferring it from whether a row happens to
 * exist — which is the same read-then-write race the guard exists to
 * catch.
 *
 * This is the clearest case for the guard in the whole codebase: a
 * debounced autosave and the workspace itself write the same record,
 * separated by user time.
 */
export interface WorkspaceStateRepository {
  getBySource(sourceId: EntityId): Promise<WorkspaceState | null>;

  /**
   * First save for a source. No guard: there is nothing to overwrite.
   *
   * @throws RecordAlreadyExistsError if a state is already stored
   *   for this source. Silently converting to an update would
   *   reinstate last-write-wins by the back door.
   */
  create(state: WorkspaceState): Promise<WorkspaceState>;

  /**
   * Subsequent saves.
   *
   * @param guard mandatory — see ADR-0003.
   * @throws RecordNotFoundError if no state is stored yet.
   */
  update(
    state: WorkspaceState,
    guard: ConcurrencyGuard,
  ): Promise<WorkspaceState>;

  /** Idempotent when already absent; guarded whenever present. */
  delete(sourceId: EntityId, guard: ConcurrencyGuard): Promise<void>;
}
