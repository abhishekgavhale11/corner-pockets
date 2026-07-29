import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/utils/format";
import type {
  BusinessDayHistoryInsightsDTO,
  BusinessDayHistorySectionSummaryDTO,
} from "@/types";

type ValueTone = "neutral" | "cash" | "gpay" | "outstanding";

function toneClass(tone: ValueTone): string {
  switch (tone) {
    case "cash":
      return "text-emerald-700";
    case "gpay":
      return "text-sky-700";
    case "outstanding":
      return "text-orange-600";
    default:
      return "text-gray-900";
  }
}

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

function IconPhonePay({ className }: { className?: string }) {
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

function IconLedger({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 4.5 7v5.2c0 4.3 3.1 7.4 7.5 8.3 4.4-.9 7.5-4 7.5-8.3V7L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 8v5M12 15.5v.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSnooker({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <circle cx="8.2" cy="9" r="1.2" fill="currentColor" opacity="0.45" />
      <circle cx="15.5" cy="9.2" r="1.2" fill="currentColor" opacity="0.45" />
      <circle cx="9" cy="15.2" r="1.2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8v3a4 4 0 0 1-8 0V4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 5H5.5A2.5 2.5 0 0 0 8 7.5M16 5h2.5A2.5 2.5 0 0 1 16 7.5M10 15h4v2.5a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2V15ZM9 21h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCafe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
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
  );
}

function IconFrames({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 9h8M8 12h5"
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

function MetricRow({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  tone?: ValueTone;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="flex items-center gap-2 text-[13px] text-gray-600">
        {icon}
        <span>{label}</span>
      </dt>
      <dd
        className={`text-[13px] font-bold tabular-nums tracking-tight ${toneClass(tone)}`}
      >
        {value}
      </dd>
    </div>
  );
}

function SectionHeading({
  title,
  icon,
  iconClassName,
  hint,
}: {
  title: string;
  icon: ReactNode;
  iconClassName: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${iconClassName}`}
        >
          {icon}
        </span>
        <h2 className="text-[18px] font-semibold tracking-tight text-gray-900">
          {title}
        </h2>
      </div>
      {hint ? <p className="text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
}

function SnookerSubCard({
  title,
  subtitle,
  icon,
  iconWrapClass,
  emphasize = false,
  summary,
  gamesLabel,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  iconWrapClass: string;
  emphasize?: boolean;
  summary: BusinessDayHistorySectionSummaryDTO;
  gamesLabel: string;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        emphasize
          ? "border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white"
          : "border-gray-200/80"
      }`}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-gray-800">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <dl className="flex-1">
        <MetricRow label="Revenue" value={formatCurrency(summary.bill)} />
        <MetricRow
          label="Cash"
          value={formatCurrency(summary.cashCollection)}
          tone="cash"
          icon={<IconCash className="h-3.5 w-3.5 text-emerald-600" />}
        />
        <MetricRow
          label="GPay"
          value={formatCurrency(summary.gpayCollection)}
          tone="gpay"
          icon={<IconPhonePay className="h-3.5 w-3.5 text-sky-600" />}
        />
        <MetricRow
          label="Outstanding Created"
          value={formatCurrency(summary.outstandingCreated)}
          tone="outstanding"
          icon={<IconLedger className="h-3.5 w-3.5 text-orange-500" />}
        />
      </dl>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
          <IconFrames className="h-3.5 w-3.5 text-gray-400" />
          {gamesLabel}
        </span>
        <span className="text-sm font-bold tabular-nums text-gray-900">
          {summary.gamesPlayed}
        </span>
      </div>
    </div>
  );
}

interface BusinessDayHistoryInsightCardsProps {
  insights: BusinessDayHistoryInsightsDTO;
  /** Defaults to Overall Business Summary (day detail). List uses Business Performance. */
  overallTitle?: string;
  overallHint?: string;
}

export function BusinessDayHistoryInsightCards({
  insights,
  overallTitle = "Overall Business Summary",
  overallHint,
}: BusinessDayHistoryInsightCardsProps) {
  const { overall, bigSnooker, poolMini, totalSnooker, cafe } = insights;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)_minmax(0,0.95fr)]">
        {/* Business Performance / Overall */}
        <section className="rounded-[12px] border border-gray-200 bg-white p-5 shadow-sm shadow-gray-900/5">
          <SectionHeading
            title={overallTitle}
            icon={<IconChart className="h-4 w-4 text-sky-700" />}
            iconClassName="bg-sky-50 text-sky-700"
            hint={overallHint}
          />
          <dl>
            <MetricRow
              label="Revenue"
              value={formatCurrency(overall.totalRevenue)}
            />
            <MetricRow
              label="Business Collection"
              value={formatCurrency(overall.totalReceived)}
              tone="cash"
            />
            <MetricRow
              label="Cash Collection"
              value={formatCurrency(overall.cashCollection)}
              tone="cash"
              icon={<IconCash className="h-3.5 w-3.5 text-emerald-600" />}
            />
            <MetricRow
              label="GPay Collection"
              value={formatCurrency(overall.gpayCollection)}
              tone="gpay"
              icon={<IconPhonePay className="h-3.5 w-3.5 text-sky-600" />}
            />
            <MetricRow
              label="Outstanding Created"
              value={formatCurrency(overall.outstandingCreated)}
              tone="outstanding"
              icon={<IconLedger className="h-3.5 w-3.5 text-orange-500" />}
            />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <IconCash className="h-3 w-3" /> Cash
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              <IconPhonePay className="h-3 w-3" /> GPay
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              <IconLedger className="h-3 w-3" /> Outstanding
            </span>
          </div>
        </section>

        {/* Snooker */}
        <section className="rounded-[12px] border border-gray-200 bg-slate-50/60 p-5 shadow-sm shadow-gray-900/5">
          <SectionHeading
            title="Snooker Summary"
            icon={<IconSnooker className="h-4 w-4 text-emerald-700" />}
            iconClassName="bg-emerald-50 text-emerald-700"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <SnookerSubCard
              title="Big Snooker"
              subtitle="3 Tables"
              icon={<IconSnooker className="h-4 w-4 text-emerald-700" />}
              iconWrapClass="bg-emerald-50"
              summary={bigSnooker}
              gamesLabel="Frames Played"
            />
            <SnookerSubCard
              title="Pool & Mini"
              subtitle="2 Pool + 1 Mini"
              icon={<IconSnooker className="h-4 w-4 text-sky-700" />}
              iconWrapClass="bg-sky-50"
              summary={poolMini}
              gamesLabel="Games Played"
            />
            <SnookerSubCard
              title="Total Snooker"
              icon={<IconTrophy className="h-4 w-4 text-amber-700" />}
              iconWrapClass="bg-amber-50"
              emphasize
              summary={totalSnooker}
              gamesLabel="Total Games Played"
            />
          </div>
        </section>

        {/* Cafe */}
        <section className="rounded-[12px] border border-gray-200 bg-white p-5 shadow-sm shadow-gray-900/5">
          <SectionHeading
            title="Cafe Summary"
            icon={<IconCafe className="h-4 w-4 text-orange-600" />}
            iconClassName="bg-orange-50 text-orange-600"
          />
          <dl>
            <MetricRow label="Revenue" value={formatCurrency(cafe.bill)} />
            <MetricRow
              label="Cash Collection"
              value={formatCurrency(cafe.cashCollection)}
              tone="cash"
              icon={<IconCash className="h-3.5 w-3.5 text-emerald-600" />}
            />
            <MetricRow
              label="GPay Collection"
              value={formatCurrency(cafe.gpayCollection)}
              tone="gpay"
              icon={<IconPhonePay className="h-3.5 w-3.5 text-sky-600" />}
            />
            <MetricRow
              label="Outstanding Created"
              value={formatCurrency(cafe.outstandingCreated)}
              tone="outstanding"
              icon={<IconLedger className="h-3.5 w-3.5 text-orange-500" />}
            />
          </dl>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
              <IconBag className="h-3.5 w-3.5 text-orange-400" />
              Orders
            </span>
            <span className="text-sm font-bold tabular-nums text-gray-900">
              {cafe.gamesPlayed}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
