import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import './primitives.css';

/**
 * Close on Escape, and on a click outside the root.
 *
 * Shared by Popover and Menu so the two cannot drift. A dismissal
 * rule that differs between two lookalike controls is a bug users
 * experience as the app being unreliable.
 */
function useDismiss(
  open: boolean,
  close: () => void,
  rootRef: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) close();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close, rootRef]);
}

export interface PopoverProps {
  /** Must accept `aria-expanded`, `aria-controls` and `onClick`. */
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: () => void;
  }) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A non-modal overlay anchored to its trigger.
 *
 * Unlike Dialog it does not trap focus — a popover the user can tab
 * out of is correct behaviour for a non-modal surface, and trapping
 * it would strand keyboard users in a panel they never asked to be
 * confined to.
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(open, close, rootRef);

  return (
    <div className="cn-popover-root" ref={rootRef}>
      {trigger({
        'aria-expanded': open,
        'aria-controls': id,
        onClick: () => setOpen(!open),
      })}
      {open ? (
        <div
          id={id}
          className={align === 'end' ? 'cn-popover cn-popover--end' : 'cn-popover'}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface MenuProps {
  label: string;
  items: readonly MenuItem[];
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-haspopup': 'menu';
    onPointerDown: (event: React.PointerEvent) => void;
    onClick: (event: React.MouseEvent) => void;
  }) => ReactNode;
  align?: 'start' | 'end';
}

/**
 * A menu with roving arrow-key focus.
 *
 * Arrow keys move, Home and End jump, Enter selects, Escape closes
 * and returns focus to the trigger. That last part matters: a menu
 * that closes and drops focus to the document leaves a keyboard user
 * at the top of the page with no idea where they are.
 */
export function Menu({ label, items, trigger, align = 'start' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pointerActivated, setPointerActivated] = useState(false);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const enabledIndexes = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0);

  const move = (delta: number) => {
    if (enabledIndexes.length === 0) return;
    const position = enabledIndexes.indexOf(activeIndex);
    const next =
      position === -1
        ? enabledIndexes[0]!
        : enabledIndexes[
            (position + delta + enabledIndexes.length) % enabledIndexes.length
          ]!;
    setActiveIndex(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(enabledIndexes[0] ?? 0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(enabledIndexes.at(-1) ?? 0);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  };

  const toggle = useCallback(() => {
    setActiveIndex(enabledIndexes[0] ?? 0);
    setOpen(!open);
  }, [enabledIndexes, open, setOpen]);

  const onTriggerPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!event.isPrimary) return;
      // Prevent the native pointer focus from retaking focus after the
      // menu effect moves it to the first item.
      event.preventDefault();
      setPointerActivated(true);
      setTimeout(() => {
        setPointerActivated(false);
      }, 0);
      toggle();
    },
    [toggle],
  );

  const onTriggerClick = useCallback(
    (event: React.MouseEvent) => {
      if (pointerActivated) {
        setPointerActivated(false);
        return;
      }
      if (event.detail === 0) toggle();
    },
    [pointerActivated, toggle],
  );

  return (
    <div
      className="cn-popover-root"
      ref={rootRef}
      onKeyDown={open ? onKeyDown : undefined}
    >
      <span
        ref={(node) => {
          triggerRef.current = node?.firstElementChild as HTMLElement | null;
        }}
        style={{ display: 'contents' }}
      >
        {trigger({
          'aria-expanded': open,
          'aria-controls': id,
          'aria-haspopup': 'menu',
          // A focused ancestor can re-render a trigger between pointerdown
          // and click. Pointer activation must therefore not depend on the
          // later click reaching the same DOM node; keyboard activation still
          // arrives as a detail-0 click.
          onPointerDown: onTriggerPointerDown,
          onClick: onTriggerClick,
        })}
      </span>
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={align === 'end' ? 'cn-popover cn-popover--end' : 'cn-popover'}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              className="cn-menu__item"
              data-active={index === activeIndex}
              disabled={item.disabled}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => {
                item.onSelect();
                close();
                triggerRef.current?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface TooltipProps {
  label: string;
  children: ReactNode;
}

/**
 * A hint on hover and on keyboard focus.
 *
 * Focus matters as much as hover: a tooltip that only appears on
 * pointer hover does not exist for a keyboard user. The label is
 * also exposed through `aria-describedby`, so it reaches a screen
 * reader whether or not it is painted.
 *
 * Never the only place information lives — a tooltip cannot be
 * reached at all on a touch device.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span
      className="cn-tooltip-root"
      onPointerEnter={() => setVisible(true)}
      onPointerLeave={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={() => setVisible(false)}
    >
      <span aria-describedby={id} style={{ display: 'contents' }}>
        {children}
      </span>
      <span role="tooltip" id={id} hidden={!visible} className="cn-tooltip">
        {label}
      </span>
    </span>
  );
}
