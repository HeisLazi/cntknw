import { useRepositories } from '@app/providers/RepositoryProvider';
import { useAsyncResource } from '@app/hooks/useAsyncResource';
import { EmptyState, Surface } from '@components/primitives';
import {
  RouteError,
  RouteHeader,
  RouteLoading,
} from '@components/shell/RouteStates';

/**
 * Notes — the cross-source view of journal writing.
 *
 * Third and last primary destination. The blocks it will list are
 * the same canonical `JournalBlock` records the Study Workspace
 * writes (INV-006) — Notes is a different view of one set of blocks,
 * never a second store of them.
 *
 * Search, filters and the map view are Phase 6. Phase 0D establishes
 * the route and proves the read path.
 */
export function NotesRoute() {
  const { claims } = useRepositories();
  const { resource, reload } = useAsyncResource(() => claims.getAll(), [claims]);

  return (
    <div className="cn-main__inner">
      <RouteHeader
        title="Notes"
        lede="Everything you have written, across every source."
      />

      {resource.status === 'loading' ? (
        <RouteLoading label="Loading your notes…" />
      ) : null}

      {resource.status === 'error' ? (
        <RouteError message={resource.error.message} onRetry={reload} />
      ) : null}

      {resource.status === 'ready' ? (
        resource.value.length === 0 ? (
          <EmptyState
            title="Nothing written yet"
            description="Open a source and start writing. Notes gathers what you have written across your whole library — it is a view of your journals, not a separate notebook."
          />
        ) : (
          <ul className="cn-lab__grid">
            {resource.value.map((claim) => (
              <li key={claim.id}>
                <Surface as="article" tone="paper" pad="md" bordered>
                  <p>{claim.statement}</p>
                </Surface>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
