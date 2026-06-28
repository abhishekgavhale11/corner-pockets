"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { reverseTransaction } from "@/actions/transactions";
import {
  REVERSAL_REASONS,
  type ReversalReasonKey,
} from "@/lib/constants/reversal-reasons";
import { formatActivityTimeParts } from "@/lib/utils/activity-display";
import { formatLedgerAmount } from "@/lib/utils/customer-ledger-display";
import type { CustomerLedgerLineDTO } from "@/types";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface CustomerFinancialHistoryProps {
  customerId: string;
  lines: CustomerLedgerLineDTO[];
  fullHeight?: boolean;
  canReverseRecharges?: boolean;
}

export function CustomerFinancialHistory({
  customerId,
  lines,
  fullHeight = false,
  canReverseRecharges = false,
}: CustomerFinancialHistoryProps) {
  const router = useRouter();
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

  const chronological = [...lines].reverse().filter((line) => line.id !== "opening");

  const rowGridClass =
    "grid grid-cols-[3.25rem_minmax(0,1fr)_4rem_5.5rem] items-start gap-x-2 sm:grid-cols-[3.25rem_minmax(0,1fr)_4.25rem_5.5rem_3rem]";

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
        <p className="mt-0.5 text-[11px] text-gray-500">
          Games, cafe, payments &amp; running balance
        </p>
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
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Balance</span>
          <span className="hidden sm:inline" />
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {chronological.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-gray-500">
              No activity yet.
            </li>
          ) : (
            chronological.map((line) => {
              const { date, time } = formatActivityTimeParts(line.timestamp);
              const canReverse =
                canReverseRecharges &&
                line.canReverseRecharge &&
                line.transactionId;

              return (
                <li
                  key={line.id}
                  className="border-b border-gray-100 px-3 py-1.5 hover:bg-gray-50/80"
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
                    <div className="min-w-0">
                      <p
                        className="text-xs font-medium text-gray-800"
                        title={line.description}
                      >
                        {line.description}
                      </p>
                      <p className="truncate text-[10px] text-gray-400">
                        {line.staffUsername}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-right text-xs font-bold tabular-nums",
                        line.amount > 0 && "text-emerald-700",
                        line.amount < 0 && "text-red-700",
                        line.amount === 0 && "text-gray-500"
                      )}
                    >
                      {formatLedgerAmount(line.amount)}
                    </span>
                    <span className="text-right text-[10px] font-medium leading-snug text-gray-800">
                      {line.balanceLabel}
                    </span>
                    <span className="hidden text-right sm:block">
                      {canReverse && (
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-emerald-700 hover:underline"
                          onClick={() =>
                            setReverseTransactionId(line.transactionId!)
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
