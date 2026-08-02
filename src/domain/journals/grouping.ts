/**
 * Grouping a continuous journal by where its writing happened.
 *
 * INV-003 gives each source **one** journal — not a notebook per
 * chapter, not a page of notes per page of book. One scroll, from the
 * first page to the last.
 *
 * INV-005 and AC-004 then say the thing that makes that bearable:
 * **an empty page creates no visible section.** A four-hundred-page
 * book with notes on eleven pages shows eleven sections, not four
 * hundred headers with silence between them. That is the difference
 * between a journal and a spreadsheet with a row per page.
 *
 * This is a pure function over blocks, deliberately: the rule is a
 * property of the content, not of the component that draws it, and it
 * is far easier to be certain about here than inside a render.
 */
import type { JournalBlock } from './journal.schemas';
import { compareRank } from '../../lib/rank';

/**
 * Blocks that share a location, in reading order.
 *
 * `page` is absent for blocks with no page — a note about the book as
 * a whole rather than about a passage in it. Those are real and must
 * not be silently dropped into page 1.
 */
export interface JournalGroup {
  /** Stable key for rendering. `page-12`, or `unplaced`. */
  key: string;
  /** 1-based page, or undefined for a block with no page context. */
  page: number | undefined;
  blocks: JournalBlock[];
}

function pageOf(block: JournalBlock): number | undefined {
  const page = block.sourceLocation?.pdf?.page;
  return typeof page === 'number' ? page : undefined;
}

/**
 * Group live blocks by page, in page order, dropping nothing.
 *
 * Deleted blocks are **not** filtered here. The caller decides
 * whether it is showing the journal or the trash, and a function that
 * silently discarded records would make the trash view impossible to
 * write correctly.
 *
 * Unplaced blocks sort last rather than first: they are commentary on
 * the whole work, and putting them above page 1 would make the
 * journal open on the least specific thing in it.
 */
export function groupBlocksByLocation(
  blocks: readonly JournalBlock[],
): JournalGroup[] {
  const byPage = new Map<number, JournalBlock[]>();
  const unplaced: JournalBlock[] = [];

  for (const block of blocks) {
    const page = pageOf(block);
    if (page === undefined) {
      unplaced.push(block);
      continue;
    }
    const existing = byPage.get(page);
    if (existing) existing.push(block);
    else byPage.set(page, [block]);
  }

  const groups: JournalGroup[] = [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, pageBlocks]) => ({
      key: `page-${page}`,
      page,
      // Rank is the ordering within a page — fractional indexing, so
      // inserting between two blocks never renumbers the others.
      blocks: [...pageBlocks].sort((a, b) => compareRank(a.rank, b.rank)),
    }));

  if (unplaced.length > 0) {
    groups.push({
      key: 'unplaced',
      page: undefined,
      blocks: [...unplaced].sort((a, b) => compareRank(a.rank, b.rank)),
    });
  }

  return groups;
}

/**
 * The group a page belongs to, or `null` when nothing is written there.
 *
 * `null` rather than an empty group, so a caller cannot accidentally
 * render a heading for a page with no writing — the exact thing
 * INV-005 forbids. Making the empty case unrepresentable is cheaper
 * than remembering to check for it.
 */
export function groupForPage(
  groups: readonly JournalGroup[],
  page: number,
): JournalGroup | null {
  return groups.find((group) => group.page === page) ?? null;
}

/**
 * Where to jump to, given a page the reader is on.
 *
 * A continuous journal scrolled to a page with no writing should
 * settle at the nearest writing *before* it, so the reader lands in
 * context rather than in blank space. Returns `null` when nothing has
 * been written at or before this page.
 */
export function nearestGroupAtOrBefore(
  groups: readonly JournalGroup[],
  page: number,
): JournalGroup | null {
  let best: JournalGroup | null = null;
  for (const group of groups) {
    if (group.page === undefined) continue;
    if (group.page <= page && (best === null || group.page > (best.page ?? -1))) {
      best = group;
    }
  }
  return best;
}

/** Pages that have writing, ascending. For an outline or a scrollbar. */
export function pagesWithWriting(groups: readonly JournalGroup[]): number[] {
  return groups
    .map((group) => group.page)
    .filter((page): page is number => page !== undefined);
}
