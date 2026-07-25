"use client";

import {
  formatCafeLineExpanded,
  formatCafeTabSummary,
  type CafeOpenTab,
  type CafeTabLine,
} from "@/lib/utils/cafe-tabs";
import { formatCurrency } from "@/lib/utils/format";
import { framePaidAmount } from "@/lib/utils/frame-payment";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { CustomerPreviewNameButton } from "@/components/counter/CustomerPreviewContext";
import { HistoryPaymentStatusCell } from "@/components/business-day/HistoryPaymentStatusCell";

interface CafeCustomerTabsProps {
  tabs: CafeOpenTab[];
  expandedId: string | null;
  onToggleExpand: (tabKey: string | null) => void;
  onAddItem: (tab: CafeOpenTab) => void;
  onEdit: (tab: CafeOpenTab) => void;
}

function tabTitle(tab: CafeOpenTab): string {
  return tab.kind === "customer" ? tab.customerName : tab.tableName;
}

function tabAmount(tab: CafeOpenTab): number {
  return tab.kind === "table" ? tab.cafeTotal : tab.total;
}

function linePaymentTotals(line: CafeTabLine): {
  paidAmount: number;
  paymentMethod?: "CASH" | "GPAY" | "WALLET";
} {
  let paidAmount = 0;
  let paymentMethod: "CASH" | "GPAY" | "WALLET" | undefined;
  for (const entry of line.entries) {
    paidAmount += framePaidAmount(entry.paidAmount);
    if (!paymentMethod && (entry.paymentMethod === "CASH" || entry.paymentMethod === "GPAY")) {
      paymentMethod = entry.paymentMethod;
    }
  }
  return { paidAmount, paymentMethod };
}

export function CafeCustomerTabs({
  tabs,
  expandedId,
  onToggleExpand,
  onAddItem,
  onEdit,
}: CafeCustomerTabsProps) {
  if (tabs.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-gray-500">
        No open tabs. Use + Existing Customer, + New Customer, or + Table Tab.
      </p>
    );
  }

  return (
    <ul className="grid gap-0.5 md:grid-cols-2">
      {tabs.map((tab) => {
        const expanded = expandedId === tab.tabKey;

        return (
          <li
            key={tab.tabKey}
            className={cn(
              "border bg-white",
              expanded ? "border-emerald-500" : "border-gray-200",
              tab.kind === "table" && !expanded && "border-l-2 border-l-amber-400"
            )}
          >
            {tab.kind === "customer" ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onToggleExpand(expanded ? null : tab.tabKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggleExpand(expanded ? null : tab.tabKey);
                  }
                }}
                className={cn(
                  "w-full px-1.5 py-1 text-left leading-tight",
                  expanded ? "bg-emerald-50/80" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className="min-w-0 flex-1"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <CustomerPreviewNameButton
                      customerId={tab.customerId}
                      customerName={tabTitle(tab)}
                      className="w-full truncate text-[15px]"
                    />
                  </span>
                  <span className="shrink-0 text-[14px] font-bold tabular-nums text-gray-900">
                    {formatCurrency(tabAmount(tab))}
                  </span>
                </div>
                <p className="truncate text-[11px] text-gray-600">
                  {tab.lines.length > 0
                    ? formatCafeTabSummary(tab.lines)
                    : "No items yet"}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onToggleExpand(expanded ? null : tab.tabKey)}
                className={cn(
                  "w-full px-1.5 py-1 text-left leading-tight",
                  expanded ? "bg-emerald-50/80" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[15px] font-bold text-gray-900">
                    {tabTitle(tab)}
                  </span>
                  <span className="shrink-0 text-[14px] font-bold tabular-nums text-gray-900">
                    {formatCurrency(tabAmount(tab))}
                  </span>
                </div>
                <p className="truncate text-[11px] text-gray-600">
                  {tab.lines.length > 0
                    ? formatCafeTabSummary(tab.lines)
                    : "No cafe items yet"}
                </p>
              </button>
            )}

            {expanded && (
              <div className="border-t border-gray-200 px-1.5 py-1">
                <div className="mb-1 flex items-baseline justify-between gap-1">
                  <span className="truncate text-sm font-bold text-gray-900">
                    {tabTitle(tab)}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {formatCurrency(tabAmount(tab))}
                  </span>
                </div>

                {tab.kind === "table" && (
                  <div className="mb-1 space-y-0 text-[11px] text-gray-700">
                    <div className="flex justify-between gap-2">
                      <span>Game</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(tab.gameTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Cafe</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(tab.cafeTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-gray-100 pt-0.5 font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatCurrency(tab.grandTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {tab.lines.length > 0 && (
                  <ul className="space-y-0.5">
                    {tab.lines.map((line) => {
                      const payment = linePaymentTotals(line);
                      return (
                        <li
                          key={line.lineKey}
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[12px] leading-snug"
                        >
                          <span className="min-w-0 truncate text-gray-800">
                            {formatCafeLineExpanded(line)}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                            {formatCurrency(line.amount)}
                          </span>
                          <span className="shrink-0 text-right">
                            <HistoryPaymentStatusCell
                              amount={line.amount}
                              paidAmount={payment.paidAmount}
                              paymentMethod={payment.paymentMethod}
                            />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-1.5 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 flex-1 px-2 text-[11px] font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddItem(tab);
                    }}
                  >
                    Add Item
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 flex-1 px-2 text-[11px] font-semibold"
                    disabled={tab.entries.length === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(tab);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
