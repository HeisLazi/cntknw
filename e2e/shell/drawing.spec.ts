/**
 * Phase 3C production journey — editable vector Drawing journal blocks.
 *
 * Storage is reset through the harness, but no source, block or stroke is
 * seeded there: import, page inheritance, creation, drawing and editing all
 * travel through the same production UI a reader uses.
 */
import { test, expect, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(5, 'A drawn study');

async function openReaderOnPageFive(page: Page) {
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'drawn-study.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'A drawn study' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({ timeout: 15_000 });
  for (let pageNumber = 1; pageNumber < 5; pageNumber += 1) {
    await page.getByRole('button', { name: 'Next page' }).click();
  }
  await expect(page.locator('.cn-reader__page-input')).toHaveValue('5');
  await expect(page.locator('.cn-run--active .cn-run__folio')).toHaveText('p.5');
}

async function drawStroke(page: Page, offset = 0) {
  const canvas = page.getByRole('img', { name: /Editable drawing canvas/ });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Drawing canvas has no browser layout box');
  await page.mouse.move(box.x + 30 + offset, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.35 + offset, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6, { steps: 5 });
  await page.mouse.up();
}

test('a page-linked drawing stays vector, editable, recoverable and offline', async ({ page }) => {
  const origin = 'http://localhost:5174';
  const external: string[] = [];
  const dataUrls: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('data:')) dataUrls.push(request.url());
    if (!request.url().startsWith(origin)) {
      external.push(request.url());
    }
  });

  await openReaderOnPageFive(page);
  await page.getByRole('button', { name: 'Draw a sketch.' }).click();

  const runFive = page.locator('.cn-run', {
    has: page.locator('.cn-run__folio', { hasText: 'p.5' }),
  });
  await expect(runFive.locator('.cn-block[data-kind="drawing"]')).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Editable drawing canvas, 0 strokes' })).toBeFocused();

  await drawStroke(page);
  await expect(page.getByRole('status').filter({ hasText: 'Added a stroke. 1 stroke.' })).toBeAttached();
  await expect(page.locator('.cn-drawing__canvas')).toHaveAttribute('data-stroke-count', '1');
  await expect(page.locator('.cn-drawing__stroke')).toHaveCount(1);
  await page.waitForTimeout(700);

  await page.reload();
  await expect(page.locator('.cn-pdf-page[data-page="5"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: 'Drawing, 1 stroke' })).toHaveAttribute('viewBox', '0 0 800 600');
  await expect(page.locator('.cn-drawing__stroke')).toHaveAttribute('d', /M .* L /);
  await expect(page.locator('.cn-block[data-kind="drawing"]')).toHaveCount(1);

  // Keyboard path: focus the block, enter edit, Delete a selected stroke,
  // undo a later stroke from a real button, then Escape back to read state.
  const drawingBlock = page.getByRole('group', { name: 'Drawing block, 1 stroke' });
  await drawingBlock.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('img', { name: 'Editable drawing canvas, 1 stroke' })).toBeFocused();

  await drawStroke(page, 12);
  await expect(page.locator('.cn-drawing__canvas')).toHaveAttribute('data-stroke-count', '2');
  const secondStroke = page.getByRole('button', { name: 'Stroke 2. Select' });
  await secondStroke.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('img', { name: /Editable drawing canvas/ }).focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.cn-drawing__canvas')).toHaveAttribute('data-stroke-count', '1');

  await drawStroke(page, 20);
  const undo = page.getByRole('button', { name: 'Undo last stroke' });
  await undo.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.cn-drawing__canvas')).toHaveAttribute('data-stroke-count', '1');
  await page.getByRole('img', { name: /Editable drawing canvas/ }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit drawing' })).toBeFocused();
  await page.waitForTimeout(700);

  await page.reload();
  await expect(page.getByRole('img', { name: 'Drawing, 1 stroke' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.cn-block[data-kind="drawing"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Edit drawing' }).click();
  await page.getByRole('button', { name: 'Move drawing to trash' }).click();
  await page.getByText('Recently Deleted (1)').click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('img', { name: 'Drawing, 1 stroke' })).toBeVisible();
  await expect(page.locator('.cn-block[data-kind="drawing"]')).toHaveCount(1);

  expect(dataUrls).toEqual([]);
  expect(external).toEqual([]);
});
