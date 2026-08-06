import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryProvider } from '@app/providers/RepositoryProvider';
import { createMemoryRepositories } from '@data/adapters/memory';
import type { MemoryRepositories } from '@data/adapters/memory';
import { PomodoroProvider, usePomodoro } from './PomodoroProvider';

function Probe() {
  const timer = usePomodoro();
  return (
    <div>
      <span data-testid="ready">{String(timer.ready)}</span>
      <span data-testid="mode">{timer.state.mode}</span>
      <span data-testid="status">{timer.state.status}</span>
      <span data-testid="remaining">{timer.remainingSeconds}</span>
      <button type="button" onClick={() => timer.send({ type: 'start' })}>Start</button>
      <button type="button" onClick={() => timer.send({ type: 'pause' })}>Pause</button>
      <button type="button" onClick={() => timer.send({ type: 'resume' })}>Resume</button>
      <button type="button" onClick={() => timer.send({ type: 'reset' })}>Reset</button>
      <button type="button" onClick={() => timer.send({ type: 'skip' })}>Skip</button>
      <button
        type="button"
        onClick={() => timer.send({
          type: 'set-durations',
          durations: { focus: 1, shortBreak: 1, longBreak: 1 },
        })}
      >
        One minute
      </button>
    </div>
  );
}

function mount(repositories: MemoryRepositories) {
  return render(
    <RepositoryProvider repositories={repositories}>
      <PomodoroProvider><Probe /></PomodoroProvider>
    </RepositoryProvider>,
  );
}

describe('PomodoroProvider persistence', () => {
  let repositories: MemoryRepositories;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-06T10:00:00.000Z'));
    repositories = createMemoryRepositories();
  });

  afterEach(() => vi.useRealTimers());

  it('persists transitions but never writes for visible second ticks', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const create = vi.spyOn(repositories.pomodoro, 'create');
    const update = vi.spyOn(repositories.pomodoro, 'update');
    mount(repositories);
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));

    await act(async () => { vi.advanceTimersByTime(3_100); });
    expect(Number(screen.getByTestId('remaining').textContent)).toBeLessThan(1500);
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(3));
  });

  it('restores a running deadline after remount instead of resetting it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const first = mount(repositories);
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(async () => expect(await repositories.pomodoro.get()).not.toBeNull());

    await act(async () => { vi.advanceTimersByTime(4_100); });
    first.unmount();
    mount(repositories);

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));
    expect(screen.getByTestId('status')).toHaveTextContent('running');
    expect(Number(screen.getByTestId('remaining').textContent)).toBeLessThan(1500);
  });

  it('persists the current snapshot on pagehide', async () => {
    const create = vi.spyOn(repositories.pomodoro, 'create');
    mount(repositories);
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));

    // The `pagehide` listener mounts in an effect that depends on `ready`;
    // force the passively scheduled effect to commit before firing the
    // event, or a starved parallel worker can run the event first and miss it.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      fireEvent(window, new Event('pagehide'));
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect((await repositories.pomodoro.get())?.status).toBe('idle');
  });

  it('announces completion and leaves the next phase stopped', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount(repositories);
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));
    await user.click(screen.getByRole('button', { name: 'One minute' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    await act(async () => { vi.advanceTimersByTime(60_100); });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('completed'));
    expect(screen.getByRole('status')).toHaveTextContent('Focus session complete');
    expect(screen.getByTestId('mode')).toHaveTextContent('focus');
  });
});
