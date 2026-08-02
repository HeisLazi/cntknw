import { test, expect } from '@playwright/test';
import {
  harness,
  loadHarness,
  seedApplicationSource,
  resetApplicationStorage,
} from './harness-client';

test.describe('Journal Conflict Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await resetApplicationStorage(page);
  });

  test('ADR-0004: clicking Reload on a conflict exposes both truths rather than silently overwriting with a draft', async ({
    context,
    page, // Harness page
  }) => {
    // 1. Seed a book in the main application DB
    const sourceId = await seedApplicationSource(page, 'A Book');

    // 2. Open the main app and navigate to the book
    const uiPage = await context.newPage();
    await uiPage.goto('/');
    await uiPage.getByRole('link', { name: 'A Book' }).click();
    
    // 3. UI creates a block by typing in the new block input
    await uiPage.getByRole('button', { name: /Start writing/ }).click();
    const editor = uiPage.locator('.cn-block-editor__content').last();
    await editor.pressSequentially('Initial setup from UI', { delay: 10 });
    await uiPage.waitForTimeout(1000); // Wait for flush (Rev 0 created)

    // Find the journal ID and the created block ID via the harness
    await loadHarness(page);
    const api = harness(page);
    await api.call('open', 'cntknw');
    const journalId = await api.call('getJournalId', sourceId);
    if (!journalId) throw new Error('No journal');
    
    const block = await api.call('getFirstBlock', journalId);
    const blockId = block.id;
    const rev0 = block.revision;

    // 4. Harness secretly updates the block in the background (Rev 0 -> 1)
    await api.call('updateBlockText', journalId, blockId, 'Truth A', rev0);

    // 5. UI types again (drafting "Truth B"). 
    // The UI is unaware of the Harness's update. Its expected revision is still 0 (or whatever it loaded).
    await uiPage.bringToFront();
    // Clear and type
    await editor.fill('');
    await editor.pressSequentially('Truth B', { delay: 10 });

    // 6. UI flushes and gets RevisionConflictError. The conflict notice should appear.
    const conflictNotice = uiPage.locator('.cn-journal__conflict');
    await expect(conflictNotice).toBeVisible();

    // 7. Click Reload on the conflict notice
    await uiPage.getByRole('button', { name: /Reload/ }).click();

    // 8. Assert: ADR-0004 requires no silent reapplies. The UI should load "Truth A" (the remote truth)
    // rather than blindly flushing "Truth B" over it.
    await uiPage.waitForTimeout(1000); // wait for load and potential erroneous flush
    
    // Check DB
    const remoteBlockAfter = await api.call('getFirstBlock', journalId);
    const textAfter = remoteBlockAfter.content.type === 'paragraph' ? remoteBlockAfter.content.text : '';
    
    expect(textAfter).toBe('Truth A');
  });
});
