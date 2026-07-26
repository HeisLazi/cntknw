import { describe, it, expect } from 'vitest';
import {
  rankBetween,
  rankAfter,
  rankAfterAll,
  rankBeforeAll,
  compareRank,
  endsInLowestDigit,
  INITIAL_RANK,
} from './rank';

describe('rankBetween', () => {
  it('returns the initial rank when both bounds are open', () => {
    expect(rankBetween(null, null)).toBe(INITIAL_RANK);
  });

  it('produces a rank strictly between two adjacent-looking ranks', () => {
    const mid = rankBetween('a', 'b');
    expect(mid > 'a').toBe(true);
    expect(mid < 'b').toBe(true);
  });

  it('produces a rank before an open start', () => {
    const before = rankBetween(null, 'b');
    expect(before < 'b').toBe(true);
  });

  it('produces a rank after an open end', () => {
    const after = rankBetween('a', null);
    expect(after > 'a').toBe(true);
  });

  it('rejects reversed bounds', () => {
    expect(() => rankBetween('b', 'a')).toThrow();
  });

  it('rejects equal bounds', () => {
    expect(() => rankBetween('a', 'a')).toThrow();
  });

  it('survives repeated insertion at the same position', () => {
    // The case that breaks naive integer or timestamp ranking:
    // inserting over and over between the same two neighbours.
    let low = 'a';
    const high = 'b';
    const produced: string[] = [];
    for (let i = 0; i < 60; i++) {
      const next = rankBetween(low, high);
      expect(next > low).toBe(true);
      expect(next < high).toBe(true);
      produced.push(next);
      low = next;
    }
    expect(new Set(produced).size).toBe(produced.length);
  });

  it('survives repeated insertion at the head', () => {
    // The case that exposed the floor bug: a rank ending in the
    // lowest digit has nothing that can precede it, because every
    // extension of it sorts after it.
    let head = INITIAL_RANK;
    for (let i = 0; i < 40; i++) {
      const next = rankBetween(null, head);
      expect(next < head).toBe(true);
      head = next;
    }
  });

  it('never produces a rank ending in the lowest digit', () => {
    // The invariant the whole algorithm exists to maintain.
    const produced: string[] = [];

    let head = INITIAL_RANK;
    for (let i = 0; i < 40; i++) {
      head = rankBetween(null, head);
      produced.push(head);
    }

    let tail = INITIAL_RANK;
    for (let i = 0; i < 40; i++) {
      tail = rankBetween(tail, null);
      produced.push(tail);
    }

    let low = 'a';
    for (let i = 0; i < 40; i++) {
      low = rankBetween(low, 'b');
      produced.push(low);
    }

    for (const rank of produced) {
      expect(endsInLowestDigit(rank)).toBe(false);
    }
  });

  it('can still insert before a rank that begins with the lowest digit', () => {
    // '0' is fine inside a rank — only a trailing '0' is a floor.
    const low = rankBetween(null, '01');
    expect(low < '01').toBe(true);
    expect(endsInLowestDigit(low)).toBe(false);
  });

  it('survives repeated insertion at the tail', () => {
    let tail = INITIAL_RANK;
    for (let i = 0; i < 40; i++) {
      const next = rankBetween(tail, null);
      expect(next > tail).toBe(true);
      tail = next;
    }
  });

  it('keeps lexicographic order matching insertion order', () => {
    const first = rankBetween(null, null);
    const third = rankBetween(first, null);
    const second = rankBetween(first, third);
    const sorted = [third, first, second].sort();
    expect(sorted).toEqual([first, second, third]);
  });
});

describe('rankAfterAll / rankBeforeAll', () => {
  it('returns the initial rank for an empty set', () => {
    expect(rankAfterAll([])).toBe(INITIAL_RANK);
    expect(rankBeforeAll([])).toBe(INITIAL_RANK);
  });

  it('sorts after every existing rank', () => {
    const existing = ['A', 'M', 'z'];
    const next = rankAfterAll(existing);
    for (const rank of existing) expect(next > rank).toBe(true);
  });

  it('sorts before every existing rank', () => {
    const existing = ['A', 'M', 'z'];
    const next = rankBeforeAll(existing);
    for (const rank of existing) expect(next < rank).toBe(true);
  });
});

describe('rankAfter', () => {
  it('inserts at the head when the anchor is null', () => {
    const siblings = ['b', 'd', 'f'];
    const next = rankAfter(null, siblings);
    expect(next < 'b').toBe(true);
  });

  it('inserts between the anchor and the following sibling', () => {
    const siblings = ['b', 'd', 'f'];
    const next = rankAfter('b', siblings);
    expect(next > 'b').toBe(true);
    expect(next < 'd').toBe(true);
  });

  it('appends when the anchor is the last sibling', () => {
    const siblings = ['b', 'd', 'f'];
    const next = rankAfter('f', siblings);
    expect(next > 'f').toBe(true);
  });

  it('appends rather than guessing when the anchor is unknown', () => {
    const siblings = ['b', 'd', 'f'];
    const next = rankAfter('zzz-not-present', siblings);
    for (const rank of siblings) expect(next > rank).toBe(true);
  });

  it('handles an empty sibling set', () => {
    expect(rankAfter(null, [])).toBe(INITIAL_RANK);
  });
});

describe('compareRank', () => {
  it('orders ranks lexicographically', () => {
    expect(compareRank('a', 'b')).toBe(-1);
    expect(compareRank('b', 'a')).toBe(1);
    expect(compareRank('a', 'a')).toBe(0);
  });

  it('sorts a shuffled list back into rank order', () => {
    const a = rankBetween(null, null);
    const b = rankBetween(a, null);
    const c = rankBetween(b, null);
    const shuffled = [c, a, b];
    expect([...shuffled].sort(compareRank)).toEqual([a, b, c]);
  });
});
