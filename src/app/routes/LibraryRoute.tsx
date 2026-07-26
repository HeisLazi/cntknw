import { Link } from 'react-router';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { useAsyncResource } from '@app/hooks/useAsyncResource';
import { Surface } from '@components/primitives';
import {
  RouteError,
  RouteHeader,
  RouteLoading,
} from '@components/shell/RouteStates';
import { ImportSource } from '@features/library/ImportSource';
import type { Source, BookDetails, WorkspaceState } from '@domain/index';
import '@features/reader/reader.css';

interface LibraryEntry {
  source: Source;
  details: BookDetails | null;
  workspace: WorkspaceState | null;
}

/**
 * Library — the first of exactly three primary destinations.
 *
 * From Phase 1 this is a working surface rather than a placeholder:
 * import a PDF, see it listed with its progress, open it.
 */
export function LibraryRoute() {
  const { sources, workspaceStates } = useRepositories();

  const { resource, reload } = useAsyncResource(async (): Promise<LibraryEntry[]> => {
    const books = await sources.getByType('book');
    return Promise.all(
      books.map(async (source) => ({
        source,
        details: await sources.getBookDetails(source.id),
        workspace: await workspaceStates.getBySource(source.id),
      })),
    );
  }, [sources, workspaceStates]);

  const entries = resource.status === 'ready' ? resource.value : [];

  return (
    <div className="cn-main__inner">
      <RouteHeader
        title="Library"
        lede="Books you are studying, and the journals that belong to them."
      />

      <ImportSource onImported={reload} />

      {resource.status === 'loading' ? (
        <RouteLoading label="Loading your library…" />
      ) : null}

      {resource.status === 'error' ? (
        <RouteError message={resource.error.message} onRetry={reload} />
      ) : null}

      {resource.status === 'ready' && entries.length > 0 ? (
        <ul className="cn-lab__grid" style={{ marginTop: 'var(--cn-space-xl)' }}>
          {entries.map(({ source, details, workspace }) => {
            const page = workspace?.activeLocation.pdf?.page;
            const total = details?.pageCount;
            return (
              <li key={source.id}>
                <Surface as="article" tone="raised" pad="md" bordered>
                  <div className="cn-source-card">
                    <h2 className="cn-source-card__title">
                      <Link to={`/study/${source.id}`}>{source.title}</Link>
                    </h2>
                    <p className="cn-source-card__meta">
                      {details?.authorText ?? 'Unknown author'}
                    </p>
                    <p className="cn-source-card__progress">
                      {page && page > 1
                        ? total
                          ? `Page ${page} of ${total}`
                          : `Page ${page}`
                        : total
                          ? `${total} pages — not started`
                          : 'Not started'}
                    </p>
                  </div>
                </Surface>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
