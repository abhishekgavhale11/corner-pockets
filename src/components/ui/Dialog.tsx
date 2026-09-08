"use client";

import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Default fits narrow forms; `lg` ~800px for POS-style editors. */
  size?: "md" | "lg";
  /**
   * When false, the dialog body does not scroll. Children must manage
   * overflow (flex column with one inner scroller). Default true.
   */
  bodyScroll?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  size = "md",
  bodyScroll = true,
}: DialogProps) {
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

  const handleBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const isLg = size === "lg";
  const lockBodyScroll = !bodyScroll;

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed left-1/2 top-1/2 m-0 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border-0 bg-white p-0 shadow-xl backdrop:bg-black/50",
        "open:animate-in open:fade-in",
        isLg
          ? "max-h-[min(94vh,860px)] w-[min(calc(100vw-1.5rem),50rem)]"
          : "max-h-[min(90vh,640px)] w-[min(calc(100vw-2rem),28rem)]",
        lockBodyScroll &&
          "open:flex open:h-[min(94dvh,860px)] open:max-h-[min(94dvh,860px)] open:flex-col"
      )}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          isLg ? "px-5 py-4 sm:px-6" : "p-6",
          lockBodyScroll
            ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden"
            : cn(
                "overflow-y-auto",
                isLg
                  ? "max-h-[min(94vh,860px)]"
                  : "max-h-[min(90vh,640px)]"
              )
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-3",
            isLg ? "mb-3" : "mb-4"
          )}
        >
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        {lockBodyScroll ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          children
        )}
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
