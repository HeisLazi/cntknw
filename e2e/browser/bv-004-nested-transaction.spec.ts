/**
 * BV-004 — a nested unit of work joins the outer browser transaction.
 *
 * The failure this guards against is specific and quiet: an inner
 * `run` that opens its own IndexedDB transaction commits as soon as
 * its own work finishes, so when the outer transaction later aborts,
 * the inner writes are already durable. The result is a half-written
 * import that no rollback will ever clean up.
 *
 * Dexie binds the active transaction to the async context, and
 * `DexieUnitOfWork.run` reuses it rather than opening a second one.
 * That behaviour is only real in a browser, so this is where it is
 * proven.
 */
import { test, expect } from '@playwright/test';
import {
  harness,
  isolatedDatabaseName,
  loadHarness,
  reloadAndReopen,
} from './harness-client';

test.describe('BV-004 nested transaction', () => {
  const databaseName = isolatedDatabaseName('bv-004');

  test.afterEach(async ({ page }) => {
    await harness(page).call('deleteDatabase', databaseName);
  });

  test('an inner run rolls back with its parent', async ({ page }) => {
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', databaseName);

    const before = await api.call('counts');
    expect(before.sources).toBe(0);

    const failure = await api.call('failingNestedTransaction');
    expect(failure.ok).toBe(false);
    if (failure.ok) throw new Error('unreachable');
    expect(failure.message).toContain('outer failed after the inner run returned');

    // The inner run returned successfully and its writes are still gone.
    const after = await api.call('counts');
    expect(after.sources).toBe(0);
    expect(after.journals).toBe(0);

    await reloadAndReopen(page, databaseName);
    const reloaded = await harness(page).call('counts');
    expect(reloaded.sources).toBe(0);
    expect(reloaded.journals).toBe(0);
    expect(reloaded.workspaceStates).toBe(0);
  });
});
