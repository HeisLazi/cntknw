/**
 * BV-002 — real IndexedDB transaction rollback.
 *
 * The memory adapter fakes rollback by restoring a snapshot, and
 * `fake-indexeddb` runs an in-process implementation. Neither proves
 * that a browser's own transaction aborts and discards its writes.
 *
 * The unit of work here spans five writes across four stores —
 * assets, assetBinaries, sources, sourceAssets, journals — and throws
 * at the end. The page is then reloaded, so the assertion is made
 * against what actually reached disk rather than against a heap that
 * might merely have been rewound.
 */
import { test, expect } from '@playwright/test';
import {
  harness,
  isolatedDatabaseName,
  loadHarness,
  reloadAndReopen,
} from './harness-client';

test.describe('BV-002 transaction rollback', () => {
  const databaseName = isolatedDatabaseName('bv-002');

  test.afterEach(async ({ page }) => {
    await harness(page).call('deleteDatabase', databaseName);
  });

  test('no partial record survives a failed multi-store transaction', async ({
    page,
  }) => {
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', databaseName);

    // A committed source first, so the assertion distinguishes
    // "rollback worked" from "the database was empty anyway".
    const kept = await api.call('importSource', 'Committed before the failure');
    const before = await api.call('counts');
    expect(before.sources).toBe(1);

    const failure = await api.call('failingMultiStoreTransaction');
    expect(failure.ok).toBe(false);
    if (failure.ok) throw new Error('unreachable');
    expect(failure.message).toContain('deliberate failure after five writes');

    // Rolled back in this session…
    const after = await api.call('counts');
    expect(after).toEqual(before);

    // …and still rolled back on disk after a reload.
    await reloadAndReopen(page, databaseName);
    const reloaded = await harness(page).call('counts');
    expect(reloaded.sources).toBe(1);
    expect(reloaded.assets).toBe(before.assets);
    expect(reloaded.binaries).toBe(before.binaries);
    expect(reloaded.sourceAssets).toBe(before.sourceAssets);
    expect(reloaded.journals).toBe(before.journals);

    // The committed record was not collateral damage.
    const survivor = await harness(page).call('readSource', kept.sourceId);
    expect(survivor?.title).toBe('Committed before the failure');
  });
});
