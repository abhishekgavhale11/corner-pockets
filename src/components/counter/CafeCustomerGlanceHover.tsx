"use client";

import Link from "next/link";
import {
  customerInitials,
  formatVisitGlanceCafeLine,
  formatVisitGlanceGameLine,
} from "@/lib/utils/customer-visit-glance";
import { checkoutHrefForCustomer } from "@/lib/utils/checkout-navigation";
import { formatCurrency } from "@/lib/utils/format";
import {
  buildVisitGlanceSummaryMetrics,
  type VisitGlanceSummaryMetric,
} from "@/lib/utils/counter-visit-display";
import type { CustomerVisitGlanceDTO } from "@/types";
import { cn } from "@/lib/utils/cn";

function formatVisitStartTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: VisitGlanceSummaryMetric) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums leading-none",
          tone === "paid" && "text-emerald-700",
          tone === "due" && "text-amber-700",
          tone === "outstanding" && "text-amber-700",
          tone === "finished" && "text-slate-700",
          tone === "default" && "text-gray-950"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CustomerVisitGlancePanel({
  glance,
  onClose,
}: {
  glance: CustomerVisitGlanceDTO;
  onClose?: () => void;
}) {
  const hasItems = glance.games.length > 0 || glance.cafe.length > 0;
  const visitFinished = glance.visitStatus === "FINISHED";
  const hasVisit =
    glance.visitStatus === "ACTIVE" || glance.visitStatus === "FINISHED";
  const showCheckout =
    glance.visitStatus === "ACTIVE" && glance.billTotal > 0;
  const summaryMetrics = buildVisitGlanceSummaryMetrics({
    visitStatus: glance.visitStatus,
    billTotal: glance.billTotal,
    paidAmount: glance.paidAmount,
    dueAmount: glance.dueAmount,
  });

  return (
    <div className="text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">
            {customerInitials(glance.customerName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-950">
              {glance.customerName}
            </p>
            {hasVisit && glance.visitStartedAt ? (
              <p className="truncate text-[11px] text-gray-500">
                {visitFinished ? "Finished visit" : "Active visit"} · Started{" "}
                {formatVisitStartTime(glance.visitStartedAt)}
                {visitFinished && glance.visitFinishedAt
                  ? ` · Finished ${formatVisitStartTime(glance.visitFinishedAt)}`
                  : ""}
              </p>
            ) : (
              <p className="text-[11px] text-gray-500">No visit today</p>
            )}
          </div>
        </div>
        {visitFinished ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            🔒 Finished
          </span>
        ) : hasVisit ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            Active visit
          </span>
        ) : null}
      </div>

      {hasVisit ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-gray-50/80 px-2 py-2.5">
            {summaryMetrics.map((metric) => (
              <SummaryMetric key={metric.label} {...metric} />
            ))}
          </div>

          {hasItems ? (
            <div className="mt-3 space-y-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Breakdown
              </p>

              {glance.games.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-gray-800">
                      Games
                    </span>
                    <span className="rounded-md bg-violet-50 px-2 py-0.5 text-sm font-bold tabular-nums text-violet-900">
                      {formatCurrency(
                        glance.games.reduce((sum, line) => sum + line.amount, 0)
                      )}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {glance.games.map((line) => (
                      <li
                        key={line.label}
                        className="flex items-baseline justify-between gap-2 text-[11px]"
                      >
                        <span className="min-w-0 truncate text-gray-600">
                          {formatVisitGlanceGameLine(line)}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                          {formatCurrency(line.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {glance.cafe.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-gray-800">
                      Cafe
                    </span>
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-900">
                      {formatCurrency(
                        glance.cafe.reduce((sum, line) => sum + line.amount, 0)
                      )}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {glance.cafe.map((line) => (
                      <li
                        key={line.lineKey}
                        className="flex items-baseline justify-between gap-2 text-[11px]"
                      >
                        <span className="min-w-0 truncate text-gray-600">
                          {formatVisitGlanceCafeLine(line)}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                          {formatCurrency(line.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-gray-500">
              No items on this visit yet.
            </p>
          )}

          {showCheckout || onClose ? (
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  Close
                </button>
              ) : (
                <span />
              )}
              {showCheckout ? (
                <Link
                  href={checkoutHrefForCustomer(glance.customerId)}
                  className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100"
                >
                  Checkout
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-3 text-[11px] text-gray-500">
            Assign a customer to start a visit bill.
          </p>
          {onClose ? (
            <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** @deprecated Use CustomerVisitGlancePanel */
export const CafeCustomerGlancePanel = CustomerVisitGlancePanel;
