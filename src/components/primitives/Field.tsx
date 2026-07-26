import { forwardRef, useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import './primitives.css';

interface FieldShellProps {
  id: string;
  label: string;
  /** Hide the label visually but keep it for assistive technology. */
  hideLabel?: boolean;
  hint?: string;
  hintId: string;
  error?: string;
  errorId: string;
  children: ReactNode;
}

/**
 * Label, hint and error, wired to the control by id.
 *
 * The wiring is the whole point: `aria-describedby` is what makes a
 * hint and an error message reach a screen reader at all, and doing
 * it by hand at each call site is how fields end up with a red
 * border and nothing else — meaning carried by colour alone, which
 * PDD §21 forbids.
 */
function FieldShell({
  id,
  label,
  hideLabel,
  hint,
  hintId,
  error,
  errorId,
  children,
}: FieldShellProps) {
  return (
    <div className="cn-field">
      <label
        className={hideLabel ? 'cn-visually-hidden' : 'cn-field__label'}
        htmlFor={id}
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <span className="cn-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="cn-field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(
  hint: string | undefined,
  error: string | undefined,
  hintId: string,
  errorId: string,
): string | undefined {
  const ids = [error ? errorId : null, hint && !error ? hintId : null].filter(
    Boolean,
  );
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, type = 'text', ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <FieldShell
      id={id}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
    >
      <input
        {...rest}
        ref={ref}
        id={id}
        type={type}
        className="cn-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, hintId, errorId)}
      />
    </FieldShell>
  );
});

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hideLabel, hint, error, ...rest }, ref) {
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    return (
      <FieldShell
        id={id}
        label={label}
        hideLabel={hideLabel}
        hint={hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
      >
        <textarea
          {...rest}
          ref={ref}
          id={id}
          className="cn-textarea"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, hintId, errorId)}
        />
      </FieldShell>
    );
  },
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  options: readonly SelectOption[];
}

/**
 * Native `<select>`.
 *
 * A custom listbox would need keyboard interaction, typeahead,
 * virtual focus and mobile behaviour rebuilt from scratch. The
 * platform already ships all four, and on a phone it opens the
 * system picker, which no div can.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, error, options, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <FieldShell
      id={id}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
    >
      <select
        {...rest}
        ref={ref}
        id={id}
        className="cn-select"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, hintId, errorId)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});
