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

function IconWrap({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
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
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="6"
        width="19"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M2.5 10h19M16 14.5h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
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

function WalletPayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M4 7.5h13.5A2.5 2.5 0 0 1 20 10v7.5A2.5 2.5 0 0 1 17.5 20H4V7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 7.5 6.2 4h9.6L18 7.5M14.5 14.5h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GPayIcon() {
  return (
    <span
      className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-black text-blue-600 shadow-sm"
      aria-hidden
    >
      G
    </span>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 15v-4M12 15V8M16 15v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SnookerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="12" cy="12" r="8" fill="currentColor" />
      <circle cx="12" cy="12" r="3.4" fill="white" />
      <path
        d="M10.7 10.4h1.15c.7 0 1.15.35 1.15.9 0 .5-.35.82-.9.9l1.05 1.85h-1.05l-.95-1.75H11.5v1.75h-.8V10.4Zm.8.65v1.05h.3c.35 0 .55-.15.55-.52 0-.35-.2-.53-.55-.53h-.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CafeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M5 8h11v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16 10h2a2.5 2.5 0 0 1 0 5h-2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 4.5c.6.8.6 1.6 0 2.4M11 4.5c.6.8.6 1.6 0 2.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OutstandingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M12 3v18M5 8l7-3 7 3M5 16l7 3 7-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
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

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M12 3 5 6v5c0 4.5 2.9 7.8 7 9 4.1-1.2 7-4.5 7-9V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
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
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** One metric cell in a horizontal strip: icon + label + amount. */
function MetricCell({
  icon,
  iconClassName,
  label,
  value,
  valueClassName = "text-gray-900",
}: {
  icon: ReactNode;
  iconClassName: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 sm:px-3">
      <IconWrap className={iconClassName}>{icon}</IconWrap>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium leading-tight text-gray-500 sm:text-[11px]">
          {label}
        </p>
        <p
          className={cn(
            "truncate text-sm font-bold tabular-nums leading-tight sm:text-[15px]",
            valueClassName
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex divide-x divide-gray-200 overflow-x-auto">
      {children}
    </div>
  );
}

function SectionCard({
  borderClassName,
  headerClassName,
  icon,
  iconClassName,
  title,
  children,
}: {
  borderClassName: string;
  headerClassName: string;
  icon: ReactNode;
  iconClassName: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-white",
        borderClassName
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-1.5",
          headerClassName
        )}
      >
        <IconWrap className={iconClassName}>{icon}</IconWrap>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-700 sm:text-[11px]">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function CategorySection({
  title,
  tone,
  category,
}: {
  title: string;
  tone: "snooker" | "cafe";
  category: BusinessDayCloseCategoryPreviewDTO;
}) {
  const isSnooker = tone === "snooker";
  const accent = isSnooker ? "text-emerald-700" : "text-orange-700";

  return (
    <SectionCard
      borderClassName={
        isSnooker ? "border-emerald-200" : "border-orange-200"
      }
      headerClassName={isSnooker ? "bg-emerald-50/80" : "bg-orange-50/80"}
      icon={isSnooker ? <SnookerIcon /> : <CafeIcon />}
      iconClassName={
        isSnooker
          ? "bg-emerald-100 text-emerald-700"
          : "bg-orange-100 text-orange-700"
      }
      title={title}
    >
      <MetricStrip>
        <MetricCell
          icon={<ChartIcon />}
          iconClassName={
            isSnooker
              ? "bg-emerald-100 text-emerald-700"
              : "bg-orange-100 text-orange-700"
          }
          label="Revenue"
          value={formatCurrency(category.revenue)}
          valueClassName={accent}
        />
        <MetricCell
          icon={<CashIcon />}
          iconClassName="bg-emerald-100 text-emerald-700"
          label="Cash"
          value={formatCurrency(category.cashCollection)}
          valueClassName="text-emerald-700"
        />
        <MetricCell
          icon={<GPayIcon />}
          iconClassName="bg-blue-100"
          label="GPay"
          value={formatCurrency(category.gpayCollection)}
          valueClassName="text-blue-700"
        />
        <MetricCell
          icon={<WalletPayIcon />}
          iconClassName="bg-violet-100 text-violet-700"
          label="Wallet"
          value={formatCurrency(category.walletCollection)}
          valueClassName="text-violet-700"
        />
        <MetricCell
          icon={<PersonIcon />}
          iconClassName="bg-amber-100 text-amber-700"
          label="Outstanding Created"
          value={formatCurrency(category.outstandingCreated)}
          valueClassName="text-amber-800"
        />
      </MetricStrip>
    </SectionCard>
  );
}

function ReadyCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          ok
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
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
          "truncate text-xs font-medium sm:text-sm",
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
  walletCollection: 0,
  outstandingAmount: 0,
  snooker: {
    revenue: 0,
    cashCollection: 0,
    gpayCollection: 0,
    walletCollection: 0,
    outstandingCreated: 0,
  },
  cafe: {
    revenue: 0,
    cashCollection: 0,
    gpayCollection: 0,
    walletCollection: 0,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close"
        disabled={isPending}
        onClick={() => !isPending && onClose()}
      />

      <div className="relative z-10 flex max-h-[min(92vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-start gap-2.5">
            <IconWrap className="bg-sky-100 text-sky-700">
              <CalendarIcon />
            </IconWrap>
            <div>
              <h2 className="text-base font-bold text-gray-950 sm:text-lg">
                Confirm Close Business Day
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Verify today&apos;s business before closing.
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

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 sm:px-5">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <SectionCard
            borderClassName="border-sky-200"
            headerClassName="bg-sky-50/80"
            icon={<WalletIcon />}
            iconClassName="bg-sky-100 text-sky-700"
            title="Today's Collection"
          >
            <MetricStrip>
              <MetricCell
                icon={<CashIcon />}
                iconClassName="bg-emerald-100 text-emerald-700"
                label="Cash"
                value={formatCurrency(data.cashCollection)}
                valueClassName="text-emerald-700"
              />
              <MetricCell
                icon={<GPayIcon />}
                iconClassName="bg-blue-100"
                label="GPay"
                value={formatCurrency(data.gpayCollection)}
                valueClassName="text-blue-700"
              />
              <MetricCell
                icon={<WalletPayIcon />}
                iconClassName="bg-violet-100 text-violet-700"
                label="Wallet"
                value={formatCurrency(data.walletCollection)}
                valueClassName="text-violet-700"
              />
              <MetricCell
                icon={<ChartIcon />}
                iconClassName="bg-slate-100 text-slate-700"
                label="Total Collection"
                value={formatCurrency(data.totalPaid)}
                valueClassName="text-slate-800"
              />
            </MetricStrip>
          </SectionCard>

          <CategorySection
            title="Snooker"
            tone="snooker"
            category={data.snooker}
          />

          <CategorySection title="Cafe" tone="cafe" category={data.cafe} />

          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <IconWrap className="bg-amber-100 text-amber-800">
                <OutstandingIcon />
              </IconWrap>
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-amber-950 sm:text-[11px]">
                Total Outstanding Created
              </span>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-amber-950 sm:text-[15px]">
              {formatCurrency(data.outstandingAmount)}
            </span>
          </div>

          <SectionCard
            borderClassName="border-sky-200"
            headerClassName="bg-sky-50/80"
            icon={<ShieldIcon />}
            iconClassName="bg-sky-100 text-sky-700"
            title="Ready to Close"
          >
            <div className="flex flex-col divide-y divide-gray-200 sm:flex-row sm:divide-x sm:divide-y-0">
              <ReadyCheck ok={framesOk} label="No Unassigned Frames" />
              <ReadyCheck ok={cafeOk} label="No Unassigned Cafe Items" />
            </div>
            {!ready ? (
              <p className="border-t border-amber-100 bg-amber-50/50 px-3 py-1.5 text-[11px] text-amber-800">
                Closing is blocked until all frames and cafe items are assigned.
              </p>
            ) : null}
          </SectionCard>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <span aria-hidden>✕</span>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !ready}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <LockIcon />
            {isPending ? "Closing..." : "Confirm Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
