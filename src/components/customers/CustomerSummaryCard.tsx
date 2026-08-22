"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { collectCustomerOutstandingAction } from "@/actions/outstanding";
import {
  EntryPaymentFields,
  appendEntryPaymentFormData,
  type RemainderPaymentMode,
} from "@/components/counter/EntryPaymentFields";
import { formatLastVisitLabel } from "@/lib/utils/customer-ledger-display";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerDTO, CustomerLedgerSummaryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils/cn";
import { OpeningOutstandingDialog } from "@/components/customers/OpeningOutstandingDialog";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-3.5 w-3.5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-3.5 w-3.5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-1.7 2.5" />
      <path d="M6.6 6.6C4 8.5 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.4-1" />
      <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 14 3.5-3.5L14 14l5-5" />
    </svg>
  );
}

function IconCoins({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="6" rx="6" ry="2.5" />
      <path d="M6 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6" />
      <path d="M6 10v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" />
      <path d="M6 14v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

function MetricIcon({
  tone,
  children,
}: {
  tone: "emerald" | "violet" | "sky" | "amber";
  children: ReactNode;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

interface CustomerSummaryCardProps {
  customer: CustomerDTO;
  summary: CustomerLedgerSummaryDTO;
  /** Show Add Opening Outstanding for brand-new customers only. */
  canAddOpeningOutstanding?: boolean;
}

export function CustomerSummaryCard({
  customer,
  summary,
  canAddOpeningOutstanding = false,
}: CustomerSummaryCardProps) {
  const router = useRouter();
  const [collectOpen, setCollectOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [lifetimePaidVisible, setLifetimePaidVisible] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<RemainderPaymentMode | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const outstandingAmount = summary.outstandingAmount;
  const parsedAmount = Number.parseInt(receivedAmount, 10) || 0;

  const canCollect =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= outstandingAmount;

  const resetCollectDialog = () => {
    setReceivedAmount("");
    setPaymentMode("");
    setError(null);
  };

  const closeCollectDialog = () => {
    resetCollectDialog();
    setCollectOpen(false);
  };

  const handleCollect = () => {
    if (!canCollect) {
      setError("Enter a valid amount up to the outstanding balance");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customer.id);
      const payment = appendEntryPaymentFormData(formData, {
        paidAmount: parsedAmount,
        paymentMode,
      });
      if (!payment.ok) {
        setError(payment.error);
        return;
      }
      formData.set("receivedAmount", String(parsedAmount));

      const result = await collectCustomerOutstandingAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      closeCollectDialog();
      router.refresh();
    });
  };

  return (
    <>
      <div className="rounded-[12px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-900/5 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-800 ring-1 ring-inset ring-emerald-100"
                aria-hidden
              >
                {initials(customer.name)}
              </span>
              <span
                className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-gray-900">
                {customer.name}
              </h2>
              <p className="mt-0.5 text-[12px] text-gray-500">
                Customer Summary
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canAddOpeningOutstanding ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpeningOpen(true)}
                className="h-9 px-3 text-[12px] font-semibold"
              >
                Add Opening Outstanding
              </Button>
            ) : null}
            {outstandingAmount > 0 ? (
              <Button
                type="button"
                onClick={() => {
                  resetCollectDialog();
                  setCollectOpen(true);
                }}
                className="h-9 px-3 text-[12px] font-semibold"
              >
                Collect Outstanding
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 overflow-hidden rounded-[12px] border border-gray-200">
          <div className="flex items-center gap-3 px-3.5 py-3.5 sm:px-4">
            <MetricIcon tone="emerald">
              <IconCoins className="h-4 w-4" />
            </MetricIcon>
            <div className="min-w-0">
              <p className="text-[12px] text-gray-500">Outstanding</p>
              <p
                className={cn(
                  "mt-0.5 text-[22px] font-bold leading-none tabular-nums tracking-tight",
                  outstandingAmount > 0
                    ? "text-[#B71C1C]"
                    : "text-emerald-800"
                )}
              >
                {formatCurrency(outstandingAmount)}
              </p>
            </div>
          </div>
        </div>

        <ul className="mt-2">
          <li className="flex items-center justify-between gap-3 border-b border-dashed border-gray-200 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <MetricIcon tone="sky">
                <IconChart className="h-4 w-4" />
              </MetricIcon>
              <span className="text-[13px] text-gray-600">Total Visits</span>
            </div>
            <span className="text-[15px] font-semibold tabular-nums text-gray-900">
              {summary.visitCount}
            </span>
          </li>

          <li className="flex items-center justify-between gap-3 border-b border-dashed border-gray-200 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <MetricIcon tone="amber">
                <IconCoins className="h-4 w-4" />
              </MetricIcon>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-600">
                Lifetime Paid
                <button
                  type="button"
                  onClick={() => setLifetimePaidVisible((visible) => !visible)}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  aria-label={
                    lifetimePaidVisible
                      ? "Hide lifetime paid"
                      : "Show lifetime paid"
                  }
                  aria-pressed={lifetimePaidVisible}
                >
                  {lifetimePaidVisible ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </span>
            </div>
            <span className="text-[15px] font-semibold tabular-nums text-gray-900">
              {lifetimePaidVisible
                ? formatCurrency(summary.lifetimePaid)
                : "₹••••••"}
            </span>
          </li>

          <li className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <MetricIcon tone="violet">
                <IconCalendar className="h-4 w-4" />
              </MetricIcon>
              <span className="text-[13px] text-gray-600">Last Visit</span>
            </div>
            <span className="text-[15px] font-semibold text-gray-900">
              {formatLastVisitLabel(summary.lastVisitAt)}
            </span>
          </li>
        </ul>
      </div>

      <Dialog
        open={collectOpen}
        onClose={closeCollectDialog}
        title="Collect Outstanding"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Outstanding Balance</p>
            <p className="text-2xl font-bold tabular-nums text-[#B71C1C]">
              {formatCurrency(outstandingAmount)}
            </p>
          </div>

          <EntryPaymentFields
            idPrefix="outstanding-collect"
            amount={outstandingAmount}
            paidAmount={receivedAmount}
            paymentMode={paymentMode}
            disabled={isPending}
            onPaidAmountChange={(value) => {
              setReceivedAmount(value);
              setError(null);
            }}
            onPaymentModeChange={(mode) => {
              setPaymentMode(mode);
              setError(null);
            }}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={closeCollectDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCollect} disabled={!canCollect || isPending}>
              {isPending ? "Collecting…" : "Collect"}
            </Button>
          </div>
        </div>
      </Dialog>

      <OpeningOutstandingDialog
        open={openingOpen}
        customerId={customer.id}
        customerName={customer.name}
        onClose={() => setOpeningOpen(false)}
      />
    </>
  );
}
