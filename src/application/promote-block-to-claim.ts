import type { JournalRepository } from '@data/repositories/JournalRepository';
import type { EpistemicClaimRepository } from '@data/repositories/EpistemicClaimRepository';
import type { UnitOfWork } from '@data/repositories/UnitOfWork';
import { expectedRevision } from '@data/repositories/concurrency';
import type {
  EntityId,
  EpistemicClaim,
  JournalBlock,
  PromoteBlockToClaimInput,
} from '@domain/index';

export interface PromoteBlockDeps {
  journals: JournalRepository;
  claims: EpistemicClaimRepository;
  unitOfWork: UnitOfWork;
}

export interface PromotionResult {
  claim: EpistemicClaim;
  block: JournalBlock;
  /** True when the block was already promoted and was reused. */
  alreadyPromoted: boolean;
}

export class BlockNotPromotableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockNotPromotableError';
  }
}

/**
 * Extract the assertable text from a block.
 *
 * Only content kinds that actually assert something can be
 * promoted. A divider or a drawing has no proposition to formalise.
 */
function statementFrom(block: JournalBlock): string | null {
  switch (block.content.type) {
    case 'claim':
    case 'paragraph':
    case 'question':
    case 'evidence':
    case 'objection':
    case 'callout':
      return block.content.text?.trim() || null;
    case 'quote':
      return block.content.quote.trim() || null;
    case 'heading':
      return block.content.text.trim() || null;
    default:
      return null;
  }
}

/**
 * Promote a journal block to a canonical EpistemicClaim.
 *
 * Promotion LINKS, it does not convert. The block keeps its id,
 * rank, source location, revision history and backlinks, and
 * remains ordinary journal content; it simply gains
 * `epistemicClaimId`. This is what lets one claim be asserted from
 * several passages across several sources — something a PDD §7.5
 * in-place transform could not express. See ADR-0001 §4.
 *
 * Nothing is promoted automatically. This runs only when the user
 * asks for it.
 */
export async function promoteBlockToClaim(
  deps: PromoteBlockDeps,
  input: PromoteBlockToClaimInput,
): Promise<PromotionResult> {
  const block = await deps.journals.getBlockById(input.blockId);
  if (!block) {
    throw new BlockNotPromotableError(`Block ${input.blockId} not found`);
  }
  if (block.deletedAt !== undefined) {
    throw new BlockNotPromotableError(
      `Block ${input.blockId} is deleted and cannot be promoted`,
    );
  }

  // Already promoted: return the existing claim rather than
  // creating a duplicate.
  if (block.epistemicClaimId !== undefined) {
    const existing = await deps.claims.getById(block.epistemicClaimId);
    if (existing) {
      return { claim: existing, block, alreadyPromoted: true };
    }
  }

  const statement = input.statement?.trim() || statementFrom(block);
  if (!statement) {
    throw new BlockNotPromotableError(
      `Block ${input.blockId} (${block.content.type}) has no assertable text`,
    );
  }

  return deps.unitOfWork.run(async () => {
    const claim = await deps.claims.create({
      statement,
      confidence: input.confidence,
      status: input.status,
      originBlockIds: [block.id],
      primaryLocation: block.sourceLocation,
    });

    // The block was read before the transaction opened, so its read
    // and its write are genuinely separated. Guarding on the revision
    // we actually saw is the point of ADR-0003: if the user edited
    // the block in between, promotion fails rather than overwriting.
    const updated = await deps.journals.updateBlock(
      {
        id: block.id,
        epistemicClaimId: claim.id,
      },
      expectedRevision(block.revision),
    );

    return { claim, block: updated, alreadyPromoted: false };
  });
}

/**
 * Attach an additional block as an origin of an existing claim —
 * the same proposition found in another passage or another source.
 */
export async function linkBlockToExistingClaim(
  deps: PromoteBlockDeps,
  blockId: EntityId,
  claimId: EntityId,
): Promise<PromotionResult> {
  const block = await deps.journals.getBlockById(blockId);
  if (!block) {
    throw new BlockNotPromotableError(`Block ${blockId} not found`);
  }
  const claim = await deps.claims.getById(claimId);
  if (!claim) {
    throw new BlockNotPromotableError(`Claim ${claimId} not found`);
  }

  return deps.unitOfWork.run(async () => {
    const originBlockIds = claim.originBlockIds.includes(blockId)
      ? claim.originBlockIds
      : [...claim.originBlockIds, blockId];

    const updatedClaim = await deps.claims.update(
      claimId,
      { originBlockIds },
      expectedRevision(claim.revision),
    );
    const updatedBlock = await deps.journals.updateBlock(
      {
        id: blockId,
        epistemicClaimId: claimId,
      },
      expectedRevision(block.revision),
    );

    return {
      claim: updatedClaim,
      block: updatedBlock,
      alreadyPromoted: block.epistemicClaimId === claimId,
    };
  });
}
