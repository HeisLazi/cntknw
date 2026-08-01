/**
 * The crash-recovery buffer.
 *
 * Its whole value is behaviour under failure, so that is what these
 * test: that it survives being read back, that it never becomes a
 * second source of truth, and — most importantly — that a broken or
 * unavailable `localStorage` degrades to "no recovery" rather than to
 * "the journal will not open".
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { clearDraft, recoverDrafts, stashDraft } from './draftBuffer';

const BLOCK = 'a1b2c3d4-0000-4000-8000-000000000001';
const OTHER = 'a1b2c3d4-0000-4000-8000-000000000002';

describe('draftBuffer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('round-trips a draft', () => {
    stashDraft({ blockId: BLOCK, doc: { type: 'doc' }, text: 'unsaved words' });
    const recovered = recoverDrafts();
    expect(recovered.get(BLOCK)?.text).toBe('unsaved words');
  });

  it('keeps drafts for different blocks apart', () => {
    stashDraft({ blockId: BLOCK, doc: {}, text: 'first' });
    stashDraft({ blockId: OTHER, doc: {}, text: 'second' });
    const recovered = recoverDrafts();
    expect(recovered.get(BLOCK)?.text).toBe('first');
    expect(recovered.get(OTHER)?.text).toBe('second');
  });

  it('replaces an earlier draft for the same block', () => {
    stashDraft({ blockId: BLOCK, doc: {}, text: 'old' });
    stashDraft({ blockId: BLOCK, doc: {}, text: 'new' });
    expect(recoverDrafts().get(BLOCK)?.text).toBe('new');
    expect(recoverDrafts().size).toBe(1);
  });

  it('forgets a draft once its durable write succeeds', () => {
    // The buffer must empty itself in normal operation. A buffer that
    // accumulates is a second source of truth, which is exactly what
    // it must not become.
    stashDraft({ blockId: BLOCK, doc: {}, text: 'in flight' });
    clearDraft(BLOCK);
    expect(recoverDrafts().size).toBe(0);
    expect(localStorage.getItem('cntknw:journal-drafts:v1')).toBeNull();
  });

  it('does not clear on read — recovery may itself fail', () => {
    // Clearing on read would lose the words a second time if the
    // recovery write also failed.
    stashDraft({ blockId: BLOCK, doc: {}, text: 'still needed' });
    recoverDrafts();
    expect(recoverDrafts().get(BLOCK)?.text).toBe('still needed');
  });

  it('discards implausibly stale drafts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    stashDraft({ blockId: BLOCK, doc: {}, text: 'ancient' });

    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    expect(recoverDrafts().size).toBe(0);
  });

  it('survives a corrupt stored value', () => {
    localStorage.setItem('cntknw:journal-drafts:v1', 'not json at all');
    expect(() => recoverDrafts()).not.toThrow();
    expect(recoverDrafts().size).toBe(0);
  });

  it('discards entries of the wrong shape rather than replaying them', () => {
    localStorage.setItem(
      'cntknw:journal-drafts:v1',
      JSON.stringify({ [BLOCK]: { blockId: BLOCK, text: 42 } }),
    );
    expect(recoverDrafts().size).toBe(0);
  });

  it('degrades to no recovery when localStorage is unavailable', () => {
    // Private browsing, a storage quota, a disabled API. A failure to
    // buffer must never be a failure to edit — recovery is a bonus.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(() => stashDraft({ blockId: BLOCK, doc: {}, text: 'x' })).not.toThrow();
    expect(() => recoverDrafts()).not.toThrow();
    expect(() => clearDraft(BLOCK)).not.toThrow();
    expect(recoverDrafts().size).toBe(0);
  });
});
