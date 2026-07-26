/**
 * BV-003 — a real revision conflict preserves the newer content.
 *
 * Handoff §13.3 and ADR-0003: a stale write is rejected and nothing
 * is overwritten. Asserting that in-process only shows the guard
 * returning early. Reloading afterwards shows what the browser
 * actually kept.
 */
import { test, expect } from '@playwright/test';
import {
  harness,
  isolatedDatabaseName,
  loadHarness,
  reloadAndReopen,
} from './harness-client';

test.describe('BV-003 revision conflict', () => {
  const databaseName = isolatedDatabaseName('bv-003');

  test.afterEach(async ({ page }) => {
    await harness(page).call('deleteDatabase', databaseName);
  });

  test('a stale update is rejected and the newer content survives', async ({
    page,
  }) => {
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', databaseName);

    const imported = await api.call('importSource', 'Original title');

    // One valid update: revision 0 → 1.
    const valid = await api.call(
      'updateTitle',
      imported.sourceId,
      'Newer title',
      0,
    );
    expect(valid.ok).toBe(true);
    if (!valid.ok) throw new Error('unreachable');
    expect(valid.value.revision).toBe(1);

    // A second writer, still holding revision 0.
    const stale = await api.call(
      'updateTitle',
      imported.sourceId,
      'Stale overwrite',
      0,
    );
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error('unreachable');
    expect(stale.errorName).toBe('RevisionConflictError');
    expect(stale.kind).toBe('revision-conflict');
    // Both revisions are reported, so a caller can offer a real choice.
    expect(stale.expectedRevision).toBe(0);
    expect(stale.actualRevision).toBe(1);

    // Reload: prove the rejection reached disk as a non-event.
    await reloadAndReopen(page, databaseName);
    const stored = await harness(page).call('readSource', imported.sourceId);
    expect(stored?.title).toBe('Newer title');
    expect(stored?.revision).toBe(1);
  });

  test('an explicit unconditional override still lands', async ({ page }) => {
    // The escape hatch exists and works — it simply cannot be reached
    // by forgetting an argument (ADR-0003).
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', databaseName);

    const imported = await api.call('importSource', 'Original title');
    await api.call('updateTitle', imported.sourceId, 'Newer title', 0);

    const forced = await page.evaluate((sourceId: string) => {
      // Exercised here rather than through a harness wrapper so the
      // guard object itself is what crosses the boundary.
      return window.__cntknw.updateTitleUnconditionally(sourceId, 'Repaired');
    }, imported.sourceId);

    expect(forced.ok).toBe(true);
    if (!forced.ok) throw new Error('unreachable');
    expect(forced.value.revision).toBe(2);

    await reloadAndReopen(page, databaseName);
    const stored = await harness(page).call('readSource', imported.sourceId);
    expect(stored?.title).toBe('Repaired');
    expect(stored?.revision).toBe(2);
  });
});
