import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { useAsyncResource } from '@app/hooks/useAsyncResource';
import { ContextPanel, SplitPane } from '@components/primitives';
import {
  MissingSource,
  RouteError,
  RouteLoading,
} from '@components/shell/RouteStates';
import { resumeSource } from '@application/resume-source';
import type { ResumedSourceContext } from '@application/resume-source';
import { PdfReader } from '@features/reader/PdfReader';
import type { PdfReaderHandle } from '@features/reader/PdfReader';
import { PdfOutline } from '@features/reader/PdfOutline';
import { loadPdfDocument } from '@features/reader/pdfjs';
import type { LoadedDocument } from '@features/reader/pdfjs';
import { useWorkspacePersistence } from '@features/workspace/useWorkspacePersistence';
import { recoverPosition } from '@features/workspace/positionBuffer';
import { JournalPane } from '@features/journal/JournalPane';
import { Whiteboard } from '@features/whiteboard/Whiteboard';
import { PomodoroTimer } from '@features/pomodoro/PomodoroTimer';
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

/**
 * Apply anything a crash left behind.
 *
 * A page turn is written promptly, but promptly is still an
 * asynchronous IndexedDB write, and a reload in the same tick can
 * outrun it. The synchronous buffer catches that last millisecond
 * (ADR-0005). Applied over the stored state, never instead of it —
 * and only when it is genuinely ahead, so a stale buffer can never
 * drag a reader backwards.
 */
function applyBufferedPosition(state: WorkspaceState): WorkspaceState {
  const buffered = recoverPosition(state.sourceId);
  if (!buffered) return state;

  const storedPage = state.activeLocation.pdf?.page ?? 1;
  if (buffered.page === storedPage && buffered.zoom === state.sourceView.zoom) {
    return state;
  }

  const location: SourceLocation = {
    ...state.activeLocation,
    pdf: { ...state.activeLocation.pdf, page: buffered.page },
  };
  const furthest = state.furthestLocation?.pdf?.page ?? 0;
  return {
    ...state,
    activeLocation: location,
    furthestLocation: buffered.page > furthest ? location : state.furthestLocation,
    sourceView: { ...state.sourceView, zoom: buffered.zoom },
  };
}

function initialWorkspace(context: ResumedSourceContext): WorkspaceState {
  if (context.workspaceState) return applyBufferedPosition(context.workspaceState);
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
      splitRatio: 0.7,
      rightWorkspace: 'write',
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

const SPLIT_PRESETS = [
  { value: 0.7, label: 'Reading-heavy — 70 / 30' },
  { value: 0.5, label: 'Balanced — 50 / 50' },
  { value: 0.4, label: 'Writing-heavy — 40 / 60' },
  { value: 0.3, label: 'Whiteboard-heavy — 30 / 70' },
] as const;

export function StudyWorkspace({ context }: { context: ResumedSourceContext }) {
  const { assets } = useRepositories();
  const { state, drift, commit, status } = useWorkspacePersistence(
    initialWorkspace(context),
  );
  const [document, setDocument] = useState<LoadedDocument | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [chromeOpen, setChromeOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const readerRef = useRef<PdfReaderHandle>(null);

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

  const closeContext = useCallback(() => setContextOpen(false), []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey ||
          event.key.toLowerCase() !== 'c') return;
      event.preventDefault();
      setChromeOpen(true);
      setContextOpen((open) => !open);
    };
    globalThis.document.addEventListener('keydown', handleShortcut);
    return () => globalThis.document.removeEventListener('keydown', handleShortcut);
  }, []);

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
      // A discrete page navigation invalidates the previous page's
      // absolute scroll offset. PdfReader will report the new physical
      // offset after it reveals the requested page.
      sourceView: { ...state.sourceView, scrollOffset: 0 },
      // Furthest only ever moves forward — it records how far the
      // reader has been, not where they are.
      furthestLocation: next > furthest ? location : state.furthestLocation,
    });
  };

  const setLayoutMode = (mode: 'split' | 'source-focus' | 'journal-focus') => {
    if (state.layout.mode === mode) return;
    commit({ layout: { ...state.layout, mode } });
  };

  const sourceVisible = state.layout.mode !== 'journal-focus' &&
    state.layout.mode !== 'listen';
  const rightVisible = state.layout.mode !== 'source-focus';
  const presetValue = SPLIT_PRESETS.some(
    (preset) => preset.value === state.layout.splitRatio,
  ) ? String(state.layout.splitRatio) : '';
  const rightLabel = state.layout.rightWorkspace === 'whiteboard'
    ? 'Whiteboard Focus'
    : 'Journal Focus';

  return (
    <div className="cn-study">
      <header className="cn-study__chrome" data-expanded={chromeOpen}>
        <div className="cn-study__chrome-strip">
          <button
            type="button"
            className="cn-study__chrome-reveal"
            aria-label={chromeOpen ? 'Hide workspace controls' : 'Reveal workspace controls'}
            aria-expanded={chromeOpen}
            aria-controls="cn-workspace-controls"
            onClick={() => setChromeOpen((open) => !open)}
          >
            <span aria-hidden="true">{chromeOpen ? '⌃' : '⌄'}</span>
          </button>
          <PomodoroTimer placement="chrome" />
          <h1 className="cn-study__title">{context.source.title}</h1>
          <p className="cn-study__save" role="status" aria-live="polite">
            {status === 'saving'
              ? 'Saving…'
              : status === 'error'
                ? 'Not saved'
                : status === 'saved'
                  ? 'Saved'
                  : ''}
          </p>
        </div>

        <div
          id="cn-workspace-controls"
          className="cn-study__controls"
          hidden={!chromeOpen}
        >
          <div className="cn-study__control-group" role="group" aria-label="Workspace projection">
            {([
              ['split', 'Split'],
              ['source-focus', 'Source Focus'],
              ['journal-focus', rightLabel],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className="cn-study__mode"
                aria-pressed={state.layout.mode === mode}
                onClick={() => setLayoutMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="cn-study__preset">
            <span>Split preset</span>
            <select
              aria-label="Workspace split preset"
              value={presetValue}
              onChange={(event) => {
                const splitRatio = Number(event.target.value);
                if (Number.isFinite(splitRatio)) {
                  drift({ layout: { ...state.layout, splitRatio } });
                }
              }}
            >
              {presetValue === '' ? (
                <option value="">Custom — {Math.round(state.layout.splitRatio * 100)} / {Math.round((1 - state.layout.splitRatio) * 100)}</option>
              ) : null}
              {SPLIT_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>
          </label>

          <div className="cn-study__control-group" role="group" aria-label="Right workspace">
            <button
              type="button"
              className="cn-study__mode"
              aria-pressed={state.layout.rightWorkspace === 'write'}
              onClick={() => commit({ layout: { ...state.layout, rightWorkspace: 'write' } })}
            >
              Write
            </button>
            <button
              type="button"
              className="cn-study__mode"
              aria-pressed={state.layout.rightWorkspace === 'whiteboard'}
              onClick={() => commit({ layout: { ...state.layout, rightWorkspace: 'whiteboard' } })}
            >
              Whiteboard
            </button>
          </div>

          <button
            ref={contextTriggerRef}
            type="button"
            className="cn-study__mode"
            aria-label="Open document contents (Ctrl+Shift+C)"
            aria-keyshortcuts="Control+Shift+C Meta+Shift+C"
            aria-expanded={contextOpen}
            disabled={!document}
            onClick={() => setContextOpen(true)}
          >
            Contents
          </button>
          <Link className="cn-study__settings" to="/settings" aria-label="Open settings">
            Settings
          </Link>
        </div>

        <div className="cn-study__narrow-toggle" role="group" aria-label="Visible workspace pane">
          <button type="button" onClick={() => setLayoutMode('source-focus')}>Show source</button>
          <button type="button" onClick={() => setLayoutMode('journal-focus')}>Show writing</button>
        </div>
      </header>

      <div className="cn-study__panes" data-layout-mode={state.layout.mode}>
        <SplitPane
          label="Source and journal"
          defaultRatio={state.layout.splitRatio}
          ratio={state.layout.splitRatio}
          minRatio={0.3}
          maxRatio={0.7}
          startVisible={sourceVisible}
          endVisible={rightVisible}
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
            ) : document && assetId ? (
              <PdfReader
                ref={readerRef}
                document={document}
                sourceId={context.source.id}
                assetId={assetId}
                page={page}
                zoom={state.sourceView.zoom}
                scrollOffset={state.sourceView.scrollOffset}
                annotationTool={state.sourceView.annotationTool}
                onAnnotationToolChange={(annotationTool) => {
                  if (annotationTool === state.sourceView.annotationTool) return;
                  commit({
                    sourceView: { ...state.sourceView, annotationTool },
                  });
                }}
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
            <section className="cn-study__right" aria-label="Writing workspace">
              {/*
                Deliberately NOT keyed on the page. The journal is
                continuous (INV-003) — turning a page moves which run
                is marked current, it does not swap one notebook for
                another. Keying on the page was correct when the pane
                showed a single page's notes; now it would remount and
                re-read the whole journal on every page turn, and drop
                any edit still inside the save debounce.
              */}
              <div className="cn-study__right-projection" hidden={state.layout.rightWorkspace !== 'write'}>
                <JournalPane
                  sourceId={context.source.id}
                  journalId={context.journal.id}
                  location={state.activeLocation}
                  scrollOffset={state.journalView.scrollOffset}
                  onScroll={(scrollOffset) =>
                    drift({ journalView: { ...state.journalView, scrollOffset } })
                  }
                />
              </div>
              <div
                className="cn-study__right-projection"
                aria-label="Whiteboard workspace"
                hidden={state.layout.rightWorkspace !== 'whiteboard'}
              >
                <Whiteboard
                  sourceId={context.source.id}
                  journalId={context.journal.id}
                  location={state.activeLocation}
                  state={state.whiteboard}
                  active={state.layout.rightWorkspace === 'whiteboard'}
                  onViewportDrift={(viewport) =>
                    drift({ whiteboard: { ...state.whiteboard, viewport } })
                  }
                  onViewportCommit={(viewport) =>
                    commit({ whiteboard: { ...state.whiteboard, viewport } })
                  }
                  onLayoutCommit={(layout) =>
                    commit({ whiteboard: { ...state.whiteboard, layout } })
                  }
                />
              </div>
            </section>
          }
        />
      </div>

      <ContextPanel
        open={contextOpen}
        title="Contents"
        onClose={closeContext}
        triggerRef={contextTriggerRef}
      >
        {document ? (
          <PdfOutline
            document={document}
            onNavigate={(next) => {
              setPage(next);
              readerRef.current?.navigateTo(next);
              closeContext();
            }}
            onClose={closeContext}
            showHeader={false}
          />
        ) : (
          <p className="cn-outline__hint">Contents become available with the document.</p>
        )}
      </ContextPanel>
    </div>
  );
}
