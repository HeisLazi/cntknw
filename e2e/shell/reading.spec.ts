/**
 * Phase 1 acceptance — AC-001 and AC-002, in a real browser.
 *
 * These are the two criteria that decide whether CNTKNW is usable at
 * all: a PDF can be brought in and opened offline, and reopening it
 * puts the reader back exactly where they were. Neither can be
 * accepted anywhere but here — one needs a real file input and a
 * real pdf.js worker, the other needs a real reload.
 */
import { test, expect, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(5, 'The Wretched of the Earth');

async function importPdf(page: Page, name = 'wretched-of-the-earth.pdf') {
  // Fresh storage, so no spec depends on what ran before it.
  await resetApplicationStorage(page);
  await page.goto('/library');
  // The input is visually hidden and driven by the visible button.
  // Setting files on it directly is how Playwright exercises a file
  // picker — there is no way to drive the OS dialog itself.
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
}

test.describe('AC-001 — PDF import works offline', () => {
  test('an imported PDF appears in the library with its page count', async ({
    page,
  }) => {
    await importPdf(page);

    // Title comes from the PDF's own metadata, not the filename.
    const card = page.getByRole('article').filter({
      hasText: 'The Wretched of the Earth',
    });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText(`${PDF.pageCount} pages`);
  });

  test('import survives a reload — it was stored, not held in memory', async ({
    page,
  }) => {
    await importPdf(page);
    await expect(
      page.getByRole('link', { name: 'The Wretched of the Earth' }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(
      page.getByRole('link', { name: 'The Wretched of the Earth' }),
    ).toBeVisible();
  });

  test('a file that is not a PDF is refused with a reason', async ({ page }) => {
    await page.goto('/library');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('this is not a pdf', 'utf-8'),
    });

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText('not a PDF');
    // And nothing was added.
    await expect(page.getByRole('article')).toHaveCount(0);
  });

  test('no network request is made while importing or reading', async ({ page }) => {
    // INV-009: core study capability works offline. The strongest
    // available check is that nothing off-origin is even attempted.
    // Compared against a fixed origin, not `page.url()`: early
    // requests fire while the page is still about:blank, and reading
    // the origin from the page would compare them against nothing.
    const origin = 'http://localhost:5174';
    const external: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) {
        external.push(request.url());
      }
    });

    await importPdf(page);
    await page.getByRole('link', { name: 'The Wretched of the Earth' }).click();
    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
      timeout: 15_000,
    });

    expect(external).toEqual([]);
  });
});

test.describe('AC-002 — exact workspace state resumes', () => {
  test('the reader reopens on the page it was left on', async ({ page }) => {
    await importPdf(page);
    await page.getByRole('link', { name: 'The Wretched of the Earth' }).click();

    // The document renders.
    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(`Page 1 of ${PDF.pageCount}`)).toBeVisible();

    // Read forward.
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText(`Page 3 of ${PDF.pageCount}`)).toBeVisible();
    await expect(page.locator('.cn-pdf-page[data-page="3"]')).toBeVisible();

    // Wait for the debounced save to report itself.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });

    // The actual test: a real reload, then the same place.
    await page.reload();
    await expect(page.getByText(`Page 3 of ${PDF.pageCount}`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.cn-pdf-page[data-page="3"]')).toBeVisible();
  });

  test('zoom is part of the state that resumes', async ({ page }) => {
    await importPdf(page);
    await page.getByRole('link', { name: 'The Wretched of the Earth' }).click();
    await expect(page.getByText('100%')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('125%')).toBeVisible();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText('125%')).toBeVisible({ timeout: 15_000 });
  });

  test('the library shows how far into a source the reader has got', async ({
    page,
  }) => {
    await importPdf(page);
    await page.getByRole('link', { name: 'The Wretched of the Earth' }).click();
    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Library' }).click();
    await expect(
      page.getByText(`Page 2 of ${PDF.pageCount}`),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('the reader is navigable by keyboard alone', async ({ page }) => {
    await importPdf(page);
    await page.getByRole('link', { name: 'The Wretched of the Earth' }).click();
    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('region', { name: 'Source pages' }).focus();
    await page.keyboard.press('PageDown');
    await expect(page.getByText(`Page 2 of ${PDF.pageCount}`)).toBeVisible();

    await page.keyboard.press('End');
    await expect(
      page.getByText(`Page ${PDF.pageCount} of ${PDF.pageCount}`),
    ).toBeVisible();

    await page.keyboard.press('Home');
    await expect(page.getByText(`Page 1 of ${PDF.pageCount}`)).toBeVisible();
  });

  test('page changes are announced, not only painted', async ({ page }) => {
    await importPdf(page);
    await page.getByRole('link', { name: 'The Wretched of the Earth' }).click();
    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
      timeout: 15_000,
    });

    // A live region, so turning a page is audible to a screen reader.
    const status = page.getByRole('status').filter({ hasText: 'Page 1 of' });
    await expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
