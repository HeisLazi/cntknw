import { useCallback, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './primitives.css';

export interface SplitPaneProps {
  orientation?: 'horizontal' | 'vertical';
  /** Fraction of the container given to the first pane, 0–1. */
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  /** Accessible name for the separator, e.g. "Source and journal". */
  label: string;
  start: ReactNode;
  end: ReactNode;
  onRatioChange?: (ratio: number) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Two resizable panes with a real `separator`.
 *
 * The handle is a `<button role="separator">` rather than a styled
 * div, because a split that can only be moved by dragging cannot be
 * used without a mouse. Arrow keys move it in 2% steps, Home and End
 * jump to the bounds, and `aria-valuenow` reports the position — so
 * PDD §21's "resizable panels" holds for keyboard users too.
 *
 * The ratio is transient layout state and stays local. The durable
 * one lives on `WorkspaceState.layout.splitRatio` in the repository,
 * and a caller that wants it persisted passes `onRatioChange`.
 */
export function SplitPane({
  orientation = 'horizontal',
  defaultRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
  label,
  start,
  end,
  onRatioChange,
}: SplitPaneProps) {
  const [ratio, setRatio] = useState(clamp(defaultRatio, minRatio, maxRatio));
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const apply = useCallback(
    (next: number) => {
      const bounded = clamp(next, minRatio, maxRatio);
      setRatio(bounded);
      onRatioChange?.(bounded);
    },
    [minRatio, maxRatio, onRatioChange],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const container = containerRef.current;
    if (!container) return;

    const move = (moveEvent: PointerEvent) => {
      const box = container.getBoundingClientRect();
      const next =
        orientation === 'horizontal'
          ? (moveEvent.clientX - box.left) / box.width
          : (moveEvent.clientY - box.top) / box.height;
      apply(next);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = 0.02;
    const decrease = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const increase = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';

    switch (event.key) {
      case decrease:
        event.preventDefault();
        apply(ratio - step);
        break;
      case increase:
        event.preventDefault();
        apply(ratio + step);
        break;
      case 'Home':
        event.preventDefault();
        apply(minRatio);
        break;
      case 'End':
        event.preventDefault();
        apply(maxRatio);
        break;
      default:
        break;
    }
  };

  const percent = Math.round(ratio * 100);

  return (
    <div
      ref={containerRef}
      className={`cn-split cn-split--${orientation}`}
      id={id}
    >
      <div className="cn-split__pane" style={{ flex: `0 0 ${percent}%` }}>
        {start}
      </div>
      <button
        type="button"
        role="separator"
        className="cn-split__handle"
        aria-label={label}
        aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
        aria-valuenow={percent}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      />
      <div className="cn-split__pane" style={{ flex: '1 1 0' }}>
        {end}
      </div>
    </div>
  );
}

export interface ResizablePanelProps {
  label: string;
  side?: 'start' | 'end';
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  children: ReactNode;
  onWidthChange?: (width: number) => void;
}

/**
 * A single panel with one resizable edge.
 *
 * Widths are in rem so the panel grows with the user's browser text
 * size instead of clipping at 200% zoom (PDD §21: resizable text).
 */
export function ResizablePanel({
  label,
  side = 'start',
  defaultWidth = 22,
  minWidth = 18,
  maxWidth = 34,
  children,
  onWidthChange,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(clamp(defaultWidth, minWidth, maxWidth));
  const ref = useRef<HTMLDivElement>(null);

  const apply = useCallback(
    (next: number) => {
      const bounded = clamp(next, minWidth, maxWidth);
      setWidth(bounded);
      onWidthChange?.(bounded);
    },
    [minWidth, maxWidth, onWidthChange],
  );

  const rootFontSize = () =>
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const panel = ref.current;
    if (!panel) return;
    const unit = rootFontSize();

    const move = (moveEvent: PointerEvent) => {
      const box = panel.getBoundingClientRect();
      const pixels =
        side === 'start' ? moveEvent.clientX - box.left : box.right - moveEvent.clientX;
      apply(pixels / unit);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      apply(width - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      apply(width + 1);
    }
  };

  const handle = (
    <button
      type="button"
      role="separator"
      className="cn-split__handle"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );

  return (
    <div className="cn-split cn-split--horizontal" ref={ref}>
      {side === 'end' ? handle : null}
      <div className="cn-split__pane" style={{ flex: `0 0 ${width}rem` }}>
        {children}
      </div>
      {side === 'start' ? handle : null}
    </div>
  );
}
