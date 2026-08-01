/**
 * Phase 0E — the journal in the workspace.
 *
 * The point of the two panes being one workspace: a note written
 * while a page is on screen belongs to that page, without being
 * asked (INV-004, AC-003). And a page with no writing produces no
 * visible section (INV-005, AC-004).
 *
 * Both are acceptable to jsdom in principle; both are asserted here
 * anyway, because their point is the felt behaviour and only the
 * real browser can prove that the reader is not asked.
 */
import { test, expect, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';

const PDF = makePdf(5, 'A journalled document');

async function openReader(page: Page) {
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'journalled.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'A journalled document' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('AC-003 — page context is inherited automatically', () => {
  test('the journal shows which page a new block will belong to', async ({ page }) => {
    // INV-004 in the interface: the location is stated, never asked
    // for. If the user had to pick a page from a dropdown, this test
    // would not exist and neither would the invariant.
    await openReader(page);
    await expect(page.locator('.cn-journal__location')).toHaveText('Page 1');

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.cn-journal__location')).toHaveText('Page 2');
  });

  test('a block written on page 3 is stored against page 3', async ({ page }) => {
    // The core AC-003 assertion: page context is inherited. The
    // block created on page 3 is visible on page 3, absent on any
    // other page, and comes back on returning to page 3 — proving
    // it is attached to a location rather than to the current view.
    //
    // A full reload chain would be stronger evidence, but is
    // deferred: the mixed workspace-autosave + journal-autosave
    // sequence has a race that only shows up under a specific
    // click-after-save timing, and the honest thing is to test what
    // is stable and leave the race documented rather than to write
    // a green test that hides it.
    await openReader(page);

    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(
      page.locator('.cn-reader__page').filter({ hasText: `Page 3 of ${PDF.pageCount}` }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Start writing/ }).click();
    const editor = page.locator('.cn-block-editor__content');
    await expect(editor).toBeVisible();
    await editor.pressSequentially('A note about page three.', { delay: 20 });
    // Wait past the journal debounce so the block is stored.
    await page.waitForTimeout(900);

    // Move to a different page — the block must not follow.
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(
      page.locator('.cn-reader__page').filter({ hasText: `Page 2 of ${PDF.pageCount}` }),
    ).toBeVisible();
    await expect(page.getByText('A note about page three.')).toHaveCount(0);
    await expect(page.locator('.cn-journal__hint')).toBeVisible();

    // Return to page 3 — the note is there again.
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(
      page.locator('.cn-reader__page').filter({ hasText: `Page 3 of ${PDF.pageCount}` }),
    ).toBeVisible();
    await expect(page.getByText('A note about page three.')).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('AC-004 — empty pages create no visible section', () => {
  test('a page with no writing shows a prompt, not a section', async ({ page }) => {
    // INV-005: absence is silence. A row of empty headers would
    // dominate the pane and defeat the point of a single continuous
    // journal.
    await openReader(page);

    // Nothing written yet — the pane shows the prompt for the
    // current page, not a list header for every page in the book.
    await expect(page.locator('.cn-journal__hint')).toContainText(
      'Anything you write here will belong to this page',
    );
    // No block list at all.
    await expect(page.locator('.cn-journal__blocks')).toHaveCount(0);
  });
});
