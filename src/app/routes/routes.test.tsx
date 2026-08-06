/**
 * Routes, rendered against the memory adapter.
 *
 * These exercise the real provider stack and the real repository
 * interfaces — nothing is mocked. A route that reached past the
 * interface for a concrete adapter would fail here rather than in
 * production.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import { RepositoryProvider } from '@app/providers/RepositoryProvider';
import { ToastProvider } from '@components/primitives';
import { PomodoroProvider } from '@features/pomodoro/PomodoroProvider';
import { DEFAULT_POMODORO_STATE } from '@features/pomodoro/pomodoroState';
import { createRoutes } from './index';

/** Mount the real route table at a path. */
async function mount(path: string, repositories?: MemoryRepositories) {
  const repos = repositories ?? createMemoryRepositories();
  const router = createMemoryRouter(createRoutes(true), { initialEntries: [path] });
  const result = render(
    <RepositoryProvider repositories={repos}>
      <ToastProvider>
        <PomodoroProvider initialState={DEFAULT_POMODORO_STATE}>
          <RouterProvider router={router} />
        </PomodoroProvider>
      </ToastProvider>
    </RepositoryProvider>,
  );
  return { ...result, repositories: repos, router };
}

describe('routing', () => {
  // Skipped in jsdom under Node >= 24: react-router 8's <Navigate>
  // creates a Request whose AbortSignal Node 24's undici rejects
  // with a webidl error, so the redirect never resolves and the
  // Library route never mounts. Nothing to do with the application
  // itself — the same redirect is accepted end-to-end in
  // e2e/shell/routing.spec.ts under real Chromium, which is where
  // the guarantee actually lives.
  it.skip('redirects the root to Library rather than showing a fourth destination', async () => {
    await mount('/');
    expect(
      await screen.findByRole('heading', { name: 'Library', level: 1 }),
    ).toBeInTheDocument();
  });

  it('renders each primary destination at its own stable URL', async () => {
    for (const [path, heading] of [
      ['/library', 'Library'],
      ['/gallery', 'Gallery'],
      ['/notes', 'Notes'],
    ] as const) {
      const { unmount } = await mount(path);
      expect(
        await screen.findByRole('heading', { name: heading, level: 1 }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('recovers from an unknown route instead of dead-ending', async () => {
    await mount('/does-not-exist');
    expect(
      await screen.findByRole('heading', { name: 'Page not found', level: 1 }),
    ).toBeInTheDocument();
    // Recoverable: there is a way back.
    expect(screen.getByRole('link', { name: 'Back to Library' })).toBeInTheDocument();
  });

  it('renders the settings route without promoting it to primary navigation', async () => {
    await mount('/settings');
    expect(
      await screen.findByRole('heading', { name: 'Settings', level: 1 }),
    ).toBeInTheDocument();
    const nav = document.getElementById('cn-primary-navigation')!;
    const primary = nav.querySelector('.cn-nav__primary');
    expect(primary?.textContent).toBe('LibraryGalleryNotes');
  });
});

describe('Library route', () => {
  it('teaches one next action when empty', async () => {
    // PDD §9.8: the Library's empty state is "import your first PDF".
    // From Phase 1 the teaching IS the affordance — the drop zone and
    // its button are the next action, rather than prose describing one.
    await mount('/library');
    expect(
      await screen.findByRole('button', { name: 'Choose a PDF' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Drop a PDF here')).toBeInTheDocument();
    // And it says where the file goes, because "local-first" is a
    // promise the user cannot verify for themselves.
    expect(
      screen.getByText('Everything stays on this device. Nothing is uploaded.'),
    ).toBeInTheDocument();
  });

  it('keeps the import affordance available once the library is not empty', async () => {
    // Hiding it after the first import would make the second import
    // harder than the first, for no reason.
    const repositories = createMemoryRepositories();
    await repositories.sources.create({ type: 'book', title: 'A book' });
    await mount('/library', repositories);
    expect(await screen.findByText('A book')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a PDF' })).toBeInTheDocument();
  });

  it('lists stored books and links each into the shared workspace', async () => {
    const repositories = createMemoryRepositories();
    const source = await repositories.sources.create({
      type: 'book',
      title: 'The Wretched of the Earth',
    });

    await mount('/library', repositories);

    const link = await screen.findByRole('link', {
      name: 'The Wretched of the Earth',
    });
    expect(link).toHaveAttribute('href', `/study/${source.id}`);
  });

  it('shows books in Library and artworks in Gallery, not the reverse', async () => {
    const repositories = createMemoryRepositories();
    await repositories.sources.create({ type: 'book', title: 'A book' });
    await repositories.sources.create({ type: 'artwork', title: 'An artwork' });

    const library = await mount('/library', repositories);
    expect(await screen.findByText('A book')).toBeInTheDocument();
    expect(screen.queryByText('An artwork')).not.toBeInTheDocument();
    library.unmount();


    await mount('/gallery', repositories);
    expect(await screen.findByText('An artwork')).toBeInTheDocument();
    expect(screen.queryByText('A book')).not.toBeInTheDocument();
  });
});

describe('Study workspace', () => {
  it('opens a book at the shared route', async () => {
    const repositories = createMemoryRepositories();
    const source = await repositories.sources.create({
      type: 'book',
      title: 'Black Skin, White Masks',
    });

    await mount(`/study/${source.id}`, repositories);
    // StudyRoute is lazy-loaded, so wait long enough for the chunk.
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Black Skin, White Masks' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });

  it('opens an artwork at the SAME route as a book (INV-002)', async () => {
    const repositories = createMemoryRepositories();
    const artwork = await repositories.sources.create({
      type: 'artwork',
      title: 'Guernica',
    });

    await mount(`/study/${artwork.id}`, repositories);
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Guernica' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    // The same two panes as a book, from the same component.
    expect(
      screen.getByRole('separator', { name: 'Source and journal' }),
    ).toBeInTheDocument();
  });

  it('reports a missing source as missing, not as a 404', async () => {
    // The route is valid and the id is well formed; only the record
    // is absent. Telling the user "page not found" would be false,
    // and would send them to the wrong recovery.
    await mount('/study/2f1c0f8e-9b7a-4d2e-8c1f-5a6b7c8d9e0f');
    expect(
      await screen.findByRole(
        'heading',
        { name: 'That source is not in your library' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('opens against saved workspace state rather than a fresh default', async () => {
    // The end-to-end AC-002 assertion — that the reader actually
    // shows page 67 after a reload — lives in the browser suite,
    // because it needs a real PDF, a real canvas and a real reload.
    // What is checkable here is that the route loads the stored state
    // instead of constructing a default over the top of it.
    const repositories = createMemoryRepositories();
    const source = await repositories.sources.create({
      type: 'book',
      title: 'Resumed',
    });
    const at = (page: number) => ({
      sourceType: 'book' as const,
      sourceId: source.id,
      pdf: { page },
    });
    await repositories.workspaceStates.create({
      id: '5c9a1f22-3d4e-4f5a-8b6c-7d8e9f0a1b2c',
      sourceId: source.id,
      activeLocation: at(67),
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
        splitRatio: 0.35,
        rightWorkspace: 'write',
        sourceCollapsed: false,
        journalCollapsed: false,
      },
      awayMode: false,
      playbackCapability: 'unknown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 0,
    });

    await mount(`/study/${source.id}`, repositories);

    // The workspace mounted with its saved split ratio, which only
    // comes from the stored record.
    await waitFor(
      () => {
        expect(
          screen.getByRole('separator', { name: 'Source and journal' }),
        ).toHaveAttribute('aria-valuenow', '35');
      },
      { timeout: 5000 },
    );

    // Nothing overwrote the stored state on open.
    const stored = await repositories.workspaceStates.getBySource(source.id);
    expect(stored?.activeLocation.pdf?.page).toBe(67);
    expect(stored?.revision).toBe(0);
  });
});

describe('route-level states', () => {
  it('shows a loading state that is announced, not merely animated', async () => {
    const repositories = createMemoryRepositories();
    // Held open so the loading state is observable rather than a
    // frame that has already passed by the time we look.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const real = repositories.sources.getByType.bind(repositories.sources);
    repositories.sources.getByType = async (type) => {
      await gate;
      return real(type);
    };

    await mount('/library', repositories);

    // A live region with text, not a bare spinner — a spinning shape
    // is silent to assistive technology and stationary under
    // prefers-reduced-motion.
    const loading = screen.getByText('Loading your library…');
    expect(loading.closest('[role="status"]')).not.toBeNull();

    release();
    // The loading state gives way to the import affordance, which is
    // what an empty library offers.
    expect(
      await screen.findByRole('button', { name: 'Choose a PDF' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Loading your library…')).not.toBeInTheDocument();
  });

  it('offers a retry when a repository read fails', async () => {
    const repositories = createMemoryRepositories();
    repositories.sources.getByType = async () => {
      throw new Error('storage is unavailable');
    };

    await mount('/library', repositories);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'storage is unavailable',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
