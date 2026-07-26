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
 * Gallery — artworks.
 *
 * Second of the three primary destinations. Artworks open into the
 * **same** Study Workspace as books, at `/study/:sourceId` — INV-002
 * and AC-014. A separate artwork viewer would fork the workspace and
 * duplicate every capability built into it.
 */
export function GalleryRoute() {
  const { sources } = useRepositories();
  const { resource, reload } = useAsyncResource(
    () => sources.getByType('artwork'),
    [sources],
  );

  return (
    <div className="cn-main__inner">
      <RouteHeader
        title="Gallery"
        lede="Artworks you are studying. They open in the same workspace as books."
      />

      {resource.status === 'loading' ? (
        <RouteLoading label="Loading your gallery…" />
      ) : null}

      {resource.status === 'error' ? (
        <RouteError message={resource.error.message} onRetry={reload} />
      ) : null}

      {resource.status === 'ready' ? (
        resource.value.length === 0 ? (
          <EmptyState
            title="No artworks yet"
            description="Add an image to study it the way you study a book — with a continuous journal, annotations, and connections to what you have read."
          />
        ) : (
          <ul className="cn-lab__grid">
            {resource.value.map((source) => (
              <li key={source.id}>
                <Surface as="article" tone="raised" pad="md" bordered>
                  <h2 className="cn-lab__heading">
                    <Link to={`/study/${source.id}`}>{source.title}</Link>
                  </h2>
                  <p className="cn-lab__note">{source.subtitle ?? 'Artwork'}</p>
                </Surface>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
