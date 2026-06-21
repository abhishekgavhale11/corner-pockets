"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "w-[calc(100%-2rem)] max-w-md rounded-xl border-0 bg-white p-0 shadow-xl backdrop:bg-black/50",
        "open:animate-in open:fade-in"
      )}
      onClose={onClose}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-gray-600">{message}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          disabled={isLoading}
          fullWidth
        >
          {isLoading ? "Processing..." : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
          fullWidth
        >
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
