import type { JournalRepository } from '@data/repositories/JournalRepository';
import type {
  EntityId,
  SourceLocation,
  BlockContentInput,
  BlockKind,
  JournalBlock,
} from '@domain/index';
import { rankAfter } from '@lib/rank';

export interface CreateBlockDeps {
  journals: JournalRepository;
}

export interface CreatePageLinkedBlockInput {
  sourceId: EntityId;
  /**
   * Supplied by the workspace context, never asked of the user.
   * This is INV-004 and AC-003: content created while page 5 is
   * active belongs to page 5 automatically.
   */
  sourceLocation: SourceLocation;
  /**
   * Content as the caller supplies it. Defaulted fields such as
   * `resolved` and `supportingBlockIds` stay optional here and are
   * applied when the repository parses the input.
   */
  content: BlockContentInput;
  kind: BlockKind;
  /** Insert directly after this block. Omit to append. */
  afterBlockId?: EntityId;
}

export async function createPageLinkedBlock(
  deps: CreateBlockDeps,
  input: CreatePageLinkedBlockInput,
): Promise<JournalBlock> {
  const journal = await deps.journals.getOrCreateJournalForSource(
    input.sourceId,
    'Journal',
  );

  // Rank against the blocks already on this page, so a new block
  // lands inside its page group rather than at the end of the whole
  // journal. Page sections are computed by grouping on location
  // (PDD §22.3), so ordering only has to be correct within the page.
  const page = input.sourceLocation.pdf?.page;
  const siblings =
    page === undefined
      ? await deps.journals.listBlocks(journal.id)
      : await deps.journals.listBlocksByPage(journal.id, page);

  const siblingRanks = siblings.map((b) => b.rank);

  let anchorRank: string | null = null;
  if (input.afterBlockId !== undefined) {
    const anchor = siblings.find((b) => b.id === input.afterBlockId);
    anchorRank = anchor?.rank ?? null;
  } else if (siblingRanks.length > 0) {
    // Append: anchor to the last sibling.
    anchorRank = [...siblingRanks].sort().at(-1) ?? null;
  }

  // The previous implementation returned a timestamp plus random
  // suffix and ignored afterBlockId entirely, so inserting between
  // two blocks was impossible (audit defect A-9).
  const rank = rankAfter(anchorRank, siblingRanks);

  return deps.journals.createBlock({
    journalId: journal.id,
    kind: input.kind,
    sourceLocation: input.sourceLocation,
    rank,
    content: input.content,
  });
}
