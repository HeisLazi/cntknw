/** S3 production journey — canonical journal blocks projected on an infinite SVG board. */
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

test('whiteboard objects stay canonical, editable, resumable and offline', async ({ page }) => {
  test.setTimeout(60_000);
  const origin = 'http://localhost:5174';
  const external: string[] = [];
  const dataUrls: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('data:')) dataUrls.push(request.url());
    if (!request.url().startsWith(origin)) external.push(request.url());
  });

  const sourceId = await openOnPageFour(page);

  // Put live state in Write first; the projection switch must preserve it.
  await page.getByRole('button', { name: /Start writing/ }).click();
  const journalEditor = page.locator('.cn-block-editor__content').last();
  await journalEditor.click();
  await journalEditor.pressSequentially('A journal thought kept across projections.');

  await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
  await page.getByLabel('Workspace split preset').selectOption('0.3');
  await page.getByRole('button', { name: 'Whiteboard' }).click();
  await page.getByRole('button', { name: 'Hide workspace controls' }).click();
  const canvas = page.getByRole('application', { name: 'Infinite whiteboard canvas' });
  await expect(canvas).toBeVisible();

  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await dragOnCanvas(page, { x: 90, y: 280 }, { x: 270, y: 390 });
  await expect(canvas).toHaveAttribute('data-object-count', '1');

  await page.getByRole('button', { name: 'Red', exact: true }).click();
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

  // Select and move one object. Moving layout must leave vector content intact.
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const firstDrawing = canvas.locator('[data-kind="drawing"]').last();
  const beforeMove = await firstDrawing.getAttribute('transform');
  await page.mouse.move(box.x + 180, box.y + 335);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 380, { steps: 5 });
  await page.mouse.up();
  await expect(firstDrawing).not.toHaveAttribute('transform', beforeMove ?? '');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(firstDrawing).toHaveAttribute('transform', beforeMove ?? '');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(firstDrawing).not.toHaveAttribute('transform', beforeMove ?? '');

  await expect(page.locator('.cn-whiteboard__inspector')).toContainText('p.4');
  await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
  await page.getByRole('button', { name: 'Write' }).click();
  await expect(page.getByText('A journal thought kept across projections.')).toBeVisible();
  await page.getByRole('button', { name: 'Whiteboard' }).click();
  await page.getByRole('button', { name: 'Hide workspace controls' }).click();
  await expect(canvas).toHaveAttribute('data-object-count', '3');

  // Pan far, zoom, and prove the viewport survives a full composition rebuild.
  await page.getByRole('button', { name: 'Hand', exact: true }).click();
  await dragOnCanvas(page, { x: 620, y: 500 }, { x: 170, y: 170 });
  const viewControls = page.getByRole('group', { name: 'History and view' });
  await viewControls.getByRole('button', { name: 'Zoom in' }).click();
  await viewControls.getByRole('button', { name: 'Zoom in' }).click();
  const zoom = await canvas.getAttribute('data-zoom');
  expect(Number(zoom)).toBeGreaterThan(1);
  await page.waitForTimeout(800);

  await page.reload();
  await expect(page.locator('.cn-pdf-page[data-page="4"]')).toBeVisible({ timeout: 15_000 });
  const reloadedCanvas = page.getByRole('application', { name: 'Infinite whiteboard canvas' });
  await expect(reloadedCanvas).toBeVisible();
  await expect(reloadedCanvas).toHaveAttribute('data-object-count', '3');
  await expect(reloadedCanvas).toHaveAttribute('data-zoom', zoom!);
  await expect(page.locator('.cn-whiteboard__object-stroke')).toHaveCount(2);
  await expect(page.locator('.cn-whiteboard__object-stroke').first()).toHaveAttribute('d', /M .* (L|Q) /);

  // Text remains editable canonical paragraph truth after reload.
  await page.getByRole('group', { name: 'History and view' }).getByRole('button', { name: 'Fit' }).click();
  const finalZoom = Number(await reloadedCanvas.getAttribute('data-zoom'));
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const textObject = reloadedCanvas.locator('[data-kind="paragraph"]');
  await textObject.focus();
  await textObject.press('Enter');
  const textEditor = page.getByRole('textbox', { name: 'Edit whiteboard text' });
  await textEditor.fill('An edited note placed in space');
  await textEditor.press('Control+Enter');
  await page.waitForTimeout(500);

  // Navigate away so the production DB connection closes, then inspect via repositories.
  await page.goto('/e2e/harness/index.html');
  await harness(page).call('open', 'cntknw');
  const stored = await harness(page).call('inspectWhiteboard', sourceId);
  await harness(page).call('close');
  expect(stored.workspace?.rightWorkspace).toBe('whiteboard');
  expect(stored.workspace?.viewport.zoom).toBe(finalZoom);
  expect(Object.keys(stored.workspace?.layout ?? {})).toHaveLength(3);
  const projected = stored.blocks.filter((block) => stored.workspace?.layout[block.id]);
  expect(projected).toHaveLength(3);
  expect(projected.every((block) => block.page === 4)).toBe(true);
  expect(projected.filter((block) => block.contentType === 'drawing').every(
    (block) => block.drawing?.version === 1 && (block.drawing.strokeCount ?? 0) > 0,
  )).toBe(true);
  expect(projected.some((block) => block.text === 'An edited note placed in space')).toBe(true);

  expect(dataUrls).toEqual([]);
  expect(external).toEqual([]);
});
