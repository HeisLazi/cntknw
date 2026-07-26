import type { EntityId, Annotation, CreateAnnotationInput } from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

export interface AnnotationRepository {
  getById(id: EntityId): Promise<Annotation | null>;
  getBySourceAndPage(sourceId: EntityId, page: number): Promise<Annotation[]>;
  getBySource(sourceId: EntityId): Promise<Annotation[]>;
  create(input: CreateAnnotationInput): Promise<Annotation>;

  /** @param guard mandatory — see ADR-0003. */
  update(
    id: EntityId,
    updates: Partial<Annotation>,
    guard: ConcurrencyGuard,
  ): Promise<Annotation>;

  /** Idempotent when already absent; guarded whenever present. */
  delete(id: EntityId, guard: ConcurrencyGuard): Promise<void>;
}
