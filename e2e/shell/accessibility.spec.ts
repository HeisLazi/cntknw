/**
 * Phase 0D — accessibility and responsive behaviour, in a real browser.
 *
 * Focus visibility, reduced motion and viewport behaviour depend on
 * the browser's own computed styles and media queries. jsdom has
 * neither a layout engine nor `prefers-reduced-motion`, so these
 * cannot be asserted anywhere but here.
 */
import { test, expect, type Page } from '@playwright/test';

/**
 * Put keyboard focus in a known place before tabbing.
 *
 * Two separate things have to be true, and each was a real failure:
 *
 * `locator('body').press(...)` rather than `keyboard.press(...)`,
 * because a freshly navigated page has no focused element and a raw
 * key event then has nowhere to start from. Blurring first is *not*
 * equivalent — it was tried, and it fails every time, because the
 * key event still needs a focus context to move from.
 *
 * `bringToFront()` because the whole suite shares a browser: when
 * another page had the window, the Tab occasionally went nowhere and
 * the test failed roughly one full run in four while the application
 * was correct. That is the worst kind of failure — it teaches people
 * to re-run rather than to read.
 */
async function startTabbingFromTop(page: Page): Promise<void> {
  await page.bringToFront();
  // `bringToFront` resolves before the page has necessarily *received*
  // focus, and a Tab dispatched into an unfocused document goes
  // nowhere. Waiting for `document.hasFocus()` makes the precondition
  // explicit instead of hoping the race lands the right way — which
  // it did, about three runs in four.
  await page.waitForFunction(() => document.hasFocus(), undefined, {
    timeout: 5_000,
  });
  await page.locator('body').press('Tab');
}

test.describe('keyboard access', () => {
  test('the first tab stop is a skip link that moves focus to main', async ({
    page,
  }) => {
    await page.goto('/library');
    await startTabbingFromTop(page);

    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    // Off-screen until focused, then brought into view — display:none
    // would make it unfocusable and therefore useless.
    await expect(skip).toBeInViewport();

    await page.keyboard.press('Enter');
    await expect(page.locator('#cn-main')).toBeFocused();
  });

  test('focus is visible, not merely present', async ({ page }) => {
    await page.goto('/library');
    await startTabbingFromTop(page);
    await page.keyboard.press('Tab');

    const outline = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return null;
      const style = getComputedStyle(active);
      return {
        width: style.outlineWidth,
        style: style.outlineStyle,
        color: style.outlineColor,
      };
    });

    expect(outline).not.toBeNull();
    expect(outline?.style).not.toBe('none');
    expect(parseFloat(outline?.width ?? '0')).toBeGreaterThan(0);
  });

  test('every primary destination is reachable by keyboard alone', async ({ page }) => {
    await page.goto('/library');

    // Tab past the skip link to the always-reachable overlay trigger.
    await startTabbingFromTop(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Open navigation/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Library' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Gallery' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Gallery', level: 1 })).toBeVisible();
  });

  test('the navigation shortcut closes the overlay and returns focus to its trigger', async ({
    page,
  }) => {
    await page.goto('/library');
    const trigger = page.getByRole('button', { name: /Open navigation/ });
    await trigger.focus();
    await page.keyboard.press('Control+Shift+M');
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    await page.keyboard.press('Control+Shift+M');
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('focus moves to main after a client-side navigation', async ({ page }) => {
    // Without this, a single-page navigation leaves focus on the link
    // and announces nothing — the keyboard user has to tab through
    // the whole nav again after every move.
    await page.goto('/library');
    await page.getByRole('button', { name: /Open navigation/ }).click();
    await page.getByRole('link', { name: 'Notes' }).click();
    await expect(page.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
    await expect(page.locator('#cn-main')).toBeFocused();
  });
});

test.describe('landmarks and headings', () => {
  test('exposes one main landmark and one h1 per route', async ({ page }) => {
    for (const path of ['/library', '/gallery', '/notes', '/settings']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });

  test('names the primary navigation landmark', async ({ page }) => {
    await page.goto('/library');
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(1);
  });
});

test.describe('reduced motion', () => {
  test('collapses every motion duration token', async ({ page }) => {
    // emulateMedia rather than the project-level option, so the
    // preference is set explicitly at the point it is asserted.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/library');

    const durations = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return ['instant', 'fast', 'normal', 'slow'].map((name) =>
        style.getPropertyValue(`--cn-duration-${name}`).trim(),
      );
    });

    // 1ms rather than 0: `transitionend` still fires, so any state
    // machine waiting on it does not hang.
    expect(durations).toEqual(['1ms', '1ms', '1ms', '1ms']);
  });

  test('leaves no long transition on a rendered control', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/library');
    const longest = await page.evaluate(() => {
      let max = 0;
      for (const element of document.querySelectorAll('*')) {
        const durations = getComputedStyle(element)
          .transitionDuration.split(',')
          .map((value) => parseFloat(value) * 1000);
        for (const duration of durations) {
          if (Number.isFinite(duration) && duration > max) max = duration;
        }
      }
      return max;
    });
    expect(longest).toBeLessThanOrEqual(1);
  });
});

test.describe('motion is present when not suppressed', () => {
  test('transitions are real without a reduced-motion preference', async ({ page }) => {
    // The reduced-motion test above would pass trivially if nothing
    // animated in the first place.
    await page.goto('/library');
    const normal = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--cn-duration-normal')
        .trim(),
    );
    expect(normal).not.toBe('1ms');
  });
});

test.describe('responsive navigation', () => {
  test('desktop overlay keeps all three destinations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/library');
    await page.getByRole('button', { name: /Open navigation/ }).click();

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.locator('.cn-nav__primary').getByRole('link')).toHaveCount(3);
    await expect(page.getByText('CNTKNW', { exact: true })).toBeVisible();
  });

  test('a narrow viewport keeps all three destinations reachable', async ({ page }) => {
    // Phone prioritises navigation over imitating the desktop
    // workspace — but it never drops a destination to make room.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/library');
    await page.getByRole('button', { name: /Open navigation/ }).click();

    const nav = page.getByRole('navigation', { name: 'Primary' });
    const links = nav.locator('.cn-nav__primary').getByRole('link');
    await expect(links).toHaveCount(3);

    for (const name of ['Library', 'Gallery', 'Notes']) {
      await expect(nav.getByRole('link', { name })).toBeInViewport();
    }

    await nav.getByRole('link', { name: 'Notes' }).click();
    await expect(page.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
  });

  test('the page does not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/library');
    await page.getByRole('button', { name: /Open navigation/ }).click();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test('touch targets in the phone navigation are large enough to hit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/library');
    await page.getByRole('button', { name: /Open navigation/ }).click();

    const nav = page.getByRole('navigation', { name: 'Primary' });
    const links = nav.locator('.cn-nav__primary').getByRole('link');
    const count = await links.count();

    for (let index = 0; index < count; index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box, 'every nav link must have a box').not.toBeNull();
      // 44px is the smallest reliably hittable target.
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('resizable text', () => {
  test('survives a large browser text size without clipping the shell', async ({
    page,
  }) => {
    await page.goto('/library');
    // Emulates the user raising their browser's default font size —
    // which is why nothing in base.css overrides html { font-size }.
    await page.addStyleTag({ content: 'html { font-size: 24px; }' });
    await page.getByRole('button', { name: /Open navigation/ }).click();

    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
