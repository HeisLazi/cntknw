import type { EntityId, Connection, CreateConnectionInput, Reference } from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

export interface ConnectionRepository {
  getById(id: EntityId): Promise<Connection | null>;
  create(input: CreateConnectionInput): Promise<Connection>;

  /**
   * Connection is revisioned and has no update method in this phase
   * — a connection's endpoints and relationship are set at creation
   * and replaced rather than edited. Deleting one is still
   * destructive, so it is guarded.
   *
   * Idempotent when already absent; guarded whenever present.
   */
  delete(id: EntityId, guard: ConcurrencyGuard): Promise<void>;

  getConnectionsFrom(ref: Reference): Promise<Connection[]>;
  getConnectionsTo(ref: Reference): Promise<Connection[]>;
  getBacklinks(ref: Reference): Promise<Connection[]>;
}
