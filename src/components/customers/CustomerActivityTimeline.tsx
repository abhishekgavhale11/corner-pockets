"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { reverseNotebookSettlement } from "@/actions/notebook-settlements";
import { CorrectionChangeLine } from "@/components/counter/CorrectionChangeLine";
import { CorrectionHistoryDialog } from "@/components/counter/CorrectionHistoryDialog";
import { EntryCorrectionBadge } from "@/components/counter/EntryCorrectionBadge";
import {
  NOTEBOOK_REVERSAL_REASONS,
  type NotebookReversalReasonKey,
} from "@/lib/constants/notebook-payments";
import { formatCurrency } from "@/lib/utils/format";
import {
  activityEventLabel,
  formatCompactDateTime,
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
  { id: "wallet", label: "Wallet" },
  { id: "reversals", label: "Reversals" },
] as const;

const CORRECTION_FIELD_ORDER = [
  "customer",
  "entryType",
  "playerCount",
  "amount",
] as const;

interface CustomerActivityTimelineProps {
  customerId: string;
  events: CustomerActivityEventDTO[];
  canReverseSettlements?: boolean;
  fullHeight?: boolean;
}

export function CustomerActivityTimeline({
  customerId,
  events,
  canReverseSettlements = false,
  fullHeight = false,
}: CustomerActivityTimelineProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("activity") ?? "all";
  const [reverseSettlementId, setReverseSettlementId] = useState<string | null>(
    null
  );
  const [correctionHistoryEvent, setCorrectionHistoryEvent] =
    useState<CustomerActivityEventDTO | null>(null);
  const [reversalReason, setReversalReason] =
    useState<NotebookReversalReasonKey>("WRONG_AMOUNT");
  const [reversalReasonOther, setReversalReasonOther] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await reverseNotebookSettlement(formData);
      if (result.success) {
        setReverseSettlementId(null);
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

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col border border-gray-200 bg-white",
        fullHeight && "min-h-[calc(100vh-72px)]"
      )}
    >
      <div className="shrink-0 border-b border-gray-100 px-2 py-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Activity
        </p>
        <div className="mt-0.5 flex flex-wrap gap-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-2 py-px text-[10px] font-medium",
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

      <ul
        className={cn(
          "flex-1 divide-y divide-gray-100 overflow-y-auto",
          fullHeight ? "max-h-[calc(100vh-110px)]" : "max-h-80"
        )}
      >
        {events.length === 0 ? (
          <li className="px-2 py-3 text-[11px] text-gray-500">No activity yet.</li>
        ) : (
          events.map((event) => {
            const isReversal = event.kind === "SETTLEMENT_REVERSAL";
            const label = activityEventLabel(event);
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

            return (
              <li
                key={event.id}
                className={cn(
                  "px-2 py-0.5",
                  isReversal && "bg-amber-50/90",
                  hasCorrections && "bg-amber-50/40"
                )}
              >
                <div
                  className={cn(
                    "flex items-start gap-2 text-[11px] leading-tight",
                    hasCorrections && "cursor-pointer"
                  )}
                  onClick={() => {
                    if (hasCorrections && event.corrections?.length) {
                      setCorrectionHistoryEvent(event);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      hasCorrections &&
                      event.corrections?.length &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      setCorrectionHistoryEvent(event);
                    }
                  }}
                  role={hasCorrections ? "button" : undefined}
                  tabIndex={hasCorrections ? 0 : undefined}
                >
                  <span className="w-[72px] shrink-0 font-mono text-[9px] text-gray-400">
                    {formatCompactDateTime(event.timestamp)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {!hasCorrections && (
                      <span
                        className={cn(
                          "block truncate font-medium",
                          isReversal ? "text-amber-900" : "text-gray-800"
                        )}
                      >
                        {event.contributionAmount != null
                          ? `${label} · Contribution ${formatCurrency(event.contributionAmount)}`
                          : label}
                      </span>
                    )}
                    {sortedCorrections.map((change) => (
                      <CorrectionChangeLine
                        key={change.field}
                        from={change.fromLabel}
                        to={change.toLabel}
                        className="text-[11px]"
                      />
                    ))}
                    {hasCorrections && (
                      <div className="mt-0.5">
                        <EntryCorrectionBadge />
                      </div>
                    )}
                  </div>
                  {event.amount != null && !hasCorrections && (
                    <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                      {formatCurrency(event.amount)}
                    </span>
                  )}
                  <span className="hidden w-16 shrink-0 truncate text-right text-[9px] text-gray-400 sm:inline">
                    {event.staffUsername}
                  </span>
                </div>
                {event.reversalReason && (
                  <p className="ml-[80px] truncate text-[9px] text-amber-800">
                    {event.reversalReason}
                  </p>
                )}
                {event.contributionPaymentMethod &&
                  event.kind === "COUNTER_ENTRY" && (
                    <p className="ml-[80px] text-[9px] text-gray-500">
                      Method: {event.contributionPaymentMethod}
                    </p>
                  )}
                {canReverseSettlements &&
                  event.kind === "SETTLEMENT" &&
                  event.settlementId &&
                  event.paymentMethod !== "WALLET" && (
                    <button
                      type="button"
                      className="ml-[80px] text-[9px] font-medium text-emerald-700 hover:underline"
                      onClick={() => setReverseSettlementId(event.settlementId!)}
                    >
                      Reverse
                    </button>
                  )}
              </li>
            );
          })
        )}
      </ul>

      {correctionHistoryEvent && (
        <CorrectionHistoryDialog
          corrections={correctionHistoryEvent.corrections}
          onClose={() => setCorrectionHistoryEvent(null)}
        />
      )}

      {reverseSettlementId && (
        <Dialog
          open
          onClose={() => setReverseSettlementId(null)}
          title="Reverse Settlement"
        >
          <div className="space-y-2">
            <div>
              <Label htmlFor="settlement-reversal-reason">Reason</Label>
              <select
                id="settlement-reversal-reason"
                value={reversalReason}
                onChange={(e) =>
                  setReversalReason(e.target.value as NotebookReversalReasonKey)
                }
                className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
              >
                {NOTEBOOK_REVERSAL_REASONS.map((reason) => (
                  <option key={reason.key} value={reason.key}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            {reversalReason === "OTHER" && (
              <div>
                <Label htmlFor="settlement-reversal-other">Details</Label>
                <Input
                  id="settlement-reversal-other"
                  value={reversalReasonOther}
                  onChange={(e) => setReversalReasonOther(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}
            {state?.error && (
              <p className="text-xs text-red-600">{state.error}</p>
            )}
            <Button
              type="button"
              variant="danger"
              fullWidth
              size="sm"
              disabled={
                isPending ||
                (reversalReason === "OTHER" &&
                  reversalReasonOther.trim().length < 3)
              }
              onClick={() => {
                const formData = new FormData();
                formData.set("settlementId", reverseSettlementId);
                formData.set("reversalReason", reversalReason);
                if (reversalReason === "OTHER") {
                  formData.set("reversalReasonOther", reversalReasonOther);
                }
                formAction(formData);
              }}
            >
              {isPending ? "Reversing..." : "Confirm Reverse"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
