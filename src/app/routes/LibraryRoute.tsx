import { Link } from 'react-router';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { useAsyncResource } from '@app/hooks/useAsyncResource';
import { EmptyState, Surface } from '@components/primitives';
import {
  RouteError,
  RouteHeader,
  RouteLoading,
} from '@components/shell/RouteStates';

/**
 * Library — the first of exactly three primary destinations.
 *
 * Phase 0D builds the route, its three states and its data path.
 * Shelves, covers, the immersive room and the Atlas room inside it
 * are later phases; what has to be right now is that the route
 * exists at a stable URL, reads through the repository interface,
 * and handles loading, error and empty honestly.
 */
export function LibraryRoute() {
  const { sources } = useRepositories();
  const { resource, reload } = useAsyncResource(
    () => sources.getByType('book'),
    [sources],
  );

  return (
    <div className="cn-main__inner">
      <RouteHeader
        title="Library"
        lede="Books you are studying, and the journals that belong to them."
      />

      {resource.status === 'loading' ? (
        <RouteLoading label="Loading your library…" />
      ) : null}

      {resource.status === 'error' ? (
        <RouteError message={resource.error.message} onRetry={reload} />
      ) : null}

      {resource.status === 'ready' ? (
        resource.value.length === 0 ? (
          // PDD §9.8: an empty state teaches one next action.
          <EmptyState
            title="Your library is empty"
            description="Import a PDF to start a book. Its journal is created with it, and every note you write will remember the page it came from."
          />
        ) : (
          <ul className="cn-lab__grid">
            {resource.value.map((source) => (
              <li key={source.id}>
                <Surface as="article" tone="raised" pad="md" bordered>
                  <h2 className="cn-lab__heading">
                    <Link to={`/study/${source.id}`}>{source.title}</Link>
                  </h2>
                  <p className="cn-lab__note">
                    {source.subtitle ?? 'Book'}
                  </p>
                </Surface>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
