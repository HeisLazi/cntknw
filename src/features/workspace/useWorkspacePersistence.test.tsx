/**
 * Guarded autosave.
 *
 * This is the path ADR-0003 was written for, so it is the path that
 * has to be tested rather than assumed: a debounced write whose read
 * and write are separated by user time, guarded on the revision it
 * actually saw.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import { RepositoryProvider } from '@app/providers/RepositoryProvider';
import { expectedRevision } from '@data/repositories/concurrency';
import type { WorkspaceState, SourceLocation } from '@domain/index';
import { useWorkspacePersistence } from './useWorkspacePersistence';

const SOURCE_ID = '9f3d1c2b-4a5e-4b6c-8d7e-1f2a3b4c5d6e';
const STATE_ID = '2b1c0d9e-8f7a-4b6c-9d5e-3f4a5b6c7d8e';

const at = (page: number): SourceLocation => ({
  sourceType: 'book',
  sourceId: SOURCE_ID,
  pdf: { page },
});

function makeState(page = 1): WorkspaceState {
  const now = new Date().toISOString();
  return {
    id: STATE_ID,
    sourceId: SOURCE_ID,
    activeLocation: at(page),
    furthestLocation: at(page),
    sourceView: {
      mode: 'continuous',
      zoom: 1,
      scrollOffset: 0,
      annotationTool: 'select',
    },
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

/** A probe that drives the hook the way the workspace does. */
function Probe({ initial }: { initial: WorkspaceState }) {
  const { state, drift, commit, status } = useWorkspacePersistence(initial);
  const page = state.activeLocation.pdf?.page ?? 1;
  return (
    <div>
      <span data-testid="page">{page}</span>
      <span data-testid="scroll">{state.sourceView.scrollOffset}</span>
      <span data-testid="status">{status}</span>
      {/* Discrete — written promptly. */}
      <button type="button" onClick={() => commit({ activeLocation: at(page + 1) })}>
        next page
      </button>
      {/* Continuous — debounced. */}
      <button
        type="button"
        onClick={() =>
          drift({
            sourceView: {
              ...state.sourceView,
              scrollOffset: state.sourceView.scrollOffset + 10,
            },
          })
        }
      >
        scroll
      </button>
      <button
        type="button"
        onClick={() =>
          commit({
            sourceView: {
              ...state.sourceView,
              zoom: 1.25,
            },
          })
        }
      >
        zoom
      </button>
    </div>
  );
}

let repositories: MemoryRepositories;

async function renderProbe(initial: WorkspaceState) {
  return render(
    <RepositoryProvider repositories={repositories}>
      <Probe initial={initial} />
    </RepositoryProvider>,
  );
}

describe('useWorkspacePersistence', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    repositories = createMemoryRepositories();
    await repositories.workspaceStates.create(makeState(1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the new position immediately, before the write lands', async () => {
    // A reader who turns a page must see the page turn now. Local
    // state leads; persistence follows.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderProbe(makeState(1));

    await user.click(screen.getByRole('button', { name: 'next page' }));
    expect(screen.getByTestId('page')).toHaveTextContent('2');
  });

  // ─── The defect this design exists to prevent ──────────────────

  it('writes a page turn promptly rather than debouncing it', async () => {
    // THE REGRESSION TEST. Debouncing a page turn meant that closing
    // the tab within the debounce window lost it entirely — measured
    // in a real browser, a reload 400ms after a page turn reopened
    // the source at page 1, not at the page just turned to.
    //
    // A page turn is discrete and deliberate. Only continuous change
    // — scrolling — is worth debouncing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderProbe(makeState(1));

    await user.click(screen.getByRole('button', { name: 'next page' }));

    // No timer advanced. The write is already on its way.
    await waitFor(async () => {
      const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
      expect(stored?.activeLocation.pdf?.page).toBe(2);
    });
  });

  it('debounces continuous scrolling into a single write', async () => {
    // Scrolling produces dozens of events per second. One write each
    // would be a write storm against IndexedDB for no benefit — which
    // is why `drift` exists alongside `commit` rather than instead
    // of it.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const spy = vi.spyOn(repositories.workspaceStates, 'update');
    await renderProbe(makeState(1));

    const scroll = screen.getByRole('button', { name: 'scroll' });
    for (let i = 0; i < 5; i += 1) await user.click(scroll);

    // Nothing written yet.
    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
    expect(stored?.sourceView.scrollOffset).toBe(50);
  });

  it('serialises writes so a burst cannot conflict with itself', async () => {
    // Two overlapping writes would each read the same revision, so
    // the second would conflict with the first — a self-inflicted
    // conflict the recovery path would then have to clean up.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderProbe(makeState(1));

    const button = screen.getByRole('button', { name: 'next page' });
    for (let i = 0; i < 4; i += 1) await user.click(button);

    await waitFor(async () => {
      const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
      expect(stored?.activeLocation.pdf?.page).toBe(5);
    });

    const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
    // Four writes, four revisions — none lost, none doubled by a
    // conflict-and-retry.
    expect(stored?.revision).toBe(4);
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
  });

  it('guards the write on the revision it actually read', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const spy = vi.spyOn(repositories.workspaceStates, 'update');
    await renderProbe(makeState(1));

    await user.click(screen.getByRole('button', { name: 'next page' }));
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0]?.[1]).toEqual(expectedRevision(0));
  });

  it('advances the expected revision after a successful write', async () => {
    // Reusing revision 0 for the second save would make every write
    // after the first conflict with itself.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const spy = vi.spyOn(repositories.workspaceStates, 'update');
    await renderProbe(makeState(1));

    const button = screen.getByRole('button', { name: 'next page' });

    await user.click(button);
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    await user.click(button);
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

    expect(spy.mock.calls[1]?.[1]).toEqual(expectedRevision(1));
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
  });

  it('recovers from a conflict by re-reading and reapplying, never by bypassing the guard', async () => {
    // Another window saved first. The reading position belongs to the
    // window being read in, so this one wins — but only after seeing
    // the newer revision. `unconditionally` is never used here.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderProbe(makeState(1));

    // A second writer moves the stored record on.
    const current = await repositories.workspaceStates.getBySource(SOURCE_ID);
    await repositories.workspaceStates.update(
      { ...current!, activeLocation: at(99) },
      expectedRevision(current!.revision),
    );

    const spy = vi.spyOn(repositories.workspaceStates, 'update');
    await user.click(screen.getByRole('button', { name: 'next page' }));
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('saved'),
    );

    const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
    expect(stored?.activeLocation.pdf?.page).toBe(2);
    // Revision 1 (the other writer) then 2 (this one) — the counter
    // was never reset and no write was unconditional.
    expect(stored?.revision).toBe(2);
    for (const call of spy.mock.calls) {
      expect(call[1]).toMatchObject({ mode: 'expected' });
    }
  });

  it('deep merges nested objects during conflict recovery', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderProbe(makeState(1));

    // A second writer moves the stored record on, changing ONLY scrollOffset
    const current = await repositories.workspaceStates.getBySource(SOURCE_ID);
    await repositories.workspaceStates.update(
      { ...current!, sourceView: { ...current!.sourceView, scrollOffset: 500 } },
      expectedRevision(current!.revision),
    );

    // This tab (which only knows about scrollOffset: 0) changes zoom to 1.25
    // It passes the stale scrollOffset back in the object because UI components
    // typically spread the previous state.
    await user.click(screen.getByRole('button', { name: 'zoom' }));
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('saved'),
    );

    const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
    
    // The remote scroll offset must survive, and our local zoom must be applied!
    expect(stored?.sourceView.zoom).toBe(1.25);
    expect(stored?.sourceView.scrollOffset).toBe(500); 
  });

  it('accumulates pendingChanges correctly as an autosave queue during an in-flight conflict (Finding 9)', async () => {
    // 1. Initial State
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderProbe(makeState(1));
    
    const zoomButton = screen.getByRole('button', { name: 'zoom' });
    const scrollButton = screen.getByRole('button', { name: 'scroll' });

    // 2. We mock update so that it blocks (in-flight save) until we let it finish.
    let releaseSave: () => void;
    const saveBlocker = new Promise<void>(resolve => {
      releaseSave = resolve;
    });

    const originalUpdate = repositories.workspaceStates.update.bind(repositories.workspaceStates);
    let saveAttempt = 0;
    
    vi.spyOn(repositories.workspaceStates, 'update').mockImplementation(async (state: unknown, revision: unknown) => {
      saveAttempt++;
      if (saveAttempt === 1) {
        // First save is the one we block!
        await saveBlocker;
        
        // But BEFORE we let it succeed, we simulate a remote independent change landing in the DB
        // which forces THIS save to fail with a conflict.
        const current = await repositories.workspaceStates.getBySource(SOURCE_ID);
        await originalUpdate(
          { ...current!, activeLocation: at(99) },
          expectedRevision(current!.revision)
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalUpdate(state as WorkspaceState, revision as any);
    });

    // 3. User makes a change (zoom -> 1.1) and we advance time to trigger the save.
    await user.click(zoomButton); // 1.0 + 0.1 = 1.1
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    // Now save is in flight (blocked on saveBlocker).

    // 4. While the save is in flight, the user continues interacting locally!
    await user.click(zoomButton); // 1.1 + 0.1 = 1.2
    
    // They click scroll 40 times to get to 400 (starts at 0, +10 each time)
    // Wait, let's just click it a few times to get some offset.
    for (let i = 0; i < 4; i++) {
      await user.click(scrollButton); // 0 + 40 = 40
    }
    
    // 5. Release the save! It will fail (because we sneaked in activeLocation: 99),
    // and the useWorkspacePersistence hook should catch the conflict, re-read the DB,
    // and reapply the ACCUMULATED diff (which now contains zoom=1.2 and scrollOffset=40).
    await act(async () => {
      releaseSave!();
      // Need to flush microtasks and timers for the retry logic to run
      await vi.runAllTimersAsync(); 
    });

    // 6. Verify final state in DB!
    const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
    
    // Zoom must be 1.25 (as set by the button)
    expect(stored?.sourceView.zoom).toBe(1.25);
    // Scroll must be 40
    expect(stored?.sourceView.scrollOffset).toBe(40);
    // Remote change must survive
    expect(stored?.activeLocation.pdf?.page).toBe(99);
  });


  it('reports an unrecoverable failure rather than pretending it saved', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    repositories.workspaceStates.update = async () => {
      throw new Error('storage is unavailable');
    };
    await renderProbe(makeState(1));

    await user.click(screen.getByRole('button', { name: 'next page' }));
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('error'),
    );
  });

  it('flushes a pending scroll on unmount', async () => {
    // Closing the tab inside the debounce window is exactly when a
    // reader stops reading — the most valuable position to keep, and
    // the one a naive debounce always loses.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = await renderProbe(makeState(1));

    await user.click(screen.getByRole('button', { name: 'scroll' }));
    unmount();

    await waitFor(async () => {
      const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
      expect(stored?.sourceView.scrollOffset).toBe(10);
    });
  });

  it('flushes a pending scroll when the page is hidden', async () => {
    // `pagehide` fires on a reload, which `visibilitychange` does not
    // reliably do — and a reload is exactly how the original defect
    // was found.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderProbe(makeState(1));

    await user.click(screen.getByRole('button', { name: 'scroll' }));
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    await waitFor(async () => {
      const stored = await repositories.workspaceStates.getBySource(SOURCE_ID);
      expect(stored?.sourceView.scrollOffset).toBe(10);
    });
  });
});
