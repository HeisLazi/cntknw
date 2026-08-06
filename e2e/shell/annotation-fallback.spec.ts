import { expect, test, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import {
  countPageAnnotations,
  harness,
  loadHarness,
  resetApplicationStorage,
  seedFallbackAnnotation,
} from '../browser/harness-client';

const PDF = makePdf(3, 'Legacy Fallback Acceptance');

async function importPdf(page: Page): Promise<string> {
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'legacy-fallback-acceptance.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'Legacy Fallback Acceptance' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"] canvas')).toBeVisible({
    timeout: 15_000,
  });
  const sourceId = new URL(page.url()).pathname.split('/').at(-1);
  if (!sourceId) throw new Error('Imported source route has no source ID');
  return sourceId;
}

test('legacy fallback stays durable without a fabricated spatial mark', async ({
  page,
}) => {
  const sourceId = await importPdf(page);

  await loadHarness(page);
  await harness(page).call('open', 'cntknw');
  const fallback = await seedFallbackAnnotation(page, sourceId, 1);
  expect(await countPageAnnotations(page, sourceId, fallback.assetId, 1)).toBe(1);
  await harness(page).call('close');

  await page.goto(`/study/${sourceId}`);
  await expect(page.locator('.cn-pdf-page[data-page="1"] canvas')).toBeVisible({
    timeout: 15_000,
  });
  const notice = page.getByRole('status').filter({
    hasText: 'A legacy annotation on this page could not be positioned precisely.',
  });
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`[data-annotation-id="${fallback.id}"]`)).toHaveCount(0);
  await expect(
    page.locator('.cn-pdf-page[data-page="1"] .cn-annotation--point'),
  ).toHaveCount(0);

  await page.reload();
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`[data-annotation-id="${fallback.id}"]`)).toHaveCount(0);

  await loadHarness(page);
  await harness(page).call('open', 'cntknw');
  expect(await countPageAnnotations(page, sourceId, fallback.assetId, 1)).toBe(1);
  await harness(page).call('close');
});
