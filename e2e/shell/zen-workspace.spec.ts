import { expect, test, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(8, 'Zen Workspace');

async function openImportedSource(page: Page) {
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'zen-workspace.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'Zen Workspace' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('WORKSPACE UX-1 — zen workspace shell', () => {
  test.use({ viewport: { width: 1360, height: 850 } });

  test('restores split preference and preserves reading position through focus projections', async ({
    page,
  }) => {
    await openImportedSource(page);

    const nav = page.locator('#cn-primary-navigation');
    const navTrigger = page.getByRole('button', { name: /Open navigation/ });
    await expect(nav).toBeHidden();
    await expect(navTrigger).toHaveAttribute('aria-expanded', 'false');

    const reveal = page.getByRole('button', { name: 'Reveal workspace controls' });
    await reveal.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Source Focus' })).toBeVisible();

    const separator = page.getByRole('separator', { name: 'Source and journal' });
    await expect(separator).toHaveAttribute('aria-valuenow', '70');
    await separator.focus();
    for (let step = 0; step < 5; step += 1) await page.keyboard.press('ArrowLeft');
    await expect(separator).toHaveAttribute('aria-valuenow', '60');
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('separator', { name: 'Source and journal' }))
      .toHaveAttribute('aria-valuenow', '60');

    await navTrigger.click();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(nav.locator('.cn-nav__primary').getByRole('link')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(navTrigger).toBeFocused();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(
      page.getByRole('spinbutton', { name: `Page 2 of ${PDF.pageCount}` }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
    await page.getByRole('button', { name: 'Source Focus' }).click();
    await expect(page.getByRole('region', { name: 'Source pages' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Writing workspace' })).toBeHidden();
    const focusWidths = await page.locator('.cn-study__panes > .cn-split').evaluate((split) => {
      const pane = split.querySelector<HTMLElement>('[data-pane="start"]');
      return {
        container: split.getBoundingClientRect().width,
        pane: pane?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(Math.abs(focusWidths.container - focusWidths.pane)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Split' }).click();
    await expect(page.getByRole('region', { name: 'Writing workspace' })).toBeVisible();
    await expect(
      page.getByRole('spinbutton', { name: `Page 2 of ${PDF.pageCount}` }),
    ).toBeVisible();
  });
});
