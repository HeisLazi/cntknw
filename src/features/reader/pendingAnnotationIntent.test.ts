import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityId } from '@domain/index';
import {
  clearDraftIntentsForSource,
  clearPendingIntent,
  getPendingIntent,
  pendingIntentKey,
  putPendingIntent,
  subscribePendingIntents,
  type PendingAnnotationIntent,
  type PendingIntentStatus,
} from './pendingAnnotationIntent';

const SOURCE_A = '10000000-0000-4000-8000-000000000101';
const SOURCE_B = '10000000-0000-4000-8000-000000000102';
const ASSET_A = '20000000-0000-4000-8000-000000000101';
const ASSET_B = '20000000-0000-4000-8000-000000000102';

function intent(
  sourceId: EntityId,
  assetId: EntityId,
  page: number,
  status: PendingIntentStatus = 'draft',
): PendingAnnotationIntent {
  return {
    sourceId,
    assetId,
    page,
    kind: 'highlight',
    anchor: {
      kind: 'text',
      quote: 'Recoverable selection',
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
      boundingRect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
    },
    status,
    errorMessage: status === 'failed' ? 'Not saved' : undefined,
  };
}

afterEach(() => {
  for (const sourceId of [SOURCE_A, SOURCE_B]) {
    for (const assetId of [ASSET_A, ASSET_B]) {
      for (const page of [1, 2]) clearPendingIntent(sourceId, assetId, page);
    }
  }
});

describe('pending annotation intent store', () => {
  it('isolates keys structurally across source, asset, and page', () => {
    const entries = [
      intent(SOURCE_A, ASSET_A, 1),
      intent(SOURCE_B, ASSET_A, 1),
      intent(SOURCE_A, ASSET_B, 1),
      intent(SOURCE_A, ASSET_A, 2),
    ];
    entries.forEach(putPendingIntent);

    expect(new Set(entries.map((entry) => pendingIntentKey(
      entry.sourceId,
      entry.assetId,
      entry.page,
    ))).size).toBe(4);
    entries.forEach((entry) => {
      expect(getPendingIntent(entry.sourceId, entry.assetId, entry.page)).toEqual(
        entry,
      );
    });
  });

  it('stores draft, saving, failed, retry, and clear transitions as new snapshots', () => {
    const draft = intent(SOURCE_A, ASSET_A, 1);
    putPendingIntent(draft);
    const draftSnapshot = getPendingIntent(SOURCE_A, ASSET_A, 1);
    expect(draftSnapshot).toEqual(draft);
    expect(draftSnapshot).not.toBe(draft);

    putPendingIntent({ ...draft, status: 'saving' });
    const savingSnapshot = getPendingIntent(SOURCE_A, ASSET_A, 1);
    expect(savingSnapshot?.status).toBe('saving');
    expect(savingSnapshot).not.toBe(draftSnapshot);

    putPendingIntent({ ...draft, status: 'failed', errorMessage: 'Try again' });
    const failedSnapshot = getPendingIntent(SOURCE_A, ASSET_A, 1);
    expect(failedSnapshot).toMatchObject({ status: 'failed', errorMessage: 'Try again' });

    putPendingIntent({ ...failedSnapshot!, status: 'saving', errorMessage: undefined });
    expect(getPendingIntent(SOURCE_A, ASSET_A, 1)).toMatchObject({
      status: 'saving',
      errorMessage: undefined,
    });

    clearPendingIntent(SOURCE_A, ASSET_A, 1);
    expect(getPendingIntent(SOURCE_A, ASSET_A, 1)).toBeNull();
  });

  it('clears only drafts for the requested source', () => {
    putPendingIntent(intent(SOURCE_A, ASSET_A, 1, 'draft'));
    putPendingIntent(intent(SOURCE_A, ASSET_A, 2, 'saving'));
    putPendingIntent(intent(SOURCE_A, ASSET_B, 1, 'failed'));
    putPendingIntent(intent(SOURCE_B, ASSET_A, 1, 'draft'));

    clearDraftIntentsForSource(SOURCE_A);

    expect(getPendingIntent(SOURCE_A, ASSET_A, 1)).toBeNull();
    expect(getPendingIntent(SOURCE_A, ASSET_A, 2)?.status).toBe('saving');
    expect(getPendingIntent(SOURCE_A, ASSET_B, 1)?.status).toBe('failed');
    expect(getPendingIntent(SOURCE_B, ASSET_A, 1)?.status).toBe('draft');
  });

  it('notifies subscribers on put and effective clear operations only', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingIntents(listener);

    pendingIntentKey(SOURCE_A, ASSET_A, 1);
    getPendingIntent(SOURCE_A, ASSET_A, 1);
    clearPendingIntent(SOURCE_A, ASSET_A, 1);
    expect(listener).not.toHaveBeenCalled();

    putPendingIntent(intent(SOURCE_A, ASSET_A, 1));
    clearPendingIntent(SOURCE_A, ASSET_A, 1);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    putPendingIntent(intent(SOURCE_A, ASSET_A, 1));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
