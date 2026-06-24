"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { checkoutHrefForSession } from "@/lib/utils/checkout-navigation";
import {
  formatClockTime,
  formatDurationMinutes,
  formatTimeRange,
} from "@/lib/utils/session-timer";
import {
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/utils/table-session-history";
import type { TableSessionHistoryDTO } from "@/types";
import { cn } from "@/lib/utils/cn";

interface SessionHistoryRowProps {
  row: TableSessionHistoryDTO;
}

export function SessionHistoryRow({ row }: SessionHistoryRowProps) {
  const customerLabel =
    row.customerNames.length > 0 ? row.customerNames.join(", ") : null;

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            {formatTimeRange(row.startedAt, row.endedAt)}
          </p>
          <p className="text-gray-600">{row.displayLabel}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
            row.paymentStatus === "PAID" && "bg-emerald-100 text-emerald-800",
            row.paymentStatus === "PENDING" && "bg-blue-100 text-blue-800",
            row.paymentStatus === "REVERSED" && "bg-amber-100 text-amber-800"
          )}
        >
          {paymentStatusLabel(row.paymentStatus)}
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-600">
        <span>Duration</span>
        <span className="text-right font-medium text-gray-900">
          {formatDurationMinutes(row.activePlayMs)}
        </span>
        <span>Game</span>
        <span className="text-right tabular-nums text-gray-900">
          {formatCurrency(row.gameAmount)}
        </span>
        <span>Cafe</span>
        <span className="text-right tabular-nums text-gray-900">
          {formatCurrency(row.cafeAmount)}
        </span>
        <span className="font-semibold text-gray-800">Total</span>
        <span className="text-right font-bold tabular-nums text-gray-900">
          {formatCurrency(row.totalAmount)}
        </span>
      </div>

      {row.paymentEvents.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-gray-200/80 pt-2">
          {row.paymentEvents.map((event, index) =>
            event.kind === "paid" ? (
              <p key={`${event.at}-paid-${index}`} className="text-gray-700">
                Paid {formatCurrency(event.amount ?? row.totalAmount)}{" "}
                {paymentMethodLabel(event.paymentMethod)}
                <span className="text-gray-500">
                  {" "}
                  {formatClockTime(event.at)}
                </span>
                {event.customerName ? (
                  <span className="text-gray-600">
                    {" "}
                    · {event.customerName}
                  </span>
                ) : null}
              </p>
            ) : (
              <p
                key={`${event.at}-rev-${index}`}
                className="font-medium text-amber-800"
              >
                Reversed {formatClockTime(event.at)}
              </p>
            )
          )}
        </div>
      ) : customerLabel ? (
        <p className="mt-2 text-gray-700">
          {row.paymentStatus === "PENDING"
            ? `Pending · ${customerLabel}`
            : `Paid by ${customerLabel}`}
        </p>
      ) : row.paymentStatus === "PENDING" ? (
        <p className="mt-2 text-gray-700">Pending</p>
      ) : null}

      {row.paymentStatus === "PENDING" && (
        <Link
          href={checkoutHrefForSession(row.sessionId)}
          className="mt-2 inline-block font-semibold text-blue-800 hover:underline"
        >
          Pay in Checkout →
        </Link>
      )}
    </div>
  );
}
