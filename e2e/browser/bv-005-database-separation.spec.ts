/**
 * BV-005 — v2 never touches the v1 database.
 *
 * ADR-0002 §1 is the decision this test defends. Opening
 * `philosophy-journal` at a higher version irreversibly upgrades it,
 * after which the v1 app — which opens at version 1 — throws
 * `VersionError` and can never run again. Handoff §6.1 requires
 * legacy to stay runnable until migration is verified, and §6.2 and
 * §26 prohibit mutating or deleting it at all.
 *
 * That is a claim about IndexedDB version negotiation, which does not
 * exist under `fake-indexeddb` in any form worth trusting. It is
 * checked here, against a real v1-shaped database.
 */
import { test, expect } from '@playwright/test';
import {
  harness,
  isolatedDatabaseName,
  loadHarness,
  reloadAndReopen,
} from './harness-client';

const V1_NAME = 'philosophy-journal';

test.describe('BV-005 database separation', () => {
  const databaseName = isolatedDatabaseName('bv-005');

  test.afterEach(async ({ page }) => {
    const api = harness(page);
    await api.call('deleteDatabase', databaseName);
    await api.call('deleteDatabase', V1_NAME);
  });

  test('v2 writes leave philosophy-journal at version 1 and intact', async ({
    page,
  }) => {
    await loadHarness(page);
    const api = harness(page);

    // ── Stage a real v1 database ──
    const seeded = await api.call('seedV1Database');
    expect(seeded.version).toBe(1);

    // ── Do a full v2 session's worth of writing ──
    await api.call('open', databaseName);
    const imported = await api.call('importSource', 'A v2 source');
    await api.call('addBlock', imported.sourceId, 5, 'v2 content');
    await api.call(
      'moveReadingPosition',
      imported.sourceId,
      5,
      imported.workspaceRevision,
    );
    await api.call('failingMultiStoreTransaction');

    await reloadAndReopen(page, databaseName);
    const after = harness(page);

    // ── v1 is untouched ──
    const databases = await after.call('listDatabases');
    const v1 = databases.find((entry) => entry.name === V1_NAME);
    expect(v1, 'the v1 database must still exist').toBeDefined();
    expect(v1?.version, 'v1 must not have been upgraded').toBe(1);

    const legacy = await after.call('readV1');
    expect(legacy.exists).toBe(true);
    expect(legacy.bookCount).toBe(1);
    expect(legacy.firstTitle).toBe('Legacy book that must survive');
    expect(legacy.firstCurrentPage).toBe(88);

    // `pdfAnnotations` exists and is empty; the phantom `annotations`
    // store PDFReader.jsx wrote to was never created (ADR-0002 §8.1).
    expect(legacy.storesFound).toContain('pdfAnnotations');
    expect(legacy.storesFound).not.toContain('annotations');
    expect(legacy.phantomAnnotationCount).toBe(0);

    // ── v2 wrote only to its own database ──
    const v2 = databases.find((entry) => entry.name === databaseName);
    expect(v2, 'the v2 database must exist').toBeDefined();
    expect(v2?.version).toBeGreaterThan(0);

    const resumed = await after.call('resume', imported.sourceId);
    expect(resumed.sourceTitle).toBe('A v2 source');
    expect(resumed.activePage).toBe(5);

    // Nothing else was created behind our back.
    const unexpected = databases
      .map((entry) => entry.name)
      .filter((name) => name !== V1_NAME && name !== databaseName);
    expect(unexpected).toEqual([]);
  });

  test('reading v1 does not upgrade it', async ({ page }) => {
    // The readers open v1 in Dexie's dynamic mode — no .version()
    // call — so attaching to it must not fire an upgrade transaction.
    await loadHarness(page);
    const api = harness(page);

    await api.call('seedV1Database');
    await api.call('readV1');
    await api.call('readV1');

    const databases = await api.call('listDatabases');
    expect(databases.find((entry) => entry.name === V1_NAME)?.version).toBe(1);
  });
});
