import type { FormEvent } from 'react';
import type { PomodoroMode } from '@domain/index';
import { usePomodoro } from './PomodoroProvider';
import {
  POMODORO_MODE_LABELS,
  formatPomodoroTime,
} from './pomodoroState';
import './pomodoro.css';

const MODES: readonly PomodoroMode[] = ['focus', 'short-break', 'long-break'];

function statusCopy(mode: PomodoroMode, status: string): string {
  if (status === 'running') {
    return mode === 'focus' ? 'You have been focusing.' : 'Your break is underway.';
  }
  if (status === 'paused') return 'Paused. Your time will wait.';
  if (status === 'completed') return `${POMODORO_MODE_LABELS[mode]} session complete.`;
  return 'Ready when you are.';
}

function statusLabel(status: string): string {
  if (status === 'running') return 'running';
  if (status === 'paused') return 'paused';
  if (status === 'completed') return 'complete';
  return 'ready';
}

export function PomodoroTimer({ placement }: { placement: 'nav' | 'chrome' }) {
  const { state, remainingSeconds, ready, saveStatus, send } = usePomodoro();
  const time = formatPomodoroTime(remainingSeconds);

  const submitDurations = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    send({
      type: 'set-durations',
      durations: {
        focus: Number(values.get('focus')),
        shortBreak: Number(values.get('shortBreak')),
        longBreak: Number(values.get('longBreak')),
      },
    });
  };

  return (
    <details className={`cn-pomodoro cn-pomodoro--${placement}`}>
      <summary
        className="cn-pomodoro__summary"
        aria-label={`${POMODORO_MODE_LABELS[state.mode]} timer, ${time}, ${statusLabel(state.status)}`}
      >
        <span className="cn-pomodoro__summary-mode">{POMODORO_MODE_LABELS[state.mode]}</span>
        <time className="cn-pomodoro__summary-time">{time}</time>
      </summary>

      <section className="cn-pomodoro__panel" aria-label="Focus timer controls">
        <div className="cn-pomodoro__modes" role="group" aria-label="Timer mode">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={state.mode === mode}
              disabled={!ready}
              onClick={() => send({ type: 'switch-mode', mode })}
            >
              {POMODORO_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        <div className="cn-pomodoro__readout">
          <span className="cn-pomodoro__phase">{POMODORO_MODE_LABELS[state.mode]}</span>
          <time className="cn-pomodoro__time" aria-label={`${time} remaining`}>
            {ready ? time : '--:--'}
          </time>
          <p className="cn-pomodoro__message">{statusCopy(state.mode, state.status)}</p>
        </div>

        <div className="cn-pomodoro__actions" role="group" aria-label="Timer actions">
          {state.status === 'running' ? (
            <button type="button" disabled={!ready} onClick={() => send({ type: 'pause' })}>
              Pause
            </button>
          ) : state.status === 'paused' ? (
            <button type="button" disabled={!ready} onClick={() => send({ type: 'resume' })}>
              Resume
            </button>
          ) : (
            <button type="button" disabled={!ready} onClick={() => send({ type: 'start' })}>
              Start
            </button>
          )}
          <button type="button" disabled={!ready} onClick={() => send({ type: 'reset' })}>
            Reset
          </button>
          <button type="button" disabled={!ready} onClick={() => send({ type: 'skip' })}>
            Skip
          </button>
        </div>

        <details className="cn-pomodoro__custom">
          <summary>Custom durations</summary>
          <form
            key={`${state.durations.focus}-${state.durations.shortBreak}-${state.durations.longBreak}`}
            onSubmit={submitDurations}
          >
            <label>
              <span>Focus minutes</span>
              <input
                type="number"
                name="focus"
                min="1"
                max="180"
                required
                defaultValue={state.durations.focus}
              />
            </label>
            <label>
              <span>Short break minutes</span>
              <input
                type="number"
                name="shortBreak"
                min="1"
                max="60"
                required
                defaultValue={state.durations.shortBreak}
              />
            </label>
            <label>
              <span>Long break minutes</span>
              <input
                type="number"
                name="longBreak"
                min="1"
                max="120"
                required
                defaultValue={state.durations.longBreak}
              />
            </label>
            <button type="submit" disabled={!ready}>Save durations</button>
          </form>
        </details>

        {saveStatus === 'error' ? (
          <p className="cn-pomodoro__save-error" role="status">
            Timer changes are active here but could not be saved.
          </p>
        ) : null}
      </section>
    </details>
  );
}
