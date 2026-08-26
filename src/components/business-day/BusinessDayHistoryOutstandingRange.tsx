import { OutstandingCollectionLedger } from "@/components/business-day/OutstandingCollectionLedger";
import { ClubOutstandingTrendChart } from "@/components/business-day/ClubOutstandingTrendChart";
import { historyUi } from "@/components/business-day/history";
import { formatCurrency } from "@/lib/utils/format";
import type { OutstandingHistoryTabDTO } from "@/types";

interface BusinessDayHistoryOutstandingRangeProps {
  data: OutstandingHistoryTabDTO;
}

const METRICS = [
  {
    key: "opening",
    label: "Opening Club Outstanding",
    hint: "Club Outstanding immediately before the selected date range began.",
    wrap: "bg-slate-50/90",
    accent: "bg-slate-300",
    labelClass: "text-slate-600",
    valueClass: "text-slate-900",
    field: "openingOutstanding",
  },
  {
    key: "created",
    label: "Outstanding Created",
    wrap: "bg-indigo-50/80",
    accent: "bg-indigo-300",
    labelClass: "text-indigo-700/80",
    valueClass: "text-indigo-900",
    field: "outstandingCreated",
  },
  {
    key: "collected",
    label: "Outstanding Collected",
    wrap: "bg-emerald-50/80",
    accent: "bg-emerald-300",
    labelClass: "text-emerald-700/80",
    valueClass: "text-emerald-800",
    field: "outstandingPaid",
  },
  {
    key: "current",
    label: "Current Club Outstanding",
    wrap: "bg-orange-50/80",
    accent: "bg-orange-300",
    labelClass: "text-orange-700/80",
    valueClass: "text-orange-800",
    field: "currentClubOutstanding",
  },
] as const;

export function BusinessDayHistoryOutstandingRange({
  data,
}: BusinessDayHistoryOutstandingRangeProps) {
  const { movement, series } = data;

  return (
    <div className="space-y-3">
      <section className={`${historyUi.card} overflow-hidden`}>
        <div className="grid grid-cols-2 border-b border-gray-100 sm:grid-cols-4">
          {METRICS.map((metric, index) => (
            <div
              key={metric.key}
              title={"hint" in metric ? metric.hint : undefined}
              className={`px-3 py-2.5 sm:px-4 ${metric.wrap} ${
                index > 0 ? "border-l border-l-white/80" : ""
              }`}
            >
              <div className={`mb-2 h-[3px] w-8 rounded-full ${metric.accent}`} />
              <p
                className={`text-[11px] font-medium leading-tight ${metric.labelClass}`}
              >
                {metric.label}
              </p>
              <p
                className={`mt-1 text-[18px] font-bold tabular-nums tracking-tight sm:text-[22px] ${metric.valueClass}`}
              >
                {formatCurrency(movement[metric.field])}
              </p>
              {"hint" in metric ? (
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  {metric.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <p className="border-b border-gray-100 bg-gray-50/70 px-4 py-2 text-[12px] leading-relaxed text-gray-600">
          {formatCurrency(movement.openingOutstanding)}
          {" + "}
          {formatCurrency(movement.outstandingCreated)}
          {" − "}
          {formatCurrency(movement.outstandingPaid)}
          {" = "}
          <span className="font-semibold text-orange-800">
            {formatCurrency(movement.currentClubOutstanding)}
          </span>
          <span className="mt-0.5 block text-[11px] text-gray-500">
            Opening Club Outstanding + Outstanding Created − Outstanding
            Collected = Current Club Outstanding
          </span>
        </p>

        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-[16px] font-semibold tracking-tight text-gray-900">
            Club Outstanding
          </h2>
          <p className="mt-0.5 text-[12px] text-gray-500">
            Daily running outstanding balance. Each point is the closing
            balance for that date, not the range opening.
          </p>
        </div>

        <div className="px-3 py-3 sm:px-4 sm:py-4">
          {series.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-gray-500">
              No calendar days in this date range.
            </div>
          ) : (
            <ClubOutstandingTrendChart series={series} />
          )}
        </div>
      </section>

      <OutstandingCollectionLedger ledger={data.ledger} />
    </div>
  );
}
