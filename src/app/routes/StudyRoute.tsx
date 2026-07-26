import { useParams } from 'react-router';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { useAsyncResource } from '@app/hooks/useAsyncResource';
import { SplitPane, Surface } from '@components/primitives';
import {
  MissingSource,
  RouteError,
  RouteLoading,
} from '@components/shell/RouteStates';
import { resumeSource } from '@application/resume-source';

/**
 * The shared Study Workspace. INV-002.
 *
 * **One route for books and artworks.** `/study/:sourceId` is where
 * every source opens, whatever its type — the PDD's single most
 * load-bearing structural decision, because everything built into
 * the workspace (journal, annotations, connections, Read Aloud) is
 * then built once. A `/gallery/:id` viewer would fork all of it.
 *
 * It is also **not** a primary destination: it has no permanent nav
 * entry and is reached by opening a source. INV-001 fixes the
 * primary destinations at three.
 *
 * Read Aloud's Listen-Only is a *layout mode* of this route, not a
 * fourth destination (ADR-0001 §7).
 *
 * Phase 0D builds the frame and proves the read path through
 * `resumeSource`. PDF rendering, the editor and annotations are 0E
 * and later.
 */
export function StudyRoute() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const repositories = useRepositories();

  const { resource, reload } = useAsyncResource(async () => {
    if (!sourceId) return null;
    const exists = await repositories.sources.getById(sourceId);
    // `resumeSource` throws for an unknown source. Checking first
    // lets a missing source be reported as what it is rather than as
    // a generic failure — the two need different recovery routes.
    if (!exists) return null;
    return resumeSource(repositories, sourceId);
  }, [repositories, sourceId]);

  if (!sourceId) return <MissingSource sourceId="(none)" />;

  if (resource.status === 'loading') {
    return <RouteLoading label="Opening source…" />;
  }

  if (resource.status === 'error') {
    return <RouteError message={resource.error.message} onRetry={reload} />;
  }

  if (resource.value === null) {
    return <MissingSource sourceId={sourceId} />;
  }

  const context = resource.value;
  const page = context.workspaceState?.activeLocation.pdf?.page;

  return (
    <div className="cn-study">
      <div className="cn-study__bar">
        <h1 className="cn-study__title">{context.source.title}</h1>
        <p className="cn-lab__note" style={{ margin: 0 }}>
          {page ? `Page ${page}` : 'Not yet opened'}
        </p>
      </div>

      <div className="cn-study__panes">
        <SplitPane
          label="Source and journal"
          defaultRatio={0.5}
          start={
            <Surface tone="sunken" as="section" aria-label="Source">
              <div className="cn-study__pane cn-study__pane--source">
                <h2 className="cn-lab__heading">Source</h2>
                <p className="cn-study__reading">
                  The reader arrives in Phase 1. This pane already knows which
                  source it is showing and where the reader left off, because
                  that state is loaded from the repository rather than reset on
                  open (AC-002).
                </p>
              </div>
            </Surface>
          }
          end={
            <Surface tone="paper" as="section" aria-label="Journal">
              <div className="cn-study__pane cn-study__pane--journal">
                <h2 className="cn-lab__heading">Journal</h2>
                <p className="cn-study__reading">
                  {context.nearbyBlocks.length === 0
                    ? 'Nothing written here yet. In Phase 2 this becomes one continuous journal, and a block created on page 5 belongs to page 5 without being asked.'
                    : `${context.nearbyBlocks.length} block(s) at this location.`}
                </p>
              </div>
            </Surface>
          }
        />
      </div>
    </div>
  );
}
