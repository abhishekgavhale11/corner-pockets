"use client";

import { useState } from "react";
import { historyUi } from "@/components/business-day/history";
import {
  AdjustmentActivityCard,
  CorrectionsAuditFooter,
  IconShieldCheck,
} from "@/components/business-day/history/CorrectionsAdjustmentsUi";
import { formatCurrency } from "@/lib/utils/format";
import type { FinancialCorrectionHistoryRowDTO } from "@/types";

interface BusinessDayHistoryRangeCorrectionsProps {
  corrections: FinancialCorrectionHistoryRowDTO[];
}

export function BusinessDayHistoryRangeCorrections({
  corrections,
}: BusinessDayHistoryRangeCorrectionsProps) {
  const [expanded, setExpanded] = useState(false);

  const missedPayments = corrections
    .filter((row) => row.type === "MISSED_PAYMENT")
    .reduce((sum, row) => sum + row.amount, 0);
  const outstandingCorrections = corrections
    .filter((row) => row.type === "OUTSTANDING_CORRECTION")
    .reduce((sum, row) => sum + row.amount, 0);
  const countLabel =
    corrections.length === 1
      ? "1 correction record"
      : `${corrections.length} correction records`;
  const canExpand = corrections.length > 0;

  return (
    <section className={`${historyUi.card} overflow-hidden`}>
      <button
        type="button"
        onClick={() => {
          if (!canExpand) return;
          setExpanded((open) => !open);
        }}
        disabled={!canExpand}
        aria-expanded={expanded}
        aria-controls="business-history-corrections-details"
        className={`w-full px-4 py-3 text-left ${
          canExpand ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
              <IconShieldCheck className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold tracking-tight text-gray-900">
                Corrections & Adjustments
              </h2>
              <p className="mt-0.5 text-[12px] text-gray-500">{countLabel}</p>
            </div>
          </div>
          {canExpand ? (
            <span className="shrink-0 text-[12px] font-semibold text-emerald-800">
              {expanded ? "Hide Details" : "View Details"}
            </span>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-orange-50 px-3 py-2">
            <p className="text-[11px] font-medium text-orange-800/80">
              Missed Payments
            </p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-orange-700">
              {formatCurrency(missedPayments)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-medium text-emerald-800/80">
              Outstanding Corrections
            </p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-emerald-800">
              {formatCurrency(outstandingCorrections)}
            </p>
          </div>
        </div>
      </button>

      <div
        id="business-history-corrections-details"
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {corrections.length > 0 ? (
            <div className="space-y-2.5 px-4 pb-3">
              <AdjustmentActivityCard
                corrections={corrections}
                customerHrefFor={(row) => `/customers/${row.customerId}`}
                affectedDayHrefFor={(row) =>
                  `/business-day/history/${row.affectedBusinessDayId}`
                }
              />
              <CorrectionsAuditFooter />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
