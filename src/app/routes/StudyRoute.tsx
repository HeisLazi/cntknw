import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { useAsyncResource } from '@app/hooks/useAsyncResource';
import { SplitPane } from '@components/primitives';
import {
  MissingSource,
  RouteError,
  RouteLoading,
} from '@components/shell/RouteStates';
import { resumeSource } from '@application/resume-source';
import type { ResumedSourceContext } from '@application/resume-source';
import { PdfReader } from '@features/reader/PdfReader';
import { loadPdfDocument } from '@features/reader/pdfjs';
import type { LoadedDocument } from '@features/reader/pdfjs';
import { useWorkspacePersistence } from '@features/workspace/useWorkspacePersistence';
import { JournalPane } from '@features/journal/JournalPane';
import type { WorkspaceState, SourceLocation } from '@domain/index';
import '@features/reader/reader.css';

/**
 * The shared Study Workspace. INV-002.
 *
 * **One route for books and artworks.** `/study/:sourceId` is where
 * every source opens, whatever its type — the PDD's most load-bearing
 * structural decision, because everything built into the workspace
 * (journal, annotations, connections, Read Aloud) is then built once.
 *
 * It is **not** a primary destination: no permanent nav entry, reached
 * by opening a source. INV-001 fixes those at three. Read Aloud's
 * Listen-Only is a *layout mode* of this route (ADR-0001 §7).
 */
export function StudyRoute() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const repositories = useRepositories();

  const { resource, reload } = useAsyncResource(async () => {
    if (!sourceId) return null;
    const exists = await repositories.sources.getById(sourceId);
    // Checked first so a missing source can be reported as what it
    // is; `resumeSource` throws, and the two need different recovery.
    if (!exists) return null;
    return resumeSource(repositories, sourceId);
  }, [repositories, sourceId]);

  if (!sourceId) return <MissingSource sourceId="(none)" />;
  if (resource.status === 'loading') return <RouteLoading label="Opening source…" />;
  if (resource.status === 'error') {
    return <RouteError message={resource.error.message} onRetry={reload} />;
  }
  if (resource.value === null) return <MissingSource sourceId={sourceId} />;

  // Keyed on the source id so switching sources rebuilds the
  // workspace rather than carrying one source's scroll position and
  // pending save into another's.
  return <StudyWorkspace key={sourceId} context={resource.value} />;
}

function initialWorkspace(context: ResumedSourceContext): WorkspaceState {
  if (context.workspaceState) return context.workspaceState;
  // A source imported before workspace state existed, or one whose
  // state was removed. Rendering from a default is better than
  // refusing to open the document.
  const now = new Date().toISOString();
  const location: SourceLocation = {
    sourceType: context.source.type,
    sourceId: context.source.id,
    pdf: { page: 1 },
  };
  return {
    id: context.source.id,
    sourceId: context.source.id,
    activeLocation: location,
    furthestLocation: location,
    sourceView: { mode: 'continuous', zoom: 1, scrollOffset: 0 },
    journalView: { scrollOffset: 0 },
    layout: {
      mode: 'split',
      splitRatio: 0.5,
      sourceCollapsed: false,
      journalCollapsed: false,
    },
    awayMode: false,
    playbackCapability: 'unknown',
    createdAt: now,
    updatedAt: now,
    revision: 0,
  };
}

function StudyWorkspace({ context }: { context: ResumedSourceContext }) {
  const { assets } = useRepositories();
  const { state, drift, commit, status } = useWorkspacePersistence(
    initialWorkspace(context),
  );
  const [document, setDocument] = useState<LoadedDocument | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);

  const assetId = context.primaryAsset?.id;

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    let loaded: LoadedDocument | null = null;

    void (async () => {
      try {
        const bytes = await assets.getBinary(assetId);
        if (!bytes) throw new Error('The file for this source is missing.');
        const opened = await loadPdfDocument(bytes);
        if (cancelled) {
          void opened.destroy();
          return;
        }
        loaded = opened;
        setDocument(opened);
      } catch (cause) {
        if (!cancelled) {
          setDocumentError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();

    return () => {
      cancelled = true;
      // Released explicitly: a pdf.js document holds a worker port
      // and its rendered page caches, and leaving them behind while
      // moving between sources leaks both.
      void loaded?.destroy();
    };
  }, [assets, assetId]);

  const page = state.activeLocation.pdf?.page ?? 1;
  const furthest = state.furthestLocation?.pdf?.page ?? page;

  const setPage = (next: number) => {
    const location: SourceLocation = {
      ...state.activeLocation,
      pdf: { ...state.activeLocation.pdf, page: next },
    };
    // A page turn is discrete and deliberate — written promptly, not
    // debounced. See useWorkspacePersistence for what debouncing this
    // used to cost.
    commit({
      activeLocation: location,
      // Furthest only ever moves forward — it records how far the
      // reader has been, not where they are.
      furthestLocation: next > furthest ? location : state.furthestLocation,
    });
  };

  return (
    <div className="cn-study">
      <div className="cn-study__bar">
        <h1 className="cn-study__title">{context.source.title}</h1>
        <p className="cn-lab__note" style={{ margin: 0 }} role="status" aria-live="polite">
          {status === 'saving'
            ? 'Saving…'
            : status === 'error'
              ? 'Not saved'
              : status === 'saved'
                ? 'Saved'
                : ''}
        </p>
      </div>

      <div className="cn-study__panes">
        <SplitPane
          label="Source and journal"
          defaultRatio={state.layout.splitRatio}
          onRatioChange={(ratio) =>
            // Dragging emits continuously; the divider position is not
            // worth a write per frame.
            drift({ layout: { ...state.layout, splitRatio: ratio } })
          }
          start={
            documentError ? (
              <div className="cn-study__pane cn-study__pane--source" role="alert">
                <h2 className="cn-lab__heading">Source</h2>
                <p className="cn-study__reading">{documentError}</p>
              </div>
            ) : document ? (
              <PdfReader
                document={document}
                page={page}
                zoom={state.sourceView.zoom}
                scrollOffset={state.sourceView.scrollOffset}
                onPageChange={setPage}
                onZoomChange={(zoom) =>
                  // A zoom step is a discrete decision, like a page turn.
                  commit({ sourceView: { ...state.sourceView, zoom } })
                }
                onScroll={(scrollOffset) =>
                  // Continuous by nature — the one thing that genuinely
                  // needs debouncing.
                  drift({ sourceView: { ...state.sourceView, scrollOffset } })
                }
              />
            ) : assetId ? (
              <RouteLoading label="Loading the document…" />
            ) : (
              <div className="cn-study__pane cn-study__pane--source">
                <h2 className="cn-lab__heading">Source</h2>
                <p className="cn-study__reading">
                  This source has no file attached.
                </p>
              </div>
            )
          }
          end={
            <section aria-label="Journal" style={{ height: '100%' }}>
              {/*
                Keyed on the page, so moving to another page mounts a
                journal for that page rather than re-labelling the one
                already on screen with somebody else's blocks.
              */}
              <JournalPane
                key={page}
                sourceId={context.source.id}
                journalId={context.journal.id}
                location={state.activeLocation}
              />
            </section>
          }
        />
      </div>
    </div>
  );
}
