/**
 * The PDF text layer.
 *
 * Until this existed, a rendered page was a picture of a page. These
 * tests assert the difference: that the words are really in the DOM,
 * really selectable, really findable, and really positioned over the
 * glyphs they belong to.
 *
 * That last one is the part worth testing hardest. A text layer whose
 * geometry is wrong still passes "the text is present" — and is worse
 * than none, because selection appears to work and selects the wrong
 * words. Phase 3 will anchor annotations to these spans, so a
 * misaligned layer would put every highlight in the wrong place.
 */
import { test, expect, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';

const PDF = makePdf(4, 'A readable document');

async function openReader(page: Page) {
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'readable.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'A readable document' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
    timeout: 15_000,
  });
}

/** The text layer of a given page. */
const textLayerOf = (page: Page, pageNumber: number) =>
  page.locator(`.cn-pdf-page[data-page="${pageNumber}"] .cn-pdf-page__text`);

test.describe('the page text is really there', () => {
  test('the words are in the DOM, not only painted on a canvas', async ({ page }) => {
    await openReader(page);

    const layer = textLayerOf(page, 1);
    await expect(layer).not.toBeEmpty({ timeout: 15_000 });
    // The fixture draws "Page 1" as real text on page 1.
    await expect(layer).toContainText('Page 1');
  });

  test('each page carries its own text, not the first page repeated', async ({
    page,
  }) => {
    // A text layer wired to the wrong page is a plausible bug that
    // "text exists" would not catch.
    await openReader(page);
    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(textLayerOf(page, 2)).toContainText('Page 2', { timeout: 15_000 });
    await expect(textLayerOf(page, 2)).not.toContainText('Page 1');
  });

  test('the canvas is hidden from assistive technology now the text exists', async ({
    page,
  }) => {
    // A labelled canvas would make a screen reader announce "Page 3,
    // image" and then read the page — the label becomes noise in
    // front of the real content.
    await openReader(page);
    const canvas = page.locator('.cn-pdf-page[data-page="1"] canvas');
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  });

  test('the reader announces which page it is on before the page text', async ({
    page,
  }) => {
    await openReader(page);
    const marker = page.locator('.cn-pdf-page[data-page="1"] .cn-visually-hidden');
    await expect(marker).toHaveText('Page 1');
  });
});

test.describe('the text can be used', () => {
  test('a selection returns the page text', async ({ page }) => {
    await openReader(page);
    await expect(textLayerOf(page, 1)).toContainText('Page 1', { timeout: 15_000 });

    const selected = await page.evaluate(() => {
      const layer = document.querySelector('.cn-pdf-page[data-page="1"] .cn-pdf-page__text');
      if (!layer) return null;
      const range = document.createRange();
      range.selectNodeContents(layer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return selection?.toString() ?? null;
    });

    expect(selected).toContain('Page 1');
  });

  test('the text is transparent but not hidden — it must stay hit-testable', async ({
    page,
  }) => {
    // `opacity: 0` or `visibility: hidden` would look identical and
    // silently break selection, find-in-page and annotation anchoring.
    await openReader(page);
    await expect(textLayerOf(page, 1)).toContainText('Page 1', { timeout: 15_000 });

    const style = await page.evaluate(() => {
      const span = document.querySelector(
        '.cn-pdf-page[data-page="1"] .cn-pdf-page__text span',
      );
      if (!span) return null;
      const computed = getComputedStyle(span);
      return {
        color: computed.color,
        visibility: computed.visibility,
        opacity: computed.opacity,
        display: computed.display,
      };
    });

    expect(style).not.toBeNull();
    expect(style?.color).toBe('rgba(0, 0, 0, 0)');
    expect(style?.visibility).toBe('visible');
    expect(style?.opacity).toBe('1');
    expect(style?.display).not.toBe('none');
  });
});

test.describe('the text is positioned over the glyphs it belongs to', () => {
  test('spans sit inside the page they annotate', async ({ page }) => {
    await openReader(page);
    await expect(textLayerOf(page, 1)).toContainText('Page 1', { timeout: 15_000 });

    const geometry = await page.evaluate(() => {
      const pageEl = document.querySelector('.cn-pdf-page[data-page="1"]');
      const span = pageEl?.querySelector('.cn-pdf-page__text span');
      if (!pageEl || !span) return null;
      const pageBox = pageEl.getBoundingClientRect();
      const spanBox = span.getBoundingClientRect();
      return {
        insideHorizontally:
          spanBox.left >= pageBox.left - 1 && spanBox.right <= pageBox.right + 1,
        insideVertically:
          spanBox.top >= pageBox.top - 1 && spanBox.bottom <= pageBox.bottom + 1,
        hasSize: spanBox.width > 0 && spanBox.height > 0,
      };
    });

    expect(geometry?.hasSize, 'a zero-sized span cannot be selected').toBe(true);
    expect(geometry?.insideHorizontally).toBe(true);
    expect(geometry?.insideVertically).toBe(true);
  });

  test('the text layer rescales with zoom instead of drifting', async ({ page }) => {
    // The geometry pdf.js emits is multiplied by --scale-factor. If
    // that is not updated on zoom, selection lands further from the
    // words the more the reader zooms — and the layer would still
    // "contain the text", so only measuring catches it.
    await openReader(page);
    await expect(textLayerOf(page, 1)).toContainText('Page 1', { timeout: 15_000 });

    const measure = () =>
      page.evaluate(() => {
        const pageEl = document.querySelector('.cn-pdf-page[data-page="1"]');
        const canvas = pageEl?.querySelector('canvas');
        const span = pageEl?.querySelector('.cn-pdf-page__text span');
        if (!canvas || !span) return null;
        const canvasBox = canvas.getBoundingClientRect();
        const spanBox = span.getBoundingClientRect();
        return {
          canvasWidth: canvasBox.width,
          // Where the span starts, as a fraction of the page width.
          relativeLeft: (spanBox.left - canvasBox.left) / canvasBox.width,
          relativeTop: (spanBox.top - canvasBox.top) / canvasBox.height,
          spanWidth: spanBox.width,
        };
      });

    const before = await measure();
    expect(before).not.toBeNull();

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText('125%')).toBeVisible();
    // Give the re-render time to settle at the new scale.
    await expect
      .poll(async () => (await measure())?.canvasWidth ?? 0, { timeout: 15_000 })
      .toBeGreaterThan(before!.canvasWidth);

    const after = await measure();
    expect(after).not.toBeNull();

    // The span kept its position *relative to the page* — that is
    // what "aligned" means, and it is scale-independent.
    expect(after!.relativeLeft).toBeCloseTo(before!.relativeLeft, 2);
    expect(after!.relativeTop).toBeCloseTo(before!.relativeTop, 2);
    // And it grew with the page rather than staying its old size.
    expect(after!.spanWidth).toBeGreaterThan(before!.spanWidth);
  });
});
