"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type {
  CustomerActivityCountLineDTO,
  CustomerActivityItemDTO,
} from "@/types";

/** Mockup palette */
const GREEN = "#2E7D32";
const BLUE = "#1976D2";
const RED = "#B71C1C";

type TimelineMode = "ALL_ACTIVITY" | "BALANCE_HISTORY";

interface CustomerActivityTimelineProps {
  items: CustomerActivityItemDTO[];
}

function formatCountLine(line: CustomerActivityCountLineDTO): string {
  return `${line.label} ×${line.quantity} (${formatCurrency(line.amount)})`;
}

function formatDisplayDate(date: string): string {
  return formatBusinessDayDate(date).toUpperCase();
}

/**
 * Events that changed Outstanding. Extensible for future reversals/adjustments.
 */
function affectsOutstandingBalance(item: CustomerActivityItemDTO): boolean {
  switch (item.kind) {
    case "OPENING_OUTSTANDING":
    case "OUTSTANDING_COLLECTED":
    case "OUTSTANDING_PARTIALLY_COLLECTED":
    case "MISSED_PAYMENT":
    case "OUTSTANDING_CORRECTION":
      return true;
    case "BUSINESS_DAY_SUMMARY":
      return (item.businessDaySummary?.todaysDue ?? 0) > 0;
    default:
      return false;
  }
}

function IconArrowDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 3v9M4.5 8.5 8 12l3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 13V4M4.5 7.5 8 4l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="2"
        y="5"
        width="16"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="2"
        y="5"
        width="16"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconGames({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="2"
        y="6"
        width="16"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 10.5h2M8 9.5v2M13 10h.01M15 11.5h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCafe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 8h10v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14 9h1.5a2 2 0 0 1 0 4H14"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 4.5c.5.5.5 1 0 1.5M9.5 4c.5.5.5 1.2 0 1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconExternal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10M9 2h5v5M14 2 7 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BalanceStrip({
  previous,
  current,
}: {
  previous: number;
  current: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded bg-[#F5F5F5] px-2.5 py-1.5 text-[11px] text-[#616161]">
      <span>
        Previous Outstanding{" "}
        <span className="font-semibold tabular-nums text-[#212121]">
          {formatCurrency(previous)}
        </span>
      </span>
      <span className="text-[#9E9E9E]" aria-hidden>
        →
      </span>
      <span>
        Current Outstanding{" "}
        <span className="font-bold tabular-nums" style={{ color: RED }}>
          {formatCurrency(current)}
        </span>
      </span>
    </div>
  );
}

function TimelineMarker({
  tone,
}: {
  tone: "charge" | "collect" | "outstanding";
}) {
  const background =
    tone === "charge" ? GREEN : tone === "outstanding" ? "#E65100" : BLUE;
  const showUp = tone === "charge";
  return (
    <div className="relative z-[1] flex w-4 shrink-0 justify-center">
      <div
        className="flex h-4 w-4 items-center justify-center rounded-full text-white shadow-sm"
        style={{ backgroundColor: background }}
      >
        {showUp ? (
          <IconArrowUp className="h-2.5 w-2.5" />
        ) : (
          <IconArrowDown className="h-2.5 w-2.5" />
        )}
      </div>
    </div>
  );
}

function TimelineMeta({
  date,
  caption,
  time,
}: {
  date: string;
  caption?: string;
  time?: string;
}) {
  return (
    <div className="w-[5.25rem] shrink-0 pt-0.5 text-right sm:w-[6rem]">
      <time className="block text-[11px] font-bold uppercase leading-tight tracking-wide text-gray-800">
        {formatDisplayDate(date)}
      </time>
      {caption ? (
        <p className="mt-0.5 text-[10px] leading-tight text-gray-500">
          {caption}
        </p>
      ) : null}
      {time ? (
        <p className="mt-0.5 text-[10px] leading-tight text-gray-400">
          {formatBusinessDayTime(time)}
        </p>
      ) : null}
    </div>
  );
}

function DayStatusBadge({
  paidInFull,
  todaysDue,
}: {
  paidInFull: boolean;
  todaysDue: number;
}) {
  if (paidInFull) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <span aria-hidden>✓</span>
        Paid in Full
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#B71C1C]">
      <span aria-hidden>⚠</span>
      Outstanding {formatCurrency(todaysDue)}
    </span>
  );
}

function PaymentMethodDot({
  kind,
}: {
  kind: "cash" | "gpay";
}) {
  const className =
    kind === "gpay" ? "bg-sky-600" : "bg-emerald-600";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      aria-hidden
    />
  );
}

function CorrectionCard({ item }: { item: CustomerActivityItemDTO }) {
  const isMissed = item.kind === "MISSED_PAYMENT";
  const amount = item.amount ?? 0;
  const title = isMissed ? "Missed Payment" : "Outstanding Correction";
  const border = isMissed ? "border-sky-200" : "border-amber-200";
  const titleColor = isMissed ? "text-sky-800" : "text-amber-900";

  return (
    <div className="relative flex gap-2.5">
      <TimelineMeta date={item.timestamp} time={item.timestamp} />

      <TimelineMarker tone={isMissed ? "collect" : "outstanding"} />

      <article
        className={`min-w-0 flex-1 overflow-hidden rounded-[10px] border bg-white shadow-sm shadow-gray-900/5 ${border}`}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <h3
            className={`text-[11px] font-semibold uppercase tracking-wide ${titleColor}`}
          >
            {title}
          </h3>
          <p
            className={`shrink-0 text-[13px] font-semibold tabular-nums ${titleColor}`}
          >
            {formatCurrency(amount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 py-2">
          {isMissed ? (
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-gray-500">
                Payment Method
              </p>
              <p className="text-[13px] font-semibold text-gray-900">
                {item.paymentMethodLabel ?? "—"}
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-gray-500">Type</p>
              <p className="text-[13px] font-semibold text-gray-900">
                Not a payment
              </p>
            </div>
          )}
          {item.sectionLabel ? (
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-gray-500">Section</p>
              <p className="text-[13px] font-semibold text-gray-900">
                {item.sectionLabel}
              </p>
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] leading-tight text-gray-500">
              Affected Date
            </p>
            <p
              className="text-[13px] font-semibold text-gray-900"
              title={item.businessDayPublicId}
            >
              {item.businessDate
                ? formatBusinessDayDate(item.businessDate)
                : "—"}
            </p>
          </div>
        </div>

        {item.reason ? (
          <div className="px-3 pb-1">
            <p className="text-[11px] leading-tight text-gray-500">Reason</p>
            <p className="text-[12px] text-gray-800">{item.reason}</p>
          </div>
        ) : null}

        {item.createdBy ? (
          <p className="px-3 pb-2 text-[11px] text-gray-500">
            Recorded by {item.createdBy}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function CollectionCard({ item }: { item: CustomerActivityItemDTO }) {
  const collected = item.amount ?? 0;
  const previous = item.previousOutstanding ?? collected;
  const current = item.outstandingBalance ?? Math.max(0, previous - collected);

  return (
    <div className="relative flex gap-2.5">
      <TimelineMeta date={item.timestamp} time={item.timestamp} />

      <TimelineMarker tone="collect" />

      <article className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-sky-200 bg-white shadow-sm shadow-gray-900/5">
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
            Outstanding Collected
          </h3>
          <p className="shrink-0 text-[13px] font-semibold tabular-nums text-sky-800">
            Collected {formatCurrency(collected)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 py-2">
          <div className="flex items-start gap-1.5">
            <IconCash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" />
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-gray-500">
                Collected Amount
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-sky-800">
                − {formatCurrency(collected)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <IconCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" />
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-gray-500">
                Payment Method
              </p>
              <p className="truncate text-[13px] font-semibold text-gray-900">
                {item.paymentMethodLabel ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 pb-2">
          <BalanceStrip previous={previous} current={current} />
        </div>
      </article>
    </div>
  );
}

const OPENING_AMBER = "#E65100";

function OpeningOutstandingCard({ item }: { item: CustomerActivityItemDTO }) {
  const opening = item.openingOutstanding;
  const amount = opening?.amount ?? item.amount ?? 0;
  const previous = item.previousOutstanding ?? 0;
  const current = item.outstandingBalance ?? previous + amount;
  const effectiveDate = opening?.effectiveDate;
  const reason = opening?.reason;
  const createdBy = opening?.createdBy ?? item.createdBy ?? "—";

  return (
    <div className="relative flex gap-2.5">
      <TimelineMeta date={item.timestamp} time={item.timestamp} />

      <TimelineMarker tone="outstanding" />

      <article className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-orange-200 bg-white shadow-sm shadow-gray-900/5">
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <h3
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: OPENING_AMBER }}
          >
            Opening Outstanding
          </h3>
          <p
            className="shrink-0 text-[13px] font-semibold tabular-nums"
            style={{ color: OPENING_AMBER }}
          >
            +{formatCurrency(amount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-[11px] leading-tight text-gray-500">Amount</p>
            <p
              className="text-[13px] font-semibold tabular-nums"
              style={{ color: OPENING_AMBER }}
            >
              {formatCurrency(amount)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] leading-tight text-gray-500">
              Effective Date
            </p>
            <p className="text-[13px] font-semibold text-gray-900">
              {effectiveDate ? formatDisplayDate(effectiveDate) : "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] leading-tight text-gray-500">Created By</p>
            <p className="truncate text-[13px] font-semibold text-gray-900">
              {createdBy}
            </p>
          </div>
        </div>

        {reason ? (
          <div className="px-3 pb-1">
            <p className="text-[11px] leading-tight text-gray-500">Reason</p>
            <p className="text-[12px] text-gray-800">{reason}</p>
          </div>
        ) : null}

        <div className="px-3 pb-2">
          <BalanceStrip previous={previous} current={current} />
        </div>
      </article>
    </div>
  );
}

function BusinessDayPaymentSummary({
  summary,
}: {
  summary: NonNullable<CustomerActivityItemDTO["businessDaySummary"]>;
}) {
  const payment = summary.paymentSummary;
  const allRows: Array<{
    key: "cash" | "gpay";
    label: string;
    amount: number;
  }> = [
    { key: "cash", label: "Cash", amount: payment.cash },
    { key: "gpay", label: "GPay", amount: payment.gpay },
  ];
  const rows = allRows.filter((row) => row.amount > 0);

  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-gray-400">No payments recorded</p>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center gap-1.5 text-[15px] font-semibold tabular-nums text-gray-900"
        >
          <PaymentMethodDot kind={row.key} />
          <span>
            {row.label}{" "}
            <span className="tabular-nums">{formatCurrency(row.amount)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function BusinessDayClosedCard({ item }: { item: CustomerActivityItemDTO }) {
  const summary = item.businessDaySummary;
  if (!summary || !item.businessDayId) return null;

  const displayDate = item.businessDate ?? item.timestamp;
  const hasGames = summary.games.length > 0;
  const hasCafe = summary.cafe.length > 0;
  const paidInFull = summary.todaysDue <= 0;
  const paidAmount = summary.todaysPayment;

  return (
    <div className="relative flex gap-2.5">
      <TimelineMeta
        date={displayDate}
        caption="Business Day Closed"
        time={item.timestamp}
      />

      <TimelineMarker tone={paidInFull ? "charge" : "outstanding"} />

      <article className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-sm shadow-gray-900/5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 pt-2.5">
          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800">
            Business Day Closed
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <DayStatusBadge
              paidInFull={paidInFull}
              todaysDue={summary.todaysDue}
            />
            <Link
              href={`/business-day/history/${item.businessDayId}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-emerald-700/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
            >
              View Business Day
              <IconExternal className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 px-3 py-2.5 sm:grid-cols-2 md:grid-cols-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1 text-gray-400">
              <IconGames className="h-3.5 w-3.5" />
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Games
              </p>
            </div>
            {hasGames ? (
              <ul className="space-y-0.5 text-[15px] font-semibold leading-snug text-gray-900">
                {summary.games.map((line) => (
                  <li key={line.label} className="truncate">
                    {formatCountLine(line)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-gray-400">No Games</p>
            )}
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1 text-gray-400">
              <IconCafe className="h-3.5 w-3.5" />
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Cafe
              </p>
            </div>
            {hasCafe ? (
              <ul className="space-y-0.5 text-[15px] font-semibold leading-snug text-gray-900">
                {summary.cafe.map((line) => (
                  <li key={line.label} className="truncate">
                    {formatCountLine(line)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-gray-400">No Cafe Orders</p>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-gray-500">Today&apos;s Bill</span>
              <span className="text-[15px] font-semibold tabular-nums text-gray-900">
                {formatCurrency(summary.todaysBill)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-gray-500">Paid</span>
              <span className="text-[15px] font-semibold tabular-nums text-gray-900">
                {formatCurrency(paidAmount)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-gray-500">Today&apos;s Due</span>
              <span
                className={`text-[15px] font-semibold tabular-nums ${
                  paidInFull ? "text-gray-900" : "text-[#B71C1C]"
                }`}
              >
                {formatCurrency(summary.todaysDue)}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Payment Summary
            </p>
            <BusinessDayPaymentSummary summary={summary} />
          </div>
        </div>
      </article>
    </div>
  );
}

export function CustomerActivityTimeline({
  items,
}: CustomerActivityTimelineProps) {
  const [mode, setMode] = useState<TimelineMode>("ALL_ACTIVITY");

  const balanceHistoryItems = useMemo(
    () => items.filter(affectsOutstandingBalance),
    [items]
  );

  const visibleItems =
    mode === "ALL_ACTIVITY" ? items : balanceHistoryItems;

  const allCount = items.length;
  const balanceCount = balanceHistoryItems.length;

  return (
    <div className="flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[12px] border border-gray-200 bg-white shadow-sm shadow-gray-900/5">
      <div className="border-b border-gray-100 px-3 pt-3 sm:px-4">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-emerald-900">
          Customer Timeline
        </h2>
        <div
          className="mt-2 flex gap-4"
          role="tablist"
          aria-label="Timeline mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "ALL_ACTIVITY"}
            onClick={() => setMode("ALL_ACTIVITY")}
            className={
              mode === "ALL_ACTIVITY"
                ? "border-b-2 border-emerald-700 pb-2 text-[13px] font-semibold text-emerald-900"
                : "border-b-2 border-transparent pb-2 text-[13px] font-medium text-gray-500 hover:text-gray-800"
            }
          >
            All Activity ({allCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "BALANCE_HISTORY"}
            onClick={() => setMode("BALANCE_HISTORY")}
            className={
              mode === "BALANCE_HISTORY"
                ? "border-b-2 border-emerald-700 pb-2 text-[13px] font-semibold text-emerald-900"
                : "border-b-2 border-transparent pb-2 text-[13px] font-medium text-gray-500 hover:text-gray-800"
            }
          >
            Balance History ({balanceCount})
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-2 py-2.5 sm:px-3">
        {visibleItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            {mode === "ALL_ACTIVITY"
              ? "No activity yet."
              : "No balance changes yet."}
          </p>
        ) : (
          <ul className="relative space-y-2">
            <div
              className="pointer-events-none absolute bottom-2 top-2 w-px bg-gray-200 left-[calc(5.25rem+0.625rem+0.5rem)] sm:left-[calc(6rem+0.625rem+0.5rem)]"
              aria-hidden
            />
            {visibleItems.map((item) => (
              <li key={item.id} className="relative">
                {item.kind === "BUSINESS_DAY_SUMMARY" ? (
                  <BusinessDayClosedCard item={item} />
                ) : item.kind === "OPENING_OUTSTANDING" ? (
                  <OpeningOutstandingCard item={item} />
                ) : item.kind === "MISSED_PAYMENT" ||
                  item.kind === "OUTSTANDING_CORRECTION" ? (
                  <CorrectionCard item={item} />
                ) : (
                  <CollectionCard item={item} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {visibleItems.length > 0 && (
        <div className="flex items-start gap-2 border-t border-sky-100 bg-sky-50/70 px-3 py-1.5 text-[11px] text-sky-800">
          <span
            className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[9px] font-bold text-white"
            aria-hidden
          >
            i
          </span>
          <p>
            {mode === "ALL_ACTIVITY"
              ? "All Activity shows every visit. Switch to Balance History for Outstanding changes only."
              : "Balance History shows only events that changed Outstanding."}
          </p>
        </div>
      )}
    </div>
  );
}
