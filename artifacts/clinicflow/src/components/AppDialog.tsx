import React, { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
        className="flex flex-col gap-0 p-0 overflow-hidden sm:max-w-2xl max-h-[90vh] bg-white border border-border shadow-xl rounded-xl"
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
        <DialogHeader className="px-6 md:px-8 py-5 border-b border-border bg-slate-50/50 flex-shrink-0">
          <DialogTitle className="text-xl text-foreground font-bold tracking-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        {/* Single internal scroll area for the content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8 bg-white">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AppDialog;
