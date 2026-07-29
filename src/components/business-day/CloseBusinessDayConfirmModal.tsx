"use client";

import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type {
  BusinessDayCloseCategoryPreviewDTO,
  BusinessDayClosePreviewDTO,
} from "@/types";

type Props = {
  open: boolean;
  preview: BusinessDayClosePreviewDTO | null;
  error?: string | null;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function IconBox({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        className
      )}
    >
      {children}
    </span>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function GPayIcon() {
  return (
    <span className="text-[11px] font-black text-blue-600" aria-hidden>
      G
    </span>
  );
}

function CoinsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="9" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14 8.2a5 5 0 1 1 0 7.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19c1.8-3.2 4-4.8 7-4.8S17.2 15.8 19 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 17l9-10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10v6M12 7.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type Tone = "neutral" | "cash" | "outstanding" | "total";

function toneValueClass(tone: Tone): string {
  switch (tone) {
    case "cash":
      return "text-emerald-600";
    case "outstanding":
      return "text-orange-600";
    case "total":
      return "text-gray-900";
    default:
      return "text-gray-800";
  }
}

function MetricItem({
  icon,
  iconClassName,
  label,
  value,
  tone = "neutral",
}: {
  icon: ReactNode;
  iconClassName: string;
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <IconBox className={iconClassName}>{icon}</IconBox>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p
          className={cn(
            "text-base font-bold tabular-nums leading-tight",
            toneValueClass(tone)
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  columns,
  children,
}: {
  title: string;
  columns: 4 | 5;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">
        {title}
      </h3>
      <div
        className={cn(
          "grid gap-4",
          columns === 4
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        )}
      >
        {children}
      </div>
    </section>
  );
}

function CategorySummary({
  title,
  category,
}: {
  title: string;
  category: BusinessDayCloseCategoryPreviewDTO;
}) {
  return (
    <SummaryCard title={title} columns={4}>
      <MetricItem
        icon={<ChartIcon />}
        iconClassName="bg-gray-100 text-gray-600"
        label="Revenue"
        value={formatCurrency(category.revenue)}
      />
      <MetricItem
        icon={<CashIcon />}
        iconClassName="bg-emerald-50 text-emerald-600"
        label="Cash"
        value={formatCurrency(category.cashCollection)}
        tone="cash"
      />
      <MetricItem
        icon={<GPayIcon />}
        iconClassName="bg-blue-50"
        label="GPay"
        value={formatCurrency(category.gpayCollection)}
      />
      <MetricItem
        icon={<PersonIcon />}
        iconClassName="bg-orange-50 text-orange-600"
        label="Outstanding Created"
        value={formatCurrency(category.outstandingCreated)}
        tone="outstanding"
      />
    </SummaryCard>
  );
}

function ReadyCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        )}
      >
        {ok ? (
          <CheckIcon />
        ) : (
          <span className="text-[10px] font-bold leading-none">!</span>
        )}
      </span>
      <span
        className={cn(
          "text-sm font-medium",
          ok ? "text-gray-800" : "text-amber-900"
        )}
      >
        {ok ? label : `${label.replace(/^No /, "")} still open`}
      </span>
    </div>
  );
}

const emptyPreview: BusinessDayClosePreviewDTO = {
  todaysBill: 0,
  totalPaid: 0,
  cashCollection: 0,
  gpayCollection: 0,
  outstandingAmount: 0,
  snooker: {
    revenue: 0,
    cashCollection: 0,
    gpayCollection: 0,
    outstandingCreated: 0,
  },
  cafe: {
    revenue: 0,
    cashCollection: 0,
    gpayCollection: 0,
    outstandingCreated: 0,
  },
  unassignedFrames: 0,
  unassignedCafeItems: 0,
};

export function CloseBusinessDayConfirmModal({
  open,
  preview,
  error,
  isPending = false,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  const data = preview ?? emptyPreview;
  const framesOk = data.unassignedFrames === 0;
  const cafeOk = data.unassignedCafeItems === 0;
  const ready = framesOk && cafeOk;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close"
        disabled={isPending}
        onClick={() => !isPending && onClose()}
      />

      <div className="relative z-10 flex max-h-[min(94vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <IconBox className="bg-sky-100 text-sky-700">
              <CalendarIcon />
            </IconBox>
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Confirm Close Business Day
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Review today&apos;s business summary before closing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="rounded-md p-1 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <SummaryCard title="Today's Collection" columns={4}>
            <MetricItem
              icon={<CashIcon />}
              iconClassName="bg-emerald-50 text-emerald-600"
              label="Cash"
              value={formatCurrency(data.cashCollection)}
              tone="cash"
            />
            <MetricItem
              icon={<GPayIcon />}
              iconClassName="bg-blue-50"
              label="GPay"
              value={formatCurrency(data.gpayCollection)}
            />
            <MetricItem
              icon={<CoinsIcon />}
              iconClassName="bg-gray-100 text-gray-700"
              label="Total Collection"
              value={formatCurrency(data.totalPaid)}
              tone="total"
            />
          </SummaryCard>

          <CategorySummary title="Snooker Summary" category={data.snooker} />
          <CategorySummary title="Cafe Summary" category={data.cafe} />

          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">
              Total Outstanding Created
            </p>
            <p className="text-lg font-bold tabular-nums text-orange-600">
              {formatCurrency(data.outstandingAmount)}
            </p>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">
              Ready to Close
            </h3>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-8">
              <ReadyCheck ok={framesOk} label="No Unassigned Frames" />
              <ReadyCheck ok={cafeOk} label="No Unassigned Cafe Items" />
            </div>
            {!ready ? (
              <p className="mt-3 text-xs text-amber-800">
                Closing is blocked until all frames and cafe items are assigned.
              </p>
            ) : null}
          </section>

          <div className="flex gap-2.5 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span className="mt-0.5 shrink-0 text-sky-600">
              <InfoIcon />
            </span>
            <p>
              Please verify before closing. Once closed, you will not be able to
              edit today&apos;s transactions. All data will be locked and
              available in Business Day History.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <span aria-hidden>✕</span>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !ready}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            <LockIcon />
            {isPending ? "Closing..." : "Confirm Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
