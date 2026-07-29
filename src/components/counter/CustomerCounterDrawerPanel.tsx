"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CashGpaySegmentedControl,
  type PaymentModeOption,
} from "@/components/ui/CashGpaySegmentedControl";
import { Button } from "@/components/ui/Button";
import {
  markCustomerRemainingAsPaid,
  type MarkRemainingPaymentInput,
} from "@/components/counter/mark-customer-remaining-paid";
import {
  CAFE_ITEM_TYPE_LABELS,
  isQtyCafeItemType,
  type CafeItemType,
} from "@/lib/constants/cafe";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { formatCurrency } from "@/lib/utils/format";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { frameDueFromParts } from "@/lib/utils/frame-payment";
import type { CafeOrderDTO, CafeOrderItemDTO } from "@/lib/mappers/cafe-order";
import type { NotebookEntryDTO } from "@/types";
import type { CustomerCounterDrawerDTO } from "@/types";

function entryTableLabel(entry: NotebookEntryDTO): string {
  if (entry.section === "CAFE") {
    return entry.tableId ? sectionLabel(entry.tableId) : "—";
  }
  return sectionLabel(entry.section);
}

/**
 * Status cell: payment mode when fully paid, remaining due when money is owed.
 * Matches Counter Due-column rules. Never shows ₹0 for a fully paid line.
 * Display only — Due is already computed in getCustomerCounterDrawer for totals.
 */
function PaymentStatusCell({
  amount,
  paidAmount,
  balanceCollectedAmount,
  paymentMethod,
}: {
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  paymentMethod?: "CASH" | "GPAY";
}) {
  const due = frameDueFromParts(amount, paidAmount, balanceCollectedAmount);

  if (due <= 0) {
    if (paymentMethod === "CASH") {
      return (
        <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-50">
          {paymentMethodLabel("CASH")}
        </span>
      );
    }
    if (paymentMethod === "GPAY") {
      return (
        <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold text-blue-800 bg-blue-50">
          {paymentMethodLabel("GPAY")}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold text-emerald-700">Paid</span>
    );
  }

  return (
    <span className="text-[12px] font-bold tabular-nums text-orange-700">
      {formatCurrency(due)}
    </span>
  );
}

function lineAmountsForCustomer(
  entry: NotebookEntryDTO,
  customerId: string
): {
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  paymentMethod?: NotebookEntryDTO["paymentMethod"];
} {
  const contributor = entry.contributors?.find(
    (row) => row.customerId === customerId
  );
  if (contributor) {
    return {
      amount: contributor.amount,
      paidAmount: contributor.paidAmount,
      balanceCollectedAmount: contributor.balanceCollectedAmount,
      paymentMethod: contributor.paymentMethod ?? entry.paymentMethod,
    };
  }
  return {
    amount: entry.amount,
    paidAmount: entry.paidAmount,
    balanceCollectedAmount: entry.balanceCollectedAmount,
    paymentMethod: entry.paymentMethod,
  };
}

/** Same labels as Cafe Counter item cards. */
function cafeOrderItemLabel(item: CafeOrderItemDTO): string {
  const type = item.type as CafeItemType;
  if (isQtyCafeItemType(type)) {
    const base = CAFE_ITEM_TYPE_LABELS[type];
    const qty = item.quantity ?? 0;
    return qty > 1 ? `${base} ×${qty}` : base;
  }
  return item.description?.trim() || CAFE_ITEM_TYPE_LABELS[type];
}

function CafeOrderRows({ order }: { order: CafeOrderDTO }) {
  const items = order.items ?? [];
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <tr
            key={`${order.id}-${item.id || index}`}
            className="border-b border-gray-100 last:border-0"
          >
            <td className="py-1.5 pr-1 font-medium text-gray-700 truncate">
              Cafe
            </td>
            <td className="px-1 py-1.5 font-medium text-gray-800 truncate">
              {cafeOrderItemLabel(item)}
            </td>
            <td className="px-1 py-1.5 text-right tabular-nums text-gray-800">
              {formatCurrency(item.amount)}
            </td>
            <td className="py-1.5 pl-1 text-right">
              {isLast ? (
                <PaymentStatusCell
                  amount={order.amount}
                  paidAmount={order.received}
                  paymentMethod={order.paymentMethod}
                />
              ) : null}
            </td>
          </tr>
        );
      })}
    </>
  );
}

export function CustomerCounterDrawerPanel({
  summary,
  onPaymentComplete,
}: {
  summary: CustomerCounterDrawerDTO;
  onPaymentComplete?: () => void;
}) {
  const hasCafe = summary.todaysCafeOrders.length > 0;
  const hasDue = summary.totalDue > 0;
  const [paymentMode, setPaymentMode] = useState<PaymentModeOption | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canMarkPaid = hasDue && paymentMode !== "" && !isPending;

  useEffect(() => {
    setPaymentMode("");
    setError(null);
  }, [summary.customerId, summary.totalDue]);

  const handlePaymentModeChange = (mode: PaymentModeOption) => {
    setPaymentMode(mode);
    setError(null);
  };

  const handleMarkRemainingAsPaid = () => {
    if (!canMarkPaid) return;

    const payment: MarkRemainingPaymentInput = {
      paymentMode,
    };

    setError(null);
    startTransition(async () => {
      const result = await markCustomerRemainingAsPaid(summary, payment);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPaymentComplete?.();
    });
  };

  return (
    <div className="text-left pr-5">
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-gray-950">
          {summary.customerName}
        </p>
        <p className="text-[11px] text-gray-500">Today&apos;s Summary</p>
      </div>

      <dl className="mt-3 grid gap-1.5 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Today&apos;s Bill</dt>
          <dd className="font-semibold tabular-nums text-gray-950">
            {formatCurrency(summary.todaysBill)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Total Received</dt>
          <dd className="font-semibold tabular-nums text-emerald-800">
            {formatCurrency(summary.totalReceived)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Total Due</dt>
          <dd className="font-semibold tabular-nums text-orange-700">
            {formatCurrency(summary.totalDue)}
          </dd>
        </div>
      </dl>

      <section className="mt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Today&apos;s Frames
        </h3>
        {summary.todaysFrames.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">No frames today</p>
        ) : (
          <table className="mt-1 w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[30%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
            </colgroup>
            <tbody>
              {summary.todaysFrames.map((entry) => {
                const line = lineAmountsForCustomer(entry, summary.customerId);
                return (
                  <tr key={entry.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-1 font-medium text-gray-700 truncate">
                      {entryTableLabel(entry)}
                    </td>
                    <td className="px-1 py-1.5 font-medium text-gray-800 truncate">
                      {getEntryDisplayLabel(entry)}
                    </td>
                    <td className="px-1 py-1.5 text-right tabular-nums text-gray-800">
                      {formatCurrency(line.amount)}
                    </td>
                    <td className="py-1.5 pl-1 text-right">
                      <PaymentStatusCell
                        amount={line.amount}
                        paidAmount={line.paidAmount}
                        balanceCollectedAmount={line.balanceCollectedAmount}
                        paymentMethod={line.paymentMethod}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Today&apos;s Cafe
        </h3>
        {!hasCafe ? (
          <p className="mt-1 text-xs text-gray-400">No cafe items today</p>
        ) : (
          <table className="mt-1 w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[30%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
            </colgroup>
            <tbody>
              {summary.todaysCafeOrders.map((order) => (
                <CafeOrderRows key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {hasDue ? (
        <section className="mt-4 space-y-3 border-t border-gray-200 pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Payment Method
            </p>
            <CashGpaySegmentedControl
              idPrefix="customer-drawer-pay"
              value={paymentMode}
              onChange={handlePaymentModeChange}
              disabled={isPending}
              size="sm"
              className="mt-1.5"
            />
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <Button
            type="button"
            fullWidth
            onClick={handleMarkRemainingAsPaid}
            disabled={!canMarkPaid}
          >
            {isPending ? "Applying…" : "Mark Remaining as Paid"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
