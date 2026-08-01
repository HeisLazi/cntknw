/**
 * INV-005 as a property of the data, not of a render.
 *
 * "An empty page creates no visible journal section" is the invariant
 * that makes a continuous journal over a four-hundred-page book
 * readable at all. Testing it here rather than in a component means
 * it holds for every view that groups blocks — journal, outline,
 * cards, map (INV-006) — instead of once, in whichever one happened
 * to be written first.
 */
import { describe, it, expect } from 'vitest';
import {
  groupBlocksByLocation,
  groupForPage,
  nearestGroupAtOrBefore,
  pagesWithWriting,
} from './grouping';
import type { JournalBlock } from './journal.schemas';
import { createEntityId } from '@lib/id';

const journalId = createEntityId();
const sourceId = createEntityId();

function block(
  rank: string,
  page: number | undefined,
  text = 'x',
): JournalBlock {
  const now = new Date().toISOString();
  return {
    id: createEntityId(),
    journalId,
    kind: 'paragraph',
    rank,
    content: { type: 'paragraph', text },
    conceptIds: [],
    provenance: 'user',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    ...(page === undefined
      ? {}
      : { sourceLocation: { sourceType: 'book' as const, sourceId, pdf: { page } } }),
  };
}

describe('groupBlocksByLocation', () => {
  it('produces no group for a page with no writing (INV-005, AC-004)', () => {
    // The whole point. Three notes across a 400-page book must be
    // three sections, not four hundred.
    const groups = groupBlocksByLocation([
      block('a', 5),
      block('b', 120),
      block('c', 398),
    ]);
    expect(groups).toHaveLength(3);
    expect(pagesWithWriting(groups)).toEqual([5, 120, 398]);
  });

  it('returns nothing at all for an empty journal', () => {
    expect(groupBlocksByLocation([])).toEqual([]);
  });

  it('orders groups by page, not by insertion', () => {
    // Blocks arrive in whatever order the repository returns them.
    // A journal that showed page 200 above page 5 would be unusable.
    const groups = groupBlocksByLocation([
      block('a', 200),
      block('b', 5),
      block('c', 50),
    ]);
    expect(pagesWithWriting(groups)).toEqual([5, 50, 200]);
  });

  it('orders blocks within a page by rank', () => {
    // Rank is base-62 fractional indexing, so inserting between two
    // blocks never renumbers the others.
    const groups = groupBlocksByLocation([
      block('c', 7, 'third'),
      block('a', 7, 'first'),
      block('b', 7, 'second'),
    ]);
    expect(groups).toHaveLength(1);
    expect(
      groups[0]!.blocks.map((b) =>
        b.content.type === 'paragraph' ? b.content.text : '',
      ),
    ).toEqual(['first', 'second', 'third']);
  });

  it('keeps blocks with no page rather than dropping them', () => {
    // A note about the book as a whole is real writing. Silently
    // discarding it, or filing it under page 1, would both be wrong.
    const groups = groupBlocksByLocation([block('a', 3), block('b', undefined)]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.key === 'unplaced')?.blocks).toHaveLength(1);
  });

  it('sorts unplaced blocks last, not first', () => {
    // They are commentary on the whole work. Above page 1 they would
    // make the journal open on its least specific content.
    const groups = groupBlocksByLocation([block('a', undefined), block('b', 1)]);
    expect(groups.map((g) => g.key)).toEqual(['page-1', 'unplaced']);
  });

  it('does not filter deleted blocks — that is the caller\'s decision', () => {
    // A function that silently discarded records would make the trash
    // view impossible to write correctly.
    const deleted = { ...block('a', 4), deletedAt: new Date().toISOString() };
    expect(groupBlocksByLocation([deleted])).toHaveLength(1);
  });

  it('gives every group a stable key', () => {
    const groups = groupBlocksByLocation([block('a', 12), block('b', undefined)]);
    expect(groups.map((g) => g.key)).toEqual(['page-12', 'unplaced']);
  });
});

describe('groupForPage', () => {
  it('returns null for a page with no writing, never an empty group', () => {
    // Making the empty case unrepresentable is cheaper than
    // remembering to check for it at every call site.
    const groups = groupBlocksByLocation([block('a', 5)]);
    expect(groupForPage(groups, 6)).toBeNull();
    expect(groupForPage(groups, 5)?.blocks).toHaveLength(1);
  });
});

describe('nearestGroupAtOrBefore', () => {
  it('lands the reader in context rather than in blank space', () => {
    const groups = groupBlocksByLocation([block('a', 10), block('b', 40)]);
    expect(nearestGroupAtOrBefore(groups, 25)?.page).toBe(10);
    expect(nearestGroupAtOrBefore(groups, 40)?.page).toBe(40);
    expect(nearestGroupAtOrBefore(groups, 99)?.page).toBe(40);
  });

  it('returns null when nothing has been written yet at or before', () => {
    const groups = groupBlocksByLocation([block('a', 50)]);
    expect(nearestGroupAtOrBefore(groups, 10)).toBeNull();
  });

  it('ignores unplaced blocks when finding a page neighbour', () => {
    const groups = groupBlocksByLocation([block('a', undefined), block('b', 8)]);
    expect(nearestGroupAtOrBefore(groups, 20)?.page).toBe(8);
  });
});
