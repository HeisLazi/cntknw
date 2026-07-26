import type {
  EntityId,
  EpistemicClaim,
  CreateEpistemicClaimInput,
  KnowledgeStatus,
} from '@domain/index';
import type { ExpectedRevision } from './concurrency';

export interface EpistemicClaimRepository {
  getById(id: EntityId): Promise<EpistemicClaim | null>;
  getAll(): Promise<EpistemicClaim[]>;
  getByStatus(status: KnowledgeStatus): Promise<EpistemicClaim[]>;

  /**
   * Claims promoted from a given journal block. A block promotes to
   * at most one claim, but a claim may originate from several
   * blocks, so this is a lookup rather than a direct field read.
   */
  getByOriginBlock(blockId: EntityId): Promise<EpistemicClaim[]>;

  /** Rival answers to the same question, grouped by thread. */
  getByInterpretationThread(thread: string): Promise<EpistemicClaim[]>;

  create(input: CreateEpistemicClaimInput): Promise<EpistemicClaim>;
  update(
    id: EntityId,
    updates: Partial<EpistemicClaim>,
    expectedRevision?: ExpectedRevision,
  ): Promise<EpistemicClaim>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
}
