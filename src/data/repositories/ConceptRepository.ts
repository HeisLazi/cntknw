import type {
  EntityId,
  Concept,
  CreateConceptInput,
} from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface ConceptRepository {
  getById(id: EntityId): Promise<Concept | null>;
  getAll(): Promise<Concept[]>;
  findByTitle(title: string): Promise<Concept | null>;
  create(input: CreateConceptInput): Promise<Concept>;
  update(
    id: EntityId,
    updates: Partial<Concept>,
    expectedRevision?: ExpectedRevision,
  ): Promise<Concept>;
  delete(id: EntityId): Promise<void>;
}
