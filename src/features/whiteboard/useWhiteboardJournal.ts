import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { createPageLinkedBlock } from '@application/create-block';
import { expectedRevision } from '@data/repositories/concurrency';
import { RevisionConflictError } from '@data/errors';
import { textOfEditableContent } from '@domain/journals/transform';
import type {
  BlockContent,
  EntityId,
  JournalBlock,
  SourceLocation,
} from '@domain/index';
import { clearDraft, recoverDrafts, stashDraft } from '@features/journal/draftBuffer';
import {
  applyPendingEdit,
  drawingSummary,
  pendingEditSummary,
  type PendingJournalEdit,
} from '@features/journal/pendingEdit';
import {
  announceJournalProjectionChange,
  listenForJournalProjectionChanges,
} from './journalProjectionEvents';

const SAVE_DEBOUNCE_MS = 400;

type ConflictResolution = 'keep-saved' | 'use-mine';

export interface WhiteboardConflict {
  remoteSummary: string;
  localSummary: string;
  resolutionError: boolean;
  retryAction?: ConflictResolution;
}

export interface WhiteboardJournal {
  blocks: JournalBlock[] | null;
  failedWrites: ReadonlyMap<EntityId, string>;
  conflicts: ReadonlyMap<EntityId, WhiteboardConflict>;
  historyEpoch: number;
  createBlock: (
    kind: 'drawing' | 'paragraph',
    content: BlockContent,
    location: SourceLocation,
  ) => Promise<JournalBlock>;
  scheduleEdit: (blockId: EntityId, edit: PendingJournalEdit) => void;
  flush: (blockId: EntityId) => Promise<void>;
  resolveKeepSaved: (blockId: EntityId) => Promise<void>;
  resolveUseMyVersion: (blockId: EntityId) => Promise<void>;
  retryResolution: (blockId: EntityId) => Promise<void>;
  deleteBlock: (blockId: EntityId) => Promise<void>;
  restoreBlock: (blockId: EntityId) => Promise<JournalBlock>;
  refresh: () => Promise<void>;
}

/** Whiteboard access to the same guarded journal seams used by JournalPane. */
export function useWhiteboardJournal(
  sourceId: EntityId,
  journalId: EntityId,
  active: boolean,
  boardBlockIds: ReadonlySet<EntityId>,
): WhiteboardJournal {
  const repositories = useRepositories();
  const { journals } = repositories;
  const [blocks, setBlocks] = useState<JournalBlock[] | null>(null);
  const [failedWrites, setFailedWrites] = useState<Map<EntityId, string>>(new Map());
  const [conflicts, setConflicts] = useState<Map<EntityId, WhiteboardConflict>>(new Map());
  const [historyEpoch, setHistoryEpoch] = useState(0);
  const blocksRef = useRef<JournalBlock[]>([]);
  const deletedRef = useRef(new Map<EntityId, JournalBlock>());
  const revisions = useRef(new Map<EntityId, number>());
  const pending = useRef(new Map<EntityId, PendingJournalEdit>());
  const timers = useRef(new Map<EntityId, ReturnType<typeof setTimeout>>());
  const conflictsRef = useRef(new Map<EntityId, WhiteboardConflict>());
  const boardBlockIdsRef = useRef(boardBlockIds);
  const mountedRef = useRef(false);
  const flushRef = useRef<(blockId: EntityId) => Promise<void>>(async () => undefined);

  useEffect(() => {
    boardBlockIdsRef.current = boardBlockIds;
  }, [boardBlockIds]);

  const replaceBlocks = useCallback((next: JournalBlock[]) => {
    blocksRef.current = next;
    setBlocks(next);
  }, []);

  const replaceConflicts = useCallback((
    update: (current: Map<EntityId, WhiteboardConflict>) => Map<EntityId, WhiteboardConflict>,
  ) => {
    const next = update(conflictsRef.current);
    conflictsRef.current = next;
    setConflicts(next);
  }, []);

  const clearFailure = useCallback((blockId: EntityId) => {
    setFailedWrites((current) => {
      if (!current.has(blockId)) return current;
      const next = new Map(current);
      next.delete(blockId);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const [found, deleted] = await Promise.all([
      journals.listBlocks(journalId),
      journals.listDeletedBlocks(journalId),
    ]);
    deletedRef.current = new Map(deleted.map((block) => [block.id, block]));
    for (const block of [...found, ...deleted]) {
      revisions.current.set(block.id, block.revision);
    }

    const drafts = recoverDrafts();
    const recoveredIds: EntityId[] = [];
    const withPending = found.map((block) => {
      if (boardBlockIdsRef.current.has(block.id) && !pending.current.has(block.id)) {
        const draft = drafts.get(block.id);
        const storedText = textOfEditableContent(block.content);
        if (draft && storedText !== undefined) {
          if (draft.text === storedText) {
            clearDraft(block.id);
          } else {
            pending.current.set(block.id, {
              kind: 'text',
              doc: draft.doc,
              text: draft.text,
            });
            recoveredIds.push(block.id);
          }
        }
      }
      const edit = pending.current.get(block.id);
      return edit ? { ...block, content: applyPendingEdit(block.content, edit) } : block;
    });
    replaceBlocks(withPending);
    for (const blockId of recoveredIds) void flushRef.current(blockId);
  }, [journalId, journals, replaceBlocks]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      void refresh();
      return;
    }
    if (active) void refresh();
  }, [active, refresh]);

  useEffect(() => listenForJournalProjectionChanges(journalId, () => {
    if (active) void refresh();
  }), [active, journalId, refresh]);

  const flush = useCallback(async (blockId: EntityId) => {
    if (conflictsRef.current.has(blockId)) return;
    const edit = pending.current.get(blockId);
    const revision = revisions.current.get(blockId);
    const current = blocksRef.current.find((block) => block.id === blockId);
    if (!edit || revision === undefined || !current) return;
    try {
      const saved = await journals.updateBlock(
        { id: blockId, content: applyPendingEdit(current.content, edit) },
        expectedRevision(revision),
      );
      revisions.current.set(blockId, saved.revision);
      const cleared = pending.current.get(blockId) === edit;
      if (cleared) {
        pending.current.delete(blockId);
        clearDraft(blockId);
      }
      const newer = pending.current.get(blockId);
      const visible = newer
        ? { ...saved, content: applyPendingEdit(saved.content, newer) }
        : saved;
      replaceBlocks(blocksRef.current.map((block) => block.id === blockId ? visible : block));
      clearFailure(blockId);
      announceJournalProjectionChange({ journalId, blockId, source: 'whiteboard' });
      if (newer) void flushRef.current(blockId);
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        replaceConflicts((currentConflicts) => new Map(currentConflicts).set(blockId, {
          remoteSummary: 'Loading saved version…',
          localSummary: pendingEditSummary(edit),
          resolutionError: false,
        }));
        clearFailure(blockId);
        setHistoryEpoch((current) => current + 1);
        try {
          const remote = await journals.getBlockById(blockId);
          if (!remote) throw new Error('The current object could not be reloaded.');
          revisions.current.set(blockId, remote.revision);
          replaceConflicts((currentConflicts) => {
            const conflict = currentConflicts.get(blockId);
            if (!conflict) return currentConflicts;
            return new Map(currentConflicts).set(blockId, {
              ...conflict,
              remoteSummary: drawingSummary(remote.content),
            });
          });
        } catch {
          replaceConflicts((currentConflicts) => {
            const conflict = currentConflicts.get(blockId);
            if (!conflict) return currentConflicts;
            return new Map(currentConflicts).set(blockId, {
              ...conflict,
              remoteSummary: 'Saved version could not be loaded.',
            });
          });
        }
        return;
      }
      setFailedWrites((currentFailures) => new Map(currentFailures).set(
        blockId,
        'Failed to save this object. Your changes are still visible.',
      ));
    }
  }, [clearFailure, journalId, journals, replaceBlocks, replaceConflicts]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleEdit = useCallback((blockId: EntityId, edit: PendingJournalEdit) => {
    const current = blocksRef.current.find((block) => block.id === blockId);
    if (!current) return;
    pending.current.set(blockId, edit);
    if (edit.kind === 'text') {
      stashDraft({ blockId, doc: edit.doc, text: edit.text });
    }
    replaceBlocks(blocksRef.current.map((block) => block.id === blockId
      ? { ...block, content: applyPendingEdit(block.content, edit) }
      : block));
    if (conflictsRef.current.has(blockId)) {
      replaceConflicts((currentConflicts) => {
        const conflict = currentConflicts.get(blockId);
        return conflict
          ? new Map(currentConflicts).set(blockId, {
              ...conflict,
              localSummary: pendingEditSummary(edit),
            })
          : currentConflicts;
      });
      return;
    }
    const timer = timers.current.get(blockId);
    if (timer) clearTimeout(timer);
    timers.current.set(blockId, setTimeout(() => void flushRef.current(blockId), SAVE_DEBOUNCE_MS));
  }, [replaceBlocks, replaceConflicts]);

  const resolveConflict = useCallback(async (
    blockId: EntityId,
    action: ConflictResolution,
  ) => {
    const conflict = conflictsRef.current.get(blockId);
    if (!conflict) return;
    replaceConflicts((currentConflicts) => new Map(currentConflicts).set(blockId, {
      ...conflict,
      resolutionError: false,
      retryAction: action,
    }));
    try {
      const remote = await journals.getBlockById(blockId);
      if (!remote) throw new Error('The saved object is no longer available.');

      let accepted = remote;
      if (action === 'use-mine') {
        const edit = pending.current.get(blockId);
        if (!edit) throw new Error('The local version is no longer available.');
        accepted = await journals.updateBlock(
          { id: blockId, content: applyPendingEdit(remote.content, edit) },
          expectedRevision(remote.revision),
        );
      }

      const timer = timers.current.get(blockId);
      if (timer) clearTimeout(timer);
      timers.current.delete(blockId);
      pending.current.delete(blockId);
      clearDraft(blockId);
      revisions.current.set(blockId, accepted.revision);
      replaceBlocks(blocksRef.current.map((block) => block.id === blockId ? accepted : block));
      replaceConflicts((currentConflicts) => {
        const next = new Map(currentConflicts);
        next.delete(blockId);
        return next;
      });
      clearFailure(blockId);
      setHistoryEpoch((current) => current + 1);
      announceJournalProjectionChange({ journalId, blockId, source: 'whiteboard' });
    } catch {
      replaceConflicts((currentConflicts) => {
        const current = currentConflicts.get(blockId);
        return current
          ? new Map(currentConflicts).set(blockId, {
              ...current,
              resolutionError: true,
              retryAction: action,
            })
          : currentConflicts;
      });
    }
  }, [clearFailure, journalId, journals, replaceBlocks, replaceConflicts]);

  const resolveKeepSaved = useCallback(
    (blockId: EntityId) => resolveConflict(blockId, 'keep-saved'),
    [resolveConflict],
  );
  const resolveUseMyVersion = useCallback(
    (blockId: EntityId) => resolveConflict(blockId, 'use-mine'),
    [resolveConflict],
  );
  const retryResolution = useCallback(async (blockId: EntityId) => {
    const action = conflictsRef.current.get(blockId)?.retryAction;
    if (action) await resolveConflict(blockId, action);
  }, [resolveConflict]);

  const createBlock = useCallback(async (
    kind: 'drawing' | 'paragraph',
    content: BlockContent,
    location: SourceLocation,
  ) => {
    const block = await createPageLinkedBlock(repositories, {
      sourceId,
      sourceLocation: location,
      kind,
      content,
    });
    revisions.current.set(block.id, block.revision);
    replaceBlocks([...blocksRef.current, block]);
    announceJournalProjectionChange({ journalId, blockId: block.id, source: 'whiteboard' });
    return block;
  }, [journalId, replaceBlocks, repositories, sourceId]);

  const deleteBlock = useCallback(async (blockId: EntityId) => {
    if (conflictsRef.current.has(blockId)) {
      throw new Error('Resolve this object conflict before deleting it.');
    }
    const timer = timers.current.get(blockId);
    if (timer) clearTimeout(timer);
    timers.current.delete(blockId);
    await flushRef.current(blockId);
    if (pending.current.has(blockId)) {
      throw new Error('The latest object changes must save before it can be deleted.');
    }
    const revision = revisions.current.get(blockId);
    if (revision === undefined) throw new Error('The object revision is unavailable.');
    const deleted = await journals.softDeleteBlock(blockId, expectedRevision(revision));
    deletedRef.current.set(blockId, deleted);
    revisions.current.set(blockId, deleted.revision);
    replaceBlocks(blocksRef.current.filter((block) => block.id !== blockId));
    announceJournalProjectionChange({ journalId, blockId, source: 'whiteboard' });
  }, [journalId, journals, replaceBlocks]);

  const restoreBlock = useCallback(async (blockId: EntityId) => {
    let deleted = deletedRef.current.get(blockId);
    if (!deleted) {
      const found = await journals.listDeletedBlocks(journalId);
      deleted = found.find((block) => block.id === blockId);
    }
    if (!deleted) throw new Error('The deleted object could not be restored.');
    const restored = await journals.restoreBlock(blockId, expectedRevision(deleted.revision));
    deletedRef.current.delete(blockId);
    revisions.current.set(blockId, restored.revision);
    replaceBlocks([...blocksRef.current, restored].sort((a, b) => a.rank.localeCompare(b.rank)));
    announceJournalProjectionChange({ journalId, blockId, source: 'whiteboard' });
    return restored;
  }, [journalId, journals, replaceBlocks]);

  const flushAll = useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    for (const blockId of [...pending.current.keys()]) void flushRef.current(blockId);
  }, []);

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

  return {
    blocks,
    failedWrites,
    conflicts,
    historyEpoch,
    createBlock,
    scheduleEdit,
    flush,
    resolveKeepSaved,
    resolveUseMyVersion,
    retryResolution,
    deleteBlock,
    restoreBlock,
    refresh,
  };
}
