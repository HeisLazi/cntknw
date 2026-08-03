import { test, expect } from '@playwright/test';
import {
  seedApplicationSource,
  resetApplicationStorage,
} from './harness-client';

test.describe('Journal Acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await resetApplicationStorage(page);
  });

  test('A. Kind transformation preserves already-saved text', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();
    
    await page.getByRole('button', { name: /Start writing/ }).click();
    const editor = page.locator('.cn-block-editor__content').last();
    await editor.pressSequentially('old');
    await page.waitForTimeout(1000);
    
    await editor.pressSequentially('new');
    await page.waitForTimeout(1000);
    
    await page.click('button[aria-label^="Block type:"]');
    await page.click('text="Claim"');
    await page.waitForTimeout(500);
    await page.reload();
    
    await expect(page.locator('.cn-block-editor__content').last()).toHaveText('oldnew');
    await expect(page.locator('.cn-block').last()).toHaveAttribute('data-kind', 'claim');
  });

  test('B. Kind transformation merges pending typed text', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();
    
    await page.getByRole('button', { name: /Start writing/ }).click();
    const editor = page.locator('.cn-block-editor__content').last();
    await editor.pressSequentially('pending text');
    
    await page.click('button[aria-label^="Block type:"]');
    await page.click('text="Question"');
    await page.waitForTimeout(500);
    await page.reload();
    
    await expect(page.locator('.cn-block-editor__content').last()).toHaveText('pending text');
    await expect(page.locator('.cn-block').last()).toHaveAttribute('data-kind', 'question');
  });

  test('C. Non-paragraph kind preserves draft text across crash', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();
    
    await page.getByRole('button', { name: /Start writing/ }).click();
    const editor = page.locator('.cn-block-editor__content').last();
    await editor.pressSequentially('paragraph text');
    await page.waitForTimeout(1000);
    
    await page.click('button[aria-label^="Block type:"]');
    await page.click('text="Heading"');
    
    await editor.fill('heading text');
    await page.waitForTimeout(500);
    await page.reload();
    
    await expect(page.locator('.cn-block-editor__content').last()).toHaveText('heading text');
    await expect(page.locator('.cn-block').last()).toHaveAttribute('data-kind', 'heading');
  });

  test('D. Conflict resolution for textual kinds', async ({ page, context }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();
    
    // Block 1: Keep saved
    await page.getByRole('button', { name: /Start writing/ }).click();
    const editor1 = page.locator('.cn-block-editor__content').nth(0);
    await editor1.fill('base text 1');
    await page.waitForTimeout(1000);

    // Block 2: Use my version
    await editor1.press('Enter');
    const editor2 = page.locator('.cn-block-editor__content').nth(1);
    await editor2.fill('base text 2');
    await page.waitForTimeout(1000);

    // Change kind of block 2 to ensure kind doesn't interfere
    await page.locator('.cn-block').nth(1).locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Question"');
    await page.waitForTimeout(1000);

    // Second connection (Remote)
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.getByRole('link', { name: 'Book A' }).click();
    const remoteEditor1 = page2.locator('.cn-block-editor__content').nth(0);
    const remoteEditor2 = page2.locator('.cn-block-editor__content').nth(1);
    
    // --- Conflict 1: Keep saved ---
    await remoteEditor1.fill('remote truth 1');
    await page2.waitForTimeout(1000);

    await editor1.fill('local truth 1');
    await page.waitForTimeout(1000);

    const conflict1 = page.locator('.cn-block').nth(0).locator('.cn-journal__conflict');
    await expect(conflict1).toBeVisible();
    await expect(conflict1).toContainText('remote truth 1');
    await expect(conflict1).toContainText('local truth 1');
    await conflict1.getByRole('button', { name: 'Keep saved' }).click();
    await expect(conflict1).not.toBeVisible();
    await expect(editor1).toHaveText('remote truth 1');

    // --- Conflict 2: Use my version ---
    await remoteEditor2.fill('remote truth 2');
    await page2.waitForTimeout(1000);

    await editor2.fill('local truth 2');
    await page.waitForTimeout(1000);

    const conflict2 = page.locator('.cn-block').nth(1).locator('.cn-journal__conflict');
    await expect(conflict2).toBeVisible();
    await expect(conflict2).toContainText('remote truth 2');
    await expect(conflict2).toContainText('local truth 2');
    await conflict2.getByRole('button', { name: 'Use my version' }).click();
    await expect(conflict2).not.toBeVisible();
    await expect(editor2).toHaveText('local truth 2');

    // Persists across reload
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('.cn-block-editor__content').nth(0)).toHaveText('remote truth 1');
    await expect(page.locator('.cn-block-editor__content').nth(1)).toHaveText('local truth 2');
    await expect(page.locator('.cn-block').nth(1)).toHaveAttribute('data-kind', 'question');
  });

  test('E. Deleted blocks can be restored', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();
    
    // create recognizable block -> persist
    await page.getByRole('button', { name: /Start writing/ }).click();
    const editor = page.locator('.cn-block-editor__content').last();
    await editor.fill('to be deleted');
    await page.waitForTimeout(1000);
    
    // -> delete
    for (let i = 0; i < 14; i++) await page.keyboard.press('Backspace');
    
    // -> live journal no longer shows it
    await expect(page.locator('.cn-block-editor__content')).toHaveCount(0);
    
    // -> reload -> live journal still empty
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('.cn-block-editor__content')).toHaveCount(0);

    // -> Recently Deleted still contains it
    const trashDetails = page.locator('.cn-journal__trash');
    await trashDetails.click();
    const trashItem = trashDetails.locator('.cn-journal__trash-item', { hasText: 'to be deleted' });
    await expect(trashItem).toBeVisible();

    // -> restore
    await trashItem.getByRole('button', { name: 'Restore' }).click();

    // -> same content/source-page returns
    await expect(page.locator('.cn-block-editor__content').last()).toHaveText('to be deleted');

    // -> reload -> block remains restored
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('.cn-block-editor__content').last()).toHaveText('to be deleted');

    // -> trash no longer contains it
    await expect(page.locator('.cn-journal__trash')).toHaveCount(0);
  });

  test('F. UI structural formatting disables for non-paragraph', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();
    
    await page.getByRole('button', { name: /Start writing/ }).click();
    const editor = page.locator('.cn-block-editor__content').last();
    await editor.pressSequentially('formatted text');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');
    
    await expect(editor.locator('strong')).toBeVisible();

    await page.click('button[aria-label^="Block type:"]');
    await page.click('text="Claim"');

    await page.waitForTimeout(500);

    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');
    
    await expect(page.locator('.cn-block-editor__content strong')).toHaveCount(0);
  });

  test('G. Pending edit kind transforms for non-paragraph kinds', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();

    // Quote -> Claim
    await page.getByRole('button', { name: /Start writing/ }).click();
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Quote"');
    await page.waitForTimeout(500);
    const editor1 = page.locator('.cn-block-editor__content').last();
    await editor1.fill('old');
    await page.waitForTimeout(1000); // Wait for flush
    await editor1.fill('new');
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Claim"');
    await page.waitForTimeout(500);

    // Evidence -> Claim
    await page.locator('.cn-block-editor__content').last().press('Enter');
    await expect(page.locator('.cn-block')).toHaveCount(2);
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Evidence"');
    await page.waitForTimeout(500);
    const editor2 = page.locator('.cn-block-editor__content').last();
    await editor2.fill('evidence old');
    await page.waitForTimeout(1000);
    await editor2.fill('evidence new');
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Claim"');
    await page.waitForTimeout(500);

    // Objection -> Question
    await page.locator('.cn-block-editor__content').last().press('Enter');
    await expect(page.locator('.cn-block')).toHaveCount(3);
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Objection"');
    await page.waitForTimeout(500);
    const editor3 = page.locator('.cn-block-editor__content').last();
    await editor3.fill('objection old');
    await page.waitForTimeout(1000);
    await editor3.fill('objection new');
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Question"');
    await page.waitForTimeout(500);

    // Callout -> Paragraph
    await page.locator('.cn-block-editor__content').last().press('Enter');
    await expect(page.locator('.cn-block')).toHaveCount(4);
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Callout"');
    await page.waitForTimeout(500);
    const editor4 = page.locator('.cn-block-editor__content').last();
    await editor4.fill('callout old');
    await page.waitForTimeout(1000);
    await editor4.fill('callout new');
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Paragraph"');

    await page.waitForTimeout(500);
    await page.reload();

    await expect(page.locator('.cn-block').nth(0)).toHaveAttribute('data-kind', 'claim');
    await expect(page.locator('.cn-block-editor__content').nth(0)).toHaveText('new');
    
    await expect(page.locator('.cn-block').nth(1)).toHaveAttribute('data-kind', 'claim');
    await expect(page.locator('.cn-block-editor__content').nth(1)).toHaveText('evidence new');

    await expect(page.locator('.cn-block').nth(2)).toHaveAttribute('data-kind', 'question');
    await expect(page.locator('.cn-block-editor__content').nth(2)).toHaveText('objection new');

    await expect(page.locator('.cn-block').nth(3)).toHaveAttribute('data-kind', 'paragraph');
    await expect(page.locator('.cn-block-editor__content').nth(3)).toHaveText('callout new');
  });

  test('H. Conflict resolution for non-paragraph textual kinds', async ({ page, context }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();

    // Create Evidence, Objection, Quote
    await page.getByRole('button', { name: /Start writing/ }).click();
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Evidence"');
    await page.waitForTimeout(500);
    await page.locator('.cn-block-editor__content').last().fill('evidence base');

    await page.locator('.cn-block-editor__content').last().press('Enter');
    await expect(page.locator('.cn-block')).toHaveCount(2);
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Objection"');
    await page.waitForTimeout(500);
    await page.locator('.cn-block-editor__content').last().fill('objection base');

    await page.locator('.cn-block-editor__content').last().press('Enter');
    await expect(page.locator('.cn-block')).toHaveCount(3);
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Quote"');
    await page.waitForTimeout(500);
    await page.locator('.cn-block-editor__content').last().fill('quote base');
    
    await page.waitForTimeout(1000);

    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.getByRole('link', { name: 'Book A' }).click();
    
    // Remote edits
    await page2.locator('.cn-block-editor__content').nth(0).fill('evidence remote');
    await page2.locator('.cn-block-editor__content').nth(1).fill('objection remote');
    await page2.locator('.cn-block-editor__content').nth(2).fill('quote remote');
    await page2.waitForTimeout(1000);

    // Local edit Evidence (conflict)
    await page.locator('.cn-block-editor__content').nth(0).fill('evidence local');
    await page.waitForTimeout(1000);

    // Evidence -> Use my version
    const conflict0 = page.locator('.cn-block').nth(0).locator('.cn-journal__conflict');
    await expect(conflict0).toBeVisible();
    await expect(conflict0).toContainText('evidence remote');
    await expect(conflict0).toContainText('evidence local');
    await conflict0.getByRole('button', { name: 'Use my version' }).click();

    // Local edit Objection (conflict)
    await page.locator('.cn-block-editor__content').nth(1).fill('objection local');
    await page.waitForTimeout(1000);

    // Objection -> Keep saved
    const conflict1 = page.locator('.cn-block').nth(1).locator('.cn-journal__conflict');
    await expect(conflict1).toBeVisible();
    await conflict1.getByRole('button', { name: 'Keep saved' }).click();

    // Local edit Quote (conflict)
    await page.locator('.cn-block-editor__content').nth(2).fill('quote local');
    await page.waitForTimeout(1000);

    // Quote -> Use my version
    const conflict2 = page.locator('.cn-block').nth(2).locator('.cn-journal__conflict');
    await expect(conflict2).toBeVisible();
    await expect(conflict2).toContainText('quote remote');
    await expect(conflict2).toContainText('quote local');
    await conflict2.getByRole('button', { name: 'Use my version' }).click();

    await page.waitForTimeout(500);
    await page.reload();

    await expect(page.locator('.cn-block-editor__content').nth(0)).toHaveText('evidence local');
    await expect(page.locator('.cn-block-editor__content').nth(1)).toHaveText('objection remote');
    await expect(page.locator('.cn-block-editor__content').nth(2)).toHaveText('quote local');
  });

  test('I. Crash recovery for non-paragraph textual kinds', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();

    await page.getByRole('button', { name: /Start writing/ }).click();
    await page.locator('.cn-block').last().locator('button[aria-label^="Block type:"]').click();
    await page.click('text="Callout"');
    await page.waitForTimeout(500);

    // Type but don't flush
    await page.locator('.cn-block-editor__content').last().fill('callout draft');
    await page.waitForTimeout(100);
    await page.reload();

    await expect(page.locator('.cn-block-editor__content').last()).toHaveText('callout draft');
  });

  test('J. Delete clears transient mutation state', async ({ page }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();

    await page.getByRole('button', { name: /Start writing/ }).click();
    await page.waitForTimeout(500);
    
    await page.locator('.cn-block-editor__content').last().fill('will be deleted');
    // delete immediately before flush
    for (let i = 0; i < 16; i++) await page.keyboard.press('Backspace');
    
    await page.waitForTimeout(100);
    
    const trashDetails = page.locator('.cn-journal__trash');
    await trashDetails.click();
    await trashDetails.locator('.cn-journal__trash-item').getByRole('button', { name: 'Restore' }).click();
    
    await page.waitForTimeout(1500); // wait longer than autosave debounce (1000ms)
    await page.reload();
    
    // Ghost save should not have happened, restored block stays empty because we never saved the text before delete!
    // Actually, "will be deleted" was never saved. It restores to its last saved state, which was empty.
    await expect(page.locator('.cn-block-editor__content').last()).toHaveText('');
  });

  test('K. Simultaneous multi-block conflict resolution', async ({ page, context }) => {
    await seedApplicationSource(page, 'Book A');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book A' }).click();

    // Create Block A and Block B
    await page.getByRole('button', { name: /Start writing/ }).click();
    await page.locator('.cn-block-editor__content').nth(0).fill('base A');
    await page.locator('.cn-block-editor__content').nth(0).press('Enter');
    await expect(page.locator('.cn-block')).toHaveCount(2);
    await page.locator('.cn-block-editor__content').nth(1).fill('base B');
    await page.waitForTimeout(1000);

    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.getByRole('link', { name: 'Book A' }).click();

    // Remote truth A and B
    await page2.locator('.cn-block-editor__content').nth(0).fill('remote A');
    await page2.locator('.cn-block-editor__content').nth(1).fill('remote B');
    await page2.waitForTimeout(1000);

    // Local truth A and B
    await page.locator('.cn-block-editor__content').nth(0).fill('local A');
    await page.locator('.cn-block-editor__content').nth(1).fill('local B');
    await page.waitForTimeout(1000);

    // Verify BOTH conflicts are visible simultaneously
    const conflict0 = page.locator('.cn-block').nth(0).locator('.cn-journal__conflict');
    const conflict1 = page.locator('.cn-block').nth(1).locator('.cn-journal__conflict');
    
    await expect(conflict0).toBeVisible();
    await expect(conflict1).toBeVisible();
    
    await expect(conflict0).toContainText('remote A');
    await expect(conflict0).toContainText('local A');
    await expect(conflict1).toContainText('remote B');
    await expect(conflict1).toContainText('local B');

    // Resolve A with Keep saved
    await conflict0.getByRole('button', { name: 'Keep saved' }).click();
    
    await expect(page.locator('.cn-block-editor__content').nth(0)).toHaveText('remote A');
    await expect(conflict1).toBeVisible(); // B conflict STILL EXISTS

    // Resolve B with Use my version
    await conflict1.getByRole('button', { name: 'Use my version' }).click();
    await expect(page.locator('.cn-block-editor__content').nth(1)).toHaveText('local B');

    await page.waitForTimeout(500);
    await page.reload();

    await expect(page.locator('.cn-block-editor__content').nth(0)).toHaveText('remote A');
    await expect(page.locator('.cn-block-editor__content').nth(1)).toHaveText('local B');
  });
});
