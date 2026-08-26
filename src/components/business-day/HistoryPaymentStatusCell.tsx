import type { ReactNode } from "react";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { formatCurrency } from "@/lib/utils/format";
import { frameDueAmount, framePaidAmount } from "@/lib/utils/frame-payment";
import { HistoryPaymentReceiptMeta } from "@/components/business-day/HistoryPaymentReceiptMeta";
import { HistoryIconCash } from "@/components/business-day/history/icons";
import type { NotebookPaymentAllocationDTO } from "@/types";

type AllocationLine = {
  paymentMethod: NotebookPaymentMethod;
  amount: number;
};

function MethodIcon({
  method,
  className,
}: {
  method: NotebookPaymentMethod;
  className?: string;
}) {
  if (method === "CASH") {
    return <HistoryIconCash className={className ?? "h-3 w-3"} />;
  }
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-600 text-[8px] font-black leading-none text-white ${className ?? ""}`}
      aria-hidden
    >
      G
    </span>
  );
}

function methodBadgeClass(method: NotebookPaymentMethod): string {
  return method === "CASH"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : "bg-sky-50 text-sky-700 ring-sky-100";
}

function positiveAllocations(
  paymentAllocations?: NotebookPaymentAllocationDTO[]
): AllocationLine[] {
  if (!paymentAllocations?.length) return [];
  return paymentAllocations.filter(
    (row): row is AllocationLine =>
      (row.paymentMethod === "CASH" || row.paymentMethod === "GPAY") &&
      row.amount > 0
  );
}

function cellShell(compact: boolean, children: ReactNode) {
  return (
    <div
      className={
        compact
          ? "flex w-full min-w-0 flex-col items-stretch text-left"
          : "inline-flex w-full min-w-0 max-w-[13rem] flex-col items-stretch text-left sm:ml-auto"
      }
    >
      {children}
    </div>
  );
}

/** Read-only payment cell for History (and compact Counter cafe tabs). */
export function HistoryPaymentStatusCell({
  amount,
  paidAmount,
  paymentMethod,
  paymentAllocations,
  receivedByUsername,
  receivedAt,
  showReceiptMeta = true,
  compact = false,
}: {
  amount: number;
  paidAmount?: number;
  paymentMethod?: NotebookPaymentMethod;
  paymentAllocations?: NotebookPaymentAllocationDTO[];
  receivedByUsername?: string;
  receivedAt?: string;
  /** History surfaces show receipt lines; Counter cafe tabs omit them. */
  showReceiptMeta?: boolean;
  /** Narrow table cards: no min-width, shorter receipt labels. */
  compact?: boolean;
}) {
  const paid = framePaidAmount(paidAmount);
  const due = frameDueAmount(amount, paid);
  const allocations = positiveAllocations(paymentAllocations);

  const receipt = showReceiptMeta ? (
    <HistoryPaymentReceiptMeta
      receivedByUsername={receivedByUsername}
      receivedAt={receivedAt}
      showPlaceholders
      compact={compact}
    />
  ) : null;

  if (due > 0) {
    return cellShell(
      compact,
      <>
        <div
          className={
            compact
              ? "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5"
              : undefined
          }
        >
          <span className="inline-flex w-fit max-w-full items-center rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700 ring-1 ring-orange-100">
            Outstanding
          </span>
          <p
            className={
              compact
                ? "text-[10px] font-semibold tabular-nums text-orange-800"
                : "mt-1 text-[10px] font-semibold tabular-nums text-orange-800"
            }
          >
            Due: {formatCurrency(due)}
          </p>
        </div>
        {receipt}
      </>
    );
  }

  if (allocations.length >= 2) {
    return cellShell(
      compact,
      <>
        <span className="inline-flex w-fit max-w-full items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
          Split Payment
        </span>
        <ul className="mt-1 space-y-0.5">
          {allocations.map((row, index) => (
            <li
              key={`${row.paymentMethod}-${index}`}
              className="flex min-w-0 items-center justify-between gap-1 text-[10px] leading-tight"
            >
              <span className="inline-flex min-w-0 items-center gap-1 font-medium text-gray-800">
                <MethodIcon
                  method={row.paymentMethod}
                  className={
                    row.paymentMethod === "CASH"
                      ? "h-3 w-3 shrink-0 text-emerald-700"
                      : undefined
                  }
                />
                <span className="truncate">
                  {paymentMethodLabel(row.paymentMethod)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-gray-900">
                {formatCurrency(row.amount)}
              </span>
            </li>
          ))}
        </ul>
        {receipt ? (
          <div className="my-1 border-t border-dashed border-gray-200" />
        ) : null}
        {receipt}
      </>
    );
  }

  const singleMethod: NotebookPaymentMethod | undefined =
    allocations[0]?.paymentMethod ?? paymentMethod;

  if (singleMethod) {
    return cellShell(
      compact,
      <>
        <span
          className={`inline-flex w-fit max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${methodBadgeClass(singleMethod)}`}
        >
          <MethodIcon
            method={singleMethod}
            className={
              singleMethod === "CASH" ? "h-3 w-3 text-emerald-700" : undefined
            }
          />
          {paymentMethodLabel(singleMethod)}
        </span>
        {receipt}
      </>
    );
  }

  return cellShell(
    compact,
    <>
      <span className="inline-flex w-fit max-w-full items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
        Paid
      </span>
      {receipt}
    </>
  );
}

/** Compact PAID / OUTSTANDING badge for History status column. */
export function HistoryPaidStatusBadge({
  amount,
  paidAmount,
}: {
  amount: number;
  paidAmount?: number;
}) {
  const due = frameDueAmount(amount, framePaidAmount(paidAmount));
  if (due > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 ring-1 ring-orange-100">
        Outstanding
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
      Paid
    </span>
  );
}
