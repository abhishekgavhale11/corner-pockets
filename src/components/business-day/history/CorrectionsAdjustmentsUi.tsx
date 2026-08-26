import Link from "next/link";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { FINANCIAL_CORRECTION_SECTION_LABELS } from "@/lib/constants/financial-corrections";
import { formatCurrency } from "@/lib/utils/format";
import type { FinancialCorrectionHistoryRowDTO } from "@/types";

export function correctionTypeLabel(
  type: FinancialCorrectionHistoryRowDTO["type"]
): string {
  return type === "MISSED_PAYMENT" ? "Missed Payment" : "Outstanding Correction";
}

export function sectionLabel(
  section: FinancialCorrectionHistoryRowDTO["section"]
): string | null {
  return section ? FINANCIAL_CORRECTION_SECTION_LABELS[section] : null;
}

export function displayCorrectionAmount(
  row: FinancialCorrectionHistoryRowDTO
): string {
  const formatted = formatCurrency(row.amount);
  return row.type === "OUTSTANDING_CORRECTION" ? `−${formatted}` : formatted;
}

export function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.4 5 6.4v5.3c0 4.2 2.9 7.3 7 8.3 4.1-1 7-4.1 7-8.3V6.4L12 3.4Z"
        fill="currentColor"
      />
      <path
        d="M9.2 12.1 11 14l3.8-4.2"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="4.25"
        y="1.75"
        width="7.5"
        height="12.5"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M7 12.75h2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBanknote({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.75"
        y="4"
        width="12.5"
        height="8"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconArrowUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 12.5v-9M4.5 7 8 3.5 11.5 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CorrectionPaymentChip({
  method,
}: {
  method: FinancialCorrectionHistoryRowDTO["paymentMethod"];
}) {
  if (!method) return null;
  const isGpay = method === "GPAY";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold ${
        isGpay
          ? "border-sky-200 bg-sky-50 text-sky-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {isGpay ? (
        <IconPhone className="h-2.5 w-2.5" />
      ) : (
        <IconBanknote className="h-2.5 w-2.5" />
      )}
      {isGpay ? "GPay" : "Cash"}
    </span>
  );
}

export function CorrectionsSectionHeader({
  subtitle,
  showHeading = true,
}: {
  subtitle: string;
  showHeading?: boolean;
}) {
  return (
    <header className="flex min-w-0 items-start gap-2">
      {showHeading ? (
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500 text-white">
          <IconShieldCheck className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <div className="min-w-0">
        {showHeading ? (
          <h2 className="text-[15px] font-semibold tracking-tight text-gray-900">
            Corrections & Adjustments
          </h2>
        ) : null}
        <p
          className={
            showHeading
              ? "mt-0.5 text-[11px] leading-snug text-gray-500"
              : "text-[11px] leading-snug text-gray-500"
          }
        >
          {subtitle}
        </p>
      </div>
    </header>
  );
}

function SectionBadge({
  section,
}: {
  section: FinancialCorrectionHistoryRowDTO["section"];
}) {
  const label = sectionLabel(section);
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-1.5 py-px text-[10px] font-semibold text-gray-700">
      {label}
    </span>
  );
}

function CorrectionTypeBadge({
  type,
}: {
  type: FinancialCorrectionHistoryRowDTO["type"];
}) {
  const isMissed = type === "MISSED_PAYMENT";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
        isMissed
          ? "bg-orange-50 text-orange-700"
          : "bg-emerald-50 text-emerald-800"
      }`}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full ${
          isMissed ? "bg-orange-500 text-white" : "bg-emerald-600 text-white"
        }`}
        aria-hidden
      >
        {isMissed ? (
          <IconPlus className="h-2 w-2" />
        ) : (
          <IconArrowUp className="h-2 w-2" />
        )}
      </span>
      {correctionTypeLabel(type)}
    </span>
  );
}

export function OriginalCloseAuditCard({
  summary,
}: {
  summary: {
    todaysBill: number;
    totalReceived: number;
    cashCollection: number;
    gpayCollection: number;
    outstandingCreated: number;
  };
}) {
  const metrics = [
    { label: "Revenue", value: summary.todaysBill, valueClass: "text-gray-900" },
    {
      label: "Received",
      value: summary.totalReceived,
      valueClass: "text-gray-900",
    },
    {
      label: "Cash",
      value: summary.cashCollection,
      valueClass: "text-emerald-800",
    },
    {
      label: "GPay",
      value: summary.gpayCollection,
      valueClass: "text-sky-800",
    },
    {
      label: "Outstanding Created",
      value: summary.outstandingCreated,
      valueClass: "text-orange-700",
    },
  ] as const;

  return (
    <section
      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
      aria-label="Original Close for audit"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
          Original Close · For Audit
        </h3>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-5">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`bg-white px-3 py-2 ${
              index === metrics.length - 1 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              {metric.label}
            </dt>
            <dd
              className={`mt-0.5 text-[13px] font-semibold tabular-nums ${metric.valueClass}`}
            >
              {formatCurrency(metric.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-500">
        Original close remains unchanged for audit.
      </p>
    </section>
  );
}

const activityRowGrid =
  "md:grid md:grid-cols-[10.5rem_minmax(9.75rem,13rem)_minmax(5.5rem,1.15fr)_6.5rem_4.75rem_5.25rem] md:items-center md:gap-x-2";

export function CorrectionActivityItem({
  row,
  affectedDayHref,
  customerHref,
}: {
  row: FinancialCorrectionHistoryRowDTO;
  affectedDayHref?: string;
  customerHref?: string;
}) {
  const isMissed = row.type === "MISSED_PAYMENT";
  const showPayment = isMissed || Boolean(row.paymentMethod);
  const affectedDateLabel = formatBusinessDayDate(row.affectedBusinessDate);
  const dateLabel = affectedDateLabel.toUpperCase();
  const timeLabel = formatBusinessDayTime(row.createdAt).toUpperCase();
  const amountClass = isMissed ? "text-orange-600" : "text-emerald-800";

  const customerName = customerHref ? (
    <Link
      href={customerHref}
      className="truncate text-[13px] font-semibold text-gray-900 hover:text-emerald-800"
    >
      {row.customerName}
    </Link>
  ) : (
    <p className="truncate text-[13px] font-semibold text-gray-900">
      {row.customerName}
    </p>
  );

  const affectedDate = affectedDayHref ? (
    <Link
      href={affectedDayHref}
      className="font-medium text-emerald-800 hover:text-emerald-950"
      title={row.affectedPublicId}
    >
      {affectedDateLabel}
    </Link>
  ) : (
    <span className="font-medium text-gray-700" title={row.affectedPublicId}>
      {affectedDateLabel}
    </span>
  );

  return (
    <li className="border-b border-gray-100 last:border-b-0">
      <article className="px-3 py-2 transition-colors hover:bg-slate-50/80 sm:px-4">
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${activityRowGrid}`}>
          <p
            className="w-full shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-gray-500 md:w-auto"
            title={row.affectedPublicId}
          >
            {dateLabel} · {timeLabel}
          </p>
          <CorrectionTypeBadge type={row.type} />
          <div className="min-w-0">{customerName}</div>
          {sectionLabel(row.section) ? (
            <SectionBadge section={row.section} />
          ) : (
            <span className="hidden md:block" />
          )}
          {showPayment ? (
            <CorrectionPaymentChip method={row.paymentMethod} />
          ) : (
            <span className="hidden md:block" />
          )}
          <p
            className={`ml-auto whitespace-nowrap text-[13px] font-bold tabular-nums md:ml-0 md:text-right ${amountClass}`}
          >
            {displayCorrectionAmount(row)}
          </p>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500 md:pl-0">
          <span>
            <span className="text-gray-400">Reason:</span> {row.reason}
          </span>
          <span className="hidden text-gray-300 sm:inline" aria-hidden>
            ·
          </span>
          <span>
            <span className="text-gray-400">Recorded by:</span> {row.createdBy}
          </span>
          <span className="hidden text-gray-300 sm:inline" aria-hidden>
            ·
          </span>
          <span>
            <span className="text-gray-400">Affected Date:</span> {affectedDate}
          </span>
        </p>
      </article>
    </li>
  );
}

export function AdjustmentActivityCard({
  corrections,
  affectedDayHrefFor,
  customerHrefFor,
}: {
  corrections: FinancialCorrectionHistoryRowDTO[];
  affectedDayHrefFor?: (row: FinancialCorrectionHistoryRowDTO) => string;
  customerHrefFor?: (row: FinancialCorrectionHistoryRowDTO) => string;
}) {
  const count = corrections.length;

  return (
    <section
      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
      aria-label="Adjustment Activity"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5 sm:px-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
          Adjustment Activity
        </h3>
        {count > 0 ? (
          <p className="text-[11px] tabular-nums text-gray-400">
            {count} {count === 1 ? "adjustment" : "adjustments"}
          </p>
        ) : null}
      </div>

      {count === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-400">
          No corrections recorded.
        </p>
      ) : (
        <>
          <div
            className={`hidden border-b border-gray-100 bg-gray-50/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 sm:px-4 md:grid ${activityRowGrid}`}
          >
            <span>Affected Date</span>
            <span>Type</span>
            <span>Customer</span>
            <span>Section</span>
            <span>Payment</span>
            <span className="text-right">Amount</span>
          </div>
          <ul className="max-h-[32rem] overflow-y-auto">
            {corrections.map((row) => (
              <CorrectionActivityItem
                key={row.id}
                row={row}
                affectedDayHref={affectedDayHrefFor?.(row)}
                customerHref={customerHrefFor?.(row)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function CorrectionsAuditFooter() {
  return (
    <p className="text-[11px] text-gray-500">
      Corrections are append-only audit records. They do not change the original
      close.
    </p>
  );
}
