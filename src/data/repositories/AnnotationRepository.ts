import type { EntityId, Annotation, CreateAnnotationInput } from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface AnnotationRepository {
  getById(id: EntityId): Promise<Annotation | null>;
  getBySourceAndPage(sourceId: EntityId, page: number): Promise<Annotation[]>;
  getBySource(sourceId: EntityId): Promise<Annotation[]>;
  create(input: CreateAnnotationInput): Promise<Annotation>;
  update(
    id: EntityId,
    updates: Partial<Annotation>,
    expectedRevision?: ExpectedRevision,
  ): Promise<Annotation>;
  delete(id: EntityId): Promise<void>;
}
