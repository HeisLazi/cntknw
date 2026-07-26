import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import './primitives.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * A modal dialog built on the native `<dialog>` element.
 *
 * `showModal()` gives focus trapping, Escape-to-close, the top layer
 * and `inert` on the rest of the page — four things a div-based
 * modal has to reimplement and usually gets at least one of wrong.
 * The only behaviour added here is closing on a backdrop click,
 * which the platform deliberately leaves to the author.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom implements <dialog> but not showModal. Falling back to
      // the `open` attribute keeps the dialog rendered and queryable
      // there, and in a browser too old for showModal it degrades to
      // a non-modal dialog rather than to nothing at all.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.open = true;
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.open = false;
    }
  }, [open]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      // The dialog element itself fills the viewport; a click whose
      // target IS the dialog landed on the backdrop, not the panel.
      if (event.target === ref.current) onClose();
    },
    [onClose],
  );

  return (
    <dialog
      ref={ref}
      className="cn-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="cn-dialog__header">
        <h2 className="cn-dialog__title" id={titleId}>
          {title}
        </h2>
      </div>
      {description || children ? (
        <div className="cn-dialog__body" id={descriptionId}>
          {description}
          {children}
        </div>
      ) : null}
      <div className="cn-dialog__footer">
        {footer ?? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action as destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation for an action that cannot simply be undone.
 *
 * Cancel is first in the DOM and receives initial focus, so the
 * default keyboard action is the safe one. NFR-008 wants a recovery
 * path for destructive actions; where one genuinely cannot exist,
 * the least this can do is not make destruction the easy mistake.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
