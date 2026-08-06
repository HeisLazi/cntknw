import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useRepositories } from '@app/providers/RepositoryProvider';
import type { PomodoroTimerRecord, PomodoroTimerState } from '@domain/index';
import { expectedRevision } from '@data/repositories/concurrency';
import { RecordAlreadyExistsError, RevisionConflictError } from '@data/errors';
import {
  DEFAULT_POMODORO_STATE,
  POMODORO_MODE_LABELS,
  remainingSecondsAt,
  transitionPomodoro,
} from './pomodoroState';
import type { PomodoroAction } from './pomodoroState';

type TimerSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PomodoroContextValue {
  state: PomodoroTimerState;
  remainingSeconds: number;
  ready: boolean;
  saveStatus: TimerSaveStatus;
  send: (action: PomodoroAction) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

function stateOf(record: PomodoroTimerRecord): PomodoroTimerState {
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    revision: _revision,
    ...state
  } = record;
  return state;
}

export function PomodoroProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  /** Optional already-hydrated state for isolated component compositions. */
  initialState?: PomodoroTimerState;
}) {
  const { pomodoro } = useRepositories();
  const [state, setState] = useState<PomodoroTimerState>(
    initialState ?? DEFAULT_POMODORO_STATE,
  );
  const [ready, setReady] = useState(initialState !== undefined);
  const [saveStatus, setSaveStatus] = useState<TimerSaveStatus>('idle');
  const [displayRemaining, setDisplayRemaining] = useState(
    initialState?.remainingSeconds ?? DEFAULT_POMODORO_STATE.remainingSeconds,
  );
  const [announcement, setAnnouncement] = useState('');
  const stateRef = useRef(state);
  const recordRevision = useRef<number | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const applySavedRecord = useCallback((record: PomodoroTimerRecord) => {
    recordRevision.current = record.revision;
    if (mounted.current) setSaveStatus('saved');
  }, []);

  const writeSnapshot = useCallback(async (
    snapshot: PomodoroTimerState,
    reapplyOnConflict: boolean,
  ) => {
    if (mounted.current) setSaveStatus('saving');
    try {
      if (recordRevision.current === null) {
        try {
          applySavedRecord(await pomodoro.create(snapshot));
          return;
        } catch (error) {
          if (!(error instanceof RecordAlreadyExistsError)) throw error;
          const current = await pomodoro.get();
          if (!current) throw error;
          recordRevision.current = current.revision;
        }
      }

      applySavedRecord(await pomodoro.update(
        snapshot,
        expectedRevision(recordRevision.current),
      ));
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        const current = await pomodoro.get();
        if (current) {
          recordRevision.current = current.revision;
          if (reapplyOnConflict) {
            try {
              applySavedRecord(await pomodoro.update(
                snapshot,
                expectedRevision(current.revision),
              ));
              return;
            } catch {
              // A second conflict is continuous contention. Stop here.
            }
          }
        }
      }
      if (mounted.current) setSaveStatus('error');
    }
  }, [applySavedRecord, pomodoro]);

  const persist = useCallback((
    snapshot: PomodoroTimerState,
    reapplyOnConflict = true,
  ) => {
    writeQueue.current = writeQueue.current.then(
      () => writeSnapshot(snapshot, reapplyOnConflict),
      () => writeSnapshot(snapshot, reapplyOnConflict),
    );
    return writeQueue.current;
  }, [writeSnapshot]);

  useEffect(() => {
    if (initialState) return;
    let cancelled = false;
    void pomodoro.get().then((record) => {
      if (cancelled) return;
      recordRevision.current = record?.revision ?? null;
      const restored = record ? stateOf(record) : DEFAULT_POMODORO_STATE;
      const next = transitionPomodoro(restored, { type: 'elapsed' }, Date.now());
      stateRef.current = next;
      setState(next);
      setDisplayRemaining(remainingSecondsAt(next, Date.now()));
      setReady(true);
      if (next.status === 'completed' && restored.status === 'running') {
        setAnnouncement(`${POMODORO_MODE_LABELS[next.mode]} session complete`);
        void persist(next);
      }
    }).catch(() => {
      if (cancelled) return;
      setReady(true);
      setSaveStatus('error');
    });
    return () => { cancelled = true; };
  }, [initialState, persist, pomodoro]);

  const send = useCallback((action: PomodoroAction) => {
    if (!ready) return;
    const previous = stateRef.current;
    const next = transitionPomodoro(previous, action, Date.now());
    if (next === previous) return;
    stateRef.current = next;
    setState(next);
    setDisplayRemaining(remainingSecondsAt(next, Date.now()));
    if (next.status === 'completed' && previous.status !== 'completed') {
      setAnnouncement(`${POMODORO_MODE_LABELS[next.mode]} session complete`);
    } else if (action.type !== 'elapsed') {
      setAnnouncement('');
    }
    void persist(next);
  }, [persist, ready]);

  useEffect(() => {
    if (!ready || state.status !== 'running' || state.deadlineAt === null) return;
    const now = Date.now();
    const remaining = remainingSecondsAt(state, now);
    if (remaining === 0) {
      send({ type: 'elapsed' });
      return;
    }
    const remainingMilliseconds = state.deadlineAt - now;
    const untilVisibleChange = remainingMilliseconds - (remaining - 1) * 1000;
    const timer = window.setTimeout(() => {
      if (remainingSecondsAt(stateRef.current, Date.now()) === 0) {
        send({ type: 'elapsed' });
      } else {
        setDisplayRemaining(remainingSecondsAt(stateRef.current, Date.now()));
      }
    }, Math.max(16, untilVisibleChange + 1));
    return () => window.clearTimeout(timer);
  }, [displayRemaining, ready, send, state]);

  useEffect(() => {
    if (!ready) return;
    const onPageHide = () => { void persist(stateRef.current, false); };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [persist, ready]);

  const value = useMemo<PomodoroContextValue>(() => ({
    state,
    remainingSeconds: displayRemaining,
    ready,
    saveStatus,
    send,
  }), [displayRemaining, ready, saveStatus, send, state]);

  return (
    <PomodoroContext.Provider value={value}>
      {children}
      <p className="cn-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextValue {
  const value = useContext(PomodoroContext);
  if (!value) throw new Error('usePomodoro must be used inside PomodoroProvider.');
  return value;
}
