import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Disables the button and announces the wait. `aria-busy` and the
   * visible label carry it as well as the spinner does — a spinner
   * alone is invisible to a screen reader and to anyone who has
   * turned animation off.
   */
  loading?: boolean;
  loadingLabel?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  children?: ReactNode;
}

/**
 * A real `<button>`.
 *
 * Not a styled div: keyboard activation, form participation, the
 * disabled state and the accessibility role all come from the
 * element, and every one of them is something a custom
 * reimplementation gets subtly wrong.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      loadingLabel = 'Working…',
      startIcon,
      endIcon,
      disabled,
      type = 'button',
      children,
      ...rest
    },
    ref,
  ) {
    const classes = [
      'cn-button',
      `cn-button--${variant}`,
      size !== 'md' ? `cn-button--${size}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled ?? loading}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <>
            <span className="cn-spinner" aria-hidden="true" />
            <span>{loadingLabel}</span>
          </>
        ) : (
          <>
            {startIcon ? <span aria-hidden="true">{startIcon}</span> : null}
            {children}
            {endIcon ? <span aria-hidden="true">{endIcon}</span> : null}
          </>
        )}
      </button>
    );
  },
);

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /**
   * Required. An icon-only control with no accessible name is
   * unusable by anyone not looking at it, and there is no sensible
   * default to fall back on.
   */
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, icon, size = 'md', type = 'button', ...rest }, ref) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={size === 'sm' ? 'cn-icon-button cn-icon-button--sm' : 'cn-icon-button'}
        aria-label={label}
        title={label}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    );
  },
);
