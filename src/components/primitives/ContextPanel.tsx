import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { IconButton } from './Button';
import { trapFocusWithin } from './focusTrap';
import './primitives.css';

export interface ContextPanelProps {
  open?: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** The control that should regain focus after the overlay closes. */
  triggerRef?: RefObject<HTMLElement | null>;
}

/**
 * Reusable right-edge chrome for source context such as PDF contents.
 *
 * It stays mounted so its occupant can retain local projection state,
 * but the native `hidden` attribute removes every descendant from the
 * focus order while closed. Positioning is fixed in the primitive
 * stylesheet, so opening it never changes the work area's dimensions.
 */
export function ContextPanel({
  open = false,
  title,
  children,
  onClose,
  triggerRef,
}: ContextPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) triggerRef?.current?.focus();
      wasOpen.current = false;
      return;
    }

    wasOpen.current = true;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, triggerRef]);

  return (
    <aside
      ref={panelRef}
      className="cn-context-panel"
      data-state={open ? 'open' : 'closed'}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      hidden={!open}
      onKeyDown={(event) => trapFocusWithin(event, panelRef.current)}
    >
      <header className="cn-context-panel__header">
        <h2 className="cn-context-panel__title">{title}</h2>
        <IconButton
          ref={closeRef}
          icon="×"
          label={`Close ${title.toLowerCase()} panel`}
          size="sm"
          onClick={onClose}
        />
      </header>
      <div className="cn-context-panel__body">{children}</div>
    </aside>
  );
}
