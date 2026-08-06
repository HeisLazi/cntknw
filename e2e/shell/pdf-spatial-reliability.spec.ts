import { expect, test, type Locator, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import {
  harness,
  loadHarness,
  resetApplicationStorage,
} from '../browser/harness-client';

const SCROLL_PDF = makePdf(40, 'Spatial Reader');
const NAV_PDF = makePdf(40, 'Spatial Navigation', {
  outline: [{ title: 'The distant chapter', page: 17 }],
});
const LONG_PDF = makePdf(500, 'Long Spatial Reader');

async function importAndOpen(page: Page, pdf = SCROLL_PDF): Promise<string> {
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'spatial-reader.pdf',
    mimeType: 'application/pdf',
    buffer: pdf.bytes,
  });
  await page.getByRole('link', { name: pdf === NAV_PDF ? 'Spatial Navigation' : pdf === LONG_PDF ? 'Long Spatial Reader' : 'Spatial Reader' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"] canvas')).toBeVisible({
    timeout: 15_000,
  });
  return new URL(page.url()).pathname.split('/').at(-1)!;
}

const scrollport = (page: Page): Locator =>
  page.getByRole('region', { name: 'Source pages' });

const pageElement = (page: Page, pageNumber: number): Locator =>
  page.locator(`.cn-pdf-page[data-page="${pageNumber}"]`);

async function pageViewportIntersection(
  page: Page,
  pageNumber: number,
): Promise<number> {
  return pageElement(page, pageNumber).evaluate((element) => {
    const viewport = element.closest('.cn-reader__scroll');
    if (!viewport) return 0;
    const pageBox = element.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(pageBox.bottom, viewportBox.bottom) -
        Math.max(pageBox.top, viewportBox.top),
    );
  });
}

async function expectPageInViewport(page: Page, pageNumber: number): Promise<void> {
  await expect(pageElement(page, pageNumber)).toHaveCount(1);
  await expect
    .poll(() => pageViewportIntersection(page, pageNumber), { timeout: 15_000 })
    .toBeGreaterThan(100);
}

async function currentPage(page: Page): Promise<number> {
  return Number(await page.locator('.cn-reader__page-input').inputValue());
}

async function enterPage(page: Page, pageNumber: number): Promise<void> {
  const input = page.getByRole('spinbutton', { name: /Page \d+ of \d+/ });
  await input.fill(String(pageNumber));
  await input.press('Enter');
}

async function wheelUntilPage(page: Page, target: number, deltaY: number): Promise<void> {
  await scrollport(page).hover();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.mouse.wheel(0, deltaY);
    if (await currentPage(page) === target) return;
    await page.waitForTimeout(80);
  }
  expect(await currentPage(page)).toBe(target);
}

test.describe('bounded continuous PDF reading', () => {
  test('natural downward scrolling advances the actually visible page', async ({ page }) => {
    await importAndOpen(page);

    await wheelUntilPage(page, 2, 260);

    await expectPageInViewport(page, 2);
    await expect(page.getByRole('spinbutton', { name: 'Page 2 of 40' })).toBeVisible();
  });

  test('natural upward scrolling moves the visible page backward', async ({ page }) => {
    await importAndOpen(page);
    await wheelUntilPage(page, 3, 300);

    await wheelUntilPage(page, 2, -260);

    await expectPageInViewport(page, 2);
    await expect(page.getByRole('spinbutton', { name: 'Page 2 of 40' })).toBeVisible();
  });

  test('a 500-page document keeps a bounded page window at both ends', async ({ page }) => {
    await importAndOpen(page, LONG_PDF);

    await expect(page.locator('.cn-pdf-page')).toHaveCount(5);
    await enterPage(page, 500);
    await expectPageInViewport(page, 500);

    await expect(page.locator('.cn-pdf-page')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await enterPage(page, 1);
    await expectPageInViewport(page, 1);
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });
});

test.describe('spatial navigation truth', () => {
  test('direct page entry mounts and physically reveals the requested page', async ({ page }) => {
    await importAndOpen(page, NAV_PDF);

    await enterPage(page, 29);

    await expectPageInViewport(page, 29);
    await expect(page.getByRole('spinbutton', { name: 'Page 29 of 40' })).toBeFocused();
  });

  test('an outline destination physically reveals its page', async ({ page }) => {
    await importAndOpen(page, NAV_PDF);

    await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
    await page.getByRole('button', { name: /Open document contents/ }).click();
    await page.getByRole('link', { name: 'The distant chapter' }).click();

    await expectPageInViewport(page, 17);
    await expect(page.getByRole('spinbutton', { name: 'Page 17 of 40' })).toBeVisible();
  });

  test('a source-search result physically reveals its page', async ({ page }) => {
    await importAndOpen(page, NAV_PDF);

    await page.getByRole('button', { name: 'Search document' }).click();
    await page.getByPlaceholder('Find in document…').fill('Page 23');
    await page.getByPlaceholder('Find in document…').press('Enter');

    await expect(page.getByText('1 of 1 pages · 1 matches')).toBeVisible();
    await expectPageInViewport(page, 23);
    await expect(page.getByRole('spinbutton', { name: 'Page 23 of 40' })).toBeVisible();
  });
});

test.describe('outline availability', () => {
  test('a valid PDF with no outline says so', async ({ page }) => {
    await importAndOpen(page);

    await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
    await page.getByRole('button', { name: /Open document contents/ }).click();

    await expect(page.getByText('This document has no outline.')).toBeVisible();
    await expect(page.getByText('Outline unavailable.')).toHaveCount(0);
  });
});

test.describe('distant position and journal provenance', () => {
  test('leaving and reopening restores the distant page and exact scroll offset', async ({ page }) => {
    await importAndOpen(page);
    await enterPage(page, 31);
    await expectPageInViewport(page, 31);
    await page.waitForTimeout(800);
    const expectedPage = await currentPage(page);
    const expectedOffset = await scrollport(page).evaluate((node) => node.scrollTop);

    await page.getByRole('button', { name: /Open navigation/ }).click();
    await page.getByRole('link', { name: 'Library' }).click();
    await page.getByRole('link', { name: 'Spatial Reader' }).click();

    await expectPageInViewport(page, expectedPage);
    await expect
      .poll(() => scrollport(page).evaluate((node) => node.scrollTop))
      .toBeCloseTo(expectedOffset, 0);
  });

  test('refresh restores the distant visible page and exact scroll offset', async ({ page }) => {
    await importAndOpen(page);
    await enterPage(page, 27);
    await expectPageInViewport(page, 27);
    await scrollport(page).evaluate((node) => node.scrollBy(0, 61));
    await page.waitForTimeout(800);
    const expectedPage = await currentPage(page);
    const expectedOffset = await scrollport(page).evaluate((node) => node.scrollTop);

    await page.reload();

    await expectPageInViewport(page, expectedPage);
    await expect
      .poll(() => scrollport(page).evaluate((node) => node.scrollTop))
      .toBeCloseTo(expectedOffset, 0);
  });

  test('a block captured after natural scrolling inherits the newly visible page', async ({ page }) => {
    const sourceId = await importAndOpen(page);
    await wheelUntilPage(page, 2, 260);
    await expectPageInViewport(page, 2);

    await page.getByRole('button', { name: 'Start writing.' }).click();
    await page.locator('.cn-block-editor__content').last().fill('Captured after scrolling');
    await page.waitForTimeout(800);

    await loadHarness(page);
    await harness(page).call('open', 'cntknw');
    const resumed = await harness(page).call('resume', sourceId);
    expect(resumed.firstBlockPage).toBe(2);
  });
});
