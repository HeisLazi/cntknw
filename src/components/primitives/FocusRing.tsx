import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export interface FocusRingProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'style'> {
  /**
   * Render the ring whether or not the browser considers the child
   * focus-visible. For a composite widget whose real focus sits on a
   * parent — a roving-tabindex list, a virtual cursor — the visible
   * ring has to be drawn where the user believes they are.
   */
  visible?: boolean;
  children: ReactNode;
}

/**
 * The focus ring, as a component, for the cases where CSS cannot
 * reach it on its own.
 *
 * Nearly everything gets its ring from the global `:focus-visible`
 * rule in `design/base.css`, and should keep doing so — one ring
 * everywhere is the point. This exists for composite widgets where
 * DOM focus and perceived focus are different elements, and it
 * deliberately reuses the same two tokens rather than inventing a
 * second look.
 */
export function FocusRing({ visible = false, children, ...rest }: FocusRingProps) {
  const style: CSSProperties = visible
    ? {
        outline: 'var(--cn-focus-ring-width) solid var(--cn-focus-ring)',
        outlineOffset: 'var(--cn-focus-ring-offset)',
        borderRadius: 'var(--cn-radius-xs)',
        display: 'inline-flex',
      }
    : { display: 'inline-flex' };

  return (
    <span {...rest} style={style} data-focus-ring={visible || undefined}>
      {children}
    </span>
  );
}
