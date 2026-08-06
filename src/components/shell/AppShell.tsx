import { NavLink, Outlet, useLocation } from 'react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '@components/primitives';
import { trapFocusWithin } from '@components/primitives/focusTrap';
import { PomodoroTimer } from '@features/pomodoro/PomodoroTimer';
import './shell.css';

/**
 * The three primary destinations. INV-001 and IA-001.
 *
 * This array is the whole of permanent navigation, and
 * `navigation.test.ts` asserts its length is exactly three. Sessions,
 * Whiteboard, PDF Reader, Dictionary, Export, Settings, Chess and
 * Atlas are **never** promoted here: Atlas is a room inside the
 * Library, Settings is a secondary route, and the rest are tools
 * within the Study Workspace. A fourth entry is a product change
 * requiring a PDD revision, not a routing tweak.
 */
export const PRIMARY_DESTINATIONS = [
  { to: '/library', label: 'Library' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/notes', label: 'Notes' },
] as const;

function SkipLink() {
  return (
    <a className="cn-skip-link" href="#cn-main">
      Skip to content
    </a>
  );
}

/**
 * Move focus to the main region after a route change.
 *
 * A single-page app swaps content without the browser's usual
 * navigation, so focus stays wherever the link was and a screen
 * reader announces nothing. Without this, keyboard users have to tab
 * back through the whole nav after every navigation.
 *
 * Keyed on the pathname rather than on a "first render" flag. The
 * flag version stole focus on initial load under StrictMode, whose
 * deliberate mount → unmount → mount cycle runs the effect twice:
 * the first run cleared the flag, the second then focused `main`,
 * moving the user past the skip link before they had touched
 * anything. Comparing the path makes the second run a no-op, because
 * the path has not changed — which is also the true condition.
 */
function useFocusMainOnNavigate(ref: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  const focusedFor = useRef<string | null>(null);

  useEffect(() => {
    if (focusedFor.current === null) {
      // Initial load. The browser has already put focus where it
      // belongs, and moving it would be the app talking over itself.
      focusedFor.current = pathname;
      return;
    }
    if (focusedFor.current === pathname) return;
    focusedFor.current = pathname;
    ref.current?.focus();
  }, [pathname, ref]);
}

export function AppShell() {
  const mainRef = useRef<HTMLElement>(null);
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const navCloseRef = useRef<HTMLButtonElement>(null);
  const navDialogRef = useRef<HTMLDivElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  useFocusMainOnNavigate(mainRef);

  const openNavigation = useCallback(() => {
    setNavOpen(true);
  }, []);

  const closeNavigation = useCallback((returnFocus = true) => {
    setNavOpen(false);
    if (returnFocus) {
      queueMicrotask(() => navTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (navOpen) navCloseRef.current?.focus();
  }, [navOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const shortcut = (event.ctrlKey || event.metaKey) && event.shiftKey &&
        event.key.toLowerCase() === 'm';
      if (shortcut) {
        event.preventDefault();
        if (navOpen) closeNavigation();
        else openNavigation();
        return;
      }
      if (navOpen && event.key === 'Escape') {
        event.preventDefault();
        closeNavigation();
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [closeNavigation, navOpen, openNavigation]);

  return (
    <div className="cn-shell">
      <SkipLink />

      <button
        ref={navTriggerRef}
        type="button"
        className="cn-nav-trigger"
        aria-label="Open navigation (Ctrl+Shift+M)"
        aria-keyshortcuts="Control+Shift+M Meta+Shift+M"
        aria-controls="cn-primary-navigation"
        aria-expanded={navOpen}
        onClick={openNavigation}
      >
        <span aria-hidden="true">☰</span>
      </button>

      <div
        ref={navDialogRef}
        id="cn-primary-navigation"
        className="cn-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        data-state={navOpen ? 'open' : 'closed'}
        hidden={!navOpen}
        onKeyDown={(event) => trapFocusWithin(event, navDialogRef.current)}
      >
        <div className="cn-nav__header">
          <span className="cn-nav__brand">CNTKNW</span>
          <IconButton
            ref={navCloseRef}
            label="Close navigation"
            icon="×"
            size="sm"
            onClick={() => closeNavigation()}
          />
        </div>

        <nav aria-label="Primary">
          <ul className="cn-nav__primary">
            {PRIMARY_DESTINATIONS.map((item) => (
              <li key={item.to}>
              {/*
                NavLink sets aria-current="page" itself, and the
                stylesheet selects on that attribute rather than on a
                class — so what is announced and what is highlighted
                cannot drift apart.
              */}
                <NavLink
                  to={item.to}
                  className="cn-nav__link"
                  onClick={() => closeNavigation()}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="cn-nav__focus" role="group" aria-label="Focus timer">
            <PomodoroTimer placement="nav" />
          </div>
        </nav>
      </div>

      <main className="cn-main" id="cn-main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
