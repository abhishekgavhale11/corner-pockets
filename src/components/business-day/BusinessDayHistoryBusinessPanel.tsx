"use client";

import { useState, type ReactNode } from "react";
import { BusinessDayHistoryList } from "@/components/business-day/BusinessDayHistoryList";
import { BusinessDayHistoryRangeCorrections } from "@/components/business-day/BusinessDayHistoryRangeCorrections";
import { formatCurrency } from "@/lib/utils/format";
import type {
  BusinessDayHistoryListItemDTO,
  BusinessDayHistorySectionSummaryDTO,
  BusinessDayHistorySummaryDTO,
  FinancialCorrectionHistoryRowDTO,
} from "@/types";

interface BusinessDayHistoryBusinessPanelProps {
  summary: BusinessDayHistorySummaryDTO;
  items: BusinessDayHistoryListItemDTO[];
  corrections: FinancialCorrectionHistoryRowDTO[];
  from: string;
  to: string;
}

type MetricKind = "revenue" | "collection" | "cash" | "gpay" | "outstanding";

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V9M10 19V5M16 19v-7M22 19H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPie({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5A8.5 8.5 0 1 0 20.5 12H12V3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 3.5V12h8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18M16.5 14.5h.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2"
        y="6"
        width="20"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="7"
        y="2.5"
        width="10"
        height="19"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M10 6h4M11 18h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 4.5 7v5.2c0 4.3 3.1 7.4 7.5 8.3 4.4-.9 7.5-4 7.5-8.3V7L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDoc({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGamepad({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 8h10a5 5 0 0 1 0 10H7a5 5 0 0 1 0-10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 13h3M10 11.5v3M16 12.5h.01M17.5 14h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const KIND: Record<
  MetricKind,
  { wrap: string; text: string; icon: ReactNode }
> = {
  revenue: {
    wrap: "bg-violet-100 text-violet-700",
    text: "text-violet-700",
    icon: <IconChart className="h-3.5 w-3.5" />,
  },
  collection: {
    wrap: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-700",
    icon: <IconWallet className="h-3.5 w-3.5" />,
  },
  cash: {
    wrap: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-700",
    icon: <IconCash className="h-3.5 w-3.5" />,
  },
  gpay: {
    wrap: "bg-sky-100 text-sky-700",
    text: "text-sky-700",
    icon: <IconPhone className="h-3.5 w-3.5" />,
  },
  outstanding: {
    wrap: "bg-orange-100 text-orange-600",
    text: "text-orange-600",
    icon: <IconShield className="h-3.5 w-3.5" />,
  },
};

function SectionHead({
  icon,
  iconClass,
  title,
  subtitle,
  trailing,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-tight text-gray-900">
            {title}
          </h2>
          <p className="text-[12px] text-gray-500">{subtitle}</p>
        </div>
      </div>
      {trailing}
    </div>
  );
}

function SummaryMetric({
  kind,
  label,
  value,
}: {
  kind: MetricKind;
  label: string;
  value: number;
}) {
  const style = KIND[kind];
  return (
    <div className="rounded-[10px] border border-gray-100 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${style.wrap}`}
        >
          {style.icon}
        </span>
        <p className="text-[12px] font-medium text-gray-500">{label}</p>
      </div>
      <p
        className={`mt-2 text-[22px] font-bold tabular-nums tracking-tight ${style.text}`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function SnookerTable({
  big,
  pool,
  total,
}: {
  big: BusinessDayHistorySectionSummaryDTO;
  pool: BusinessDayHistorySectionSummaryDTO;
  total: BusinessDayHistorySectionSummaryDTO;
}) {
  const rows: {
    kind: MetricKind | "frames";
    label: string;
    values: [number, number, number];
    money?: boolean;
  }[] = [
    {
      kind: "revenue",
      label: "Revenue",
      values: [big.bill, pool.bill, total.bill],
      money: true,
    },
    {
      kind: "collection",
      label: "Collection",
      values: [big.received, pool.received, total.received],
      money: true,
    },
    {
      kind: "cash",
      label: "Cash",
      values: [big.cashCollection, pool.cashCollection, total.cashCollection],
      money: true,
    },
    {
      kind: "gpay",
      label: "GPay",
      values: [big.gpayCollection, pool.gpayCollection, total.gpayCollection],
      money: true,
    },
    {
      kind: "outstanding",
      label: "Outstanding Created",
      values: [
        big.outstandingCreated,
        pool.outstandingCreated,
        total.outstandingCreated,
      ],
      money: true,
    },
    {
      kind: "frames",
      label: "Frames / Games",
      values: [big.gamesPlayed, pool.gamesPlayed, total.gamesPlayed],
    },
  ];

  return (
    <div className="min-w-0 overflow-x-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-2 py-1.5 font-semibold"> </th>
            <th className="hidden px-2 py-1.5 font-semibold md:table-cell">
              Big Snooker
            </th>
            <th className="hidden px-2 py-1.5 font-semibold md:table-cell">
              Pool & Mini
            </th>
            <th className="rounded-t-md bg-emerald-50/80 px-2 py-1.5 font-semibold text-emerald-800">
              Total Snooker
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const icon =
              row.kind === "frames" ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                  <IconGamepad className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${KIND[row.kind].wrap}`}
                >
                  {KIND[row.kind].icon}
                </span>
              );
            const valueClass =
              row.kind === "frames"
                ? "text-gray-900"
                : KIND[row.kind].text;
            return (
              <tr key={row.label} className="border-t border-gray-100">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-[13px] font-medium text-gray-700">
                      {row.label}
                    </span>
                  </div>
                </td>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.label}-${index}`}
                    className={`px-2 py-2 text-[13px] font-semibold tabular-nums ${valueClass} ${
                      index < 2 ? "hidden md:table-cell" : ""
                    } ${index === 2 ? "bg-emerald-50/80" : ""}`}
                  >
                    {row.money ? formatCurrency(value) : value}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BusinessDayHistoryBusinessPanel({
  summary,
  items,
  corrections,
}: BusinessDayHistoryBusinessPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const { overall, bigSnooker, poolMini, totalSnooker, cafe, cafeSalesBreakdown } =
    summary.insights;

  const cafeMetrics: { kind: MetricKind; label: string; value: number }[] = [
    { kind: "revenue", label: "Revenue", value: cafe.bill },
    { kind: "collection", label: "Collection", value: cafe.received },
    { kind: "cash", label: "Cash", value: cafe.cashCollection },
    { kind: "gpay", label: "GPay", value: cafe.gpayCollection },
    {
      kind: "outstanding",
      label: "Outstanding Created",
      value: cafe.outstandingCreated,
    },
  ];

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-[12px] border border-gray-200 bg-white shadow-sm shadow-gray-900/5">
        <div className="p-4">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-controls="business-history-details"
            className="w-full text-left"
          >
            <SectionHead
              icon={<IconPie className="h-4 w-4" />}
              iconClass="bg-violet-100 text-violet-700"
              title="Business Summary"
              subtitle="Overall performance for the selected period"
              trailing={<Chevron open={expanded} />}
            />
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <SummaryMetric
              kind="revenue"
              label="Revenue"
              value={overall.totalRevenue}
            />
            <SummaryMetric
              kind="collection"
              label="Collection"
              value={overall.totalReceived}
            />
            <SummaryMetric
              kind="cash"
              label="Cash"
              value={overall.cashCollection}
            />
            <SummaryMetric
              kind="gpay"
              label="GPay"
              value={overall.gpayCollection}
            />
            <SummaryMetric
              kind="outstanding"
              label="Outstanding Created"
              value={overall.outstandingCreated}
            />
          </div>
        </div>

        <div
          id="business-history-details"
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-gray-100 px-4 pb-4 pt-3">
              <SectionHead
                icon={<IconDoc className="h-4 w-4" />}
                iconClass="bg-emerald-100 text-emerald-700"
                title="Business Details"
                subtitle="Breakdown of business performance"
              />

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="rounded-[10px] border border-gray-100 p-3">
                  <SnookerTable
                    big={bigSnooker}
                    pool={poolMini}
                    total={totalSnooker}
                  />
                </div>

                <div className="rounded-[10px] border border-orange-100 bg-orange-50/50 p-3">
                  <h3 className="mb-2 text-[13px] font-semibold text-gray-900">
                    Cafe
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cafeMetrics.map((metric) => {
                      const style = KIND[metric.kind];
                      return (
                        <div key={metric.kind} className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${style.wrap}`}
                            >
                              {style.icon}
                            </span>
                            <p className="truncate text-[11px] text-gray-500">
                              {metric.label}
                            </p>
                          </div>
                          <p
                            className={`mt-0.5 text-[14px] font-bold tabular-nums ${style.text}`}
                          >
                            {formatCurrency(metric.value)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 text-orange-600">
                      <IconBag className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[12px] text-gray-500">Orders</p>
                    <p className="ml-auto text-[14px] font-bold tabular-nums text-gray-900">
                      {cafe.gamesPlayed}
                    </p>
                  </div>
                  <div className="mt-3 border-t border-orange-100 pt-2.5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Cafe Sales Breakdown
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <p className="text-[12px] text-gray-600">
                        Cigarette:{" "}
                        <span className="font-semibold tabular-nums text-gray-900">
                          {formatCurrency(cafeSalesBreakdown.cigarette)}
                        </span>
                      </p>
                      <p className="text-[12px] text-gray-600">
                        Water:{" "}
                        <span className="font-semibold tabular-nums text-gray-900">
                          {formatCurrency(cafeSalesBreakdown.water)}
                        </span>
                      </p>
                      <p className="text-[12px] text-gray-600">
                        Food & Beverages:{" "}
                        <span className="font-semibold tabular-nums text-gray-900">
                          {formatCurrency(cafeSalesBreakdown.foodAndBeverages)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BusinessDayHistoryRangeCorrections corrections={corrections} />

      <BusinessDayHistoryList items={items} />

      <p className="flex items-center justify-center gap-1.5 pb-1 text-center text-[11px] text-gray-400">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[9px] font-bold">
          i
        </span>
        All values are corrected with financial adjustments and reflect actual
        business performance.
      </p>
    </div>
  );
}
