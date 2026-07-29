"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AmountCell,
  CustomerCell,
  HistoryActivityTable,
  HistoryEmptyState,
  HistoryTableCell,
  HistoryTableRow,
} from "@/components/business-day/history";
import { formatCurrency } from "@/lib/utils/format";
import { formatLastVisitLabel } from "@/lib/utils/customer-ledger-display";
import { cn } from "@/lib/utils/cn";
import type { CustomerListRowDTO } from "@/types";

interface CustomerListProps {
  customers: CustomerListRowDTO[];
  emptyMessage?: string;
}

type SortKey = "name" | "outstandingAmount";
type SortDirection = "asc" | "desc";

function SortHint({
  active = false,
  direction,
}: {
  active?: boolean;
  direction?: SortDirection;
}) {
  const upClass =
    active && direction === "asc" ? "text-emerald-700" : "text-gray-300";
  const downClass =
    active && direction === "desc" ? "text-emerald-700" : "text-gray-300";

  return (
    <span className="ml-1 inline-flex flex-col" aria-hidden>
      <svg viewBox="0 0 10 6" className={cn("h-1.5 w-2.5", upClass)}>
        <path d="M5 0 10 6H0Z" fill="currentColor" />
      </svg>
      <svg
        viewBox="0 0 10 6"
        className={cn("-mt-0.5 h-1.5 w-2.5 rotate-180", downClass)}
      >
        <path d="M5 0 10 6H0Z" fill="currentColor" />
      </svg>
    </span>
  );
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

const COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "outstanding", label: "Outstanding", align: "right" as const },
  { key: "visit", label: "Last Visit" },
  { key: "actions", label: "", className: "w-12" },
];

export function CustomerList({
  customers,
  emptyMessage = "No customers found.",
}: CustomerListProps) {
  const [sort, setSort] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [totalsVisible, setTotalsVisible] = useState(false);

  const handleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) {
        return {
          key,
          direction: key === "name" ? "asc" : "desc",
        };
      }
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  const sortedCustomers = useMemo(() => {
    if (!sort) return customers;

    const multiplier = sort.direction === "asc" ? 1 : -1;
    return [...customers].sort((a, b) => {
      if (sort.key === "name") {
        const byName = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        });
        if (byName !== 0) return byName * multiplier;
        return a.id.localeCompare(b.id) * multiplier;
      }

      const diff = a[sort.key] - b[sort.key];
      if (diff !== 0) return diff * multiplier;

      const byName = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });
  }, [customers, sort]);

  const visibleTotals = useMemo(
    () =>
      sortedCustomers.reduce(
        (acc, customer) => {
          acc.outstandingAmount += customer.outstandingAmount;
          return acc;
        },
        { outstandingAmount: 0 }
      ),
    [sortedCustomers]
  );

  if (customers.length === 0) {
    return <HistoryEmptyState message={emptyMessage} />;
  }

  const columns = COLUMNS.map((column) => {
    if (column.key === "customer") {
      return {
        ...column,
        label: (
          <button
            type="button"
            onClick={() => handleSort("name")}
            className="inline-flex items-center hover:text-gray-700"
            aria-label={
              sort?.key === "name" && sort.direction === "asc"
                ? "Sort customer name Z to A"
                : "Sort customer name A to Z"
            }
          >
            Customer
            <SortHint
              active={sort?.key === "name"}
              direction={sort?.key === "name" ? sort.direction : undefined}
            />
          </button>
        ),
      };
    }
    if (column.key === "outstanding") {
      return {
        ...column,
        label: (
          <button
            type="button"
            onClick={() => handleSort("outstandingAmount")}
            className="inline-flex items-center justify-end hover:text-gray-700"
            aria-label={
              sort?.key === "outstandingAmount" && sort.direction === "desc"
                ? "Sort outstanding low to high"
                : "Sort outstanding high to low"
            }
          >
            Outstanding
            <SortHint
              active={sort?.key === "outstandingAmount"}
              direction={
                sort?.key === "outstandingAmount" ? sort.direction : undefined
              }
            />
          </button>
        ),
      };
    }
    return column;
  });

  return (
    <HistoryActivityTable
      columns={columns}
      minWidth="760px"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3 text-[13px]">
          <p className="text-gray-500">
            Showing{" "}
            <span className="font-semibold tabular-nums text-gray-800">
              {sortedCustomers.length}
            </span>{" "}
            customer{sortedCustomers.length === 1 ? "" : "s"}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => setTotalsVisible((visible) => !visible)}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
              aria-label={
                totalsVisible ? "Hide summary totals" : "Show summary totals"
              }
              aria-pressed={totalsVisible}
            >
              {totalsVisible ? <EyeOffIcon /> : <EyeIcon />}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Total Outstanding</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  visibleTotals.outstandingAmount > 0
                    ? "text-[#B71C1C]"
                    : "text-emerald-700"
                )}
              >
                {totalsVisible
                  ? formatCurrency(visibleTotals.outstandingAmount)
                  : "₹••••••"}
              </span>
            </div>
          </div>
        </div>
      }
    >
      {sortedCustomers.map((customer) => {
        const phone = customer.phone?.trim();
        const hasOutstanding = customer.outstandingAmount > 0;
        const href = `/customers/${customer.id}`;

        return (
          <HistoryTableRow key={customer.id}>
            <HistoryTableCell>
              <CustomerCell
                name={customer.name}
                href={href}
                secondary={phone || undefined}
              />
            </HistoryTableCell>
            <HistoryTableCell align="right">
              <Link href={href} className="block">
                <AmountCell
                  amount={customer.outstandingAmount}
                  tone={hasOutstanding ? "negative" : "positive"}
                />
              </Link>
            </HistoryTableCell>
            <HistoryTableCell>
              <Link
                href={href}
                className="text-[12px] text-gray-500 hover:text-gray-700"
              >
                {formatLastVisitLabel(customer.lastVisitAt)}
              </Link>
            </HistoryTableCell>
            <HistoryTableCell align="right">
              <Link
                href={href}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-gray-300 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                aria-label={`Open ${customer.name}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </HistoryTableCell>
          </HistoryTableRow>
        );
      })}
    </HistoryActivityTable>
  );
}
