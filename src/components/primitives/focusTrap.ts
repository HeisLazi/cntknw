const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface FocusTrapEvent {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
}

/** Keep keyboard focus inside an open modal surface. */
export function trapFocusWithin(
  event: FocusTrapEvent,
  container: HTMLElement | null,
): void {
  if (event.key !== 'Tab' || !container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
