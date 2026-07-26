/**
 * Phase 0D — routing and information architecture, in a real browser.
 *
 * The component tests already assert the route table and the shell.
 * What they cannot assert is the thing users actually do: type a URL,
 * press refresh, and expect to still be where they were. That needs a
 * real browser history and a real reload, so it lives here.
 */
import { test, expect } from '@playwright/test';
import { seedApplicationSource } from '../browser/harness-client';

const PRIMARY = ['Library', 'Gallery', 'Notes'] as const;

test.describe('primary destinations', () => {
  test('shows exactly three, and only the three', async ({ page }) => {
    await page.goto('/library');

    const nav = page.getByRole('navigation', { name: 'Primary' });
    const primaryLinks = nav.locator('.cn-nav__primary').getByRole('link');

    await expect(primaryLinks).toHaveCount(3);
    await expect(primaryLinks).toHaveText([...PRIMARY]);
  });

  test('does not promote settings or the component lab to a primary tab', async ({
    page,
  }) => {
    await page.goto('/library');

    const primary = page
      .getByRole('navigation', { name: 'Primary' })
      .locator('.cn-nav__primary');

    await expect(primary.getByRole('link', { name: 'Settings' })).toHaveCount(0);
    await expect(primary.getByRole('link', { name: 'Components' })).toHaveCount(0);

    // Both are still reachable — they are secondary, not hidden.
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: 'Settings', level: 1 }),
    ).toBeVisible();
  });

  test('marks the current destination for assistive technology', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.locator('[aria-current="page"]')).toHaveText('Gallery');
  });
});

test.describe('stable URLs survive a refresh', () => {
  for (const [path, heading] of [
    ['/library', 'Library'],
    ['/gallery', 'Gallery'],
    ['/notes', 'Notes'],
    ['/settings', 'Settings'],
  ] as const) {
    test(`${path} loads directly and survives reload`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }

  test('/study/:sourceId loads directly and survives reload', async ({ page }) => {
    // A real source, created through the same composition the app
    // uses — so this is the workspace opening, not a placeholder.
    const sourceId = await seedApplicationSource(page, 'The Wretched of the Earth');
    const path = `/study/${sourceId}`;

    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'The Wretched of the Earth' }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'The Wretched of the Earth' }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
  });

  test('the root redirects to Library rather than to a fourth destination', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/library');
  });
});

test.describe('books and artworks share one workspace', () => {
  test('an artwork opens at /study/:sourceId, the same route as a book', async ({
    page,
  }) => {
    // INV-002. A separate artwork viewer would fork every capability
    // built into the workspace.
    const sourceId = await seedApplicationSource(page, 'A studied work');
    await page.goto(`/study/${sourceId}`);
    await expect(
      page.getByRole('separator', { name: 'Source and journal' }),
    ).toBeVisible();
  });
});

test.describe('recovery', () => {
  test('an unknown route is recoverable', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(
      page.getByRole('heading', { name: 'Page not found', level: 1 }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Back to Library' }).click();
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();
  });

  test('a missing source is reported as missing, not as a 404, and is recoverable', async ({
    page,
  }) => {
    await page.goto('/study/2f1c0f8e-9b7a-4d2e-8c1f-5a6b7c8d9e0f');

    await expect(
      page.getByRole('heading', { name: 'That source is not in your library' }),
    ).toBeVisible();
    await expect(page.getByText('Page not found')).toHaveCount(0);

    await page.getByRole('link', { name: 'Back to Library' }).click();
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();
  });
});
