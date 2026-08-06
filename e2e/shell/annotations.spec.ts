import { expect, test, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(12, 'Annotation Production Journey');
const ORIGIN = 'http://localhost:5174';

async function importAndOpen(page: Page): Promise<void> {
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'annotation-production-journey.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'Annotation Production Journey' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"] canvas')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.cn-pdf-page[data-page="1"] .cn-pdf-page__text span').first()).toBeAttached({
    timeout: 15_000,
  });
}

async function selectPageLabel(page: Page, pageNumber: number): Promise<void> {
  const span = page
    .locator(`.cn-pdf-page[data-page="${pageNumber}"] .cn-pdf-page__text span`)
    .filter({ hasText: `Page ${pageNumber}` })
    .first();
  await expect(span).toBeVisible();
  const box = await span.boundingBox();
  if (!box) throw new Error(`Page ${pageNumber} text has no bounding box`);
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 1, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function selectedLocalRect(page: Page, pageNumber: number) {
  return page.evaluate((number) => {
    const selection = window.getSelection();
    const pageElement = document.querySelector<HTMLElement>(
      `.cn-pdf-page[data-page="${number}"]`,
    );
    if (!selection || selection.rangeCount === 0 || !pageElement) return null;
    const selected = selection.getRangeAt(0).getClientRects()[0];
    const pageRect = pageElement.getBoundingClientRect();
    return selected
      ? {
          x: selected.left - pageRect.left,
          y: selected.top - pageRect.top,
          width: selected.width,
          height: selected.height,
        }
      : null;
  }, pageNumber);
}

async function annotationLocalRect(page: Page, selector: string, pageNumber: number) {
  return page.evaluate(
    ({ annotationSelector, number }) => {
      const annotation = document.querySelector<HTMLElement>(annotationSelector);
      const pageElement = document.querySelector<HTMLElement>(
        `.cn-pdf-page[data-page="${number}"]`,
      );
      if (!annotation || !pageElement) return null;
      const mark = annotation.getBoundingClientRect();
      const pageRect = pageElement.getBoundingClientRect();
      return {
        x: mark.left - pageRect.left,
        y: mark.top - pageRect.top,
        width: mark.width,
        height: mark.height,
      };
    },
    { annotationSelector: selector, number: pageNumber },
  );
}

function expectRectNear(
  actual: { x: number; y: number; width: number; height: number } | null,
  expected: { x: number; y: number; width: number; height: number } | null,
  tolerance = 2,
): void {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual![key] - expected![key])).toBeLessThanOrEqual(tolerance);
  }
}

test.describe('Phase 3B production PDF annotations', () => {
  test('highlight aligns through zoom, reload, virtualization, then deletes safely offline', async ({
    page,
  }) => {
    const external: string[] = [];
    const failed: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(ORIGIN) && !request.url().startsWith('data:')) {
        external.push(request.url());
      }
    });
    page.on('requestfailed', (request) => failed.push(request.url()));

    await importAndOpen(page);
    await selectPageLabel(page, 1);
    const selectedAtOne = await selectedLocalRect(page, 1);
    await page.getByRole('button', { name: 'Highlight' }).click();

    const highlight = page.getByRole('button', {
      name: /Highlight on page 1: “Page 1”/u,
    });
    await expect(highlight).toBeVisible();
    expectRectNear(
      await annotationLocalRect(page, '.cn-annotation--highlight', 1),
      selectedAtOne,
    );

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('125%')).toBeVisible();
    await expect(page.locator('.cn-pdf-page[data-page="1"] canvas')).toHaveCSS(
      'width',
      '500px',
    );
    const atZoom = await annotationLocalRect(page, '.cn-annotation--highlight', 1);
    expectRectNear(
      atZoom,
      selectedAtOne
        ? {
            x: selectedAtOne.x * 1.25,
            y: selectedAtOne.y * 1.25,
            width: selectedAtOne.width * 1.25,
            height: selectedAtOne.height * 1.25,
          }
        : null,
    );

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(highlight).toBeVisible({ timeout: 15_000 });

    const pageInput = page.getByRole('spinbutton', { name: /Page 1 of 12/u });
    await pageInput.fill('10');
    await pageInput.press('Enter');
    await expect(page.locator('.cn-pdf-page[data-page="10"] canvas')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toHaveCount(0);
    const pageTenInput = page.getByRole('spinbutton', { name: /Page 10 of 12/u });
    await pageTenInput.fill('1');
    await pageTenInput.press('Enter');
    await expect(highlight).toBeVisible({ timeout: 15_000 });

    await highlight.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Delete annotation' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete highlight?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(highlight).toHaveCount(0);

    expect(external).toEqual([]);
    expect(failed).toEqual([]);
  });

  test('region tool is keyboard reachable, cancels with Escape, and persists a drag', async ({
    page,
  }) => {
    await importAndOpen(page);
    const regionTool = page.getByRole('button', { name: 'Region annotation tool' });
    await regionTool.focus();
    await page.keyboard.press('Enter');
    await expect(regionTool).toHaveAttribute('aria-pressed', 'true');

    const pageBox = await page.locator('.cn-pdf-page[data-page="1"]').boundingBox();
    if (!pageBox) throw new Error('Page 1 has no bounding box');
    await page.mouse.move(pageBox.x + 210, pageBox.y + 190);
    await page.mouse.down();
    await page.mouse.move(pageBox.x + 300, pageBox.y + 270, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Region on page 1' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Source pages' })).toBeFocused();

    await page.mouse.move(pageBox.x + 80, pageBox.y + 180);
    await page.mouse.down();
    await page.mouse.move(pageBox.x + 190, pageBox.y + 260, { steps: 6 });
    await page.mouse.up();
    const region = page.getByRole('button', { name: 'Region on page 1' });
    await expect(region).toBeVisible();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(regionTool).toHaveAttribute('aria-pressed', 'true');
    await expect(region).toBeVisible({ timeout: 15_000 });
  });

  test('cross-page text selection is refused with an announced notice', async ({ page }) => {
    await importAndOpen(page);
    const first = page
      .locator('.cn-pdf-page[data-page="1"] .cn-pdf-page__text span')
      .filter({ hasText: 'Page 1' })
      .first();
    const second = page
      .locator('.cn-pdf-page[data-page="2"] .cn-pdf-page__text span')
      .filter({ hasText: 'Page 2' })
      .first();
    const firstBox = await first.boundingBox();
    const secondBox = await second.boundingBox();
    if (!firstBox || !secondBox) throw new Error('Cross-page text is not rendered');

    await page.mouse.move(firstBox.x + 1, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      secondBox.x + secondBox.width - 1,
      secondBox.y + secondBox.height / 2,
      { steps: 20 },
    );
    await page.mouse.up();

    await expect(
      page.getByText('Selection crosses pages — annotate one page at a time.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Highlight' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: /Highlight on page/u })).toHaveCount(0);
  });
});
