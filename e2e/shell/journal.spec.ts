/**
 * The continuous journal — INV-003, INV-004, INV-005.
 *
 * The journal is one leaf with a wide left margin. A block belongs to
 * page 41 because it is set beneath the numeral 41, exactly as a
 * footnote belongs to the page it is printed on. There is no field,
 * no dropdown and no badge, because there is nothing to state.
 *
 * That is the design these tests defend: **provenance carried by
 * position, not by metadata**. If a page-picker ever appears, the
 * first test here should be the thing that objects.
 */
import { test, expect, type Page } from '@playwright/test';
import { makePdf } from '../fixtures/makePdf';
import { resetApplicationStorage } from '../browser/harness-client';

const PDF = makePdf(5, 'A journalled document');

async function openReader(page: Page) {
  // Fresh storage, so no spec depends on what ran before it.
  await resetApplicationStorage(page);
  await page.goto('/library');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'journalled.pdf',
    mimeType: 'application/pdf',
    buffer: PDF.bytes,
  });
  await page.getByRole('link', { name: 'A journalled document' }).click();
  await expect(page.locator('.cn-pdf-page[data-page="1"]')).toBeVisible({
    timeout: 15_000,
  });
}

/** Write on whatever page the reader is currently on. */
async function writeHere(page: Page, text: string) {
  await page.getByRole('button', { name: /Start writing/ }).click();
  const editor = page.locator('.cn-block-editor__content').last();
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.pressSequentially(text, { delay: 15 });
  // Past the journal debounce.
  await page.waitForTimeout(700);
}

/** Navigate to a page from wherever the reader currently is. */
const turnTo = async (page: Page, target: number) => {
  const label = page.locator('.cn-reader__page-input');
  for (let guard = 0; guard < PDF.pageCount * 2; guard += 1) {
    const current = Number(await label.inputValue() ?? '0');
    if (current === target) break;
    await page
      .getByRole('button', { name: current < target ? 'Next page' : 'Previous page' })
      .click();
  }
  await expect(label).toHaveValue(String(target));
  await expect(page.locator('.cn-run--active .cn-run__folio')).toHaveText(`p.${target}`);
};

test.describe('AC-003 — page context is inherited, never asked for', () => {
  test('the reader is never offered a way to choose a page', async ({ page }) => {
    // INV-004 is a promise about what the interface does NOT contain.
    // A select, a combobox or a spinbutton in the journal would mean
    // the user is being asked — which is precisely the thing the
    // whole two-pane design exists to avoid.
    await openReader(page);

    const journal = page.locator('.cn-journal');
    await expect(journal.getByRole('combobox')).toHaveCount(0);
    await expect(journal.getByRole('spinbutton')).toHaveCount(0);
    await expect(journal.locator('select')).toHaveCount(0);
    await expect(journal.locator('input')).toHaveCount(0);
  });

  test('the active page is marked in the margin, not stated in a field', async ({
    page,
  }) => {
    await openReader(page);

    // One run is current, and its folio says which page.
    const active = page.locator('.cn-run--active');
    await expect(active).toHaveCount(1);
    await expect(active.locator('.cn-run__folio')).toHaveText('p.1');

    await turnTo(page, 3);
    await expect(page.locator('.cn-run--active .cn-run__folio')).toHaveText('p.3');
  });

  test('a block written on page 3 is set beneath the numeral 3', async ({ page }) => {
    await openReader(page);
    await turnTo(page, 3);
    await writeHere(page, 'A note about page three.');

    // The note lives inside the run whose folio reads p.3. That
    // containment IS the provenance.
    const runThree = page.locator('.cn-run', {
      has: page.locator('.cn-run__folio', { hasText: 'p.3' }),
    });
    await expect(runThree).toContainText('A note about page three.');
  });

  test('continuing a note keeps it on its own page, not on the visible one', async ({
    page,
  }) => {
    // The trap this guards: pressing Enter inside a note about page 3
    // must create a sibling on page 3 — even if the reader has since
    // scrolled the source to page 5. Continuing inherits from the
    // block; only capturing uses the active page.
    await openReader(page);
    await turnTo(page, 3);
    await writeHere(page, 'First line on three.');

    await turnTo(page, 5);

    const editor = page
      .locator('.cn-run', { has: page.locator('.cn-run__folio', { hasText: 'p.3' }) })
      .locator('.cn-block-editor__content')
      .first();
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second line, still on three.');
    await page.waitForTimeout(700);

    const runThree = page.locator('.cn-run', {
      has: page.locator('.cn-run__folio', { hasText: 'p.3' }),
    });
    await expect(runThree).toContainText('Second line, still on three.');

    // And it did NOT land on page 5.
    const runFive = page.locator('.cn-run', {
      has: page.locator('.cn-run__folio', { hasText: 'p.5' }),
    });
    await expect(runFive).not.toContainText('Second line, still on three.');
  });
});

test.describe('AC-004 / INV-005 — empty pages create no section', () => {
  test('a five-page book with one note shows one folio, not five', async ({
    page,
  }) => {
    // The rule that makes a continuous journal over a 400-page book
    // readable at all. Sixty notes should be sixty numerals, not four
    // hundred headers with silence between them.
    await openReader(page);
    await turnTo(page, 3);
    await writeHere(page, 'The only note in this book.');

    // Move somewhere with no writing so the composing line is not
    // counted — it is transient and belongs to the caret, not the data.
    await turnTo(page, 1);

    const folios = page.locator('.cn-run__folio');
    const texts = await folios.allTextContents();
    // p.3 for the real run, p.1 for the composing line the reader is on.
    expect(texts.sort()).toEqual(['p.1', 'p.3']);
  });

  test('the composing line persists nothing if the reader writes nothing', async ({
    page,
  }) => {
    // INV-005 must hold in the DATA, not only in the view. A visited
    // page that was never written on must leave no trace at all.
    await openReader(page);
    await turnTo(page, 2);
    await expect(page.locator('.cn-run--composing')).toHaveCount(1);

    await turnTo(page, 4);
    await page.reload();
    await expect(page.locator('.cn-pdf-page[data-page="4"]')).toBeVisible({
      timeout: 15_000,
    });

    // Only the composing line for page 4. Pages 1, 2 and 3 were
    // visited and left nothing behind.
    await expect(page.locator('.cn-run')).toHaveCount(1);
    await expect(page.locator('.cn-run__folio')).toHaveText('p.4');
  });
});

test.describe('INV-003 — one continuous journal', () => {
  test('notes from several pages are all present in one scroll', async ({ page }) => {
    // Not a notebook per page. Turning a page changes which run is
    // marked current; it does not hide the rest of the journal.
    await openReader(page);

    await turnTo(page, 2);
    await writeHere(page, 'Note on two.');
    await turnTo(page, 4);
    await writeHere(page, 'Note on four.');

    await expect(page.getByText('Note on two.')).toBeVisible();
    await expect(page.getByText('Note on four.')).toBeVisible();

    // Runs are in page order.
    const folios = await page.locator('.cn-run__folio').allTextContents();
    expect(folios).toEqual(['p.2', 'p.4']);
  });

  test('the whole journal survives a reload, in order', async ({ page }) => {
    await openReader(page);
    await turnTo(page, 2);
    await writeHere(page, 'Durable note on two.');
    await turnTo(page, 5);
    await writeHere(page, 'Durable note on five.');

    await page.reload();
    await expect(page.locator('.cn-pdf-page[data-page="5"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText('Durable note on two.')).toBeVisible();
    await expect(page.getByText('Durable note on five.')).toBeVisible();
    const folios = await page.locator('.cn-run__folio').allTextContents();
    expect(folios).toEqual(['p.2', 'p.5']);
  });
});
