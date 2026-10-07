import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { decideCloseRequest } from "./app-dialog-close";
import "./app-dialog.css";

const AppDialogCloseContext = createContext<(() => void) | null>(null);
/** Inside an AppDialog: returns its guarded close (honours dirty/busy, asks before discarding). Outside: null. */
export function useAppDialogClose() { return useContext(AppDialogCloseContext); }

export interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  dirty?: boolean;
  busy?: boolean;
  /** "wide" for long forms: wider on desktop so fields group into two columns; full-screen on phones. */
  size?: "default" | "wide" | "medium";
  /** "drawer" docks the panel to the right edge (full-screen sheet on phones). Same close/dirty lifecycle. */
  variant?: "modal" | "drawer";
}

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  dirty = false,
  busy = false,
  size = "default",
  variant = "modal",
}: AppDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset when the dialog is closed from outside.
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  const requestClose = useCallback(() => {
    const decision = decideCloseRequest({ busy, dirty, confirming });
    if (decision === "confirm") {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setConfirming(true);
    } else if (decision === "close") {
      onCloseRef.current();
    }
  }, [busy, dirty, confirming]);

  const keepEditing = useCallback(() => {
    setConfirming(false);
    const el = returnFocusRef.current;
    requestAnimationFrame(() => {
      if (el && el.isConnected) el.focus();
    });
  }, []);

  const discard = useCallback(() => {
    setConfirming(false);
    onCloseRef.current();
  }, []);

  const trapConfirmFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !confirmRef.current) return;
    const items = confirmRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) requestClose();
      }}
    >
      <DialogContent
        className={`app-dialog ${variant==="drawer"?"app-dialog-drawer":size==="medium"?"app-dialog-wide app-dialog-medium sm:max-w-[820px]":size==="wide"?"app-dialog-wide sm:max-w-5xl":"sm:max-w-2xl"} bg-white border border-border shadow-xl`}
        {...(!description ? { "aria-describedby": undefined } : {})}
        aria-busy={busy || undefined}
        onOpenAutoFocus={() => {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          // Controlled dialogs have no Radix DialogTrigger to restore focus to.
          const opener = openerRef.current;
          if (opener?.isConnected && opener !== document.body) {
            event.preventDefault();
            opener.focus({ preventScroll: true });
          }
        }}
        onInteractOutside={(e) => {
          e.preventDefault();
          if (e.target instanceof Element && e.target.closest(".dtp-popover")) return;
          if (!confirming) requestClose();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          // An open date/time picker owns Escape: it closes the picker, not the dialog.
          const target = e.target instanceof Element ? e.target : null;
          if (target?.closest(".dtp-popover, [data-dtp-open]")) return;
          if (confirming) keepEditing();
          else requestClose();
        }}
      >
        <DialogHeader className="app-dialog-header bg-slate-50/50 space-y-0" inert={confirming ? true : undefined}>
          <DialogTitle className="app-dialog-title text-foreground">{title}</DialogTitle>
          {description && (
            <DialogDescription className="app-dialog-desc text-muted-foreground">
              {description}
            </DialogDescription>
          )}
          <span
            className="app-dialog-close-wrap"
            title={busy ? "Saving in progress" : undefined}
          >
            <button
              type="button"
              className="app-dialog-close"
              data-testid="button-dialog-close"
              aria-label={busy ? "Close (saving in progress)" : "Close"}
              disabled={busy}
              onClick={requestClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        </DialogHeader>

        {/* Single internal scroll area for the content. Kept mounted during
            discard confirmation so form values are preserved. */}
        <div className="app-dialog-body bg-white" aria-hidden={confirming || undefined} inert={confirming ? true : undefined}>
          <AppDialogCloseContext.Provider value={requestClose}>{children}</AppDialogCloseContext.Provider>
        </div>

        {confirming && (
          <div className="app-discard-scrim" data-testid="discard-confirm">
            <div
              ref={confirmRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="app-discard-title"
              aria-describedby="app-discard-desc"
              className="app-discard-panel"
              onKeyDown={trapConfirmFocus}
            >
              <h3 id="app-discard-title" className="app-discard-title">Discard unsaved changes?</h3>
              <p id="app-discard-desc" className="app-discard-desc">
                The changes you made in this form will be lost.
              </p>
              <div className="app-discard-actions">
                <button
                  ref={keepRef}
                  type="button"
                  className="app-discard-btn app-discard-keep"
                  data-testid="button-keep-editing"
                  onClick={keepEditing}
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  className="app-discard-btn app-discard-danger"
                  data-testid="button-discard-changes"
                  onClick={discard}
                >
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AppDialog;
