import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import './primitives.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

/**
 * A leading glyph per tone.
 *
 * PDD §21 forbids meaning carried by colour alone. The border colour
 * says "warning" to someone who can see it; the glyph and the
 * `role`/`aria-live` pairing say it to everyone else.
 */
const GLYPH: Record<ToastTone, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '×',
};

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  /** Milliseconds before auto-dismissal. 0 keeps the toast until dismissed. */
  duration?: number;
}

export function ToastProvider({ children, duration = 5000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current, { id, tone, message }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss, duration],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        The live region is always mounted, even when empty. A region
        inserted at the same moment as its first message is often not
        announced at all — screen readers need it present beforehand
        to observe the change.

        `polite`, not `assertive`: a save confirmation must not
        interrupt someone mid-sentence. Errors that genuinely cannot
        wait belong in a dialog, not a toast.
      */}
      <div
        className="cn-toast-region"
        role="status"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className={`cn-toast cn-toast--${toast.tone}`}>
            <span className="cn-toast__glyph" aria-hidden="true">
              {GLYPH[toast.tone]}
            </span>
            <span className="cn-toast__body">
              <span className="cn-visually-hidden">{toast.tone}: </span>
              {toast.message}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside a <ToastProvider>.');
  }
  return value;
}
