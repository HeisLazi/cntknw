import { expect, test, type Page } from '@playwright/test';
import type { Annotation, AnnotationRect } from '@domain/index';
import type { CntknwGeometryProbe } from '../harness/geometry-probe';
import { makePdf } from '../fixtures/makePdf';
import {
  harness,
  isolatedDatabaseName,
  loadHarness,
  reloadAndReopen,
  resetApplicationStorage,
} from '../browser/harness-client';

const PROBE_URL = '/e2e/harness/geometry-probe.html';
const PDF = makePdf(40, 'Canonical Geometry Probe');
const PDF_BYTES = Array.from(PDF.bytes);

type ProbeMethod = keyof CntknwGeometryProbe;

function probe(page: Page) {
  async function call<K extends ProbeMethod>(
    method: K,
    ...args: Parameters<CntknwGeometryProbe[K]>
  ): Promise<Awaited<ReturnType<CntknwGeometryProbe[K]>>> {
    const result = await page.evaluate(
      ([name, callArgs]) => {
        const operation = window.__cntknwProbe[name as ProbeMethod] as (
          ...values: readonly unknown[]
        ) => unknown;
        return operation(...callArgs);
      },
      [method, args] as [ProbeMethod, readonly unknown[]],
    );
    return result as Awaited<ReturnType<CntknwGeometryProbe[K]>>;
  }
  return { call };
}

async function openProbe(page: Page, initialPage = 1): Promise<void> {
  await page.goto(PROBE_URL);
  await expect(page.locator('body')).toHaveAttribute('data-probe', 'ready');
  expect(await probe(page).call('openPdf', PDF_BYTES, initialPage)).toBe(
    PDF.pageCount,
  );
  await expect(
    page.locator(`.cn-pdf-page[data-page="${initialPage}"] canvas`),
  ).toBeVisible({ timeout: 15_000 });
}

function expectNumberNear(actual: number, expected: number, tolerance = 1): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectRectNear(
  actual: { x: number; y: number; width: number; height: number },
  expected: { x: number; y: number; width: number; height: number },
  tolerance = 1,
): void {
  expectNumberNear(actual.x, expected.x, tolerance);
  expectNumberNear(actual.y, expected.y, tolerance);
  expectNumberNear(actual.width, expected.width, tolerance);
  expectNumberNear(actual.height, expected.height, tolerance);
}

test.describe('Phase 3A canonical annotation geometry', () => {
  test('a real rendered page retains the same source region through zoom', async ({
    page,
  }) => {
    await openProbe(page);
    const api = probe(page);
    const selected = { x: 60, y: 80, width: 150, height: 70 };
    const canonical = await api.call('defineRegion', 1, selected);
    const projectedAtOne = await api.call('renderedRect', 1, canonical);
    const domAtOne = await api.call('domGeometry', 1);

    expectRectNear(projectedAtOne, selected);
    expect(domAtOne).not.toBeNull();
    expectNumberNear(domAtOne!.canvasWidth, 400);
    expectNumberNear(domAtOne!.canvasHeight, 400);
    expectNumberNear(domAtOne!.pageLeft + projectedAtOne.x, domAtOne!.pageLeft + 60);
    expectNumberNear(domAtOne!.pageTop + projectedAtOne.y, domAtOne!.pageTop + 80);

    await api.call('setZoom', 2);
    await expect
      .poll(async () => (await api.call('domGeometry', 1))?.canvasWidth ?? 0)
      .toBeGreaterThan(799);
    const projectedAtTwo = await api.call('renderedRect', 1, canonical);
    const domAtTwo = await api.call('domGeometry', 1);

    expectRectNear(projectedAtTwo, {
      x: 120,
      y: 160,
      width: 300,
      height: 140,
    });
    expectNumberNear(domAtTwo!.canvasWidth, 800);
    expectNumberNear(domAtTwo!.canvasHeight, 800);
  });

  test('virtualization unmounts and remounts without becoming geometry state', async ({
    page,
  }) => {
    await openProbe(page, 2);
    const api = probe(page);
    const selected = { x: 90, y: 110, width: 120, height: 60 };
    const canonical = await api.call('defineRegion', 2, selected);

    await api.call('navigate', 30);
    await expect(page.locator('.cn-pdf-page[data-page="30"] canvas')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.cn-pdf-page[data-page="2"]')).toHaveCount(0);
    expect(await api.call('mountedPages')).toHaveLength(5);

    await api.call('navigate', 2);
    await expect(page.locator('.cn-pdf-page[data-page="2"] canvas')).toBeVisible({
      timeout: 15_000,
    });
    const reconstructed = await api.call('renderedRect', 2, canonical);
    expectRectNear(reconstructed, selected);
  });

  test('repository persistence survives reload and reconstructs on the real reader', async ({
    page,
  }, testInfo) => {
    await resetApplicationStorage(page);
    await openProbe(page, 7);
    const selected = { x: 75, y: 95, width: 180, height: 55 };
    const canonical = await probe(page).call('defineRegion', 7, selected);

    const databaseName = isolatedDatabaseName(testInfo.title);
    await loadHarness(page);
    const storage = harness(page);
    await storage.call('open', databaseName);
    const imported = await storage.call(
      'importPdfSource',
      'Canonical Geometry Probe',
      PDF_BYTES,
      PDF.pageCount,
    );
    const created = await storage.call('createAnnotation', {
      sourceId: imported.sourceId,
      assetId: imported.assetId,
      page: 7,
      kind: 'region',
      anchor: { kind: 'area', rect: canonical },
    });

    await reloadAndReopen(page, databaseName);
    const retrieved = (await harness(page).call(
      'getAnnotation',
      created.id,
    )) as Annotation | null;
    expect(retrieved?.assetId).toBe(imported.assetId);
    expect(retrieved?.page).toBe(7);
    expect(retrieved?.anchor.kind).toBe('area');
    const restoredRect = (retrieved?.anchor.kind === 'area'
      ? retrieved.anchor.rect
      : null) as AnnotationRect | null;
    expect(restoredRect).not.toBeNull();
    await harness(page).call('close');

    await openProbe(page, 7);
    const reconstructed = await probe(page).call(
      'renderedRect',
      7,
      restoredRect!,
    );
    expectRectNear(reconstructed, selected);
  });
});
