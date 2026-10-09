import type { ReactNode } from "react";
import { useAppDialogClose } from "./AppDialog";
import { ActionLabel } from "./ActionLabel";

/**
 * Shared Save/Cancel footer used by every form surface, for every role. Fixed order:
 * optional secondary content (status/errors/extra actions) on the left, then Cancel, then the
 * primary action at the end. Cancel always calls the caller's handler, so dirty-form guards
 * (AppDialog discard confirm, useRegisterUnsaved) keep working. With `onSubmit` the primary is a
 * plain button (for non-<form> surfaces); otherwise it submits the enclosing form.
 */
export interface FormActionsProps {
  onCancel?: () => void;
  onSubmit?: () => void;
  busy?: boolean;
  disabled?: boolean;
  cancelDisabled?: boolean;
  submitLabel?: ReactNode;
  busyLabel?: ReactNode;
  cancelLabel?: ReactNode;
  secondary?: ReactNode;
  submitTestId?: string;
  cancelTestId?: string;
  wide?: boolean;
  /** Extra actions placed between Cancel and the primary action (e.g. Save Draft). */
  extra?: ReactNode;
  submitClassName?: string;
  /** Inside an AppDialog with no onCancel: Cancel uses the dialog's guarded close (asks before discarding dirty input). */
  cancelClosesDialog?: boolean;
}

export function FormActions({ onCancel, onSubmit, busy = false, disabled = false, cancelDisabled = false, submitLabel = "Save Changes", busyLabel = "Saving…", cancelLabel = "Cancel", secondary, submitTestId = "button-save", cancelTestId = "button-cancel", wide = true, extra, submitClassName, cancelClosesDialog = false }: FormActionsProps) {
  const dialogClose = useAppDialogClose();
  const cancel = onCancel ?? (cancelClosesDialog ? dialogClose ?? undefined : undefined);
  return <div className={`${wide ? "wide " : ""}form-footer form-actions`} data-testid="form-actions">
    {secondary && <div className="form-actions-secondary">{secondary}</div>}
    {cancel && <button type="button" onClick={cancel} disabled={busy || cancelDisabled} data-testid={cancelTestId}><ActionLabel>{cancelLabel}</ActionLabel></button>}
    {extra}
    <button type={onSubmit ? "button" : "submit"} onClick={onSubmit} className={`button${submitClassName ? ` ${submitClassName}` : ""}`} disabled={busy || disabled} aria-busy={busy || undefined} data-testid={submitTestId}><ActionLabel>{busy ? busyLabel : submitLabel}</ActionLabel></button>
  </div>;
}
