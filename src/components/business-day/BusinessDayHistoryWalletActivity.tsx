import Link from "next/link";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { BusinessDayHistoryWalletActivityDTO } from "@/types";

interface BusinessDayHistoryWalletActivityProps {
  activity: BusinessDayHistoryWalletActivityDTO;
  /** Optional range hint for list/range view. */
  rangeHint?: string;
}

function paymentMethodLabel(method: "CASH" | "GPAY" | null): string {
  if (method === "CASH") return "Cash";
  if (method === "GPAY") return "GPay";
  return "—";
}

function Metric({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-violet-100/80 bg-violet-50/40 px-3 py-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-violet-500">
        {label}
      </dt>
      <dd
        className={`mt-1 tabular-nums ${
          emphasize
            ? "text-base font-bold text-violet-900"
            : "text-sm font-semibold text-gray-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function BusinessDayHistoryWalletActivity({
  activity,
  rangeHint,
}: BusinessDayHistoryWalletActivityProps) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
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
          </span>
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-gray-900">
              Wallet Activity
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Wallet Recharge audit — not Business Revenue
              {rangeHint ? ` · ${rangeHint}` : ""}
            </p>
          </div>
        </div>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Total Recharges"
          value={String(activity.totalRecharges)}
          emphasize
        />
        <Metric
          label="Recharge Received"
          value={formatCurrency(activity.rechargeReceived)}
        />
        <Metric
          label="Bonus Issued"
          value={formatCurrency(activity.bonusIssued)}
        />
        <Metric
          label="Wallet Credit Issued"
          value={formatCurrency(activity.walletCreditIssued)}
        />
      </dl>

      {activity.recharges.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">
          No wallet recharges in this period.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {activity.recharges.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/customers/${row.customerId}`}
                    className="text-sm font-semibold text-gray-900 hover:text-emerald-800"
                  >
                    {row.customerName}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {formatBusinessDayDate(row.createdAt)} ·{" "}
                    {formatBusinessDayTime(row.createdAt)} · By {row.createdBy}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    row.paymentMethod === "GPAY"
                      ? "bg-sky-50 text-sky-700"
                      : row.paymentMethod === "CASH"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {paymentMethodLabel(row.paymentMethod)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Paid Amount
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {formatCurrency(row.paidAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Bonus
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-violet-700">
                    {formatCurrency(row.bonusAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Wallet Credit
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-emerald-800">
                    {formatCurrency(row.walletCredit)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
