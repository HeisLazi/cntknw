import type {
  PomodoroDurations,
  PomodoroMode,
  PomodoroTimerState,
} from '@domain/index';

export const DEFAULT_POMODORO_DURATIONS: PomodoroDurations = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

export const DEFAULT_POMODORO_STATE: PomodoroTimerState = {
  mode: 'focus',
  status: 'idle',
  durations: DEFAULT_POMODORO_DURATIONS,
  remainingSeconds: 25 * 60,
  deadlineAt: null,
};

export type PomodoroAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'skip' }
  | { type: 'switch-mode'; mode: PomodoroMode }
  | { type: 'set-durations'; durations: PomodoroDurations }
  | { type: 'elapsed' };

export const POMODORO_MODE_LABELS: Readonly<Record<PomodoroMode, string>> = {
  focus: 'Focus',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
};

export function durationSeconds(
  mode: PomodoroMode,
  durations: PomodoroDurations,
): number {
  if (mode === 'focus') return durations.focus * 60;
  if (mode === 'short-break') return durations.shortBreak * 60;
  return durations.longBreak * 60;
}

export function remainingSecondsAt(
  state: PomodoroTimerState,
  nowMs: number,
): number {
  if (state.status !== 'running' || state.deadlineAt === null) {
    return state.remainingSeconds;
  }
  return Math.max(0, Math.ceil((state.deadlineAt - nowMs) / 1000));
}

function idleFor(
  mode: PomodoroMode,
  durations: PomodoroDurations,
): PomodoroTimerState {
  return {
    mode,
    status: 'idle',
    durations,
    remainingSeconds: durationSeconds(mode, durations),
    deadlineAt: null,
  };
}

function nextMode(mode: PomodoroMode): PomodoroMode {
  // Skip follows a deliberate focus ↔ short-break two-cycle. Long
  // Break remains an explicit mode choice because this local timer
  // does not persist a completed-focus counter from which a truthful
  // "every fourth focus" rotation could be derived.
  return mode === 'focus' ? 'short-break' : 'focus';
}

export function transitionPomodoro(
  state: PomodoroTimerState,
  action: PomodoroAction,
  nowMs: number,
): PomodoroTimerState {
  switch (action.type) {
    case 'start': {
      if (state.status === 'running' || state.status === 'paused') return state;
      const remainingSeconds = state.status === 'completed'
        ? durationSeconds(state.mode, state.durations)
        : state.remainingSeconds;
      return {
        ...state,
        status: 'running',
        remainingSeconds,
        deadlineAt: nowMs + remainingSeconds * 1000,
      };
    }
    case 'pause': {
      if (state.status !== 'running') return state;
      const remainingSeconds = remainingSecondsAt(state, nowMs);
      if (remainingSeconds === 0) {
        return { ...state, status: 'completed', remainingSeconds: 0, deadlineAt: null };
      }
      return { ...state, status: 'paused', remainingSeconds, deadlineAt: null };
    }
    case 'resume':
      if (state.status !== 'paused') return state;
      return {
        ...state,
        status: 'running',
        deadlineAt: nowMs + state.remainingSeconds * 1000,
      };
    case 'reset':
      return idleFor(state.mode, state.durations);
    case 'skip':
      return idleFor(nextMode(state.mode), state.durations);
    case 'switch-mode':
      return idleFor(action.mode, state.durations);
    case 'set-durations':
      return idleFor(state.mode, action.durations);
    case 'elapsed':
      if (state.status !== 'running' || remainingSecondsAt(state, nowMs) > 0) {
        return state;
      }
      return { ...state, status: 'completed', remainingSeconds: 0, deadlineAt: null };
  }
}

export function formatPomodoroTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
