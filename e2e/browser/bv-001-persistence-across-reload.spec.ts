/**
 * BV-001 — persistence across a real page reload.
 *
 * The Phase 0C contract suite runs under `fake-indexeddb`, which
 * lives in one process and one heap. It cannot fail this test,
 * because there is no reload for it to survive. Everything here is
 * written through the public use cases, the page is genuinely
 * reloaded, the composition is rebuilt from nothing, and the data is
 * read back through the same public boundary.
 */
import { test, expect } from '@playwright/test';
import {
  harness,
  isolatedDatabaseName,
  loadHarness,
  reloadAndReopen,
} from './harness-client';

test.describe('BV-001 persistence across reload', () => {
  const databaseName = isolatedDatabaseName('bv-001');

  test.afterEach(async ({ page }) => {
    await harness(page).call('deleteDatabase', databaseName);
  });

  test('a source, journal, block and workspace state survive a reload', async ({
    page,
  }) => {
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', databaseName);

    // ── Write, through importPdf and createPageLinkedBlock ──
    const imported = await api.call('importSource', 'The Wretched of the Earth');
    expect(imported.sourceId).toBeTruthy();

    const block = await api.call(
      'addBlock',
      imported.sourceId,
      67,
      'Decolonisation is always a violent event.',
    );
    expect(block.revision).toBe(0);

    const movedRevision = await api.call(
      'moveReadingPosition',
      imported.sourceId,
      67,
      imported.workspaceRevision,
    );
    expect(movedRevision).toBe(imported.workspaceRevision + 1);

    const beforeReload = await api.call('resume', imported.sourceId);
    expect(beforeReload.activePage).toBe(67);

    // ── The actual test: a real reload, then a fresh composition ──
    await reloadAndReopen(page, databaseName);

    const resumed = await harness(page).call('resume', imported.sourceId);

    // Identity survived.
    expect(resumed.journalId).toBe(imported.journalId);
    expect(resumed.primaryAssetId).toBe(imported.assetId);

    // Content survived.
    expect(resumed.sourceTitle).toBe('The Wretched of the Earth');
    expect(resumed.blockCount).toBe(1);
    expect(resumed.firstBlockText).toBe(
      'Decolonisation is always a violent event.',
    );

    // Revisions survived, rather than resetting to 0.
    expect(resumed.sourceRevision).toBe(beforeReload.sourceRevision);
    expect(resumed.workspaceRevision).toBe(movedRevision);
    expect(resumed.firstBlockRevision).toBe(0);

    // Source-location context survived — INV-004 and AC-003 depend on
    // a block still knowing which page it belongs to after a restart.
    expect(resumed.firstBlockPage).toBe(67);
    expect(resumed.activePage).toBe(67);
    expect(resumed.furthestPage).toBe(67);

    // The binary survived too, in its own store (NFR-003).
    expect(resumed.primaryAssetBytes).toBeGreaterThan(0);
  });

  test('a second reload is still stable', async ({ page }) => {
    // Guards against a first reload that appears to work because
    // something was cached rather than stored.
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', databaseName);

    const imported = await api.call('importSource', 'Black Skin, White Masks');
    await api.call('addBlock', imported.sourceId, 12, 'first');

    await reloadAndReopen(page, databaseName);
    await reloadAndReopen(page, databaseName);

    const resumed = await harness(page).call('resume', imported.sourceId);
    expect(resumed.sourceTitle).toBe('Black Skin, White Masks');
    expect(resumed.blockCount).toBe(1);
    expect(resumed.firstBlockPage).toBe(12);
  });
});
