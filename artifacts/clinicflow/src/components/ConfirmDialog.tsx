import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppDialog } from "./AppDialog";
import { LoadingButton } from "./LoadingButton";
import { friendlyError } from "@/lib/friendly-error";
import "./shared-feedback.css";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for destructive/deactivate actions (spec finding 44). */
  tone?: "default" | "danger";
  /** May return a promise; the dialog stays open showing "…" until it settles. Throw to keep it open with an error. */
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
  busyLabel?: string;
}

/** In-app replacement for window.confirm (spec §7.6). Close is blocked only while the action runs. */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Cancel", tone = "default", onConfirm, onCancel, busyLabel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  useEffect(() => { if (open) { setError(null); setBusy(false); lock.current = false; } }, [open]);
  useEffect(() => { if (open) requestAnimationFrame(() => cancelRef.current?.focus()); }, [open]);

  const run = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await onConfirm(); }
    catch (e) { setError(friendlyError(e)); }
    finally { lock.current = false; setBusy(false); }
  };

  return (
    <AppDialog open={open} onClose={onCancel} title={title} busy={busy}>
      <div className="confirm-dialog-body">
        {description && <div>{description}</div>}
        {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
      </div>
      <div className="app-dialog-footer confirm-dialog-footer">
        <button ref={cancelRef} type="button" className="button secondary small" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <LoadingButton type="button" className={`button small${tone === "danger" ? " danger-solid" : ""}`} loading={busy}
          loadingText={busyLabel ?? `${confirmLabel}…`} onClick={run} data-testid="confirm-dialog-confirm">{confirmLabel}</LoadingButton>
      </div>
    </AppDialog>
  );
}

/** Imperative-ish helper: const confirm = useConfirm(); const ok = await confirm.ask({...}); render {confirm.dialog}. */
export function useConfirm() {
  const [state, setState] = useState<(Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel"> & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = (opts: Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel">) => new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  const dialog = state ? (
    <ConfirmDialog {...state} open onConfirm={() => { state.resolve(true); setState(null); }} onCancel={() => { state.resolve(false); setState(null); }} />
  ) : null;
  return { ask, dialog };
}
