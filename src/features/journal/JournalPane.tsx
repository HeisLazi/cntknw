import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { resolveConflictKeepSaved, resolveConflictUseMyVersion } from './resolution';
import { expectedRevision } from '@data/repositories/concurrency';
import { RevisionConflictError } from '@data/errors';
import { createPageLinkedBlock } from '@application/create-block';
import { groupBlocksByLocation } from '@domain/journals/grouping';
import type { JournalGroup } from '@domain/journals/grouping';
import {
  createEmptyDrawingData,
  type EntityId,
  type JournalBlock,
  type SourceLocation,
  type BlockKind,
  type BlockContent,
} from '@domain/index';
import { textOfEditableContent, withEditedText, contentForKind } from '@domain/journals/transform';
import { movePageLinkedBlock } from '@application/index';
import { JournalBlockView } from './JournalBlockView';
import { clearDraft, recoverDrafts, stashDraft } from './draftBuffer';
import {
  applyPendingEdit,
  drawingSummary,
  pendingEditSummary,
  type PendingJournalEdit,
} from './pendingEdit';
import './journal.css';

export interface JournalPaneProps {
  sourceId: EntityId;
  journalId: EntityId;
  /** Where the reader currently is. Inherited by anything written now. */
  location: SourceLocation;
  scrollOffset?: number;
  onScroll?: (offset: number) => void;
}

/**
 * Short enough that a lost window is small, long enough that typing
 * does not produce a write per keystroke. Paired with a synchronous
 * crash buffer and a flush on every path out of the page (ADR-0005).
 */
const SAVE_DEBOUNCE_MS = 400;

/**
 * How far apart two runs are, as rhythm rather than as data.
 *
 * Deliberately not a readable quantity — the numerals state the facts.
 * This exists so that a jump from page 5 to page 41 *feels* like
 * turning a sheaf of pages, and two consecutive pages feel continuous.
 */
function gapBetween(previous: number | undefined, current: number | undefined): string {
  if (previous === undefined || current === undefined) return 'far';
  const distance = current - previous;
  if (distance <= 1) return 'adjacent';
  if (distance < 10) return 'near';
  return 'far';
}

/**
 * The journal for one source. INV-003, INV-004, INV-005.
 *
 * **One continuous journal, not a page of notes per page of book.**
 * Every block for the source is loaded and grouped into *runs* — a
 * page numeral in the margin, and the blocks written on that page set
 * beneath it.
 *
 * **Provenance is carried by position, not by metadata.** A block
 * belongs to page 41 for the same reason a footnote belongs to the
 * page it is printed on: it is set beneath the 41. There is no field,
 * no dropdown, no badge, because there is nothing to state. That is
 * INV-004 and AC-003 expressed as layout rather than as a form.
 *
 * **A run exists only if it has writing.** There is no page-header
 * component that *could* render for an empty page, so INV-005 and
 * AC-004 are structural rather than a filter someone can forget. A
 * 400-page book with notes on sixty pages shows sixty numerals — not
 * four hundred headers with silence between them.
 *
 * The single exception is the *composing line*: the page the reader is
 * on, if nothing is written there yet, gets one unsaved line at its
 * sorted position. Nothing is persisted for it, so leaving without
 * typing leaves no trace and INV-005 holds in the data as well as in
 * the view.
 */
export function JournalPane({
  sourceId,
  journalId,
  location,
  scrollOffset,
  onScroll,
}: JournalPaneProps) {
  const repositories = useRepositories();
  const { journals } = repositories;
  const activePage = location.pdf?.page;

  const [blocks, setBlocks] = useState<JournalBlock[] | null>(null);
  const [deletedBlocks, setDeletedBlocks] = useState<JournalBlock[]>([]);
  const [readError, setReadError] = useState<Error | null>(null);
  const [loadedJournal, setLoadedJournal] = useState<string>('');
  if (loadedJournal !== journalId) {
    setLoadedJournal(journalId);
    setBlocks(null);
    setReadError(null);
  }
  const loading = blocks === null && readError === null;

  const [conflictData, setConflictData] = useState<Map<EntityId, { remoteText: string, localText: string }>>(new Map());
  const [failedWrites, setFailedWrites] = useState<Set<EntityId>>(new Set());
  const [trashBlocked, setTrashBlocked] = useState<Set<EntityId>>(new Set());
  const [resolutionErrors, setResolutionErrors] = useState<Set<EntityId>>(new Set());
  const [resetKeys, setResetKeys] = useState<Map<EntityId, number>>(new Map());
  const [focusBlockId, setFocusBlockId] = useState<EntityId | null>(null);

  const revisions = useRef(new Map<EntityId, number>());
  const pending = useRef(new Map<EntityId, PendingJournalEdit>());
  const timers = useRef(new Map<EntityId, ReturnType<typeof setTimeout>>());
  const flushRef = useRef<(blockId: EntityId) => Promise<void>>(async () => {});

  const [reloadTrigger, setReloadTrigger] = useState(0);
  const scrollport = useRef<HTMLDivElement>(null);
  const [initialScrollSet, setInitialScrollSet] = useState(false);

  // ── Load the whole journal, not one page of it ─────────────────
  useEffect(() => {
    let cancelled = false;

    journals
      .listBlocks(journalId)
      .then(async (found) => {
        if (cancelled) return;
        const foundTrash = await journals.listDeletedBlocks(journalId);
        if (cancelled) return;
        setDeletedBlocks(foundTrash);
        for (const block of found) revisions.current.set(block.id, block.revision);

        // Replay anything a crash left behind (ADR-0005). Recovery is
        // not a privileged write: it goes through the same guarded
        // save path as any other edit.
        const drafts = recoverDrafts();
        const restored = found.map((block) => {
          const draft = drafts.get(block.id);
          if (!draft) return block;
          const storedText = textOfEditableContent(block.content);
          if (storedText === undefined) return block;

          if (draft.text === storedText) {
            clearDraft(block.id);
            return block;
          }
          pending.current.set(block.id, {
            kind: 'text',
            doc: draft.doc,
            text: draft.text,
          });
          
          return { ...block, content: withEditedText(block.content, draft) as BlockContent };
        });

        setBlocks(restored);
        for (const block of restored) {
          if (pending.current.has(block.id)) void flushRef.current(block.id);
        }
      })
      .catch((error) => {
        if (!cancelled) setReadError(error instanceof Error ? error : new Error(String(error)));
      });

    return () => {
      cancelled = true;
    };
  }, [journals, journalId, reloadTrigger]);

  // ── Restore scroll position once loaded ──────────────────────────
  useEffect(() => {
    if (!loading && !initialScrollSet && scrollport.current && scrollOffset !== undefined) {
      scrollport.current.scrollTop = scrollOffset;
      setInitialScrollSet(true);
    }
  }, [loading, initialScrollSet, scrollOffset]);

  // ── Saving ──────────────────────────────────────────────────────
  const flush = useCallback(
    async (blockId: EntityId) => {
      const edit = pending.current.get(blockId);
      if (!edit) return;

      const revision = revisions.current.get(blockId);
      if (revision === undefined) return;

      try {
        const currentBlock = blocks?.find((b) => b.id === blockId);
        if (!currentBlock) return;

        const mergedContent = applyPendingEdit(currentBlock.content, edit);

        const saved = await journals.updateBlock(
          {
            id: blockId,
            content: mergedContent,
          },
          expectedRevision(revision),
        );
        const clearedPendingEdit = pending.current.get(blockId) === edit;
        if (clearedPendingEdit) {
          pending.current.delete(blockId);
          clearDraft(blockId);
        }
        revisions.current.set(blockId, saved.revision);
        setBlocks(current => current?.map(b => b.id === blockId ? saved : b) ?? null);
        setConflictData(curr => {
          if (!curr.has(blockId)) return curr;
          const next = new Map(curr);
          next.delete(blockId);
          return next;
        });
        setFailedWrites((current) => {
          if (!current.has(blockId)) return current;
          const next = new Set(current);
          next.delete(blockId);
          return next;
        });
        if (clearedPendingEdit) {
          setTrashBlocked((current) => {
            if (!current.has(blockId)) return current;
            const next = new Set(current);
            next.delete(blockId);
            return next;
          });
        }
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          // Deliberately not reapplied. A reading position can be
          // re-asserted by the window in use; a sentence cannot,
          // because the other version is somebody's writing too
          // (ADR-0004 §6).
          journals.getBlockById(blockId).then(remoteBlock => {
            if (remoteBlock) {
              setConflictData(curr => new Map(curr).set(blockId, {
                remoteText: drawingSummary(remoteBlock.content),
                localText: pendingEditSummary(edit),
              }));
            }
          });
          return;
        }
        
        console.error('Failed to save block', error);
        setFailedWrites((current) => {
          const next = new Set(current);
          next.add(blockId);
          return next;
        });
      }
    },
    [journals, blocks],
  );

  const syncFlushRef = useCallback(() => {
    flushRef.current = flush;
  }, [flush]);
  useEffect(syncFlushRef);

  const scheduleSave = useCallback(
    (blockId: EntityId, edit: PendingJournalEdit) => {
      pending.current.set(blockId, edit);
      if (edit.kind === 'text') {
        // Synchronous, every keystroke. The only write guaranteed to
        // have happened if the tab dies in the next millisecond.
        stashDraft({ blockId, doc: edit.doc, text: edit.text });
      }
      const existing = timers.current.get(blockId);
      if (existing) clearTimeout(existing);
      timers.current.set(
        blockId,
        setTimeout(() => void flush(blockId), SAVE_DEBOUNCE_MS),
      );
    },
    [flush],
  );

  const flushAll = useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    for (const blockId of [...pending.current.keys()]) void flush(blockId);
  }, [flush]);

  useEffect(() => {
    const onPageHide = () => flushAll();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      flushAll();
    };
  }, [flushAll]);

  // ── Creating and removing ───────────────────────────────────────

  /**
   * Two distinct paths, and conflating them is the trap.
   *
   * **Capturing** — the composing line writes at the page the reader
   * is *on*, because that is what the reader is looking at.
   *
   * **Continuing** — Enter at the end of a block creates a sibling in
   * the *same run*, inheriting that block's location. If the reader
   * has scrolled the source away, continuing a note about page 12
   * must still land on page 12, not on wherever the source happens to
   * be showing.
   */
  const addBlock = useCallback(
    async (
      at: SourceLocation,
      kind: 'paragraph' | 'drawing' = 'paragraph',
      afterBlockId?: EntityId,
    ) => {
      const block = await createPageLinkedBlock(repositories, {
        sourceId,
        sourceLocation: at,
        kind,
        content: kind === 'drawing'
          ? { type: 'drawing', drawingData: createEmptyDrawingData() }
          : { type: 'paragraph', text: '' },
        ...(afterBlockId === undefined ? {} : { afterBlockId }),
      });
      revisions.current.set(block.id, block.revision);
      setBlocks((current) => [...(current ?? []), block]);
      setFocusBlockId(block.id);
    },
    [repositories, sourceId],
  );

  const removeBlock = useCallback(
    async (blockId: EntityId) => {
      const existingTimer = timers.current.get(blockId);
      if (existingTimer) clearTimeout(existingTimer);
      timers.current.delete(blockId);

      // Preserve substantive edits before trashing, especially a drawing
      // sent to trash inside its debounce window. A trailing blank text
      // edit is different: flushing it would erase the last saved writing
      // before soft deletion, leaving nothing useful to restore.
      const edit = pending.current.get(blockId);
      const shouldFlush = edit?.kind === 'content'
        || (edit?.kind === 'text' && edit.text.trim() !== '');
      if (shouldFlush) {
        await flush(blockId);
        if (pending.current.has(blockId)) {
          setTrashBlocked((current) => new Set(current).add(blockId));
          return;
        }
      }

      const revision = revisions.current.get(blockId);
      if (revision === undefined) return;
      // Soft delete: NFR-008 wants a recovery path for every
      // destructive action, and a block removed by a stray Backspace
      // is the clearest case for one.
      const saved = await journals.softDeleteBlock(blockId, expectedRevision(revision));
      setBlocks((current) => (current ?? []).filter((b) => b.id !== blockId));
      setDeletedBlocks(current => [...current, saved]);
      revisions.current.delete(blockId);
      
      pending.current.delete(blockId);
      clearDraft(blockId);
      
      setConflictData(curr => {
        const next = new Map(curr);
        next.delete(blockId);
        return next;
      });
      setFailedWrites(curr => {
        const next = new Set(curr);
        next.delete(blockId);
        return next;
      });
      setTrashBlocked(curr => {
        const next = new Set(curr);
        next.delete(blockId);
        return next;
      });
      setResolutionErrors(curr => {
        const next = new Set(curr);
        next.delete(blockId);
        return next;
      });
      setFocusBlockId(curr => curr === blockId ? null : curr);
    },
    [flush, journals],
  );

  const restoreBlock = useCallback(
    async (blockId: EntityId) => {
      const block = deletedBlocks.find(b => b.id === blockId);
      if (!block) return;
      const restored = await journals.restoreBlock(
        blockId,
        expectedRevision(block.revision)
      );
      setDeletedBlocks(current => current.filter(b => b.id !== blockId));
      setBlocks(current => {
        const next = [...(current ?? []), restored];
        next.sort((a, b) => a.rank.localeCompare(b.rank));
        return next;
      });
      revisions.current.set(blockId, restored.revision);
    },
    [journals, deletedBlocks],
  );

  const changeBlockKind = useCallback(
    async (blockId: EntityId, to: BlockKind) => {
      const block = blocks?.find((b) => b.id === blockId);
      if (!block) return;
      
      const revision = revisions.current.get(blockId);
      if (revision === undefined) return;

      try {
        const edit = pending.current.get(blockId);
        const baseContent = edit ? applyPendingEdit(block.content, edit) : block.content;
        const newContent = contentForKind(baseContent as BlockContent, to);
        
        const saved = await journals.updateBlock(
          {
            id: blockId,
            kind: to,
            content: newContent,
          },
          expectedRevision(revision)
        );
        if (pending.current.get(blockId) === edit) {
          pending.current.delete(blockId);
          const existingTimer = timers.current.get(blockId);
          if (existingTimer) clearTimeout(existingTimer);
          clearDraft(blockId);
        }
        
        revisions.current.set(blockId, saved.revision);
        setBlocks((current) => (current ?? []).map((b) => b.id === blockId ? saved : b));
      } catch (err) {
        console.error("Failed to change block kind", err);
      }
    },
    [blocks, journals]
  );

  const moveBlock = useCallback(
    async (blockId: EntityId, direction: 'up' | 'down') => {
      await movePageLinkedBlock(repositories, { blockId, direction });
      setReloadTrigger(n => n + 1);
    },
    [repositories]
  );

  // ── Runs ────────────────────────────────────────────────────────
  const runs = useMemo<JournalGroup[]>(
    () => groupBlocksByLocation((blocks ?? []).filter(b => !b.deletedAt)),
    [blocks],
  );


  const activeHasWriting =
    activePage !== undefined && runs.some((run) => run.page === activePage);

  /** Runs plus, if the active page is empty, one unsaved composing line. */
  const rendered = useMemo(() => {
    if (activePage === undefined || activeHasWriting) return runs;
    const composing: JournalGroup = {
      key: `composing-${activePage}`,
      page: activePage,
      blocks: [],
    };
    const placed = runs.filter((r) => r.page !== undefined);
    const unplaced = runs.filter((r) => r.page === undefined);
    const before = placed.filter((r) => (r.page ?? 0) < activePage);
    const after = placed.filter((r) => (r.page ?? 0) > activePage);
    return [...before, composing, ...after, ...unplaced];
  }, [runs, activePage, activeHasWriting]);

  return (
    <div className="cn-journal">
      {/* A running head, not a status bar. The page number is
          deliberately absent — it lives in the margin now, and
          printing it twice would make the header authoritative and
          the margin decoration, inverting the whole idea. */}
      <div className="cn-journal__header">
        <span className="cn-journal__runninghead">Journal</span>
      </div>

      <div
        className="cn-journal__body"
        ref={scrollport}
        onScroll={(e) => onScroll?.(e.currentTarget.scrollTop)}
      >
        {readError ? (
          <div className="cn-journal__error" role="alert">
            <p>Your journal could not be loaded. Your stored work has not been deleted.</p>
            <button
              type="button"
              className="cn-journal__retry"
              onClick={() => {
                setReadError(null);
                setReloadTrigger(n => n + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <p className="cn-journal__hint" role="status">
            Loading…
          </p>
        ) : rendered.length === 0 ? (
          <p className="cn-journal__hint">
            Nothing written yet. Open a page and start — what you write will
            belong to the page you wrote it on.
          </p>
        ) : (
          <ol className="cn-journal__runs">
            {rendered.map((run, index) => {
              const isActive = run.page !== undefined && run.page === activePage;
              const isComposing = run.blocks.length === 0;
              const gap = gapBetween(rendered[index - 1]?.page, run.page);

              return (
                <li
                  key={run.key}
                  className={[
                    'cn-run',
                    isActive ? 'cn-run--active' : null,
                    isComposing ? 'cn-run--composing' : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-gap={gap}
                  aria-current={isActive ? 'location' : undefined}
                  aria-label={
                    run.page === undefined
                      ? 'Notes about the whole work'
                      : `Page ${run.page}${isComposing ? ', empty' : ''}`
                  }
                >
                  <p className="cn-run__folio">
                    {run.page === undefined ? (
                      <span className="cn-run__folio-mark">§</span>
                    ) : (
                      <>
                        <span aria-hidden="true">p.</span>
                        {run.page}
                      </>
                    )}
                  </p>

                  {isComposing ? (
                    <div className="cn-run__opening">
                      <button
                        type="button"
                        className="cn-run__start"
                        onClick={() => void addBlock(location, 'paragraph')}
                      >
                        Start writing.
                      </button>
                      <button
                        type="button"
                        className="cn-run__draw"
                        onClick={() => void addBlock(location, 'drawing')}
                      >
                        Draw a sketch.
                      </button>
                    </div>
                  ) : (
                    <ol className="cn-run__blocks">
                      {run.blocks.map((block: JournalBlock) => (
                        <li key={`${block.id}-${resetKeys.get(block.id) || 0}`}>
                            <JournalBlockView
                              block={block}
                              autoFocus={block.id === focusBlockId}
                              onTextChange={(next) => scheduleSave(block.id, {
                                kind: 'text',
                                ...next,
                              })}
                              onContentChange={(content) => scheduleSave(block.id, {
                                kind: 'content',
                                content,
                              })}
                              onSplit={() =>
                                void addBlock(
                                  block.sourceLocation ?? location,
                                  'paragraph',
                                  block.id,
                                )
                              }
                              onRemove={() => void removeBlock(block.id)}
                              onMoveUp={() => void moveBlock(block.id, 'up')}
                              onMoveDown={() => void moveBlock(block.id, 'down')}
                              onChangeKind={(to) => void changeBlockKind(block.id, to)}
                              footer={
                                <>
                                  {trashBlocked.has(block.id) ? (
                                    <p className="cn-journal__error" role="alert">
                                      {conflictData.has(block.id)
                                        ? 'Could not move this to trash yet because the latest changes have not saved. Resolve the save conflict, then delete again.'
                                        : 'Could not move this to trash yet because the latest changes have not saved. Use Retry to finish saving, then delete again.'}
                                      {failedWrites.has(block.id) && !conflictData.has(block.id) ? (
                                        <button
                                          type="button"
                                          className="cn-journal__retry"
                                          onClick={() => void flush(block.id)}
                                        >
                                          Retry saving
                                        </button>
                                      ) : null}
                                    </p>
                                  ) : failedWrites.has(block.id) && !conflictData.has(block.id) ? (
                                    <p className="cn-journal__error" role="alert">
                                      Failed to save your changes. Your changes are still here.
                                      <button
                                        type="button"
                                        className="cn-journal__retry"
                                        onClick={() => void flush(block.id)}
                                      >
                                        Retry saving
                                      </button>
                                    </p>
                                  ) : null}
                                  {conflictData.has(block.id) ? (
                              <div className="cn-journal__conflict" role="alert">
                                <strong>Conflict:</strong> This block was changed in another window.
                                {resolutionErrors.has(block.id) ? (
                                  <p className="cn-journal__error" style={{marginTop: '0.5rem', marginBottom: '0.5rem'}}>
                                    Failed to resolve conflict. Please try again.
                                  </p>
                                ) : null}
                                <div className="cn-journal__conflict-diff">
                                  <p><strong>Saved version:</strong> {conflictData.get(block.id)?.remoteText || 'Loading...'}</p>
                                  <p><strong>Your unsaved version:</strong> {conflictData.get(block.id)?.localText || 'Loading...'}</p>
                                </div>
                                <div className="cn-journal__conflict-actions">
                                  <button
                                    type="button"
                                    className="cn-journal__reload"
                                    onClick={async () => {
                                      await resolveConflictKeepSaved(
                                        block.id,
                                        repositories,
                                        clearDraft,
                                        pending.current,
                                        timers.current,
                                        revisions.current,
                                        setBlocks,
                                        setConflictData,
                                        setResetKeys,
                                        setResolutionErrors
                                      );
                                      if (!pending.current.has(block.id)) {
                                        setTrashBlocked((current) => {
                                          const next = new Set(current);
                                          next.delete(block.id);
                                          return next;
                                        });
                                      }
                                    }}
                                  >
                                    Keep saved
                                  </button>
                                  <button
                                    type="button"
                                    className="cn-journal__reload"
                                      onClick={async () => {
                                        await resolveConflictUseMyVersion(
                                          block.id,
                                          repositories,
                                          clearDraft,
                                          pending.current,
                                          timers.current,
                                          revisions.current,
                                          setBlocks,
                                          setConflictData,
                                          setResetKeys,
                                          setResolutionErrors
                                        );
                                        if (!pending.current.has(block.id)) {
                                          setTrashBlocked((current) => {
                                            const next = new Set(current);
                                            next.delete(block.id);
                                            return next;
                                          });
                                        }
                                      }}
                                  >
                                    Use my version
                                  </button>
                                  </div>
                                </div>
                              ) : null}
                              </>
                            }
                          />
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {deletedBlocks.length > 0 && (
          <details className="cn-journal__trash">
            <summary>Recently Deleted ({deletedBlocks.length})</summary>
            <ol className="cn-journal__trash-list">
              {deletedBlocks.map(block => (
                <li key={block.id} className="cn-journal__trash-item">
                  <div className="cn-journal__trash-content">
                    <span className="cn-journal__trash-kind">{block.kind}</span>
                    <span className="cn-journal__trash-text">
                      {drawingSummary(block.content) || '...'}
                    </span>
                  </div>
                  <button type="button" onClick={() => void restoreBlock(block.id)}>Restore</button>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}
