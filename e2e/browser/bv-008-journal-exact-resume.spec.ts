import { test, expect } from '@playwright/test';
import {
  seedApplicationSource,
  resetApplicationStorage,
  harness,
  loadHarness,
} from './harness-client';

test.describe('Journal Exact Resume', () => {
  test.beforeEach(async ({ page }) => {
    await resetApplicationStorage(page);
  });

  test('AC-002: Exact resume must include the journal scroll offset', async ({
    page,
  }) => {
    const sourceA = await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    
    // 1. Open the study workspace
    await page.getByRole('link', { name: 'Book A' }).click();

    // 2. We need some content to scroll. Let's add blocks via harness!
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', 'cntknw');
    for (let i = 0; i < 50; i++) {
      await api.call('addBlock', sourceA, 1, `Line ${i}`);
    }
    await api.call('close');

    // Reload study page to see the new blocks
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();

    await page.addStyleTag({ content: '.cn-journal__body { max-height: 400px; overflow-y: auto !important; }' });

    // Wait for the blocks to render so the journal is actually scrollable
    await expect(page.getByText('Line 29')).toBeVisible();

    const journalBody = page.locator('.cn-journal__body');
    await journalBody.evaluate((node) => {
      if (node.scrollHeight <= node.clientHeight) {
        throw new Error(`Cannot scroll: scrollHeight ${node.scrollHeight} <= clientHeight ${node.clientHeight}`);
      }
      node.scrollTop = 200;
      node.dispatchEvent(new Event('scroll'));
    });

    // Wait for drift debounce (DRIFT_DEBOUNCE_MS = 250 in useWorkspacePersistence)
    // plus some time for IndexedDB
    await page.waitForTimeout(1000);

    // Verify it scrolled
    const scrollPos = await journalBody.evaluate((node) => node.scrollTop);
    expect(scrollPos).toBeGreaterThan(0);

    // 4. Navigate away (to library)
    await page.getByRole('button', { name: /Open navigation/ }).click();
    await page.getByRole('link', { name: 'Library' }).click();
    await expect(page.locator('h1', { hasText: 'Library' })).toBeVisible();

    // 5. Navigate back to study workspace
    await page.getByRole('link', { name: 'Book A' }).click();

    await page.addStyleTag({ content: '.cn-journal__body { max-height: 400px; overflow-y: auto !important; }' });

    // 6. Verify scroll position was restored
    const journalBodyRestored = page.locator('.cn-journal__body');
    // Wait for the journal to finish loading its blocks (so it can scroll)
    await expect(page.locator('.cn-run').first()).toBeVisible();
    
    // Note: React's useEffect to set scrollTop might take a tick after rendering blocks.
    await page.waitForTimeout(500);

    const restoredScrollPos = await journalBodyRestored.evaluate((node) => node.scrollTop);
    expect(restoredScrollPos).toBe(scrollPos); // Expect exact resume
  });
});
