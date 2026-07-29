"use client";

import { useState, useTransition } from "react";
import { verifyOutstandingIntegrityAction } from "@/actions/integrity";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { OutstandingIntegrityReport } from "@/types";
import { Button } from "@/components/ui/Button";

export function DataIntegrityView() {
  const [report, setReport] = useState<OutstandingIntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleVerify = () => {
    setError(null);
    startTransition(async () => {
      const result = await verifyOutstandingIntegrityAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReport(result.data);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Read-only check: created Outstanding minus collections must equal
          remaining. Nothing is repaired or changed.
        </p>
        <Button type="button" onClick={handleVerify} disabled={isPending}>
          {isPending ? "Verifying…" : "Verify Outstanding Integrity"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!report && !error ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-400">
          Run the check to verify Outstanding ledger consistency.
        </p>
      ) : null}

      {report ? (
        <>
          <SummaryStrip summary={report.summary} />
          <ResultsTable customers={report.customers} />
        </>
      ) : null}
    </div>
  );
}

function SummaryStrip({
  summary,
}: {
  summary: OutstandingIntegrityReport["summary"];
}) {
  const items: { label: string; value: string; tone?: "ok" | "bad" | "neutral" }[] =
    [
      {
        label: "Customers Checked",
        value: String(summary.customersChecked),
      },
      {
        label: "Passed",
        value: String(summary.passed),
        tone: "ok",
      },
      {
        label: "Failed",
        value: String(summary.failed),
        tone: summary.failed > 0 ? "bad" : "neutral",
      },
      {
        label: "Total Outstanding Created",
        value: formatCurrency(summary.totalOutstandingCreated),
      },
      {
        label: "Total Outstanding Collected",
        value: formatCurrency(summary.totalOutstandingCollected),
      },
      {
        label: "Total Outstanding Remaining",
        value: formatCurrency(summary.totalOutstandingRemaining),
      },
      {
        label: "Started At",
        value: formatDate(summary.startedAt),
      },
      {
        label: "Finished At",
        value: formatDate(summary.finishedAt),
      },
      {
        label: "Duration",
        value: `${summary.durationMs} ms`,
      },
    ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            {item.label}
          </p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums text-gray-900",
              item.tone === "ok" && "text-emerald-800",
              item.tone === "bad" && "text-red-700"
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ResultsTable({
  customers,
}: {
  customers: OutstandingIntegrityReport["customers"];
}) {
  if (customers.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-400">
        No Outstanding or collection records found.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Customer ID</th>
              <th className="px-3 py-3 text-right">Created</th>
              <th className="px-3 py-3 text-right">Collected</th>
              <th className="px-3 py-3 text-right">Remaining</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((row) => (
              <tr
                key={row.customerId}
                className={cn(
                  "border-t border-gray-50 align-top",
                  row.status === "FAIL" ? "bg-red-50/40" : "hover:bg-emerald-50/30"
                )}
              >
                <td className="px-4 py-3 font-semibold text-gray-900">
                  {row.customerName}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-gray-600">
                  {row.customerId}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-800">
                  {formatCurrency(row.totalCreated)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-800">
                  {formatCurrency(row.totalCollected)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-800">
                  {formatCurrency(row.totalRemaining)}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {row.status === "PASS" ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <div className="space-y-1.5">
                      <ul className="list-inside list-disc text-xs text-red-800">
                        {row.failureReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-gray-600">
                        Expected {formatCurrency(row.expectedRemaining ?? 0)} ·
                        Actual {formatCurrency(row.actualRemaining ?? 0)} · Diff{" "}
                        {formatCurrency(row.difference ?? 0)}
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "PASS" | "FAIL" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "PASS"
          ? "bg-emerald-50 text-emerald-800"
          : "bg-red-100 text-red-800"
      )}
    >
      {status}
    </span>
  );
}
