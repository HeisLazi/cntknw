import { EntityId } from '../domain';
import { Repositories } from '../data/repositories';
import { rankBetween, rankAfter } from '../lib/rank';
import { expectedRevision } from '../data/repositories/concurrency';

export async function movePageLinkedBlock(
  repositories: Repositories,
  params: {
    blockId: EntityId;
    direction: 'up' | 'down';
  }
): Promise<void> {
  await repositories.journals.transact(async () => {
    const block = await repositories.journals.getBlockById(params.blockId);
    if (!block || block.deletedAt) return; // Cannot move missing or deleted block

    if (!block.sourceLocation?.pdf?.page) return; // Must be page-linked

    // Find live siblings on the same page
    const journalId = block.journalId;
    let siblings = await repositories.journals.listBlocksByPage(journalId, block.sourceLocation.pdf.page);
    siblings = siblings.filter(b => !b.deletedAt);
    
    // Sort siblings by rank
    siblings.sort((a, b) => a.rank.localeCompare(b.rank));
    
    const index = siblings.findIndex(b => b.id === params.blockId);
    if (index === -1) return;

    let newRank: string;
    if (params.direction === 'up') {
      if (index === 0) return; // Already at top
      const prev = siblings[index - 1]!;
      const prevPrev = siblings[index - 2];
      newRank = prevPrev ? rankBetween(prevPrev.rank, prev.rank) : rankBetween(null, prev.rank);
    } else {
      if (index === siblings.length - 1) return; // Already at bottom
      const next = siblings[index + 1]!;
      const nextNext = siblings[index + 2];
      newRank = nextNext ? rankBetween(next.rank, nextNext.rank) : rankAfter(next.id, siblings);
    }

    await repositories.journals.updateBlock({
      id: block.id,
      rank: newRank,
    }, expectedRevision(block.revision));
  });
}
