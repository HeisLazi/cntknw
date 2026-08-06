import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedDocument, SearchResult } from './pdfjs';
import { countSearchMatches } from './pdfjs';
import { PdfSearch } from './PdfSearch';

function searchDocument(
  implementation: LoadedDocument['searchDocument'],
): LoadedDocument {
  return {
    pageCount: 3,
    title: undefined,
    author: undefined,
    getPage: vi.fn(),
    getOutline: vi.fn(),
    getPageIndex: vi.fn(),
    searchDocument: implementation,
    destroy: vi.fn(),
  } as unknown as LoadedDocument;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('PDF search semantics', () => {
  it('normalizes item boundaries and reports non-overlapping page matches', () => {
    expect(
      countSearchMatches(
        [
          { str: 'A philosopher' },
          { str: ',' },
          { str: '  thinks', hasEOL: true },
          { str: 'about   meaning.' },
        ],
        'PHILOSOPHER, thinks',
      ),
    ).toBe(1);
    expect(countSearchMatches([{ str: 'aaaa' }], 'aa')).toBe(2);
  });

  it('shows a search failure instead of treating it as no results', async () => {
    const document = searchDocument(async function* () {
      yield* [];
      throw new Error('text extraction failed');
    });
    const user = userEvent.setup();

    render(<PdfSearch document={document} onNavigate={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Find in document…'), 'meaning');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('text extraction failed');
    expect(screen.getByText('Search unavailable')).toBeVisible();
  });

  it('silently cancels and prevents stale results from overwriting a newer search', async () => {
    const first = deferred<void>();
    const navigate = vi.fn();
    const implementation = vi.fn(async function* (query: string, signal: AbortSignal) {
      if (query === 'old') {
        await first.promise;
        if (signal.aborted) return;
        yield { pageNumber: 1, matches: 9 } satisfies SearchResult;
        return;
      }
      yield { pageNumber: 2, matches: 2 } satisfies SearchResult;
    });
    const document = searchDocument(implementation);
    const user = userEvent.setup();

    render(<PdfSearch document={document} onNavigate={navigate} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Find in document…');
    await user.type(input, 'old');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(implementation).toHaveBeenCalledTimes(1));

    await user.clear(input);
    await user.type(input, 'new');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('1 of 1 pages · 2 matches')).toBeVisible();

    first.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('9 matches')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith(2);
  });
});
