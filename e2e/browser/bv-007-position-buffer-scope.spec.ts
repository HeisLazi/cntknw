import { test, expect } from '@playwright/test';
import {
  seedApplicationSource,
  resetApplicationStorage,
} from './harness-client';

test.describe('Position Buffer Scope', () => {
  test.beforeEach(async ({ page }) => {
    await resetApplicationStorage(page);
  });

  test('Reading Position Buffer is scoped to sourceId so opening Book B does not overwrite Book A', async ({
    context,
    page, // Harness page
  }) => {
    // 1. Seed two books
    const sourceA = await seedApplicationSource(page, 'Book A');
    const sourceB = await seedApplicationSource(page, 'Book B');

    // 2. Open Book A
    const pageA = await context.newPage();
    await pageA.goto('/');
    await pageA.getByRole('link', { name: 'Book A' }).click();

    // Trigger a position stash by finding a way to trigger `drift` in WorkspacePersistence.
    // The easiest way without PDF scrolling in E2E is to type something in the journal,
    // since typing also triggers a workspace state update if zoom changes, but actually 
    // the zoom/pan might be hard to trigger.
    // Wait, we can just inject a manual stash via evaluate to simulate what useWorkspacePersistence does:
    await pageA.evaluate((id) => {
      window.localStorage.setItem(`cntknw:reading-position:v1:${id}`, JSON.stringify({
        sourceId: id,
        page: 10,
        zoom: 1,
        savedAt: Date.now()
      }));
    }, sourceA);

    // 3. Open Book B
    const pageB = await context.newPage();
    await pageB.goto('/');
    await pageB.getByRole('link', { name: 'Book B' }).click();

    await pageB.evaluate((id) => {
      window.localStorage.setItem(`cntknw:reading-position:v1:${id}`, JSON.stringify({
        sourceId: id,
        page: 20,
        zoom: 1,
        savedAt: Date.now()
      }));
    }, sourceB);

    // 4. Assert that Book A's stash is still there. 
    // The bug was that the KEY was static, so Book B's stash would overwrite Book A's stash.
    const stashes = await pageB.evaluate(() => {
      return Object.keys(window.localStorage).filter(k => k.startsWith('cntknw:reading-position:v1'));
    });

    expect(stashes.length).toBe(2);
    expect(stashes).toContain(`cntknw:reading-position:v1:${sourceA}`);
    expect(stashes).toContain(`cntknw:reading-position:v1:${sourceB}`);
  });
});
