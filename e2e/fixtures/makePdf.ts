/**
 * A real, valid PDF, built byte by byte.
 *
 * The import and resume specs need a document pdf.js will actually
 * parse and render. Checking a binary fixture into the repository
 * would work, but it would be opaque — nobody could tell what the
 * test was reading, or change the page count without finding a new
 * file. This is thirty lines and the page count is an argument.
 *
 * The cross-reference table is written with real byte offsets rather
 * than relying on pdf.js's recovery path for broken xrefs. A fixture
 * that only loads because the parser is forgiving is not testing
 * what it appears to test.
 */

export interface GeneratedPdf {
  bytes: Buffer;
  pageCount: number;
}

export function makePdf(pageCount = 3, title = 'CNTKNW test document'): GeneratedPdf {
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];

  // 1 catalog, 2 page tree, 3 font — then two objects per page.
  const firstPageObject = 4;
  for (let i = 0; i < pageCount; i += 1) {
    pageObjectNumbers.push(firstPageObject + i * 2);
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] =
    `<< /Type /Pages /Kids [${pageObjectNumbers
      .map((n) => `${n} 0 R`)
      .join(' ')}] /Count ${pageCount} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  for (let i = 0; i < pageCount; i += 1) {
    const pageNumber = i + 1;
    const pageObject = pageObjectNumbers[i]!;
    const contentObject = pageObject + 1;

    // Large text, so a rendered page is visibly different per page
    // and a screenshot diff would catch the wrong page being shown.
    const stream = `BT /F1 36 Tf 40 300 Td (Page ${pageNumber}) Tj ET`;

    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  const objectCount = objects.length;
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (let n = 1; n < objectCount; n += 1) {
    offsets[n] = pdf.length;
    pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let n = 1; n < objectCount; n += 1) {
    pdf += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objectCount} /Root 1 0 R /Info << /Title (${title}) >> >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  // latin1: every byte written above is a single byte, and utf-8
  // would silently widen anything non-ASCII and break every offset.
  return { bytes: Buffer.from(pdf, 'latin1'), pageCount };
}
