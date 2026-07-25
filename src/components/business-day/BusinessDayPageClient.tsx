"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  closeBusinessDayAction,
  openBusinessDayAction,
  reopenBusinessDayAction,
} from "@/actions/business-day";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { CloseBusinessDayConfirmModal } from "@/components/business-day/CloseBusinessDayConfirmModal";
import { formatDate } from "@/lib/utils/format";
import { formatBusinessDayDate } from "@/lib/business-day/format";
import { getBusinessDate } from "@/lib/utils/business-date";
import type {
  BusinessDayClosePreviewDTO,
  BusinessDayDTO,
} from "@/types";

type Props = {
  current: BusinessDayDTO | null;
  history: BusinessDayDTO[];
  closePreview: BusinessDayClosePreviewDTO | null;
  canReopen: boolean;
};

export function BusinessDayPageClient({
  current,
  history,
  closePreview,
  canReopen,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [businessDate, setBusinessDate] = useState(() => getBusinessDate());
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);

  const closedDays = history.filter((day) => day.status === "CLOSED");

  const runAction = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  const handleOpen = () => {
    runAction(async () => {
      const formData = new FormData();
      formData.set("businessDate", businessDate);
      const result = await openBusinessDayAction(formData);
      if (!result.success) {
        throw new Error(result.error);
      }
      setBusinessDate(getBusinessDate());
    });
  };

  const handleCloseConfirm = () => {
    runAction(async () => {
      const result = await closeBusinessDayAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      setCloseConfirmOpen(false);
    });
  };

  const handleReopen = () => {
    if (!reopenTargetId) return;
    runAction(async () => {
      const formData = new FormData();
      formData.set("businessDayId", reopenTargetId);
      formData.set("reason", reopenReason);
      const result = await reopenBusinessDayAction(formData);
      if (!result.success) {
        throw new Error(result.error);
      }
      setReopenReason("");
      setReopenTargetId(null);
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Day</h1>
        <p className="mt-1 text-sm text-gray-500">
          Open, close, and reopen the club operational day.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Current Status */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Current Status
        </h2>
        {current ? (
          <div className="mt-3 space-y-2">
            <p className="text-lg font-semibold text-gray-900">
              Business Day #{current.businessDayNumber}
            </p>
            <p>
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {current.status}
              </span>
            </p>
            <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Business Date</dt>
                <dd className="font-medium">
                  {formatBusinessDayDate(current.businessDate)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Opened By</dt>
                <dd className="font-medium">{current.openedBy}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Opened At</dt>
                <dd className="font-medium">{formatDate(current.openedAt)}</dd>
              </div>
              {current.reopenedAt ? (
                <>
                  <div>
                    <dt className="text-gray-500">Reopened By</dt>
                    <dd className="font-medium">{current.reopenedBy}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Reopened At</dt>
                    <dd className="font-medium">
                      {formatDate(current.reopenedAt)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500">Reopen Reason</dt>
                    <dd className="font-medium">{current.reopenReason}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            No Business Day is currently OPEN.
          </p>
        )}
      </section>

      {/* Start Business Day */}
      {!current ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Start Business Day
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="businessDate">Business Date</Label>
              <Input
                id="businessDate"
                name="businessDate"
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                disabled={isPending}
                className="mt-1"
              />
            </div>
            <Button
              type="button"
              onClick={handleOpen}
              disabled={isPending || businessDate.trim() === ""}
            >
              Start Business Day
            </Button>
          </div>
        </section>
      ) : null}

      {/* Close Business Day */}
      {current ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Close Business Day
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Closing requires confirmation. Unassigned frames and Cafe items
            block closing.
          </p>
          <Button
            type="button"
            variant="danger"
            className="mt-4"
            onClick={() => {
              setError(null);
              setCloseConfirmOpen(true);
            }}
            disabled={isPending}
          >
            Close Business Day
          </Button>
        </section>
      ) : null}

      {/* Reopen Business Day (Admin only) */}
      {canReopen && !current && closedDays.length > 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Reopen Business Day
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Admin only. Reason is required. Cannot reopen while a newer Business
            Day is OPEN.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="reopenTarget">Closed Business Day</Label>
              <select
                id="reopenTarget"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                value={reopenTargetId ?? ""}
                onChange={(e) => setReopenTargetId(e.target.value || null)}
                disabled={isPending}
              >
                <option value="">Select…</option>
                {closedDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    #{day.businessDayNumber} — closed {formatDate(day.closedAt!)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="reopenReason">Reason</Label>
              <Input
                id="reopenReason"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Reason for reopening"
                disabled={isPending}
                className="mt-1"
              />
            </div>
            <Button
              type="button"
              onClick={handleReopen}
              disabled={
                isPending || !reopenTargetId || reopenReason.trim() === ""
              }
            >
              Reopen Business Day
            </Button>
          </div>
        </section>
      ) : null}

      {!canReopen && !current ? (
        <p className="text-xs text-gray-500">
          Reopening a closed Business Day requires Admin (Master / Super Master).
        </p>
      ) : null}

      {/* Confirmation Modal */}
      <CloseBusinessDayConfirmModal
        open={closeConfirmOpen}
        preview={closePreview}
        error={error}
        isPending={isPending}
        onClose={() => !isPending && setCloseConfirmOpen(false)}
        onConfirm={handleCloseConfirm}
      />
    </div>
  );
}
