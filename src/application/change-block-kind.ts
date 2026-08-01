import type { JournalRepository } from '@data/repositories/JournalRepository';
import type { ConcurrencyGuard } from '@data/repositories/concurrency';
import { expectedRevision } from '@data/repositories/concurrency';
import { canChangeKind, contentForKind } from '@domain/journals/transform';
import type { BlockKind, EntityId, JournalBlock } from '@domain/index';

export interface ChangeBlockKindDeps {
  journals: JournalRepository;
}

export class BlockKindChangeRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockKindChangeRefused';
  }
}

export interface ChangeBlockKindResult {
  block: JournalBlock;
  /** True when the block was already of the requested kind. */
  unchanged: boolean;
}

/**
 * Change a block's kind in place. PDD §7.5.
 *
 * **Transform, never recreate.** The block keeps its id, rank, source
 * location, revision history, concept links, promotion to an
 * epistemic claim, and — crucially — every `Connection` pointing at
 * it (INV-007). Deleting and recreating would sever all of them
 * silently, and a broken backlink is not something a user notices
 * until the moment they need it.
 *
 * Refuses rather than destroys. Converting a drawing to a paragraph
 * cannot carry the drawing, so it does not happen; the caller is told
 * what would have been lost.
 *
 * @param guard mandatory — ADR-0003. The read that produced
 *   `block.revision` happened before this call, so the window is
 *   real: a menu can sit open for as long as the user likes.
 */
export async function changeBlockKind(
  deps: ChangeBlockKindDeps,
  blockId: EntityId,
  to: BlockKind,
  guard?: ConcurrencyGuard,
): Promise<ChangeBlockKindResult> {
  const block = await deps.journals.getBlockById(blockId);
  if (!block) throw new BlockKindChangeRefused(`Block ${blockId} not found`);
  if (block.deletedAt !== undefined) {
    throw new BlockKindChangeRefused('That block is deleted.');
  }

  if (block.kind === to && block.content.type === to) {
    return { block, unchanged: true };
  }

  const verdict = canChangeKind(block.content, to);
  if (!verdict.ok) throw new BlockKindChangeRefused(verdict.reason);

  const updated = await deps.journals.updateBlock(
    { id: blockId, kind: to, content: contentForKind(block.content, to) },
    // Defaults to the revision just read. A caller holding an older
    // one — a menu opened before an autosave landed — passes its own,
    // which is the entire point of the guard being explicit.
    guard ?? expectedRevision(block.revision),
  );

  return { block: updated, unchanged: false };
}
