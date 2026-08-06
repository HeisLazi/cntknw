/**
 * Typed client for the in-page harness.
 *
 * `import type` only — nothing from the browser bundle is executed in
 * the Node test process. The import is still required: it is what
 * brings the harness module's `declare global` augmentation of
 * `window.__cntknw` into scope, so every call below is checked against
 * the real signature rather than a hand-copied duplicate that could
 * drift.
 */
import { expect, type Page } from '@playwright/test';
import type { CntknwHarness } from '../harness/harness';

/** A distinct v2 database per test. IndexedDB is origin-global. */
export function isolatedDatabaseName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `cntknw-e2e-${slug}-${crypto.randomUUID()}`;
}

type Method = keyof CntknwHarness;

/**
 * Call a harness method in the page, preserving its argument and
 * return types.
 */
export function harness(page: Page) {
  async function call<K extends Method>(
    method: K,
    ...args: Parameters<CntknwHarness[K]>
  ): Promise<Awaited<ReturnType<CntknwHarness[K]>>> {
    const result = await page.evaluate(
      ([name, callArgs]) => {
        const target = window.__cntknw[name as Method] as (
          ...values: readonly unknown[]
        ) => Promise<unknown>;
        return target(...callArgs);
      },
      [method, args] as [string, readonly unknown[]],
    );
    return result as Awaited<ReturnType<CntknwHarness[K]>>;
  }

  return { call };
}

export async function seedFallbackAnnotation(
  page: Page,
  sourceId: string,
  pageNumber: number,
) {
  return harness(page).call('seedFallbackAnnotation', sourceId, pageNumber);
}

export async function countPageAnnotations(
  page: Page,
  sourceId: string,
  assetId: string,
  pageNumber: number,
): Promise<number> {
  return harness(page).call(
    'countPageAnnotations',
    sourceId,
    assetId,
    pageNumber,
  );
}

/**
 * Load the harness page and wait for the composition surface to be
 * installed. Called again after every reload, which is the point:
 * BV-001 requires the composition to be rebuilt from nothing.
 */
export const HARNESS_URL = '/e2e/harness/index.html';

/**
 * Clear every origin-scoped store the application writes to.
 *
 * Playwright gives each test a fresh browser context, which is
 * usually enough — but specs that drive the *application* rather than
 * the harness all import into the same production database name, and
 * anything that does survive turns a green suite into an
 * order-dependent one. An accumulated library also breaks strict-mode
 * locators: two sources with the same title, and `getByRole('link',
 * { name })` no longer resolves.
 *
 * Cheap, and it removes the entire class of problem rather than the
 * instance of it that happened to be noticed.
 */
export async function resetApplicationStorage(page: Page): Promise<void> {
  // Reset from the harness page, NOT from the application.
  //
  // The application opens `cntknw` on start-up and holds the
  // connection for as long as it is mounted, so `deleteDatabase`
  // issued from an application page is `blocked` and silently does
  // nothing. The harness is same-origin — so it can see and delete
  // the same databases — but opens none of them until asked.
  await page.goto(HARNESS_URL);
  await page.evaluate(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Never the reason a test fails.
    }
    const databases = await indexedDB.databases();
    await Promise.all(
      databases
        .map((entry) => entry.name)
        .filter((name): name is string => typeof name === 'string')
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase(name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }),
        ),
    );
  });
  await page.reload();
}

export async function loadHarness(page: Page): Promise<void> {
  await page.goto(HARNESS_URL);
  await expect(page.locator('body')).toHaveAttribute('data-harness', 'ready');
}

/** Reload the page, then rebuild the composition against the same database. */
export async function reloadAndReopen(
  page: Page,
  databaseName: string,
): Promise<void> {
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-harness', 'ready');
  await harness(page).call('open', databaseName);
}

/**
 * Seed the application's own database through the harness.
 *
 * The harness and the application are served from one origin, so a
 * source created here is a source the real UI can open. That is what
 * lets the routing suite exercise `/study/:sourceId` against a
 * source that actually exists, rather than only against a missing
 * one.
 */
export async function seedApplicationSource(
  page: Page,
  title: string,
): Promise<string> {
  await loadHarness(page);
  const api = harness(page);
  // 'cntknw' is the production database name the app's composition
  // root opens. Playwright isolates storage per test, so this does
  // not leak into any other spec.
  await api.call('open', 'cntknw');
  const imported = await api.call('importSource', title);
  await api.call('close');
  return imported.sourceId;
}
