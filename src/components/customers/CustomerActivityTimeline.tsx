"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { reverseTransaction } from "@/actions/transactions";
import { CorrectionChangeLine } from "@/components/counter/CorrectionChangeLine";
import { CorrectionHistoryDialog } from "@/components/counter/CorrectionHistoryDialog";
import { EntryCorrectionBadge } from "@/components/counter/EntryCorrectionBadge";
import {
  REVERSAL_REASONS,
  type ReversalReasonKey,
} from "@/lib/constants/reversal-reasons";
import { formatCurrency } from "@/lib/utils/format";
import {
  activityEventAmount,
  activityEventCategory,
  activityEventCategoryTone,
  activityEventDescription,
  formatActivityTimeParts,
} from "@/lib/utils/activity-display";
import type { CustomerActivityEventDTO } from "@/types";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const filters = [
  { id: "all", label: "All" },
  { id: "counter", label: "Counter" },
  { id: "cafe", label: "Cafe" },
  { id: "payments", label: "Payments" },
  { id: "transactions", label: "Transactions" },
  { id: "reversals", label: "Reversals" },
] as const;

const CORRECTION_FIELD_ORDER = [
  "customer",
  "entryType",
  "playerCount",
  "amount",
] as const;

const categoryBadgeClass: Record<
  ReturnType<typeof activityEventCategoryTone>,
  string
> = {
  emerald: "bg-emerald-50 text-emerald-800",
  amber: "bg-amber-50 text-amber-900",
  sky: "bg-sky-50 text-sky-800",
  violet: "bg-violet-50 text-violet-800",
  rose: "bg-rose-50 text-rose-800",
  gray: "bg-gray-100 text-gray-700",
};

interface CustomerActivityTimelineProps {
  customerId: string;
  events: CustomerActivityEventDTO[];
  fullHeight?: boolean;
  canReverseRecharges?: boolean;
}

export function CustomerActivityTimeline({
  customerId,
  events,
  fullHeight = false,
  canReverseRecharges = false,
}: CustomerActivityTimelineProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("activity") ?? "all";
  const [correctionHistoryEvent, setCorrectionHistoryEvent] =
    useState<CustomerActivityEventDTO | null>(null);
  const [reverseTransactionId, setReverseTransactionId] = useState<
    string | null
  >(null);
  const [reversalReason, setReversalReason] =
    useState<ReversalReasonKey>("WRONG_AMOUNT");
  const [reversalReasonOther, setReversalReasonOther] = useState("");

  const [reverseState, reverseAction, isReversing] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await reverseTransaction(formData);
      if (result.success) {
        setReverseTransactionId(null);
        router.refresh();
        return null;
      }
      return { error: result.error };
    },
    null
  );

  const setFilter = (filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("activity");
    } else {
      params.set("activity", filter);
    }
    router.replace(`/customers/${customerId}?${params.toString()}`);
  };

  const rowGridClass =
    "grid grid-cols-[3.25rem_3.5rem_minmax(0,1fr)_4.25rem] items-center gap-x-2 sm:grid-cols-[3.25rem_3.5rem_minmax(0,1fr)_4.25rem_3rem_2.5rem]";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col border border-gray-200 bg-white",
        fullHeight && "min-h-[calc(100vh-72px)]"
      )}
    >
      <div className="shrink-0 border-b border-gray-100 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Activity
        </p>
        <div className="mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                active === f.id
                  ? "bg-emerald-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          fullHeight ? "max-h-[calc(100vh-120px)]" : "max-h-80"
        )}
      >
        <div
          className={cn(
            rowGridClass,
            "shrink-0 border-b border-gray-200 bg-gray-50/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
          )}
        >
          <span>Time</span>
          <span>Type</span>
          <span>Item</span>
          <span className="text-right">Amount</span>
          <span className="hidden text-right sm:inline">Staff</span>
          <span className="hidden sm:inline" />
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-gray-500">
              No activity yet.
            </li>
          ) : (
            events.map((event) => {
              const isReversal =
                event.kind === "SETTLEMENT_REVERSAL" ||
                event.walletTransactionIsReversal;
              const hasCorrections = Boolean(event.correctionSummary?.length);
              const sortedCorrections = [...(event.correctionSummary ?? [])].sort(
                (a, b) =>
                  CORRECTION_FIELD_ORDER.indexOf(
                    a.field as (typeof CORRECTION_FIELD_ORDER)[number]
                  ) -
                  CORRECTION_FIELD_ORDER.indexOf(
                    b.field as (typeof CORRECTION_FIELD_ORDER)[number]
                  )
              );
              const category = activityEventCategory(event);
              const tone = activityEventCategoryTone(category);
              const description = activityEventDescription(event);
              const amount = activityEventAmount(event);
              const { date, time } = formatActivityTimeParts(event.timestamp);
              const canReverse =
                canReverseRecharges &&
                event.kind === "WALLET_RECHARGE" &&
                event.transactionId &&
                !event.walletRechargeReversed &&
                !event.walletTransactionIsReversal;

              if (hasCorrections) {
                return (
                  <li
                    key={event.id}
                    className={cn(
                      "border-b border-gray-100 px-3 py-2",
                      "bg-amber-50/50 hover:bg-amber-50/80"
                    )}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        if (event.corrections?.length) {
                          setCorrectionHistoryEvent(event);
                        }
                      }}
                    >
                      <div className={rowGridClass}>
                        <span className="leading-tight">
                          <span className="block text-[10px] text-gray-400">
                            {date}
                          </span>
                          <span className="block font-mono text-[11px] text-gray-600">
                            {time}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "rounded px-1 py-0.5 text-center text-[10px] font-bold uppercase leading-tight",
                            categoryBadgeClass.gray
                          )}
                        >
                          Edit
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          {sortedCorrections.map((change) => (
                            <CorrectionChangeLine
                              key={change.field}
                              from={change.fromLabel}
                              to={change.toLabel}
                              className="text-xs"
                            />
                          ))}
                          <EntryCorrectionBadge />
                        </div>
                        <span className="text-right text-xs font-semibold tabular-nums text-gray-900">
                          {amount != null ? formatCurrency(amount) : "—"}
                        </span>
                        <span className="hidden truncate text-right text-[10px] text-gray-400 sm:block">
                          {event.staffUsername}
                        </span>
                        <span className="hidden sm:block" />
                      </div>
                    </button>
                  </li>
                );
              }

              return (
                <li
                  key={event.id}
                  className={cn(
                    "border-b border-gray-100 px-3 py-1.5",
                    isReversal && "bg-amber-50/60",
                    !isReversal && "hover:bg-gray-50/80"
                  )}
                >
                  <div className={rowGridClass}>
                    <span className="leading-tight">
                      <span className="block text-[10px] text-gray-400">
                        {date}
                      </span>
                      <span className="block font-mono text-[11px] text-gray-600">
                        {time}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 text-center text-[10px] font-bold uppercase leading-tight",
                        categoryBadgeClass[tone]
                      )}
                    >
                      {category}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p
                          className={cn(
                            "min-w-0 truncate text-xs font-medium",
                            isReversal ? "text-amber-900" : "text-gray-800"
                          )}
                          title={description}
                        >
                          {description}
                        </p>
                        {canReverse && (
                          <button
                            type="button"
                            className="shrink-0 text-[10px] font-semibold text-emerald-700 hover:underline sm:hidden"
                            onClick={() =>
                              setReverseTransactionId(event.transactionId!)
                            }
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                      {event.reversalReason && (
                        <p
                          className="truncate text-[10px] text-amber-800"
                          title={event.reversalReason}
                        >
                          {event.reversalReason}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-right text-xs font-bold tabular-nums",
                        isReversal ? "text-amber-900" : "text-gray-900"
                      )}
                    >
                      {amount != null ? formatCurrency(amount) : "—"}
                    </span>
                    <span
                      className="hidden truncate text-right text-[10px] text-gray-400 sm:block"
                      title={event.staffUsername}
                    >
                      {event.staffUsername}
                    </span>
                    <span className="hidden text-right sm:block">
                      {canReverse && (
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-emerald-700 hover:underline"
                          onClick={() =>
                            setReverseTransactionId(event.transactionId!)
                          }
                        >
                          Reverse
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {correctionHistoryEvent && (
        <CorrectionHistoryDialog
          corrections={correctionHistoryEvent.corrections}
          onClose={() => setCorrectionHistoryEvent(null)}
        />
      )}

      {reverseTransactionId && (
        <Dialog
          open
          onClose={() => setReverseTransactionId(null)}
          title="Reverse recharge"
        >
          <p className="text-sm text-gray-600">
            Reverse this wallet recharge? The credited amount will be removed
            from the customer&apos;s balance.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="recharge-reversal-reason">Reason</Label>
              <select
                id="recharge-reversal-reason"
                value={reversalReason}
                onChange={(e) =>
                  setReversalReason(e.target.value as ReversalReasonKey)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {REVERSAL_REASONS.map((reason) => (
                  <option key={reason.key} value={reason.key}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            {reversalReason === "OTHER" && (
              <div>
                <Label htmlFor="recharge-reversal-other">Details</Label>
                <Input
                  id="recharge-reversal-other"
                  value={reversalReasonOther}
                  onChange={(e) => setReversalReasonOther(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
            {reverseState?.error && (
              <p className="text-sm text-red-600">{reverseState.error}</p>
            )}
            <Button
              type="button"
              variant="danger"
              fullWidth
              size="sm"
              disabled={
                isReversing ||
                (reversalReason === "OTHER" &&
                  reversalReasonOther.trim().length < 3)
              }
              onClick={() => {
                const formData = new FormData();
                formData.set("customerId", customerId);
                formData.set("transactionId", reverseTransactionId);
                formData.set("reversalReason", reversalReason);
                if (reversalReason === "OTHER") {
                  formData.set("reversalReasonOther", reversalReasonOther);
                }
                reverseAction(formData);
              }}
            >
              {isReversing ? "Reversing..." : "Confirm reverse"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
