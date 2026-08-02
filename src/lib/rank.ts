/**
 * Fractional index ranking for journal block ordering.
 *
 * Blocks are ordered by a lexicographically-sortable string rather
 * than an integer position, so inserting between two blocks touches
 * one record instead of renumbering everything after it.
 *
 * Hand-rolled rather than taken as a dependency: the algorithm is
 * short, and Phase 0B should not add runtime packages.
 * See ADR-0001 §9.
 *
 * Alphabet is base-62 in ASCII order, so plain string comparison
 * matches rank order: '0' < '9' < 'A' < 'Z' < 'a' < 'z'.
 *
 * ── The constraint that shapes the algorithm ──
 *
 * A rank must never END in the lowest digit ('0'). Nothing can be
 * inserted before such a rank: every extension of '0' — '01', '0V',
 * '000…' — sorts AFTER '0', because a string sorts before its own
 * extensions. A trailing '0' is therefore a floor with no room
 * beneath it, and head insertion would fail permanently.
 *
 * The invariant is maintained by never emitting '0' as a final
 * digit: when the midpoint calculation lands on it, the digit is
 * emitted as a prefix and the search continues one position deeper.
 * '0' appears freely inside a rank, never at the end.
 */

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;
const ZERO_DIGIT = 0;
const MID_DIGIT = Math.floor(BASE / 2);

/** Initial rank for the first block in an empty collection. */
export const INITIAL_RANK = ALPHABET[MID_DIGIT]!;

function digitAt(rank: string, position: number): number {
  const index = ALPHABET.indexOf(rank[position]!);
  if (index < 0) {
    throw new Error(`Invalid rank character at position ${position}: ${rank}`);
  }
  return index;
}

/**
 * Produce a rank strictly between `before` and `after`.
 *
 * Pass `null` for either bound to insert at the beginning or end.
 * Passing `null` for both yields INITIAL_RANK.
 *
 * @throws if `before` is not strictly less than `after`.
 */
export function rankBetween(
  before: string | null,
  after: string | null,
): string {
  if (before !== null && after !== null && before >= after) {
    throw new Error(
      `rankBetween requires before < after (got "${before}", "${after}")`,
    );
  }
  if (before === null && after === null) return INITIAL_RANK;

  let result = '';
  let position = 0;

  // Once a digit strictly below `after`'s is placed, `after` no
  // longer constrains deeper positions — the result is already
  // smaller than it, whatever follows.
  let freeOfUpperBound = after === null;

  for (;;) {
    // -1 means "no lower constraint here". Reaching the end of
    // `before` counts: any digit appended to a prefix of `before`
    // produces a longer string, which sorts after it.
    const lower =
      before !== null && position < before.length
        ? digitAt(before, position)
        : -1;

    const upper = freeOfUpperBound
      ? BASE
      : position < after!.length
        ? digitAt(after!, position)
        : ZERO_DIGIT;

    if (upper - lower > 1) {
      const middle = lower + Math.floor((upper - lower) / 2);

      // Landing on '0' would end the rank in the lowest digit and
      // create a floor nothing can precede. Emit it as a prefix
      // and descend: the next position has no upper bound, so it
      // resolves immediately to the middle of the alphabet.
      if (middle !== ZERO_DIGIT) {
        return result + ALPHABET[middle]!;
      }
      result += ALPHABET[ZERO_DIGIT]!;
      freeOfUpperBound = true;
      position += 1;
      continue;
    }

    // The bounds are adjacent or inverted: no digit fits between
    // them here. Take the largest digit that stays within both and
    // descend a position.
    const digit = Math.max(lower, ZERO_DIGIT);
    if (digit < upper) freeOfUpperBound = true;
    result += ALPHABET[digit]!;
    position += 1;
  }
}

/** Rank that sorts after every rank in `existing`. */
export function rankAfterAll(existing: readonly string[]): string {
  if (existing.length === 0) return INITIAL_RANK;
  const max = existing.reduce((a, b) => (a >= b ? a : b));
  return rankBetween(max, null) + generateJitter();
}

/** Rank that sorts before every rank in `existing`. */
export function rankBeforeAll(existing: readonly string[]): string {
  if (existing.length === 0) return INITIAL_RANK;
  const min = existing.reduce((a, b) => (a <= b ? a : b));
  return rankBetween(null, min) + generateJitter();
}

export interface RankedItem {
  id: string;
  rank: string;
}

/**
 * Rank for inserting immediately after `anchorId` within a set of
 * siblings. When `anchorId` is null, insert at the start.
 */
export function rankAfter(
  anchorId: string | null,
  siblings: readonly RankedItem[],
): string {
  const sorted = [...siblings].sort((a, b) => compareRank(a.rank, b.rank));
  if (anchorId === null) return rankBeforeAll(sorted.map((s) => s.rank));

  const index = sorted.findIndex((s) => s.id === anchorId);
  if (index === -1) {
    // Unknown anchor: append rather than guess at a position.
    return rankAfterAll(sorted.map((s) => s.rank));
  }
  const anchor = sorted[index]!;
  const next = index + 1 < sorted.length ? sorted[index + 1]! : null;
  return rankBetween(anchor.rank, next?.rank ?? null) + generateJitter();
}

/**
 * Appends a 4-character random sequence from the base-62 alphabet.
 * This guarantees that concurrent insertions behind the same anchor
 * receive distinct ranks, eliminating identical rank collisions while
 * preserving the mathematical guarantees of fractional ordering.
 */
export function generateJitter(): string {
  let jitter = '';
  for (let i = 0; i < 4; i++) {
    jitter += ALPHABET[Math.floor(Math.random() * BASE)];
  }
  return jitter;
}

/** Comparator for sorting records by rank. */
export function compareRank(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True when a rank could never have anything inserted before it. */
export function endsInLowestDigit(rank: string): boolean {
  return rank.endsWith(ALPHABET[ZERO_DIGIT]!);
}

export const RANK_ALPHABET = ALPHABET;
