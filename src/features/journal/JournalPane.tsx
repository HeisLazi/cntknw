import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { expectedRevision } from '@data/repositories/concurrency';
import { RevisionConflictError } from '@data/errors';
import { createPageLinkedBlock } from '@application/create-block';
import { plainTextOf } from '@domain/journals/blockText';
import type { EntityId, JournalBlock, SourceLocation } from '@domain/index';
import { BlockEditor } from './BlockEditor';
import { clearDraft, recoverDrafts, stashDraft } from './draftBuffer';
import './journal.css';

export interface JournalPaneProps {
  sourceId: EntityId;
  journalId: EntityId;
  /** Where the reader currently is. Inherited by anything written now. */
  location: SourceLocation;
}

/**
 * Short enough that a lost window is small, long enough that typing
 * does not produce a write per keystroke. Paired with a flush on
 * every path out of the page — see `flushAll` below.
 */
const SAVE_DEBOUNCE_MS = 400;

interface PendingEdit {
  doc: unknown;
  text: string;
}

/**
 * The journal for one source. INV-003, INV-004, INV-005.
 *
 * **A block written while page 5 is on screen belongs to page 5, and
 * the user is never asked.** That is INV-004 and AC-003, and it is the
 * whole point of the two panes being one workspace: the location is
 * taken from where the reader is, not from a field they fill in.
 *
 * **Only pages with writing appear.** INV-005 and AC-004 — an empty
 * page creates no section, which is why this lists the blocks for the
 * current location rather than rendering a header per page.
 *
 * Persistence follows the pattern established for workspace state:
 * debounced, and guarded on the revision actually read (ADR-0003).
 * A journal block is more valuable than a scroll position, so a
 * conflict here does **not** reapply — it surfaces, because two
 * windows editing the same sentence is a real disagreement and
 * picking a winner silently would lose somebody's words.
 */
export function JournalPane({ sourceId, journalId, location }: JournalPaneProps) {
  const repositories = useRepositories();
  const { journals } = repositories;
  const page = location.pdf?.page;

  // `null` means "not yet loaded"; loading state is derived from it,
  // so nothing sets state synchronously inside the effect below.
  // Reset during render when the identity of the page-worth-of-blocks
  // changes, matching the useAsyncResource pattern in @app/hooks.
  const [blocks, setBlocks] = useState<JournalBlock[] | null>(null);
  const [loadedKey, setLoadedKey] = useState<string>('');
  const currentKey = `${journalId}:${page ?? 'all'}`;
  if (loadedKey !== currentKey) {
    setLoadedKey(currentKey);
    setBlocks(null);
  }
  const loading = blocks === null;
  const [conflicted, setConflicted] = useState<EntityId | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<EntityId | null>(null);

  // Revisions we believe are current, and edits not yet written.
  const revisions = useRef(new Map<EntityId, number>());
  const pending = useRef(new Map<EntityId, PendingEdit>());
  const timers = useRef(new Map<EntityId, ReturnType<typeof setTimeout>>());

  const [reloadTrigger, setReloadTrigger] = useState(0);
  const reload = useCallback(() => {
    // Bumping the trigger forces the load effect to re-run.
    setReloadTrigger((n) => n + 1);
  }, []);

  // The load effect needs `flush` to replay recovered drafts, but is
  // declared above it. A ref breaks the cycle without making the
  // effect depend on a callback that changes identity.
  const flushRef = useRef<(blockId: EntityId) => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    const query = page === undefined
      ? journals.listBlocks(journalId)
      : journals.listBlocksByPage(journalId, page);

    // The setBlocks call is inside a .then callback — an external
    // subscription resolving, not a synchronous effect body update —
    // which is the case react-hooks/set-state-in-effect permits.
    query
      .then((found) => {
        if (cancelled) return;
        for (const block of found) revisions.current.set(block.id, block.revision);

        // Replay anything a crash left behind. The draft is applied
        // over the stored block and scheduled through the ordinary
        // guarded save path — recovery is not a privileged write.
        const drafts = recoverDrafts();
        const restored = found.map((block) => {
          const draft = drafts.get(block.id);
          if (!draft) return block;
          const storedText =
            block.content.type === 'paragraph' ? block.content.text : '';
          if (draft.text === storedText) {
            clearDraft(block.id);
            return block;
          }
          pending.current.set(block.id, { doc: draft.doc, text: draft.text });
          return block.content.type === 'paragraph'
            ? {
                ...block,
                content: {
                  ...block.content,
                  doc: draft.doc as Record<string, unknown>,
                  text: draft.text,
                },
              }
            : block;
        });

        setBlocks(restored);
        for (const block of restored) {
          if (pending.current.has(block.id)) void flushRef.current(block.id);
        }
      })
      .catch(() => {
        if (!cancelled) setBlocks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [journals, journalId, page, reloadTrigger]);

  const flush = useCallback(
    async (blockId: EntityId) => {
      const edit = pending.current.get(blockId);
      if (!edit) return;
      pending.current.delete(blockId);

      const revision = revisions.current.get(blockId);
      if (revision === undefined) return;

      try {
        const saved = await journals.updateBlock(
          {
            id: blockId,
            content: {
              type: 'paragraph',
              // Cast at the boundary. The domain intentionally keeps
              // `doc` as an open record so it need not depend on the
              // editor's type — see editorSchema.ts. The editor emits
              // ProseMirror JSON, which is exactly this shape; the
              // cast is the one place the two vocabularies meet.
              doc: edit.doc as Record<string, unknown>,
              text: edit.text,
            },
          },
          expectedRevision(revision),
        );
        revisions.current.set(blockId, saved.revision);
        // Durably stored — the crash buffer no longer needs it.
        clearDraft(blockId);
        setConflicted((current) => (current === blockId ? null : current));
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          // Deliberately not reapplied. Reading position can be
          // re-asserted by the window in use; a sentence cannot,
          // because the other version is somebody's writing too.
          setConflicted(blockId);
          return;
        }
        throw error;
      }
    },
    [journals],
  );

  const syncFlushRef = useCallback(() => {
    flushRef.current = flush;
  }, [flush]);
  useEffect(syncFlushRef);

  const scheduleSave = useCallback(
    (blockId: EntityId, edit: PendingEdit) => {
      pending.current.set(blockId, edit);
      // Synchronous, on every keystroke. This is the only write that
      // is guaranteed to have happened if the tab dies in the next
      // millisecond — see draftBuffer.ts.
      stashDraft({ blockId, doc: edit.doc, text: edit.text });
      const existing = timers.current.get(blockId);
      if (existing) clearTimeout(existing);
      timers.current.set(
        blockId,
        setTimeout(() => void flush(blockId), SAVE_DEBOUNCE_MS),
      );
    },
    [flush],
  );

  /**
   * Write everything outstanding before the words can be lost.
   *
   * Unmount is not enough. A reload or a tab close does not unmount
   * React cleanly, and closing a tab mid-sentence is exactly when the
   * words matter most — the same defect measured on the workspace
   * autosave, where a reload inside the debounce window lost a page
   * turn entirely.
   *
   * Text genuinely does need debouncing — a write per keystroke would
   * be absurd — so unlike the workspace this cannot be fixed by
   * writing promptly. The debounce is instead kept short, and every
   * path out of the page flushes.
   */
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

  const addBlock = useCallback(async () => {
    const block = await createPageLinkedBlock(repositories, {
      sourceId,
      sourceLocation: location,
      kind: 'paragraph',
      content: { type: 'paragraph', text: '' },
    });
    revisions.current.set(block.id, block.revision);
    setBlocks((current) => [...(current ?? []), block]);
    setFocusBlockId(block.id);
  }, [repositories, sourceId, location]);

  const removeBlock = useCallback(
    async (blockId: EntityId) => {
      const revision = revisions.current.get(blockId);
      if (revision === undefined) return;
      // Soft delete: NFR-008 wants a recovery path for every
      // destructive action, and a block removed by a stray Backspace
      // is the clearest case for one.
      await journals.softDeleteBlock(blockId, expectedRevision(revision));
      revisions.current.delete(blockId);
      setBlocks((current) => (current ?? []).filter((block) => block.id !== blockId));
    },
    [journals],
  );

  return (
    <div className="cn-journal">
      <div className="cn-journal__header">
        <h2 className="cn-journal__title">Journal</h2>
        {page !== undefined ? (
          // The inherited location, shown rather than asked for.
          <p className="cn-journal__location">Page {page}</p>
        ) : null}
      </div>

      <div className="cn-journal__body">
        {loading ? (
          <p className="cn-journal__hint" role="status">
            Loading…
          </p>
        ) : (blocks ?? []).length === 0 ? (
          <p className="cn-journal__hint">
            {page !== undefined
              ? `Nothing written on page ${page} yet. Anything you write here will belong to this page.`
              : 'Nothing written yet.'}
          </p>
        ) : (
          <ul className="cn-journal__blocks">
            {(blocks ?? []).map((block) => (
              <li key={block.id} className="cn-journal__block">
                <BlockEditor
                  doc={block.content.type === 'paragraph' ? block.content.doc : undefined}
                  text={
                    block.content.type === 'paragraph'
                      ? block.content.text
                      : plainTextOf(undefined)
                  }
                  autoFocus={block.id === focusBlockId}
                  placeholder="Write…"
                  onChange={(next) => scheduleSave(block.id, next)}
                  onSplit={() => void addBlock()}
                  onRemove={() => void removeBlock(block.id)}
                />
                {conflicted === block.id ? (
                  <p className="cn-journal__conflict" role="alert">
                    This block was changed in another window. Your text has not
                    been saved over it.{' '}
                    <button
                      type="button"
                      className="cn-journal__reload"
                      onClick={reload}
                    >
                      Reload the block
                    </button>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="cn-journal__add" onClick={() => void addBlock()}>
          {(blocks ?? []).length === 0 ? 'Start writing' : 'Add a block'}
          {page !== undefined ? (
            <span className="cn-journal__add-hint"> on page {page}</span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
