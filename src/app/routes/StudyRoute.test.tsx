import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { RepositoryProvider } from '@app/providers/RepositoryProvider';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import type { ResumedSourceContext } from '@application/resume-source';
import { PomodoroProvider } from '@features/pomodoro/PomodoroProvider';
import { DEFAULT_POMODORO_STATE } from '@features/pomodoro/pomodoroState';

const lifecycle = vi.hoisted(() => ({ readerMounts: 0, journalMounts: 0 }));
const loadedDocument = vi.hoisted(() => ({
  pageCount: 12,
  title: 'Fixture PDF',
  author: undefined,
  getPage: vi.fn(),
  getOutline: vi.fn().mockResolvedValue(null),
  getPageIndex: vi.fn(),
  searchDocument: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('@features/reader/pdfjs', () => ({
  loadPdfDocument: vi.fn().mockResolvedValue(loadedDocument),
}));

vi.mock('@features/reader/PdfReader', async () => {
  const React = await import('react');
  return {
    PdfReader: function MockPdfReader(props: {
      page: number;
      scrollOffset: number;
      onPageChange: (page: number) => void;
      onScroll: (offset: number) => void;
    }) {
      const [pending, setPending] = React.useState('');
      React.useEffect(() => {
        lifecycle.readerMounts += 1;
        return () => { lifecycle.readerMounts -= 1; };
      }, []);
      return (
        <div data-testid="mock-reader" data-page={props.page}>
          <label>
            Reader pending
            <input value={pending} onChange={(event) => setPending(event.target.value)} />
          </label>
          <span data-testid="reader-scroll">{props.scrollOffset}</span>
          <button type="button" onClick={() => props.onPageChange(props.page + 1)}>
            Advance mocked page
          </button>
          <button type="button" onClick={() => props.onScroll(321)}>
            Scroll mocked reader
          </button>
        </div>
      );
    },
  };
});

vi.mock('@features/journal/JournalPane', async () => {
  const React = await import('react');
  return {
    JournalPane: function MockJournalPane(props: {
      scrollOffset?: number;
      onScroll?: (offset: number) => void;
    }) {
      const [pending, setPending] = React.useState('');
      React.useEffect(() => {
        lifecycle.journalMounts += 1;
        return () => { lifecycle.journalMounts -= 1; };
      }, []);
      return (
        <div data-testid="mock-journal">
          <label>
            Journal pending
            <textarea value={pending} onChange={(event) => setPending(event.target.value)} />
          </label>
          <span data-testid="journal-scroll">{props.scrollOffset ?? 0}</span>
          <button type="button" onClick={() => props.onScroll?.(654)}>
            Scroll mocked journal
          </button>
        </div>
      );
    },
  };
});

import { StudyWorkspace } from './StudyRoute';

async function makeContext(repositories: MemoryRepositories): Promise<ResumedSourceContext> {
  const source = await repositories.sources.create({
    type: 'book',
    title: 'Ways of Seeing',
  });
  const asset = await repositories.assets.create({
    kind: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: 4,
    storageKey: 'study-route-test',
  });
  await repositories.assets.storeBinary(asset.id, new Uint8Array([1, 2, 3, 4]).buffer);
  const journal = await repositories.journals.getOrCreateJournalForSource(
    source.id,
    source.title,
  );
  const now = new Date().toISOString();
  const location = {
    sourceType: 'book' as const,
    sourceId: source.id,
    pdf: { page: 1 },
  };
  const workspaceState = await repositories.workspaceStates.create({
    id: source.id,
    sourceId: source.id,
    activeLocation: location,
    furthestLocation: location,
    sourceView: {
      mode: 'continuous',
      zoom: 1,
      scrollOffset: 0,
      annotationTool: 'select',
    },
    journalView: { scrollOffset: 0 },
    whiteboard: { viewport: { x: 0, y: 0, zoom: 1 }, layout: {} },
    layout: {
      mode: 'split',
      splitRatio: 0.7,
      rightWorkspace: 'write',
      sourceCollapsed: false,
      journalCollapsed: false,
    },
    awayMode: false,
    playbackCapability: 'unknown',
    createdAt: now,
    updatedAt: now,
    revision: 0,
  });

  return {
    source,
    bookDetails: null,
    artworkDetails: null,
    primaryAsset: asset,
    journal,
    workspaceState,
    nearbyBlocks: [],
    offerResumeChoice: false,
  };
}

async function mountWorkspace() {
  const repositories = createMemoryRepositories();
  const context = await makeContext(repositories);
  const result = render(
    <RepositoryProvider repositories={repositories}>
      <PomodoroProvider initialState={DEFAULT_POMODORO_STATE}>
        <MemoryRouter>
          <StudyWorkspace context={context} />
        </MemoryRouter>
      </PomodoroProvider>
    </RepositoryProvider>,
  );
  await screen.findByTestId('mock-reader');
  return { ...result, repositories, context };
}

describe('Study Workspace projections', () => {
  beforeEach(() => {
    lifecycle.readerMounts = 0;
    lifecycle.journalMounts = 0;
    loadedDocument.getOutline.mockClear();
  });

  it('keeps the minimal top chrome keyboard-revealable and context closed by default', async () => {
    const user = userEvent.setup();
    await mountWorkspace();

    const reveal = screen.getByRole('button', { name: 'Reveal workspace controls' });
    expect(reveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Source Focus' })).not.toBeInTheDocument();
    expect(document.querySelector('.cn-context-panel')).not.toBeVisible();

    reveal.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Source Focus' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Open document contents/ })).toBeEnabled();
  });

  it('preserves reader, journal, page, scroll projections, and pending edits across focus modes', async () => {
    const user = userEvent.setup();
    const { repositories, context } = await mountWorkspace();
    await waitFor(() => {
      expect(lifecycle).toMatchObject({ readerMounts: 1, journalMounts: 1 });
    });

    const reader = screen.getByTestId('mock-reader');
    const journal = screen.getByTestId('mock-journal');
    const readerPending = screen.getByLabelText('Reader pending');
    const journalPending = screen.getByLabelText('Journal pending');
    await user.type(readerPending, 'reader draft');
    await user.type(journalPending, 'journal draft');
    await user.click(screen.getByRole('button', { name: 'Advance mocked page' }));
    await user.click(screen.getByRole('button', { name: 'Scroll mocked reader' }));
    await user.click(screen.getByRole('button', { name: 'Scroll mocked journal' }));

    await user.click(screen.getByRole('button', { name: 'Reveal workspace controls' }));
    await user.click(screen.getByRole('button', { name: 'Source Focus' }));
    expect(reader).toBeVisible();
    expect(journal).not.toBeVisible();
    expect(lifecycle).toMatchObject({ readerMounts: 1, journalMounts: 1 });

    await user.click(screen.getByRole('button', { name: 'Split' }));
    expect(screen.getByTestId('mock-reader')).toBe(reader);
    expect(screen.getByTestId('mock-journal')).toBe(journal);
    expect(readerPending).toHaveValue('reader draft');
    expect(journalPending).toHaveValue('journal draft');
    expect(reader).toHaveAttribute('data-page', '2');
    expect(screen.getByTestId('reader-scroll')).toHaveTextContent('321');
    expect(screen.getByTestId('journal-scroll')).toHaveTextContent('654');

    await user.click(screen.getByRole('button', { name: 'Journal Focus' }));
    expect(reader).not.toBeVisible();
    expect(journal).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Split' }));
    expect(lifecycle).toMatchObject({ readerMounts: 1, journalMounts: 1 });
    expect(reader).toHaveAttribute('data-page', '2');

    await waitFor(async () => {
      const stored = await repositories.workspaceStates.getBySource(context.source.id);
      expect(stored?.layout.mode).toBe('split');
      expect(stored?.activeLocation.pdf?.page).toBe(2);
    });
  });

  it('switches Write and Whiteboard without remounting or losing either projection state', async () => {
    const user = userEvent.setup();
    const { repositories, context } = await mountWorkspace();
    const journal = screen.getByTestId('mock-journal');
    const pending = screen.getByLabelText('Journal pending');
    await user.type(pending, 'still drafting');
    await user.click(screen.getByRole('button', { name: 'Reveal workspace controls' }));
    await user.click(screen.getByRole('button', { name: 'Whiteboard' }));

    const canvas = screen.getByRole('application', { name: 'Infinite whiteboard canvas' });
    expect(canvas).toBeVisible();
    expect(journal).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByLabelText('Whiteboard zoom')).toHaveTextContent('120%');

    await user.click(screen.getByRole('button', { name: 'Write' }));
    expect(journal).toBeVisible();
    expect(pending).toHaveValue('still drafting');
    await user.click(screen.getByRole('button', { name: 'Whiteboard' }));
    expect(screen.getByLabelText('Whiteboard zoom')).toHaveTextContent('120%');
    expect(lifecycle.journalMounts).toBe(1);

    await waitFor(async () => {
      const stored = await repositories.workspaceStates.getBySource(context.source.id);
      expect(stored?.layout.rightWorkspace).toBe('whiteboard');
      expect(stored?.whiteboard.viewport.zoom).toBeCloseTo(1.2);
    });
  });
});
