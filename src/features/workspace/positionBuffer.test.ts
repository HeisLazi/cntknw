import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  stashPosition,
  recoverPosition,
  clearPosition,
} from './positionBuffer';

describe('positionBuffer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('stashPosition(A) and stashPosition(B) remain scoped', () => {
    stashPosition('sourceA', 10, 1.5);
    stashPosition('sourceB', 20, 2.0);

    const recoveredA = recoverPosition('sourceA');
    expect(recoveredA).toEqual({
      sourceId: 'sourceA',
      page: 10,
      zoom: 1.5,
      savedAt: expect.any(Number),
    });

    const recoveredB = recoverPosition('sourceB');
    expect(recoveredB).toEqual({
      sourceId: 'sourceB',
      page: 20,
      zoom: 2.0,
      savedAt: expect.any(Number),
    });
  });

  test('clearPosition(A) clears A but leaves B intact', () => {
    stashPosition('sourceA', 10, 1.5);
    stashPosition('sourceB', 20, 2.0);

    clearPosition('sourceA');

    expect(recoverPosition('sourceA')).toBeNull();
    expect(recoverPosition('sourceB')).not.toBeNull();
  });

  test('ignores malformed records', () => {
    localStorage.setItem('cntknw:reading-position:v1:sourceC', 'not json');
    expect(recoverPosition('sourceC')).toBeNull();

    localStorage.setItem(
      'cntknw:reading-position:v1:sourceD',
      JSON.stringify({ zoom: 1.5 }) // missing page and sourceId
    );
    expect(recoverPosition('sourceD')).toBeNull();
  });

  test('expires old records', () => {
    const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;
    
    stashPosition('sourceE', 5, 1);
    
    // Fast forward exactly 7 days
    vi.advanceTimersByTime(SEVEN_DAYS_MS);
    expect(recoverPosition('sourceE')).not.toBeNull();
    
    // Fast forward past the expiration limit
    vi.advanceTimersByTime(1);
    expect(recoverPosition('sourceE')).toBeNull();
  });
});
