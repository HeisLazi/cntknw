import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { expectedRevision } from '@data/repositories/concurrency';
import { RevisionConflictError } from '@data/errors';
import type { WorkspaceState } from '@domain/index';
import { clearPosition, stashPosition } from './positionBuffer';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Computes a deep difference representing only the scalar leaves that changed.
 * This ensures that nested objects like `sourceView` do not overwrite each other
 * entirely when two tabs make independent changes to different properties.
 */
function computeDiff(original: any, updated: any): any {
  if (original === updated) return undefined;
  if (original == null || updated == null) return updated;
  if (typeof original !== 'object' || typeof updated !== 'object') return updated;
  if (Array.isArray(original) || Array.isArray(updated)) return updated;

  const diff: any = {};
  let hasChanges = false;
  for (const key of Object.keys(updated)) {
    const valDiff = computeDiff(original[key], updated[key]);
    if (valDiff !== undefined) {
      diff[key] = valDiff;
      hasChanges = true;
    }
  }
  return hasChanges ? diff : undefined;
}

/**
 * Deeply applies a diff (computed by computeDiff) onto a target object.
 */
function applyDiff(target: any, diff: any): any {
  if (diff === undefined) return target;
  if (diff === null) return null;
  if (typeof target !== 'object' || target == null || Array.isArray(target) || typeof diff !== 'object') {
    return diff;
  }
  const result = { ...target };
  for (const key of Object.keys(diff)) {
    result[key] = applyDiff(target[key], diff[key]);
  }
  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface WorkspacePersistence {
  /** The state to render from. Updates immediately; writes follow. */
  state: WorkspaceState;
  /**
   * A **continuous** change — scrolling, dragging a divider.
   * Debounced, because these arrive dozens per second and one write
   * each would be a write storm for no benefit.
   */
  drift: (change: Partial<WorkspaceState>) => void;
  /**
   * A **discrete, deliberate** change — a page turn, a zoom step,
   * changing layout mode. Written promptly.
   *
   * Debouncing these was a real defect, not a tuning mistake: turn a
   * page and close the tab inside the debounce window and the
   * position was never written at all. Measured before the fix, a
   * reload within 600ms of a page turn reopened the source at page 1.
   * A reader who turns a page and immediately puts the laptop down is
   * not doing anything unusual — they are doing the single most
   * common thing there is.
   */
  commit: (change: Partial<WorkspaceState>) => void;
  status: SaveStatus;
}

const DRIFT_DEBOUNCE_MS = 600;

/**
 * Persist workspace state as the user reads. AC-002, WS-001.
 *
 * **This is the path ADR-0003 exists for.** A reading position
 * changes as the user reads, so writes are separated from the read
 * that produced their revision by user time, and that gap is exactly
 * the window in which another tab can save first. ADR-0002 §4 would
 * have let these calls omit their guard and silently overwrite.
 *
 * **On conflict the guard is not bypassed — the write is redone.**
 * The stored record is re-read, its revision adopted, and the local
 * position written again. That is a deliberate re-application after
 * seeing the newer value, not a blind overwrite, and it is right
 * *for this record specifically*: reading position belongs to
 * whichever window the person is actually reading in. The journal
 * takes the opposite choice for the opposite reason (ADR-0004 §6).
 */
export function useWorkspacePersistence(
  initial: WorkspaceState,
): WorkspacePersistence {
  const { workspaceStates } = useRepositories();
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');

  // The revision we believe is current, and the newest value not yet
  // written. Both are refs because the write path must read the
  // latest values without being re-created — and therefore
  // re-debounced — on every render.
  const revision = useRef(initial.revision);
  const latest = useRef(initial);
  const pendingChanges = useRef<Partial<WorkspaceState>>({});
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Writes are chained rather than fired in parallel. Two overlapping
  // writes would each read the same `revision.current`, so the second
  // would conflict with the first — a self-inflicted conflict that
  // the recovery path would then have to clean up. Serialising costs
  // nothing at this rate and removes the case entirely.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const writeNow = useCallback(async (): Promise<void> => {
    if (!dirty.current) return;
    const toSave = latest.current;
    const diff = pendingChanges.current;
    dirty.current = false;
    pendingChanges.current = {};
    setStatus('saving');

    try {
      const saved = await workspaceStates.update(
        toSave,
        expectedRevision(revision.current),
      );
      revision.current = saved.revision;
      // Durably stored — the crash buffer no longer needs it.
      clearPosition(toSave.sourceId);
      setStatus('saved');
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        const current = await workspaceStates.getBySource(toSave.sourceId);
        if (current) {
          // Re-apply our specific deep diff over the newly fetched remote state
          const merged = applyDiff(current, diff);
          revision.current = current.revision;
          try {
            const saved = await workspaceStates.update(
              merged,
              expectedRevision(current.revision),
            );
            revision.current = saved.revision;
            
            // Bring latest.current and UI state into sync with the merged remote state,
            // while preserving any NEW pending changes that accumulated during the await!
            latest.current = applyDiff(merged, pendingChanges.current);
            setState(latest.current);
            
            clearPosition(toSave.sourceId);
            setStatus('saved');
            return;
          } catch {
            // Two conflicts in a row means something is writing
            // continuously. Stop rather than spin.
            setStatus('error');
            return;
          }
        }
      }
      setStatus('error');
    }
  }, [workspaceStates]);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    queue.current = queue.current.then(writeNow, writeNow);
    return queue.current;
  }, [writeNow]);

  const apply = useCallback((change: Partial<WorkspaceState>) => {
    // Instead of completely overwriting top-level objects, compute ONLY what changed
    // compared to the latest known state, and accumulate that deep diff.
    const diff = computeDiff(latest.current, change) || {};
    pendingChanges.current = applyDiff(pendingChanges.current, diff);
    
    const next = applyDiff(latest.current, diff);
    latest.current = next;
    dirty.current = true;
    // Synchronous, before anything asynchronous is attempted. Even a
    // prompt IndexedDB write is async, and a reload in the same tick
    // can outrun it — measured at 0ms (ADR-0005).
    stashPosition(
      next.sourceId,
      next.activeLocation.pdf?.page ?? 1,
      next.sourceView.zoom,
    );
    setState(next);
  }, []);

  const drift = useCallback(
    (change: Partial<WorkspaceState>) => {
      apply(change);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DRIFT_DEBOUNCE_MS);
    },
    [apply, flush],
  );

  const commit = useCallback(
    (change: Partial<WorkspaceState>) => {
      apply(change);
      void flush();
    },
    [apply, flush],
  );

  /**
   * Write anything outstanding before the page goes away.
   *
   * `pagehide` rather than `visibilitychange` alone: a reload does
   * not reliably fire a visibility change, and a reload is precisely
   * how the original defect was found. Both are listened for —
   * `visibilitychange` catches a tab being backgrounded on mobile,
   * where `pagehide` may not fire until the app is killed.
   *
   * An IndexedDB write started during `pagehide` is not *guaranteed*
   * to complete; browsers may discard the page first. It is a safety
   * net under the real fix, which is that discrete changes are not
   * debounced in the first place, so by the time `pagehide` runs
   * there is usually nothing outstanding but a scroll offset.
   */
  useEffect(() => {
    const onPageHide = () => void flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      void flush();
    };
  }, [flush]);

  return { state, drift, commit, status };
}
