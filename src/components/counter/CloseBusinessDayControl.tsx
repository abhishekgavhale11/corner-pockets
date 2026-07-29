"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  closeBusinessDayAction,
  getBusinessDayClosePreviewAction,
  hasOpenBusinessDayAction,
} from "@/actions/business-day";
import { CloseBusinessDayConfirmModal } from "@/components/business-day/CloseBusinessDayConfirmModal";
import { Button } from "@/components/ui/Button";
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
      <Button
        type="button"
        variant="danger"
        size="lg"
        onClick={openConfirm}
        disabled={isPending}
      >
        Close Business Day
      </Button>

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
