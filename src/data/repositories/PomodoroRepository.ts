import type {
  PomodoroTimerRecord,
  PomodoroTimerState,
} from '@domain/index';
import type { ConcurrencyGuard } from './concurrency';

/** One device-local timer, shared by every route in this CNTKNW database. */
export interface PomodoroRepository {
  get(): Promise<PomodoroTimerRecord | null>;
  create(state: PomodoroTimerState): Promise<PomodoroTimerRecord>;
  update(
    state: PomodoroTimerState,
    guard: ConcurrencyGuard,
  ): Promise<PomodoroTimerRecord>;
}
