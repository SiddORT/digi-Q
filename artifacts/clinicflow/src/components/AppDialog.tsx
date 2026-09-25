import React, { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "./app-dialog.css";

export interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  dirty?: boolean;
  busy?: boolean;
}

export function AppDialog({
  open,
  onClose,
  title,
  description,
  children,
  dirty = false,
  busy = false,
}: AppDialogProps) {
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        if (busy) {
          // Do not allow closing if busy (e.g., submitting a form)
          return;
        }
        if (dirty) {
          const confirmClose = window.confirm(
            "You have unsaved changes. Are you sure you want to discard them?"
          );
          if (!confirmClose) {
            return;
          }
        }
        onClose();
      }
    },
    [onClose, dirty, busy]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="app-dialog sm:max-w-2xl bg-white border border-border shadow-xl"
        onInteractOutside={(e) => {
          if (busy) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (busy) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="app-dialog-header bg-slate-50/50 space-y-0">
          <DialogTitle className="app-dialog-title text-foreground">{title}</DialogTitle>
          {description && (
            <DialogDescription className="app-dialog-desc text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        {/* Single internal scroll area for the content */}
        <div className="app-dialog-body bg-white">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AppDialog;
