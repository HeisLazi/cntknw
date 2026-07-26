import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export type SurfaceTone = 'default' | 'raised' | 'sunken' | 'paper';
export type SurfacePad = 'none' | 'sm' | 'md' | 'lg';

export interface SurfaceProps extends Omit<HTMLAttributes<HTMLElement>, 'className'> {
  /**
   * The element to render. Defaults to `div` — a Surface is a
   * visual treatment, so it must not impose `section` or `article`
   * semantics on content that is neither.
   */
  as?: ElementType;
  tone?: SurfaceTone;
  pad?: SurfacePad;
  bordered?: boolean;
  children?: ReactNode;
}

/** Panel, card and reading plane. One component, four tones. */
export function Surface({
  as: Element = 'div',
  tone = 'default',
  pad = 'none',
  bordered = false,
  children,
  ...rest
}: SurfaceProps) {
  const classes = [
    'cn-surface',
    tone !== 'default' ? `cn-surface--${tone}` : null,
    pad !== 'none' ? `cn-surface--pad-${pad}` : null,
    bordered ? 'cn-surface--bordered' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Element {...rest} className={classes}>
      {children}
    </Element>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** PDD §9.8: an empty state teaches exactly one next action. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="cn-empty-state">
      <h2 className="cn-empty-state__title">{title}</h2>
      {description ? (
        <p className="cn-empty-state__description">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export interface ScrollAreaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  children?: ReactNode;
}

/**
 * A scroll container with styled scrollbars.
 *
 * Native overflow, not a virtualised replacement: custom scrollbars
 * routinely break keyboard scrolling, the browser's find-in-page and
 * momentum on touch. This only changes how the bar looks.
 */
export function ScrollArea({ children, ...rest }: ScrollAreaProps) {
  return (
    <div {...rest} className="cn-scroll-area">
      {children}
    </div>
  );
}
