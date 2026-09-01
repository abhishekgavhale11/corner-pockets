"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BusinessDayHistoryInsightCards } from "@/components/business-day/BusinessDayHistoryInsightCards";
import { BusinessDayHistoryOutstandingTab } from "@/components/business-day/BusinessDayHistoryOutstandingTab";
import { BusinessDayHistoryCorrections } from "@/components/business-day/BusinessDayHistoryCorrections";
import { BusinessDayHistoryPrintButton } from "@/components/business-day/BusinessDayHistoryPrintButton";
import {
  HistoryPaidStatusBadge,
  HistoryPaymentStatusCell,
} from "@/components/business-day/HistoryPaymentStatusCell";
import {
  POOL_MINI_SECTIONS,
  SNOOKER_TABLE_SECTIONS,
} from "@/lib/constants/counter-sections";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { buildDetailHistoryInsights } from "@/lib/business-day/history-insights-display";
import {
  sectionLabel,
  type NotebookSection,
} from "@/lib/constants/notebook-sections";
import { formatCurrency } from "@/lib/utils/format";
import type {
  BusinessDayHistoryCafeLineDTO,
  BusinessDayHistoryDetailDTO,
  BusinessDayHistoryFrameLineDTO,
  BusinessDayHistorySettlementRowDTO,
} from "@/types";

interface BusinessDayHistoryDetailProps {
  detail: BusinessDayHistoryDetailDTO;
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
] as const;

function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
}

function formatDuration(openedAt: string, closedAt?: string | null): string {
  if (!closedAt) return "";
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function SectionTitle({
  title,
  icon,
  accent = "emerald",
}: {
  title: string;
  icon: ReactNode;
  accent?: "emerald" | "sky" | "orange" | "violet" | "slate";
}) {
  const wrap =
    accent === "sky"
      ? "bg-sky-50 text-sky-700"
      : accent === "orange"
        ? "bg-orange-50 text-orange-600"
        : accent === "violet"
          ? "bg-violet-50 text-violet-700"
          : accent === "slate"
            ? "bg-slate-100 text-slate-700"
            : "bg-emerald-50 text-emerald-700";

  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${wrap}`}
      >
        {icon}
      </span>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-700">
        {title}
      </h2>
    </div>
  );
}

function FrameTableColumns({
  title,
  sections,
  frames,
  emptyAccent = "sky",
}: {
  title: string;
  sections: readonly NotebookSection[];
  frames: BusinessDayHistoryFrameLineDTO[];
  emptyAccent?: "sky" | "orange";
}) {
  const hasAny = frames.some((line) => sections.includes(line.section));
  const emptyBox =
    emptyAccent === "orange"
      ? "border-orange-100 bg-orange-50/60 text-orange-700"
      : "border-sky-100 bg-sky-50/60 text-sky-700";

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">
        {title}
      </h3>
      {!hasAny ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${emptyBox}`}
        >
          No games in this section.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {sections.map((section, index) => {
            const lines = frames.filter((line) => line.section === section);
            const tableTotal = lines.reduce((sum, line) => sum + line.amount, 0);

            return (
              <div
                key={section}
                className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3 py-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <h4 className="text-sm font-bold tracking-tight text-gray-900">
                    {sectionLabel(section)}
                  </h4>
                </div>

                {lines.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-gray-400">No frames</p>
                ) : (
                  <div className="min-w-0 overflow-x-hidden">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-gray-100 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                          <th className="px-2 py-2 text-left">Customer</th>
                          <th className="hidden px-1.5 py-2 text-left md:table-cell">
                            Type
                          </th>
                          <th className="px-1.5 py-2 text-right">Amount</th>
                          <th className="px-2 py-2 text-left">Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr
                            key={`${line.entryId}-${line.customerId ?? line.customerName}`}
                            className="border-b border-gray-50 last:border-0"
                          >
                            <td className="min-w-0 px-2 py-1.5 align-top">
                              {line.customerId ? (
                                <Link
                                  href={`/customers/${line.customerId}`}
                                  className="break-words font-semibold text-gray-900 hover:text-emerald-800 md:block md:truncate"
                                  title={line.customerName}
                                >
                                  {line.customerName}
                                </Link>
                              ) : (
                                <span
                                  className="break-words text-gray-500 md:block md:truncate"
                                  title={line.customerName}
                                >
                                  {line.customerName}
                                </span>
                              )}
                            </td>
                            <td className="hidden max-w-0 px-1.5 py-1.5 align-top md:table-cell">
                              <span
                                className="block truncate text-gray-700"
                                title={line.gameType}
                              >
                                {line.gameType}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-1.5 py-1.5 text-right align-top tabular-nums font-semibold text-gray-900">
                              {formatCurrency(line.amount)}
                            </td>
                            <td className="min-w-0 px-2 py-1.5 align-top">
                              <HistoryPaymentStatusCell
                                amount={line.amount}
                                paidAmount={line.paidAmount}
                                paymentMethod={line.paymentMethod}
                                paymentAllocations={line.paymentAllocations}
                                receivedByUsername={line.receivedByUsername}
                                receivedAt={line.receivedAt}
                                compact
                              />
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50/80">
                          <td className="px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Total
                          </td>
                          <td className="hidden md:table-cell" />
                          <td className="whitespace-nowrap px-1.5 py-2 text-right text-[11px] font-bold tabular-nums text-gray-900">
                            {formatCurrency(tableTotal)}
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CounterSnapshotSection({
  frames,
}: {
  frames: BusinessDayHistoryFrameLineDTO[];
}) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
      <SectionTitle
        title="Counter Snapshot"
        accent="slate"
        icon={
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect
              x="3"
              y="3"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="13"
              y="3"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="3"
              y="13"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <rect
              x="13"
              y="13"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        }
      />
      <div className="space-y-6">
        <FrameTableColumns
          title="Big Snooker (3 Tables)"
          sections={SNOOKER_TABLE_SECTIONS}
          frames={frames}
        />
        <FrameTableColumns
          title="Pool & Mini"
          sections={POOL_MINI_SECTIONS}
          frames={frames}
          emptyAccent="sky"
        />
      </div>
    </section>
  );
}

function CustomerSettlementSummary({
  settlements,
}: {
  settlements: BusinessDayHistorySettlementRowDTO[];
}) {
  const totals = settlements.reduce(
    (acc, row) => ({
      bigSnooker: acc.bigSnooker + row.bigSnooker,
      poolMini: acc.poolMini + row.poolMini,
      cafe: acc.cafe + row.cafe,
      bill: acc.bill + row.bill,
      cashCollection: acc.cashCollection + row.cashCollection,
      gpayCollection: acc.gpayCollection + row.gpayCollection,
      due: acc.due + row.due,
    }),
    {
      bigSnooker: 0,
      poolMini: 0,
      cafe: 0,
      bill: 0,
      cashCollection: 0,
      gpayCollection: 0,
      due: 0,
    }
  );

  const rows = [...settlements].sort((a, b) => {
    const aOutstanding = a.due > 0 ? 1 : 0;
    const bOutstanding = b.due > 0 ? 1 : 0;
    return bOutstanding - aOutstanding;
  });

  const sectionCol = "hidden md:table-cell";
  const moneyCell =
    "w-[1%] whitespace-nowrap px-1.5 py-2.5 text-right tabular-nums md:px-3 md:py-3";
  const dueCell = `${moneyCell} px-2 md:px-4`;

  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm sm:p-5">
      <SectionTitle
        title="Customer Settlement Summary"
        accent="violet"
        icon={
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
            <circle
              cx="16.5"
              cy="9"
              r="2.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M3.5 18c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4M13 18c.4-1.6 1.5-2.8 3.5-2.8 1.7 0 2.8 1 3.3 2.8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        }
      />
      {settlements.length === 0 ? (
        <p className="text-sm text-gray-400">
          No customer activity on this Business Day.
        </p>
      ) : (
        <div className="min-w-0 overflow-x-hidden rounded-xl border border-gray-100">
          <table className="w-full border-collapse text-[12px] md:text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                <th className="px-2 py-2.5 text-left md:px-4 md:py-3">
                  Customer
                </th>
                <th className={`${sectionCol} px-3 py-3 text-right`}>
                  Big Snooker
                </th>
                <th className={`${sectionCol} px-3 py-3 text-right`}>
                  Pool & Mini
                </th>
                <th className={`${sectionCol} px-3 py-3 text-right`}>Cafe</th>
                <th className={`${moneyCell} font-bold`}>Bill</th>
                <th className={`${moneyCell} font-bold`}>GPay</th>
                <th className={`${moneyCell} font-bold`}>Cash</th>
                <th className={`${dueCell} font-bold`}>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hasOutstanding = row.due > 0;
                return (
                  <tr
                    key={row.customerId}
                    className={
                      hasOutstanding
                        ? "border-b border-red-200 bg-red-50"
                        : "border-t border-gray-50 transition hover:bg-emerald-50/40"
                    }
                  >
                    <td className="min-w-0 px-2 py-2.5 md:px-4 md:py-3">
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="flex min-w-0 items-center gap-2 font-semibold text-gray-900 hover:text-emerald-800 md:gap-2.5"
                      >
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold md:h-7 md:w-7 md:text-[10px] ${avatarTone(row.customerId)}`}
                        >
                          {customerInitials(row.customerName)}
                        </span>
                        <span className="min-w-0 break-words">
                          {row.customerName}
                        </span>
                      </Link>
                    </td>
                    <td
                      className={`${sectionCol} ${moneyCell} text-gray-800`}
                    >
                      {formatCurrency(row.bigSnooker)}
                    </td>
                    <td
                      className={`${sectionCol} ${moneyCell} text-gray-800`}
                    >
                      {formatCurrency(row.poolMini)}
                    </td>
                    <td
                      className={`${sectionCol} ${moneyCell} text-gray-800`}
                    >
                      {formatCurrency(row.cafe)}
                    </td>
                    <td className={`${moneyCell} font-semibold text-gray-900`}>
                      {formatCurrency(row.bill)}
                    </td>
                    <td className={`${moneyCell} font-semibold text-sky-700`}>
                      {formatCurrency(row.gpayCollection)}
                    </td>
                    <td
                      className={`${moneyCell} font-semibold text-emerald-700`}
                    >
                      {formatCurrency(row.cashCollection)}
                    </td>
                    <td
                      className={`${dueCell} ${
                        hasOutstanding
                          ? "font-bold text-red-700"
                          : "font-semibold text-gray-400"
                      }`}
                    >
                      {formatCurrency(row.due)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-gray-200 bg-slate-50">
                <td className="px-2 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-600 md:px-4 md:py-3">
                  Total
                </td>
                <td
                  className={`${sectionCol} ${moneyCell} text-sm font-bold text-gray-900`}
                >
                  {formatCurrency(totals.bigSnooker)}
                </td>
                <td
                  className={`${sectionCol} ${moneyCell} text-sm font-bold text-gray-900`}
                >
                  {formatCurrency(totals.poolMini)}
                </td>
                <td
                  className={`${sectionCol} ${moneyCell} text-sm font-bold text-gray-900`}
                >
                  {formatCurrency(totals.cafe)}
                </td>
                <td className={`${moneyCell} text-sm font-bold text-gray-900`}>
                  {formatCurrency(totals.bill)}
                </td>
                <td className={`${moneyCell} text-sm font-bold text-sky-700`}>
                  {formatCurrency(totals.gpayCollection)}
                </td>
                <td
                  className={`${moneyCell} text-sm font-bold text-emerald-700`}
                >
                  {formatCurrency(totals.cashCollection)}
                </td>
                <td
                  className={`${dueCell} text-sm ${
                    totals.due > 0
                      ? "font-bold text-red-700"
                      : "font-bold text-gray-400"
                  }`}
                >
                  {formatCurrency(totals.due)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CafeSnapshotSection({
  cafe,
}: {
  cafe: BusinessDayHistoryCafeLineDTO[];
}) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
      <SectionTitle
        title="Cafe Snapshot"
        accent="orange"
        icon={
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 9h10v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M16 10h1.5A2.5 2.5 0 0 1 20 12.5v0A2.5 2.5 0 0 1 17.5 15H16M8 20h8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        }
      />
      {cafe.length === 0 ? (
        <p className="rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm text-orange-700">
          No cafe items on this Business Day.
        </p>
      ) : (
        <div className="min-w-0 overflow-x-hidden rounded-xl border border-gray-100">
          <table className="w-full border-collapse text-[12px] md:text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                <th className="px-2 py-2.5 text-left md:px-4 md:py-3">
                  Customer
                </th>
                <th className="hidden px-3 py-3 text-left md:table-cell">
                  Item
                </th>
                <th className="w-[1%] whitespace-nowrap px-1.5 py-2.5 text-right md:px-3 md:py-3">
                  Amount
                </th>
                <th className="hidden px-4 py-3 text-left md:table-cell">
                  Payment
                </th>
                <th className="w-[1%] px-2 py-2.5 text-right md:px-4 md:py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {cafe.map((line) => (
                <tr
                  key={`${line.entryId}-${line.customerId ?? line.customerName}`}
                  className="border-t border-gray-50 transition hover:bg-orange-50/30"
                >
                  <td className="min-w-0 px-2 py-2.5 md:px-4 md:py-3">
                    {line.customerId ? (
                      <Link
                        href={`/customers/${line.customerId}`}
                        className="break-words font-semibold text-gray-900 hover:text-emerald-800"
                      >
                        {line.customerName}
                      </Link>
                    ) : (
                      <span className="break-words text-gray-500">
                        {line.customerName}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-gray-700 md:table-cell">
                    {line.item}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-2.5 text-right tabular-nums font-semibold text-gray-900 md:px-3 md:py-3">
                    {formatCurrency(line.amount)}
                  </td>
                  <td className="hidden px-4 py-3 align-top md:table-cell">
                    <HistoryPaymentStatusCell
                      amount={line.amount}
                      paidAmount={line.paidAmount}
                      paymentMethod={line.paymentMethod}
                      paymentAllocations={line.paymentAllocations}
                      receivedByUsername={line.receivedByUsername}
                      receivedAt={line.receivedAt}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right align-top md:px-4 md:py-3">
                    <HistoryPaidStatusBadge
                      amount={line.amount}
                      paidAmount={line.paidAmount}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function BusinessDayHistoryDetail({
  detail,
}: BusinessDayHistoryDetailProps) {
  const { day } = detail;
  const insights = buildDetailHistoryInsights(detail);
  const duration = formatDuration(day.openedAt, day.closedAt);
  const [tab, setTab] = useState<"overview" | "outstanding">("overview");

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/business-day/history"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
          >
            ← Business History
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {detail.publicId}
            </h1>
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Closed
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {formatBusinessDayDate(detail.businessDate)} · Read-only snapshot as
            of close
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Opened {formatBusinessDayTime(day.openedAt)}
            {day.closedAt
              ? ` · Closed ${formatBusinessDayTime(day.closedAt)}`
              : ""}
            {duration ? ` · ${duration}` : ""}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Opened By
              </dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {day.openedBy || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Closed By
              </dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {day.closedBy || "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <BusinessDayHistoryPrintButton />
        </div>
      </div>

      <div
        className="flex gap-1 rounded-lg bg-gray-100 p-1 print:hidden"
        role="tablist"
        aria-label="Business Day History sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
          className={
            tab === "overview"
              ? "flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm"
              : "flex-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          }
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "outstanding"}
          onClick={() => setTab("outstanding")}
          className={
            tab === "outstanding"
              ? "flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm"
              : "flex-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          }
        >
          Outstanding
        </button>
      </div>

      {tab === "outstanding" ? (
        <BusinessDayHistoryOutstandingTab trend={detail.outstandingTrend} />
      ) : (
        <>
          <BusinessDayHistoryInsightCards insights={insights} />

          <BusinessDayHistoryCorrections
            publicId={detail.publicId}
            corrections={detail.corrections}
            originalSummary={detail.originalSummary}
          />

          <CustomerSettlementSummary settlements={detail.settlements} />

          <CounterSnapshotSection frames={detail.frames} />

          <CafeSnapshotSection cafe={detail.cafe} />

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-xs text-violet-800">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-200 text-[10px] font-bold">
                i
              </span>
              {detail.corrections.length > 0
                ? "Corrected totals are shown. Original close is in Corrections & Adjustments."
                : "All amounts are final as of the close of Business Day."}
            </span>
            <span className="font-medium">
              Figures are locked and cannot be edited.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
