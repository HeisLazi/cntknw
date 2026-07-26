import type {
  EntityId,
  Concept,
  CreateConceptInput,
} from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

export interface ConceptRepository {
  getById(id: EntityId): Promise<Concept | null>;
  getAll(): Promise<Concept[]>;
  findByTitle(title: string): Promise<Concept | null>;
  create(input: CreateConceptInput): Promise<Concept>;

  /** @param guard mandatory — see ADR-0003. */
  update(
    id: EntityId,
    updates: Partial<Concept>,
    guard: ConcurrencyGuard,
  ): Promise<Concept>;

  /** Idempotent when already absent; guarded whenever present. */
  delete(id: EntityId, guard: ConcurrencyGuard): Promise<void>;
}
