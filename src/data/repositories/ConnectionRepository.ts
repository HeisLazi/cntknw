import type { EntityId, Connection, CreateConnectionInput, Reference } from '@domain/index';

export interface ConnectionRepository {
  getById(id: EntityId): Promise<Connection | null>;
  create(input: CreateConnectionInput): Promise<Connection>;
  delete(id: EntityId): Promise<void>;
  getConnectionsFrom(ref: Reference): Promise<Connection[]>;
  getConnectionsTo(ref: Reference): Promise<Connection[]>;
  getBacklinks(ref: Reference): Promise<Connection[]>;
}
