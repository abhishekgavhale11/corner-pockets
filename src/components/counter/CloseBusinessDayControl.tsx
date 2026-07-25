"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  closeBusinessDayAction,
  getBusinessDayClosePreviewAction,
  hasOpenBusinessDayAction,
} from "@/actions/business-day";
import { CloseBusinessDayConfirmModal } from "@/components/business-day/CloseBusinessDayConfirmModal";
import type { BusinessDayClosePreviewDTO } from "@/types";

/**
 * Top-bar Close control for Counter.
 * Displays preview data from the Business Day module; does not validate itself.
 */
export function CloseBusinessDayControl() {
  const pathname = usePathname();
  const router = useRouter();
  const onCounter = pathname.startsWith("/counter");

  const [hasOpenDay, setHasOpenDay] = useState(false);
  const [preview, setPreview] = useState<BusinessDayClosePreviewDTO | null>(
    null
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshOpenState = useCallback(async () => {
    if (!onCounter) {
      setHasOpenDay(false);
      return;
    }
    const open = await hasOpenBusinessDayAction();
    setHasOpenDay(open);
  }, [onCounter]);

  useEffect(() => {
    void refreshOpenState();
  }, [refreshOpenState]);

  if (!onCounter || !hasOpenDay) {
    return null;
  }

  const openConfirm = () => {
    setError(null);
    startTransition(async () => {
      const nextPreview = await getBusinessDayClosePreviewAction();
      setPreview(nextPreview);
      setConfirmOpen(true);
    });
  };

  const confirmClose = () => {
    setError(null);
    startTransition(async () => {
      const result = await closeBusinessDayAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
      setHasOpenDay(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        disabled={isPending}
        className="rounded px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Close Business Day
      </button>

      <CloseBusinessDayConfirmModal
        open={confirmOpen}
        preview={preview}
        error={error}
        isPending={isPending}
        onClose={() => !isPending && setConfirmOpen(false)}
        onConfirm={confirmClose}
      />
    </>
  );
}
