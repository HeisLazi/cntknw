import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { createPageLinkedBlock } from '@application/create-block';
import { expectedRevision } from '@data/repositories/concurrency';
import { RevisionConflictError } from '@data/errors';
import type {
  BlockContent,
  EntityId,
  JournalBlock,
  SourceLocation,
} from '@domain/index';
import {
  applyPendingEdit,
  type PendingJournalEdit,
} from '@features/journal/pendingEdit';
import {
  announceJournalProjectionChange,
  listenForJournalProjectionChanges,
} from './journalProjectionEvents';

const SAVE_DEBOUNCE_MS = 400;

export interface WhiteboardJournal {
  blocks: JournalBlock[] | null;
  failedWrites: ReadonlyMap<EntityId, string>;
  createBlock: (
    kind: 'drawing' | 'paragraph',
    content: BlockContent,
    location: SourceLocation,
  ) => Promise<JournalBlock>;
  scheduleEdit: (blockId: EntityId, edit: PendingJournalEdit) => void;
  flush: (blockId: EntityId) => Promise<void>;
  deleteBlock: (blockId: EntityId) => Promise<void>;
  restoreBlock: (blockId: EntityId) => Promise<JournalBlock>;
  refresh: () => Promise<void>;
}

/** Whiteboard access to the same guarded journal seams used by JournalPane. */
export function useWhiteboardJournal(
  sourceId: EntityId,
  journalId: EntityId,
  active: boolean,
): WhiteboardJournal {
  const repositories = useRepositories();
  const { journals } = repositories;
  const [blocks, setBlocks] = useState<JournalBlock[] | null>(null);
  const [failedWrites, setFailedWrites] = useState<Map<EntityId, string>>(new Map());
  const blocksRef = useRef<JournalBlock[]>([]);
  const deletedRef = useRef(new Map<EntityId, JournalBlock>());
  const revisions = useRef(new Map<EntityId, number>());
  const pending = useRef(new Map<EntityId, PendingJournalEdit>());
  const timers = useRef(new Map<EntityId, ReturnType<typeof setTimeout>>());
  const flushRef = useRef<(blockId: EntityId) => Promise<void>>(async () => undefined);

  const replaceBlocks = useCallback((next: JournalBlock[]) => {
    blocksRef.current = next;
    setBlocks(next);
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
    const withPending = found.map((block) => {
      const edit = pending.current.get(block.id);
      return edit ? { ...block, content: applyPendingEdit(block.content, edit) } : block;
    });
    replaceBlocks(withPending);
  }, [journalId, journals, replaceBlocks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  useEffect(() => listenForJournalProjectionChanges(journalId, () => {
    if (active) void refresh();
  }), [active, journalId, refresh]);

  const flush = useCallback(async (blockId: EntityId) => {
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
      if (cleared) pending.current.delete(blockId);
      const newer = pending.current.get(blockId);
      const visible = newer
        ? { ...saved, content: applyPendingEdit(saved.content, newer) }
        : saved;
      replaceBlocks(blocksRef.current.map((block) => block.id === blockId ? visible : block));
      setFailedWrites((currentFailures) => {
        if (!currentFailures.has(blockId)) return currentFailures;
        const next = new Map(currentFailures);
        next.delete(blockId);
        return next;
      });
      announceJournalProjectionChange({ journalId, blockId, source: 'whiteboard' });
      if (newer) void flushRef.current(blockId);
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        try {
          const remote = await journals.getBlockById(blockId);
          if (!remote) throw new Error('The current object could not be reloaded.');
          revisions.current.set(blockId, remote.revision);
          const cleared = pending.current.get(blockId) === edit;
          if (cleared) pending.current.delete(blockId);
          const newer = pending.current.get(blockId);
          const visible = newer
            ? { ...remote, content: applyPendingEdit(remote.content, newer) }
            : remote;
          replaceBlocks(blocksRef.current.map((block) => block.id === blockId ? visible : block));
          setFailedWrites((currentFailures) => {
            if (!currentFailures.has(blockId)) return currentFailures;
            const next = new Map(currentFailures);
            next.delete(blockId);
            return next;
          });
          return;
        } catch {
          setFailedWrites((currentFailures) => new Map(currentFailures).set(
            blockId,
            'This object changed in another window and could not be reloaded. Your changes are still visible.',
          ));
          return;
        }
      }
      setFailedWrites((currentFailures) => new Map(currentFailures).set(
        blockId,
        'Failed to save this object. Your changes are still visible.',
      ));
    }
  }, [journalId, journals, replaceBlocks]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleEdit = useCallback((blockId: EntityId, edit: PendingJournalEdit) => {
    const current = blocksRef.current.find((block) => block.id === blockId);
    if (!current) return;
    pending.current.set(blockId, edit);
    replaceBlocks(blocksRef.current.map((block) => block.id === blockId
      ? { ...block, content: applyPendingEdit(block.content, edit) }
      : block));
    const timer = timers.current.get(blockId);
    if (timer) clearTimeout(timer);
    timers.current.set(blockId, setTimeout(() => void flushRef.current(blockId), SAVE_DEBOUNCE_MS));
  }, [replaceBlocks]);

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

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    for (const blockId of pending.current.keys()) void flushRef.current(blockId);
  }, []);

  return {
    blocks,
    failedWrites,
    createBlock,
    scheduleEdit,
    flush,
    deleteBlock,
    restoreBlock,
    refresh,
  };
}
