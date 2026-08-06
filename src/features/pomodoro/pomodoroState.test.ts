import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POMODORO_STATE,
  remainingSecondsAt,
  transitionPomodoro,
} from './pomodoroState';

const NOW = 1_000_000;

describe('Pomodoro state machine', () => {
  it('starts, pauses with wall-clock truth, and resumes from the pause', () => {
    const running = transitionPomodoro(DEFAULT_POMODORO_STATE, { type: 'start' }, NOW);
    expect(running).toMatchObject({ status: 'running', remainingSeconds: 1500 });
    expect(running.deadlineAt).toBe(NOW + 1_500_000);
    expect(remainingSecondsAt(running, NOW + 2_400)).toBe(1498);

    const paused = transitionPomodoro(running, { type: 'pause' }, NOW + 2_400);
    expect(paused).toMatchObject({ status: 'paused', remainingSeconds: 1498 });
    expect(paused.deadlineAt).toBeNull();

    const resumed = transitionPomodoro(paused, { type: 'resume' }, NOW + 10_000);
    expect(resumed.status).toBe('running');
    expect(resumed.deadlineAt).toBe(NOW + 10_000 + 1_498_000);
  });

  it('resets the current mode and skips to the next unstarted phase', () => {
    const running = transitionPomodoro(DEFAULT_POMODORO_STATE, { type: 'start' }, NOW);
    const reset = transitionPomodoro(running, { type: 'reset' }, NOW + 1_000);
    expect(reset).toEqual(DEFAULT_POMODORO_STATE);

    const shortBreak = transitionPomodoro(reset, { type: 'skip' }, NOW);
    expect(shortBreak).toMatchObject({
      mode: 'short-break',
      status: 'idle',
      remainingSeconds: 300,
      deadlineAt: null,
    });
    const focus = transitionPomodoro(shortBreak, { type: 'skip' }, NOW);
    expect(focus.mode).toBe('focus');
    const secondShortBreak = transitionPomodoro(focus, { type: 'skip' }, NOW);
    expect(secondShortBreak.mode).toBe('short-break');
    expect(secondShortBreak.mode).not.toBe('long-break');
  });

  it('switches all three modes and applies custom durations without starting', () => {
    const longBreak = transitionPomodoro(
      DEFAULT_POMODORO_STATE,
      { type: 'switch-mode', mode: 'long-break' },
      NOW,
    );
    expect(longBreak.remainingSeconds).toBe(900);

    const custom = transitionPomodoro(longBreak, {
      type: 'set-durations',
      durations: { focus: 40, shortBreak: 7, longBreak: 20 },
    }, NOW);
    expect(custom).toMatchObject({
      mode: 'long-break',
      status: 'idle',
      remainingSeconds: 1200,
    });
  });

  it('stops at elapsed completion and never auto-starts another phase', () => {
    const running = transitionPomodoro(DEFAULT_POMODORO_STATE, { type: 'start' }, NOW);
    expect(transitionPomodoro(running, { type: 'elapsed' }, NOW + 10_000))
      .toBe(running);

    const complete = transitionPomodoro(
      running,
      { type: 'elapsed' },
      running.deadlineAt!,
    );
    expect(complete).toMatchObject({
      mode: 'focus',
      status: 'completed',
      remainingSeconds: 0,
      deadlineAt: null,
    });
  });
});
