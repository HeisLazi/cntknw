import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import { expectedRevision } from '@data/repositories/concurrency';
import { RevisionConflictError } from '@data/errors';
import type { WorkspaceState } from '@domain/index';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface WorkspacePersistence {
  /** The state to render from. Updates immediately; saves are debounced. */
  state: WorkspaceState;
  /** Merge a change and schedule a save. */
  update: (change: Partial<WorkspaceState>) => void;
  status: SaveStatus;
}

const DEBOUNCE_MS = 600;

/**
 * Persist workspace state as the user reads. AC-002, WS-001.
 *
 * **This is the path ADR-0003 exists for.** A reading position
 * changes on every scroll, so the write must be debounced; a
 * debounced write is separated from the read that produced its
 * revision by user time; and that gap is exactly the window in which
 * another tab can save first. ADR-0002 §4 would have let this call
 * omit its guard and silently overwrite the other tab's position.
 *
 * **On conflict the guard is not bypassed — the write is redone.**
 * The stored record is re-read, its revision adopted, and the local
 * position written again. That is a deliberate re-application after
 * seeing the newer value, not a blind overwrite, and it is the right
 * resolution *for this record specifically*: reading position belongs
 * to whichever window the person is actually reading in. Nothing else
 * in the codebase should copy this pattern without arguing for it,
 * which is why it is here rather than in the repository.
 */
export function useWorkspacePersistence(
  initial: WorkspaceState,
): WorkspacePersistence {
  const { workspaceStates } = useRepositories();
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');

  // The revision we believe is current. Held in a ref because the
  // save callback must read the latest value without being
  // re-created — and therefore re-debounced — on every change.
  const revision = useRef(initial.revision);
  const pending = useRef<WorkspaceState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setStatus('saving');

    try {
      const saved = await workspaceStates.update(
        next,
        expectedRevision(revision.current),
      );
      revision.current = saved.revision;
      setStatus('saved');
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        // Someone else wrote first. Adopt their revision and reapply
        // this window's position — see the note above on why that is
        // correct here and nowhere else by default.
        const current = await workspaceStates.getBySource(next.sourceId);
        if (current) {
          revision.current = current.revision;
          try {
            const saved = await workspaceStates.update(
              { ...next, revision: current.revision },
              expectedRevision(current.revision),
            );
            revision.current = saved.revision;
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

  const update = useCallback(
    (change: Partial<WorkspaceState>) => {
      setState((current) => {
        const next = { ...current, ...change };
        pending.current = next;
        return next;
      });

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [flush],
  );

  // Save on unmount and when the tab is hidden. Without this, closing
  // the tab within the debounce window loses the last position —
  // which is precisely the moment a reader stops reading, so it is
  // the most likely position to lose rather than the least.
  useEffect(() => {
    const saveNow = () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      saveNow();
    };
  }, [flush]);

  return { state, update, status };
}
