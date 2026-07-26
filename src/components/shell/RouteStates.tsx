import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@components/primitives';
import './shell.css';

export interface RouteHeaderProps {
  title: string;
  lede?: string;
  actions?: ReactNode;
}

/** One `<h1>` per route, so the heading outline stays honest. */
export function RouteHeader({ title, lede, actions }: RouteHeaderProps) {
  return (
    <header className="cn-route-header">
      <h1 className="cn-route-header__title">{title}</h1>
      {lede ? <p className="cn-route-header__lede">{lede}</p> : null}
      {actions}
    </header>
  );
}

export interface RouteLoadingProps {
  label?: string;
}

/**
 * Route-level loading.
 *
 * `role="status"` with visible text, not a bare spinner: a shape
 * that spins says nothing to a screen reader, and says nothing at
 * all once reduced-motion stops it.
 */
export function RouteLoading({ label = 'Loading…' }: RouteLoadingProps) {
  return (
    <div className="cn-route-loading" role="status">
      <span className="cn-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export interface RouteErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function RouteError({
  title = 'This view could not be loaded',
  message,
  onRetry,
}: RouteErrorProps) {
  return (
    <div className="cn-route-state" role="alert">
      <h2 className="cn-route-state__title">{title}</h2>
      <p className="cn-route-state__message">{message}</p>
      <div className="cn-route-state__actions">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Link className="cn-nav__link" to="/library">
          Back to Library
        </Link>
      </div>
    </div>
  );
}

export interface MissingSourceProps {
  sourceId: string;
}

/**
 * A study route whose source does not exist.
 *
 * Distinct from a 404 on purpose: the route is valid and the id is
 * well-formed, so telling the user "page not found" would be false.
 * The recovery is also different — the Library is where the source
 * would be, if it were anywhere.
 */
export function MissingSource({ sourceId }: MissingSourceProps) {
  return (
    <div className="cn-route-state" role="alert">
      <h2 className="cn-route-state__title">That source is not in your library</h2>
      <p className="cn-route-state__message">
        Nothing is stored under <code>{sourceId}</code>. It may have been removed,
        or the link may be from another device.
      </p>
      <div className="cn-route-state__actions">
        <Link className="cn-nav__link" to="/library">
          Back to Library
        </Link>
      </div>
    </div>
  );
}
