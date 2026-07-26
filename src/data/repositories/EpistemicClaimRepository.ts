import type {
  EntityId,
  EpistemicClaim,
  CreateEpistemicClaimInput,
  KnowledgeStatus,
} from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

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

  /** @param guard mandatory — see ADR-0003. */
  update(
    id: EntityId,
    updates: Partial<EpistemicClaim>,
    guard: ConcurrencyGuard,
  ): Promise<EpistemicClaim>;

  /** Idempotent when already absent; guarded whenever present. */
  softDelete(id: EntityId, guard: ConcurrencyGuard): Promise<void>;
  restore(id: EntityId, guard: ConcurrencyGuard): Promise<void>;
}
