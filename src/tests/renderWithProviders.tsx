import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import type { Repositories } from '@data/repositories';
import { RepositoryProvider } from '@app/providers/RepositoryProvider';
import { ToastProvider } from '@components/primitives';

export interface ProviderOptions {
  repositories?: Repositories;
  /** Initial history entries for the router. */
  initialEntries?: string[];
}

export interface RenderedWithProviders extends RenderResult {
  repositories: MemoryRepositories;
}

/**
 * Render a component inside the real provider stack, with the
 * **memory** adapter.
 *
 * This is the injection point the whole composition design exists
 * for: no test touches IndexedDB, no test mocks a repository, and a
 * component that reached for a concrete adapter would fail here
 * rather than silently writing to a real database during a test run.
 *
 * `MemoryRouter` rather than `createBrowserRouter`: jsdom has no
 * navigation, and an in-memory history is what makes route
 * assertions deterministic.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions = {},
): RenderedWithProviders {
  const repositories = (options.repositories ??
    createMemoryRepositories()) as MemoryRepositories;

  const result = render(
    <RepositoryProvider repositories={repositories}>
      <ToastProvider>
        <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>
          {ui}
        </MemoryRouter>
      </ToastProvider>
    </RepositoryProvider>,
  );

  return { ...result, repositories };
}
