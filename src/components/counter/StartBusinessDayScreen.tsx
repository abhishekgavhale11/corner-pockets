"use client";

import { useState, useTransition } from "react";
import { openBusinessDayAction } from "@/actions/business-day";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { getBusinessDate } from "@/lib/utils/business-date";

/**
 * Counter entry screen when no OPEN Business Day exists.
 * Admin and Staff can open the Business Day.
 */
export function StartBusinessDayScreen({
  canManageBusinessDay,
}: {
  canManageBusinessDay: boolean;
}) {
  const [businessDate, setBusinessDate] = useState(() => getBusinessDate());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("businessDate", businessDate);
        const result = await openBusinessDayAction(formData);
        if (!result.success) {
          setError(result.error);
          return;
        }
        // Action has finished — hard navigate so the Counter layout re-checks
        // OPEN day. router.refresh() alone can leave cashiers on this gate
        // after a prior close (stale RSC tree).
        window.location.assign("/counter/big-snooker");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start Business Day"
        );
      }
    });
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4">
      <div className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">
          Business Day has not been started.
        </h1>

        {!canManageBusinessDay ? (
          <p className="mt-2 text-sm text-gray-500">
            Ask an Admin to open the Business Day before using Counter.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-500">
              Choose the Business Date and start the Business Day to use
              Counter.
            </p>

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              <div>
                <Label htmlFor="businessDate">Business Date</Label>
                <Input
                  id="businessDate"
                  type="date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  disabled={isPending}
                  className="mt-1"
                />
              </div>
              <Button
                type="button"
                fullWidth
                onClick={handleStart}
                disabled={isPending || businessDate.trim() === ""}
                data-testid="start-business-day"
              >
                {isPending ? "Starting…" : "Start Business Day"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
