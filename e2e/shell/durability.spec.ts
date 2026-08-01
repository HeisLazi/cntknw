/**
 * Durability under sudden exit.
 *
 * These exist because of a measured data-loss defect, not a
 * hypothetical one. Reading position was debounced by 600ms, and a
 * reload inside that window did not lose the *previous* position — it
 * lost the write entirely, reopening the source at page 1. A reader
 * who turns a page and immediately shuts the laptop is not doing
 * anything unusual.
 *
 * The fix was a design correction: discrete changes (a page turn, a
 * zoom step) are written promptly; only continuous change (scrolling)
 * is debounced, with a flush on every path out of the page.
 *
 * The delays below straddle the old debounce window on purpose. If
 * anyone reintroduces debouncing on a discrete action, the 0ms and
 * 200ms cases fail.
 */
import { test, expect, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(5, 'A durable document');

async function openReader(page: Page) {
  // Fresh storage, so no spec depends on what ran before it.
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'durable.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'A durable document' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
    timeout: 15_000,
  });
}

const pageLabel = (page: Page) =>
  page.locator('.cn-reader__page').textContent().then((t) => t?.trim() ?? '');

test.describe('a page turn survives an immediate reload', () => {
  // 0ms is the real case: the reader turns a page and the machine
  // sleeps. 200 and 400 sit inside the old 600ms debounce window and
  // were the exact failures measured.
  for (const delay of [0, 200, 400]) {
    test(`reload ${delay}ms after turning to page 3`, async ({ page }) => {
      await openReader(page);

      await page.getByRole('button', { name: 'Next page' }).click();
      await page.getByRole('button', { name: 'Next page' }).click();
      expect(await pageLabel(page)).toBe(`Page 3 of ${PDF.pageCount}`);

      if (delay > 0) await page.waitForTimeout(delay);
      await page.reload();

      await expect(page.locator('.cn-reader__page')).toBeVisible({
        timeout: 15_000,
      });
      await expect
        .poll(() => pageLabel(page), { timeout: 10_000 })
        .toBe(`Page 3 of ${PDF.pageCount}`);
    });
  }

  test('a zoom step survives an immediate reload too', async ({ page }) => {
    // Zoom is discrete for the same reason a page turn is.
    await openReader(page);
    await expect(page.getByText('100%')).toBeVisible();

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('125%')).toBeVisible();

    await page.reload();
    await expect(page.getByText('125%')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('writing survives leaving the page', () => {
  test('a block written and immediately abandoned is still there', async ({
    page,
  }) => {
    // Text genuinely needs debouncing — a write per keystroke would be
    // absurd — so this cannot be fixed by writing promptly. Instead
    // the debounce is short and every path out of the page flushes.
    await openReader(page);
    await page.getByRole('button', { name: /Start writing/ }).click();

    const editor = page.locator('.cn-block-editor__content');
    await expect(editor).toBeVisible();
    await editor.pressSequentially('Written, then abandoned.', { delay: 15 });

    // Leave at once — inside the debounce window.
    await page.reload();

    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Written, then abandoned.')).toBeVisible({
      timeout: 15_000,
    });
  });
});
