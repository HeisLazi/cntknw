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
});
