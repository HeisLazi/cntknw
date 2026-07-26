import { useMemo } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router';
import type { Repositories } from '@data/repositories';
import { ErrorBoundary } from './providers/ErrorBoundary';
import { RepositoryProvider } from './providers/RepositoryProvider';
import { ToastProvider } from '@components/primitives';
import { createRoutes } from './routes';
import '@design/tokens.css';
import '@design/base.css';

export interface AppProps {
  /**
   * Injected. Production passes the graph built by
   * `app/composition/production.ts`; tests pass the memory adapter.
   */
  repositories: Repositories;
  /** Overridden in tests that need the lab present or absent. */
  includeDevRoutes?: boolean;
}

/**
 * The composition, assembled.
 *
 *   App
 *   └── ErrorBoundary          — outside everything, so it catches
 *       └── RepositoryProvider   a failure in the providers or the
 *           └── ToastProvider    router as well as in a route
 *               └── RouterProvider
 *                   └── AppShell   (rendered by the route table)
 *
 * The order is the point. An error boundary *inside* the router
 * cannot catch a router failure, and a provider below the boundary
 * takes the whole tree down with it when it throws.
 */
export function App({
  repositories,
  includeDevRoutes = import.meta.env.DEV,
}: AppProps) {
  const router = useMemo(
    () => createBrowserRouter(createRoutes(includeDevRoutes)),
    [includeDevRoutes],
  );

  return (
    <ErrorBoundary>
      <RepositoryProvider repositories={repositories}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </RepositoryProvider>
    </ErrorBoundary>
  );
}
