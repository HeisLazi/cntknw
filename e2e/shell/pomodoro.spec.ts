import { expect, test, type Locator, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(4, 'A timed study');

async function openStudyWorkspace(page: Page) {
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'timed-study.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'A timed study' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
    timeout: 15_000,
  });
}

async function displayedSeconds(timer: Locator): Promise<number> {
  const value = await timer.locator('.cn-pomodoro__summary-time').textContent();
  const match = value?.match(/^(\d+):(\d{2})$/);
  if (!match) throw new Error(`Unexpected timer display: ${String(value)}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

test('focus timer continues through navigation, pauses, resumes, resets, and stays local', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openStudyWorkspace(page);

  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  const topTimer = page.locator('.cn-pomodoro--chrome');
  await expect(topTimer.locator('.cn-pomodoro__summary-time')).toHaveText('25:00');
  await topTimer.locator('> summary').focus();
  await page.keyboard.press('Enter');
  await topTimer.getByRole('button', { name: 'Start' }).focus();
  await page.keyboard.press('Enter');
  const startedAt = await displayedSeconds(topTimer);
  await page.waitForTimeout(1_200);
  expect(await displayedSeconds(topTimer)).toBeLessThan(startedAt);

  // A workspace projection is presentation only; it must not remount the timer.
  await topTimer.locator('> summary').click();
  await page.getByRole('button', { name: 'Reveal workspace controls' }).click();
  await page.getByRole('button', { name: 'Source Focus' }).click();
  await expect(page.getByRole('region', { name: 'Source pages' })).toBeVisible();

  // Navigate to another primary destination, then operate the same timer from
  // the left overlay. No route owns the timer state.
  await page.getByRole('button', { name: /Open navigation/ }).click();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const navTimer = nav.locator('.cn-pomodoro--nav');
  const beforeNavigation = await displayedSeconds(navTimer);
  await nav.getByRole('link', { name: 'Gallery' }).click();
  await expect(page.getByRole('heading', { name: 'Gallery', level: 1 })).toBeVisible();
  await page.waitForTimeout(1_200);
  await page.getByRole('button', { name: /Open navigation/ }).click();
  expect(await displayedSeconds(navTimer)).toBeLessThan(beforeNavigation);

  await navTimer.locator('> summary').focus();
  await page.keyboard.press('Enter');
  await navTimer.getByRole('button', { name: 'Pause' }).focus();
  await page.keyboard.press('Enter');
  const pausedAt = await displayedSeconds(navTimer);
  await page.waitForTimeout(1_200);
  expect(await displayedSeconds(navTimer)).toBe(pausedAt);

  await navTimer.getByRole('button', { name: 'Resume' }).click();
  await page.waitForTimeout(1_200);
  expect(await displayedSeconds(navTimer)).toBeLessThan(pausedAt);

  await navTimer.getByRole('button', { name: 'Reset' }).click();
  await expect(navTimer.locator('.cn-pomodoro__summary-time')).toHaveText('25:00');
  await expect(navTimer.locator('> summary')).toHaveAttribute('aria-label', /ready$/);

  // Listener begins only after the app and PDF are fully loaded. Timer state
  // transitions and client-side navigation must issue no requests at all.
  expect(requests).toEqual([]);
});
