/**
 * S7 BLOCKER 3 — Write stays a writing projection.
 *
 * Whiteboard-authored objects are canonical journal blocks, but their
 * projection visibility is presentation membership (WhiteboardState.layout),
 * not full inline rendering in the Write projection. Journal-authored prose
 * must stay visible; board gestures must not flood Write as drawing editors.
 */
import { test, expect, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { harness, resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(5, 'A spatial notebook');

async function openOnPageFour(page: Page): Promise<string> {
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'spatial-notebook.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'A spatial notebook' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({ timeout: 15_000 });
  for (let current = 1; current < 4; current += 1) {
    await page.getByRole('button', { name: 'Next page' }).click();
  }
  await expect(page.locator('.cn-reader__page-input')).toHaveValue('4');
  return new URL(page.url()).pathname.split('/').at(-1)!;
}

async function dragOnCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const canvas = page.getByRole('application', { name: 'Infinite whiteboard canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Whiteboard canvas has no browser layout box');
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
}

async function switchToWhiteboard(page: Page) {
  await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
  await page.getByLabel('Workspace split preset').selectOption('0.3');
  await page.getByRole('button', { name: 'Whiteboard' }).click();
  await page.getByRole('button', { name: 'Hide workspace controls' }).click();
  await expect(page.getByRole('application', { name: 'Infinite whiteboard canvas' })).toBeVisible();
}

async function switchToWrite(page: Page) {
  await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
  await page.getByRole('button', { name: 'Write' }).click();
  await page.getByRole('button', { name: 'Hide workspace controls' }).click();
}

test('Write stays a clean writing projection while Whiteboard objects remain canonical', async ({ page }) => {
  test.setTimeout(90_000);
  const sourceId = await openOnPageFour(page);

  // 1. Ordinary journal prose first.
  await page.getByRole('button', { name: /Start writing/ }).click();
  const journalEditor = page.locator('.cn-block-editor__content').last();
  await journalEditor.click();
  await journalEditor.pressSequentially('A journal thought kept across projections.');

  // 2. Switch to Whiteboard and author several objects.
  await switchToWhiteboard(page);
  const canvas = page.getByRole('application', { name: 'Infinite whiteboard canvas' });

  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await dragOnCanvas(page, { x: 90, y: 280 }, { x: 270, y: 390 });
  await expect(canvas).toHaveAttribute('data-object-count', '1');

  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await dragOnCanvas(page, { x: 310, y: 300 }, { x: 470, y: 420 });
  await expect(canvas).toHaveAttribute('data-object-count', '2');

  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Whiteboard canvas has no browser layout box');
  await page.mouse.click(box.x + 520, box.y + 330);
  const textDraft = page.getByRole('textbox', { name: 'New whiteboard text' });
  await textDraft.fill('A note placed in space');
  await textDraft.press('Control+Enter');
  await expect(canvas).toHaveAttribute('data-object-count', '3');

  // 4-6. Switch to Write: prose intact, no drawing editors, no board text.
  await switchToWrite(page);
  await expect(page.getByText('A journal thought kept across projections.')).toBeVisible();
  await expect(page.locator('.cn-drawing')).toHaveCount(0);
  await expect(page.getByText('A note placed in space')).not.toBeVisible();

  // 7-8. Switch back: every board object remains.
  await switchToWhiteboard(page);
  await expect(canvas).toHaveAttribute('data-object-count', '3');

  // 9. One canonical record per intended object, no duplicates.
  await page.goto('/e2e/harness/index.html');
  await harness(page).call('open', 'cntknw');
  const stored = await harness(page).call('inspectWhiteboard', sourceId);
  await harness(page).call('close');
  const projected = stored.blocks.filter((block) => stored.workspace?.layout[block.id]);
  expect(projected).toHaveLength(3);
  expect(stored.blocks).toHaveLength(4); // 3 board objects + 1 journal prose block
  expect(new Set(stored.blocks.map((block) => block.id)).size).toBe(4);
  expect(projected.every((block) => block.page === 4)).toBe(true);
  expect(stored.blocks.some((block) => block.text === 'A journal thought kept across projections.')).toBe(true);

  // 10. Reload preserves both projections.
  await page.goto(`/study/${sourceId}`);
  await expect(page.locator('.cn-pdf-page[data-page="4"]')).toBeVisible({ timeout: 15_000 });
  await switchToWrite(page);
  await expect(page.getByText('A journal thought kept across projections.')).toBeVisible();
  await expect(page.locator('.cn-drawing')).toHaveCount(0);
  await switchToWhiteboard(page);
  await expect(canvas).toHaveAttribute('data-object-count', '3');
});

test('many pen gestures do not make the Write projection unusable', async ({ page }) => {
  test.setTimeout(90_000);
  const sourceId = await openOnPageFour(page);

  await page.getByRole('button', { name: /Start writing/ }).click();
  const journalEditor = page.locator('.cn-block-editor__content').last();
  await journalEditor.click();
  await journalEditor.pressSequentially('Prose that must survive a busy board.');

  await switchToWhiteboard(page);
  const canvas = page.getByRole('application', { name: 'Infinite whiteboard canvas' });
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  for (let index = 0; index < 12; index += 1) {
    const row = index < 6 ? 0 : 1;
    const column = index % 6;
    await dragOnCanvas(
      page,
      { x: 60 + column * 120, y: 280 + row * 130 },
      { x: 120 + column * 120, y: 360 + row * 130 },
    );
    // The board is busy while each object's canonical create is in flight;
    // pace the gestures so none land inside the busy window (Undo is
    // disabled for the whole busy span).
    await expect(canvas).toHaveAttribute('data-object-count', String(index + 1));
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  }
  await expect(canvas).toHaveAttribute('data-object-count', '12');

  await switchToWrite(page);
  await expect(page.getByText('Prose that must survive a busy board.')).toBeVisible();
  await expect(page.locator('.cn-drawing')).toHaveCount(0);
  await expect(page.locator('.cn-block')).toHaveCount(1);

  await page.goto('/e2e/harness/index.html');
  await harness(page).call('open', 'cntknw');
  const stored = await harness(page).call('inspectWhiteboard', sourceId);
  await harness(page).call('close');
  expect(stored.blocks).toHaveLength(13); // 12 gestures + 1 prose, no duplicates
  expect(new Set(stored.blocks.map((block) => block.id)).size).toBe(13);
  expect(Object.keys(stored.workspace?.layout ?? {})).toHaveLength(12);
});
