/**
 * Repository / application-services provider.
 *
 * React context here is a **dependency-injection channel, not a
 * second database**. It carries interfaces so a component can reach
 * the persistence layer without importing an adapter; it does not
 * cache entities, and nothing durable lives in it. Durable state
 * belongs in repositories, and only transient UI state is local —
 * a context full of mirrored records is a second source of truth
 * that will disagree with the first one.
 */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Repositories } from '@data/repositories';

const RepositoryContext = createContext<Repositories | null>(null);

export interface RepositoryProviderProps {
  /**
   * Injected, never constructed here. Production passes the graph
   * from `app/composition/production.ts`; tests pass the memory
   * adapter. A provider that built its own would make the memory
   * adapter unreachable from a component test.
   */
  repositories: Repositories;
  children: ReactNode;
}

export function RepositoryProvider({
  repositories,
  children,
}: RepositoryProviderProps) {
  // The bundle is stable for the life of the app, but memoising on
  // identity keeps a caller that rebuilds it (a test, a reset) from
  // re-rendering every consumer for an equal value.
  const value = useMemo(() => repositories, [repositories]);
  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
}

/**
 * The whole persistence surface.
 *
 * @throws when called outside a provider — a component rendered
 *   without its dependencies is a wiring bug, and returning `null`
 *   would push it downstream to become a confusing crash somewhere
 *   else.
 */
export function useRepositories(): Repositories {
  const value = useContext(RepositoryContext);
  if (!value) {
    throw new Error(
      'useRepositories must be used inside a <RepositoryProvider>. ' +
        'Wrap the tree in one, or render through renderWithProviders in tests.',
    );
  }
  return value;
}

/**
 * One repository, by name.
 *
 * Narrower than `useRepositories`, so a component states which part
 * of persistence it actually depends on.
 */
export function useRepository<K extends keyof Repositories>(
  name: K,
): Repositories[K] {
  return useRepositories()[name];
}
