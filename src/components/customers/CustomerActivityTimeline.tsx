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
    case "OUTSTANDING_COLLECTED":
    case "OUTSTANDING_PARTIALLY_COLLECTED":
      return true;
    case "BUSINESS_DAY_SUMMARY":
      return (item.businessDaySummary?.todaysDue ?? 0) > 0;
    default:
      // Future balance-changing kinds (reversals, adjustments) go here.
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

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 16c1.5-2.5 3.5-3.5 6-3.5s4.5 1 6 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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

function PaidInFullStatus() {
  return (
    <div className="rounded bg-[#E8F5E9] px-2.5 py-1.5 text-[11px] font-semibold text-[#2E7D32]">
      Status <span className="ml-1">✓ Paid in Full</span>
    </div>
  );
}

function TimelineMarker({ tone }: { tone: "charge" | "collect" }) {
  const isCharge = tone === "charge";
  return (
    <div className="relative z-[1] flex w-5 shrink-0 justify-center">
      <div
        className="flex h-5 w-5 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: isCharge ? GREEN : BLUE }}
      >
        {isCharge ? (
          <IconArrowUp className="h-3 w-3" />
        ) : (
          <IconArrowDown className="h-3 w-3" />
        )}
      </div>
    </div>
  );
}

function CollectionCard({ item }: { item: CustomerActivityItemDTO }) {
  const collected = item.amount ?? 0;
  const previous = item.previousOutstanding ?? collected;
  const current = item.outstandingBalance ?? Math.max(0, previous - collected);

  return (
    <div className="relative flex gap-2.5">
      <div className="w-[4.75rem] shrink-0 pt-0.5 text-right sm:w-[5.5rem]">
        <time className="block text-[10px] font-bold uppercase leading-tight tracking-wide text-[#424242]">
          {formatDisplayDate(item.timestamp)}
        </time>
        <p className="mt-0.5 text-[10px] leading-tight text-[#757575]">
          {formatBusinessDayTime(item.timestamp)}
        </p>
      </div>

      <TimelineMarker tone="collect" />

      <article className="min-w-0 flex-1 overflow-hidden rounded-md border border-[#BBDEFB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <h3
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: BLUE }}
          >
            Outstanding Collected
          </h3>
          <p
            className="shrink-0 text-xs font-bold tabular-nums"
            style={{ color: BLUE }}
          >
            Collected {formatCurrency(collected)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 px-3 py-2" style={{ color: BLUE }}>
          <div className="flex items-start gap-1.5">
            <IconCash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 text-[#212121]">
              <p className="text-[10px] leading-tight text-[#9E9E9E]">
                Collected Amount
              </p>
              <p
                className="text-xs font-bold tabular-nums"
                style={{ color: BLUE }}
              >
                − {formatCurrency(collected)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <IconCard className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 text-[#212121]">
              <p className="text-[10px] leading-tight text-[#9E9E9E]">
                Payment Mode
              </p>
              <p className="truncate text-xs font-semibold text-[#212121]">
                {item.paymentMethodLabel ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <IconUser className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 text-[#212121]">
              <p className="text-[10px] leading-tight text-[#9E9E9E]">
                Collected By
              </p>
              <p className="truncate text-xs font-semibold text-[#212121]">
                {item.createdBy ?? "—"}
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

const WALLET_PURPLE = "#6A1B9A";

function WalletEventCard({ item }: { item: CustomerActivityItemDTO }) {
  const isRecharge = item.kind === "WALLET_RECHARGE";
  const amount = item.amount ?? 0;
  const bonus = item.bonusAmount ?? 0;
  const credited = item.creditedAmount ?? amount + bonus;
  const balanceAfter = item.walletBalanceAfter;
  const payment = item.walletPayment;
  const purposeLabel = payment?.purposeLabel ?? item.label;

  return (
    <div className="relative flex gap-2.5">
      <div className="w-[4.75rem] shrink-0 pt-0.5 text-right sm:w-[5.5rem]">
        <time className="block text-[10px] font-bold uppercase leading-tight tracking-wide text-[#424242]">
          {formatDisplayDate(item.timestamp)}
        </time>
        <p className="mt-0.5 text-[10px] leading-tight text-[#757575]">
          {formatBusinessDayTime(item.timestamp)}
        </p>
      </div>

      <TimelineMarker tone={isRecharge ? "charge" : "collect"} />

      <article
        className="min-w-0 flex-1 overflow-hidden rounded-md border bg-white shadow-sm"
        style={{ borderColor: isRecharge ? "#E1BEE7" : "#D1C4E9" }}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <div className="min-w-0">
            <h3
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: WALLET_PURPLE }}
            >
              {isRecharge ? "Wallet Recharge" : purposeLabel}
            </h3>
            {!isRecharge && item.businessDayPublicId ? (
              <p className="mt-0.5 text-[10px] text-[#757575]">
                {item.businessDayPublicId}
                {item.businessDate
                  ? ` · ${formatDisplayDate(item.businessDate)}`
                  : null}
              </p>
            ) : null}
          </div>
          <p
            className="shrink-0 text-xs font-bold tabular-nums"
            style={{ color: WALLET_PURPLE }}
          >
            {isRecharge ? "+" : "−"}
            {formatCurrency(isRecharge ? credited : amount)}
          </p>
        </div>

        {isRecharge ? (
          <div className="grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-[10px] leading-tight text-[#9E9E9E]">
                Paid Amount
              </p>
              <p className="text-xs font-bold tabular-nums text-[#212121]">
                {formatCurrency(amount)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] leading-tight text-[#9E9E9E]">Bonus</p>
              <p className="text-xs font-bold tabular-nums text-[#212121]">
                {bonus > 0 ? `+${formatCurrency(bonus)}` : "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] leading-tight text-[#9E9E9E]">
                Wallet Credit
              </p>
              <p className="text-xs font-bold tabular-nums text-[#212121]">
                {formatCurrency(credited)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-3 py-2">
            {payment?.lines && payment.lines.length > 0 ? (
              <div>
                <p className="text-[10px] leading-tight text-[#9E9E9E]">
                  {payment.purpose === "CAFE_PAYMENT" ? "Items" : "Details"}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {payment.lines.map((line, index) => (
                    <li
                      key={`${line.label}-${index}`}
                      className="text-xs font-semibold text-[#212121]"
                    >
                      {line.label}
                      {line.quantity && line.quantity > 0
                        ? ` ×${line.quantity}`
                        : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="min-w-0">
                <p className="text-[10px] leading-tight text-[#9E9E9E]">
                  {payment?.billAmountLabel ?? "Bill Amount"}
                </p>
                <p className="text-xs font-bold tabular-nums text-[#212121]">
                  {formatCurrency(payment?.billAmount ?? amount)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] leading-tight text-[#9E9E9E]">
                  Wallet Used
                </p>
                <p className="text-xs font-bold tabular-nums text-[#212121]">
                  {formatCurrency(payment?.walletUsed ?? amount)}
                </p>
              </div>
              {(payment?.remainderAmount ?? 0) > 0 &&
              payment?.remainderMethodLabel ? (
                <div className="min-w-0">
                  <p className="text-[10px] leading-tight text-[#9E9E9E]">
                    {payment.remainderMethodLabel}
                  </p>
                  <p className="text-xs font-bold tabular-nums text-[#212121]">
                    {formatCurrency(payment.remainderAmount)}
                  </p>
                </div>
              ) : payment?.purpose !== "OUTSTANDING_COLLECTION" ? (
                <div className="min-w-0">
                  <p className="text-[10px] leading-tight text-[#9E9E9E]">
                    Total Paid
                  </p>
                  <p className="text-xs font-bold tabular-nums text-[#212121]">
                    {formatCurrency(payment?.totalPaid ?? amount)}
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-[10px] leading-tight text-[#9E9E9E]">
                    Balance After
                  </p>
                  <p className="text-xs font-bold tabular-nums text-[#212121]">
                    {balanceAfter !== undefined
                      ? formatCurrency(balanceAfter)
                      : "—"}
                  </p>
                </div>
              )}
            </div>

            {(payment?.remainderAmount ?? 0) > 0 ? (
              <div className="grid grid-cols-2 gap-2 border-t border-[#EDE7F6] pt-2">
                <div className="min-w-0">
                  <p className="text-[10px] leading-tight text-[#9E9E9E]">
                    Total Paid
                  </p>
                  <p className="text-xs font-bold tabular-nums text-[#212121]">
                    {formatCurrency(payment?.totalPaid ?? amount)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] leading-tight text-[#9E9E9E]">
                    Balance After
                  </p>
                  <p className="text-xs font-bold tabular-nums text-[#212121]">
                    {balanceAfter !== undefined
                      ? formatCurrency(balanceAfter)
                      : "—"}
                  </p>
                </div>
              </div>
            ) : payment?.purpose !== "OUTSTANDING_COLLECTION" ? (
              <div className="border-t border-[#EDE7F6] pt-2">
                <p className="text-[10px] leading-tight text-[#9E9E9E]">
                  Balance After
                </p>
                <p className="text-xs font-bold tabular-nums text-[#212121]">
                  {balanceAfter !== undefined
                    ? formatCurrency(balanceAfter)
                    : "—"}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {(isRecharge && balanceAfter !== undefined) ||
        (!isRecharge && item.createdBy) ||
        (isRecharge && item.businessDayPublicId) ? (
          <div className="px-3 pb-2">
            <div className="rounded bg-[#F3E5F5] px-2.5 py-1.5 text-[11px] text-[#6A1B9A]">
              {isRecharge ? (
                <>
                  Wallet balance{" "}
                  <span className="font-bold tabular-nums">
                    {formatCurrency(balanceAfter!)}
                  </span>
                  {item.paymentMethodLabel
                    ? ` · ${item.paymentMethodLabel}`
                    : null}
                  {item.createdBy ? ` · By ${item.createdBy}` : null}
                  {item.businessDayPublicId
                    ? ` · ${item.businessDayPublicId}`
                    : null}
                </>
              ) : (
                <>By {item.createdBy}</>
              )}
            </div>
          </div>
        ) : null}
      </article>
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

  return (
    <div className="relative flex gap-2.5">
      <div className="w-[4.75rem] shrink-0 pt-0.5 text-right sm:w-[5.5rem]">
        <time className="block text-[10px] font-bold uppercase leading-tight tracking-wide text-[#424242]">
          {formatDisplayDate(displayDate)}
        </time>
        <p className="mt-0.5 text-[10px] leading-tight text-[#757575]">
          Business Day Closed
        </p>
      </div>

      <TimelineMarker tone="charge" />

      <article className="min-w-0 flex-1 overflow-hidden rounded-md border border-[#C8E6C9] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <h3
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: GREEN }}
          >
            Business Day Closed
          </h3>
          <p
            className="shrink-0 text-xs font-bold tabular-nums"
            style={{ color: paidInFull ? "#616161" : GREEN }}
          >
            {paidInFull
              ? "Today's Due ₹0"
              : `Today's Due + ${formatCurrency(summary.todaysDue)}`}
          </p>
        </div>

        <div
          className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          style={{ color: GREEN }}
        >
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-1">
              <IconGames className="h-3.5 w-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9E9E9E]">
                Games
              </p>
            </div>
            {hasGames ? (
              <ul className="space-y-0 text-[11px] leading-snug text-[#212121]">
                {summary.games.map((line) => (
                  <li key={line.label} className="truncate">
                    {formatCountLine(line)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[#BDBDBD]">—</p>
            )}
          </div>

          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-1">
              <IconCafe className="h-3.5 w-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9E9E9E]">
                Cafe
              </p>
            </div>
            {hasCafe ? (
              <ul className="space-y-0 text-[11px] leading-snug text-[#212121]">
                {summary.cafe.map((line) => (
                  <li key={line.label} className="truncate">
                    {formatCountLine(line)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[#BDBDBD]">—</p>
            )}
          </div>

          <div className="rounded border border-[#E0E0E0] bg-[#FAFAFA] px-2 py-1.5 text-[11px] sm:min-w-[9rem]">
            <div className="flex justify-between gap-3">
              <span className="text-[#757575]">Today&apos;s Bill</span>
              <span className="font-semibold tabular-nums text-[#212121]">
                {formatCurrency(summary.todaysBill)}
              </span>
            </div>
            <div className="mt-0.5 flex justify-between gap-3">
              <span className="text-[#757575]">Today&apos;s Payment</span>
              <span className="font-semibold tabular-nums text-[#212121]">
                {formatCurrency(summary.todaysPayment)}
              </span>
            </div>
            <div className="mt-0.5 flex justify-between gap-3 border-t border-[#EEEEEE] pt-0.5">
              <span className="text-[#757575]">Today&apos;s Due</span>
              <span
                className="font-bold tabular-nums"
                style={{ color: paidInFull ? "#616161" : GREEN }}
              >
                {paidInFull
                  ? formatCurrency(0)
                  : `+ ${formatCurrency(summary.todaysDue)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          <div className="min-w-0 flex-1">
            {paidInFull ? (
              <PaidInFullStatus />
            ) : (
              <BalanceStrip
                previous={summary.previousOutstanding}
                current={summary.currentOutstanding}
              />
            )}
          </div>
          <Link
            href={`/business-day/history/${item.businessDayId}`}
            className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium hover:bg-[#E8F5E9]"
            style={{ color: GREEN, borderColor: "#A5D6A7" }}
          >
            View Business Day
            <IconExternal className="h-3 w-3" />
          </Link>
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
    <div className="flex h-full min-h-[24rem] flex-col border border-[#E0E0E0] bg-white">
      <div className="border-b border-[#E0E0E0] px-3 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#757575]">
          Customer Timeline
        </h2>
        <div
          className="mt-2 flex gap-1 rounded-md bg-[#F5F5F5] p-0.5"
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
                ? "flex-1 rounded px-2 py-1.5 text-[11px] font-semibold text-[#212121] bg-white shadow-sm"
                : "flex-1 rounded px-2 py-1.5 text-[11px] font-medium text-[#757575] hover:text-[#212121]"
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
                ? "flex-1 rounded px-2 py-1.5 text-[11px] font-semibold text-[#212121] bg-white shadow-sm"
                : "flex-1 rounded px-2 py-1.5 text-[11px] font-medium text-[#757575] hover:text-[#212121]"
            }
          >
            Balance History ({balanceCount})
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-2 py-2 sm:px-3">
        {visibleItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#9E9E9E]">
            {mode === "ALL_ACTIVITY"
              ? "No activity yet."
              : "No balance changes yet."}
          </p>
        ) : (
          <ul className="relative space-y-2.5">
            <div
              className="pointer-events-none absolute bottom-3 top-3 w-px bg-[#E0E0E0]"
              style={{ left: "calc(4.75rem + 0.625rem + 0.625rem - 0.5px)" }}
              aria-hidden
            />
            {visibleItems.map((item) => (
              <li key={item.id} className="relative">
                {item.kind === "BUSINESS_DAY_SUMMARY" ? (
                  <BusinessDayClosedCard item={item} />
                ) : item.kind === "WALLET_RECHARGE" ||
                  item.kind === "WALLET_PAYMENT" ? (
                  <WalletEventCard item={item} />
                ) : (
                  <CollectionCard item={item} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {visibleItems.length > 0 && (
        <div className="flex items-start gap-2 border-t border-[#BBDEFB] bg-[#E3F2FD] px-3 py-1.5 text-[11px] text-[#1565C0]">
          <span
            className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: BLUE }}
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
