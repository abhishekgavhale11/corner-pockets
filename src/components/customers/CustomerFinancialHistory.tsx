"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { reverseTransaction } from "@/actions/transactions";
import {
  REVERSAL_REASONS,
  type ReversalReasonKey,
} from "@/lib/constants/reversal-reasons";
import { formatActivityTimeParts } from "@/lib/utils/activity-display";
import {
  formatLedgerAmountForKind,
  ledgerEventKindLabel,
  ledgerLineAmountClass,
  ledgerLineDescriptionClass,
  ledgerLineRowClass,
  ledgerOutstandingClass,
} from "@/lib/utils/customer-ledger-display";
import type { CustomerLedgerLineDTO } from "@/types";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatCurrency } from "@/lib/utils/format";

interface CustomerFinancialHistoryProps {
  customerId: string;
  lines: CustomerLedgerLineDTO[];
  fullHeight?: boolean;
  canReverseRecharges?: boolean;
  currentUsername?: string;
}

export function CustomerFinancialHistory({
  customerId,
  lines,
  fullHeight = false,
  canReverseRecharges = false,
  currentUsername,
}: CustomerFinancialHistoryProps) {
  const router = useRouter();
  const [reverseTransactionId, setReverseTransactionId] = useState<
    string | null
  >(null);
  const [reversalReason, setReversalReason] =
    useState<ReversalReasonKey>("WRONG_AMOUNT");
  const [reversalReasonOther, setReversalReasonOther] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
    "grid grid-cols-[3.25rem_minmax(0,1fr)_4.25rem_5.5rem_3rem] items-start gap-x-2.5";

  const datedRows: Array<
    { type: "separator"; key: string; label: string } | { type: "line"; line: CustomerLedgerLineDTO }
  > = [];
  let lastDateKey: string | null = null;
  for (const line of chronological) {
    const date = new Date(line.timestamp);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (dateKey !== lastDateKey) {
      datedRows.push({
        type: "separator",
        key: dateKey,
        label: date.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      });
      lastDateKey = dateKey;
    }
    datedRows.push({ type: "line", line });
  }

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
          Ledger story: charges, payments, and status events
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] font-medium uppercase tracking-wide text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Charge
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Payment
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Status
          </span>
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
          <span>Description</span>
          <span className="pr-3 text-right text-xs font-bold uppercase tracking-wide">
            Amount
          </span>
          <span className="pl-3 text-right text-xs font-bold uppercase tracking-wide">
            Outstanding
          </span>
          <span />
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {chronological.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-gray-500">
              No activity yet.
            </li>
          ) : (
            datedRows.map((row) => {
              if (row.type === "separator") {
                return (
                  <li
                    key={`date-${row.key}`}
                    className="sticky top-0 z-[1] border-y border-gray-200 bg-gray-50/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 backdrop-blur"
                  >
                    {row.label}
                  </li>
                );
              }

              const line = row.line;
              const { date, time } = formatActivityTimeParts(line.timestamp);
              const canReverse =
                canReverseRecharges &&
                line.canReverseRecharge &&
                line.transactionId;
              const isExpanded = expandedRows.has(line.id);
              const showStaffInline =
                isExpanded ||
                (line.staffUsername &&
                  line.staffUsername !== "—" &&
                  line.staffUsername !== currentUsername);

              return (
                <li
                  key={line.id}
                  className={cn(
                    "border-b border-gray-100 px-3 py-1.5 transition-colors hover:bg-gray-100/70",
                    ledgerLineRowClass(line.kind)
                  )}
                  onClick={() =>
                    setExpandedRows((prev) => {
                      const next = new Set(prev);
                      if (next.has(line.id)) next.delete(line.id);
                      else next.add(line.id);
                      return next;
                    })
                  }
                >
                  <div className={rowGridClass}>
                    <span className="leading-tight">
                      <span className="block font-mono text-[11px] text-gray-600">
                        {time}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            line.kind === "charge" && "bg-red-500",
                            line.kind === "payment" && "bg-emerald-500",
                            line.kind === "status" && "bg-amber-500"
                          )}
                        />
                        <p
                          className={cn(
                            "min-w-0 truncate text-xs",
                            ledgerLineDescriptionClass(line.kind)
                          )}
                          title={line.description}
                        >
                          {line.description}
                        </p>
                      </div>
                      {showStaffInline ? (
                        <p className="truncate text-[10px] text-gray-400">
                          {line.staffUsername}
                        </p>
                      ) : null}
                      {isExpanded ? (
                        <p className="mt-0.5 text-[10px] text-gray-500">
                          {date}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "pr-3 text-right text-xs font-bold tabular-nums",
                        ledgerLineAmountClass(line.kind, line.amount)
                      )}
                    >
                      {formatLedgerAmountForKind(line.kind, line.amount)}
                    </span>
                    <span
                      className={cn(
                        "pl-3 text-right text-xs font-bold tabular-nums leading-snug",
                        ledgerOutstandingClass(line.outstandingBalance)
                      )}
                    >
                      {formatCurrency(line.outstandingBalance)}
                    </span>
                    <span className="text-right">
                      {canReverse && (
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-emerald-700 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setReverseTransactionId(line.transactionId!);
                          }}
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
