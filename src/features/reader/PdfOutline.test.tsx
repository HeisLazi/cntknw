import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedDocument } from './pdfjs';
import { PdfOutline } from './PdfOutline';

function outlineDocument(
  getOutline: LoadedDocument['getOutline'],
): LoadedDocument {
  return {
    pageCount: 3,
    title: 'Outline fixture',
    author: undefined,
    getPage: vi.fn(),
    getOutline,
    getPageIndex: vi.fn(),
    searchDocument: vi.fn(),
    destroy: vi.fn(),
  } as unknown as LoadedDocument;
}

describe('PdfOutline failure states', () => {
  it('distinguishes a valid document with no outline', async () => {
    const document = outlineDocument(vi.fn().mockResolvedValue(null));

    render(<PdfOutline document={document} onNavigate={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText('This document has no outline.')).toBeVisible();
    expect(screen.queryByText('Outline unavailable.')).not.toBeInTheDocument();
  });

  it('reports extraction failure honestly and retries without an unhandled rejection', async () => {
    const getOutline = vi
      .fn<LoadedDocument['getOutline']>()
      .mockRejectedValueOnce(new Error('damaged outline tree'))
      .mockResolvedValueOnce(null);
    const document = outlineDocument(getOutline);
    const user = userEvent.setup();

    render(<PdfOutline document={document} onNavigate={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText('Outline unavailable.')).toBeVisible();
    expect(screen.queryByText('This document has no outline.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry outline' }));

    expect(await screen.findByText('This document has no outline.')).toBeVisible();
    expect(getOutline).toHaveBeenCalledTimes(2);
  });
});