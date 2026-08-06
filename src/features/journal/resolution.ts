import { Repositories } from '@data/repositories';
import type { EntityId, JournalBlock } from '@domain/index';
import { applyPendingEdit, type PendingJournalEdit } from './pendingEdit';
import { expectedRevision } from '@data/repositories/concurrency';

export async function resolveConflictKeepSaved(
  blockId: EntityId,
  repositories: Repositories,
  clearDraft: (id: EntityId) => void,
  pending: Map<EntityId, PendingJournalEdit>,
  timers: Map<EntityId, NodeJS.Timeout>,
  revisions: Map<EntityId, number>,
  setBlocks: (updater: (current: JournalBlock[] | null) => JournalBlock[] | null) => void,
  setConflictData: (updater: (current: Map<EntityId, { remoteText: string; localText: string }>) => Map<EntityId, { remoteText: string; localText: string }>) => void,
  setResetKeys: (updater: (current: Map<EntityId, number>) => Map<EntityId, number>) => void,
  setResolutionErrors: (updater: (current: Set<EntityId>) => Set<EntityId>) => void
): Promise<void> {
  setResolutionErrors((curr) => { const n = new Set(curr); n.delete(blockId); return n; });
  try {
    const remote = await repositories.journals.getBlockById(blockId);
    if (remote) {
      setBlocks((current) => (current || []).map((b) => (b.id === blockId ? remote : b)));
      revisions.set(blockId, remote.revision);

      clearDraft(blockId);
      pending.delete(blockId);
      const existingTimer = timers.get(blockId);
      if (existingTimer) clearTimeout(existingTimer);
      timers.delete(blockId);

      setConflictData((curr) => { const n = new Map(curr); n.delete(blockId); return n; });
      setResetKeys((curr) => new Map(curr).set(blockId, (curr.get(blockId) || 0) + 1));
    } else {
      throw new Error("Remote block missing");
    }
  } catch (err) {
    console.error("Keep saved failed", err);
    setResolutionErrors((curr) => { const n = new Set(curr); n.add(blockId); return n; });
  }
}

export async function resolveConflictUseMyVersion(
  blockId: EntityId,
  repositories: Repositories,
  clearDraft: (id: EntityId) => void,
  pending: Map<EntityId, PendingJournalEdit>,
  timers: Map<EntityId, NodeJS.Timeout>,
  revisions: Map<EntityId, number>,
  setBlocks: (updater: (current: JournalBlock[] | null) => JournalBlock[] | null) => void,
  setConflictData: (updater: (current: Map<EntityId, { remoteText: string; localText: string }>) => Map<EntityId, { remoteText: string; localText: string }>) => void,
  setResetKeys: (updater: (current: Map<EntityId, number>) => Map<EntityId, number>) => void,
  setResolutionErrors: (updater: (current: Set<EntityId>) => Set<EntityId>) => void
): Promise<void> {
  setResolutionErrors((curr) => { const n = new Set(curr); n.delete(blockId); return n; });
  try {
    const remote = await repositories.journals.getBlockById(blockId);
    if (remote) {
      const edit = pending.get(blockId);
      if (edit) {
        const newContent = applyPendingEdit(remote.content, edit);
        const saved = await repositories.journals.updateBlock(
          { id: blockId, content: newContent },
          expectedRevision(remote.revision)
        );
        revisions.set(blockId, saved.revision);
        setBlocks((current) => (current || []).map((b) => (b.id === blockId ? saved : b)));

        pending.delete(blockId);
        clearDraft(blockId);
        const existingTimer = timers.get(blockId);
        if (existingTimer) clearTimeout(existingTimer);
        timers.delete(blockId);

        setConflictData((curr) => { const n = new Map(curr); n.delete(blockId); return n; });
        setResetKeys((curr) => new Map(curr).set(blockId, (curr.get(blockId) || 0) + 1));
      } else {
        throw new Error("No pending edit");
      }
    } else {
      throw new Error("Remote block missing");
    }
  } catch (err) {
    console.error("Use my version failed", err);
    setResolutionErrors((curr) => { const n = new Set(curr); n.add(blockId); return n; });
  }
}
