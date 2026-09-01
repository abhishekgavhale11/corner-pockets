"use client";

import { useState } from "react";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import type { CustomerDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import {
  frameDueAmount,
  syncReceivedWithAmountChange,
} from "@/lib/utils/frame-payment";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { CashGpaySegmentedControl } from "@/components/ui/CashGpaySegmentedControl";
import { DueStatusBadge } from "@/components/counter/DueStatusBadge";
import {
  contributorReceivedPaymentModeError,
  explicitPaymentMethod,
} from "@/lib/utils/contributor-payment";

export type ContributorPaymentMode = "CASH" | "GPAY";

/** Frame ownership row — each contributor owns amount, received, and payment mode. */
export type ContributorRow = {
  customerId: string;
  customerName: string;
  amount: string;
  paidAmount: string;
  /** Empty/null when Unassigned. Cash/GPay only when the cashier explicitly selects one. */
  paymentMethod: ContributorPaymentMode | "";
  initialPaidAmount?: number;
  initialPaymentMethod?: ContributorPaymentMode | "";
};

interface ContributorsSplitFieldsProps {
  totalAmount: number;
  rows: ContributorRow[];
  onRowsChange: (rows: ContributorRow[]) => void;
  disabled?: boolean;
  lockedCustomerIds?: string[];
  lockedRowIndexes?: number[];
  /** Frame type/amount/split amounts locked; only customer reassignment allowed */
  partiallyLocked?: boolean;
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizePaymentMethod(
  method: string | undefined | null
): ContributorPaymentMode | "" {
  if (method === "CASH" || method === "GPAY") return method;
  return "";
}

const fieldLabelClass =
  "mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500";
const moneyInputClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-6 pr-2 text-right text-sm font-semibold tabular-nums text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:opacity-60";

export function ContributorsSplitFields({
  totalAmount,
  rows,
  onRowsChange,
  disabled = false,
  lockedCustomerIds = [],
  lockedRowIndexes = [],
  partiallyLocked = false,
}: ContributorsSplitFieldsProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [reassignIndex, setReassignIndex] = useState<number | null>(null);

  const total = rows.reduce((sum, row) => {
    const amount = Number.parseInt(row.amount, 10);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const remaining = totalAmount - total;

  const searchCustomers = async (q: string) => {
    const customers = await searchNotebookCustomers(q.trim() || undefined);
    setResults(customers);
  };

  const addCustomer = (customer: CustomerDTO) => {
    if (rows.some((row) => row.customerId === customer.id)) return;

    const left = Math.max(0, totalAmount - total);
    onRowsChange([
      ...rows,
      {
        customerId: customer.id,
        customerName: customer.name,
        amount: left > 0 ? String(left) : "",
        paidAmount: "0",
        paymentMethod: "",
        initialPaidAmount: 0,
        initialPaymentMethod: "",
      },
    ]);
    setQuery("");
    setResults([]);
  };

  const reassignCustomer = (index: number, customer: CustomerDTO) => {
    if (rows.some((row, i) => i !== index && row.customerId === customer.id)) {
      return;
    }

    onRowsChange(
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              customerId: customer.id,
              customerName: customer.name,
              initialPaidAmount: 0,
              initialPaymentMethod: "",
            }
          : row
      )
    );
    setReassignIndex(null);
    setQuery("");
    setResults([]);
  };

  const updateRow = (index: number, patch: Partial<ContributorRow>) => {
    onRowsChange(
      rows.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const amountsLocked = partiallyLocked;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {!partiallyLocked ? (
        <div className="border-b border-gray-100 px-3 py-2.5 sm:px-4">
          <p className="mb-2 text-xs font-semibold text-gray-800">
            Contributors
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="5.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M12.5 12.5 16 16"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  void searchCustomers(e.target.value);
                }}
                onFocus={() => void searchCustomers(query)}
                placeholder="Search to add contributor"
                disabled={disabled}
                className="h-9 pl-9 text-sm"
              />
            </div>
            <p className="shrink-0 text-[11px] text-gray-500 sm:text-right">
              Remaining to Split:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  remaining === 0 ? "text-emerald-700" : "text-amber-700"
                )}
              >
                {formatCurrency(remaining)}
              </span>
            </p>
          </div>
          {results.length > 0 ? (
            <ul className="mt-1.5 max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-emerald-50"
                    disabled={disabled}
                    onClick={() => addCustomer(customer)}
                  >
                    <span className="font-medium">{customer.name}</span>
                    <span className="ml-2 text-gray-500">
                      {formatCustomerContactLine(customer)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="border-b border-gray-100 px-3 py-2 sm:px-4">
          <p className="text-xs font-semibold text-gray-800">Contributors</p>
        </div>
      )}

      <div className="max-h-[min(42vh,320px)] space-y-1.5 overflow-y-auto px-2.5 py-2 sm:px-3">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">
            Add at least two customers to split this frame.
          </p>
        ) : (
          rows.map((row, index) => {
            const rowLocked = partiallyLocked
              ? lockedRowIndexes.includes(index)
              : lockedCustomerIds.includes(row.customerId);
            const canReassign = partiallyLocked && !rowLocked;
            const isReassigning = reassignIndex === index;
            const rowAmount = Number.parseInt(row.amount, 10) || 0;
            const rowPaid = Number.parseInt(row.paidAmount, 10) || 0;

            return (
              <div
                key={`${index}-${row.customerId}`}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 shadow-sm"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-800">
                    {customerInitials(row.customerName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight text-gray-900">
                      {row.customerName}
                    </p>
                  </div>
                  {canReassign ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50"
                      disabled={disabled}
                      onClick={() => {
                        setReassignIndex(isReassigning ? null : index);
                        setQuery("");
                        setResults([]);
                      }}
                    >
                      {isReassigning ? "Cancel" : "Change"}
                    </button>
                  ) : !partiallyLocked ? (
                    <button
                      type="button"
                      aria-label={`Remove ${row.customerName}`}
                      disabled={disabled || rowLocked}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-60"
                      onClick={() =>
                        onRowsChange(
                          rows.filter(
                            (item) => item.customerId !== row.customerId
                          )
                        )
                      }
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <path
                          d="M4.5 6.5h11M8 6.5V5.2A1.2 1.2 0 0 1 9.2 4h1.6A1.2 1.2 0 0 1 12 5.2V6.5M7.5 6.5v8.2c0 .7.5 1.3 1.2 1.3h2.6c.7 0 1.2-.6 1.2-1.3V6.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4 sm:items-end">
                  <div className="min-w-0">
                    <span className={fieldLabelClass}>Amount</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        ₹
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.amount}
                        placeholder="0"
                        readOnly={amountsLocked}
                        disabled={disabled || amountsLocked || rowLocked}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          const previousAmount =
                            Number.parseInt(row.amount, 10) || 0;
                          const nextAmount = Number.parseInt(digits, 10) || 0;
                          const currentReceived =
                            Number.parseInt(row.paidAmount, 10) || 0;
                          const synced =
                            currentReceived > 0
                              ? syncReceivedWithAmountChange({
                                  previousAmount,
                                  nextAmount,
                                  currentReceived,
                                })
                              : null;
                          updateRow(index, {
                            amount: digits,
                            ...(synced != null ? { paidAmount: synced } : {}),
                          });
                        }}
                        className={moneyInputClass}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <span className={fieldLabelClass}>Received</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        ₹
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.paidAmount}
                        placeholder="0"
                        disabled={disabled || rowLocked}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          const nextPaid = Number.parseInt(digits, 10) || 0;
                          updateRow(index, {
                            paidAmount: digits,
                            ...(nextPaid <= 0 ? { paymentMethod: "" } : {}),
                          });
                        }}
                        className={moneyInputClass}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <span className={fieldLabelClass}>Payment Mode</span>
                    {rowPaid <= 0 ? (
                      <div className="flex h-9 items-center rounded-lg border border-dashed border-gray-200 px-2 text-xs text-gray-400">
                        Unassigned
                      </div>
                    ) : (
                      <CashGpaySegmentedControl
                        size="sm"
                        className="w-full"
                        idPrefix={`split-${index}-mode`}
                        value={normalizePaymentMethod(row.paymentMethod)}
                        onChange={(mode) => {
                          updateRow(index, { paymentMethod: mode });
                        }}
                        disabled={disabled || rowLocked}
                        aria-label="Payment mode"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className={fieldLabelClass}>Due</span>
                    <div className="flex min-h-9 items-center">
                      <DueStatusBadge
                        dueAmount={frameDueAmount(rowAmount, rowPaid)}
                        paymentMode={normalizePaymentMethod(row.paymentMethod)}
                      />
                    </div>
                  </div>
                </div>

                {isReassigning ? (
                  <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
                    <Input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        void searchCustomers(e.target.value);
                      }}
                      onFocus={() => void searchCustomers(query)}
                      placeholder="Search new customer"
                      disabled={disabled}
                      className="h-9 text-sm"
                    />
                    {results.length > 0 ? (
                      <ul className="mt-1 max-h-28 overflow-y-auto rounded border border-gray-200 bg-white">
                        {results.map((customer) => (
                          <li key={customer.id}>
                            <button
                              type="button"
                              className="w-full px-2 py-1.5 text-left text-xs hover:bg-emerald-50"
                              disabled={disabled}
                              onClick={() => reassignCustomer(index, customer)}
                            >
                              <span className="font-medium">{customer.name}</span>
                              <span className="ml-2 text-gray-500">
                                {formatCustomerContactLine(customer)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function validateContributorRows(
  rows: ContributorRow[],
  totalAmount: number,
  options?: {
    requireAtLeastOne?: boolean;
  }
): string | null {
  if (rows.length === 0) {
    return options?.requireAtLeastOne ? "Add at least one contributor" : null;
  }

  for (const row of rows) {
    const amount = Number.parseInt(row.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Enter a valid amount for each contributor";
    }
    const paid = Number.parseInt(row.paidAmount || "0", 10);
    if (!Number.isFinite(paid) || paid < 0) {
      return "Enter a valid received amount for each contributor";
    }
    if (paid > amount) {
      return `Received cannot exceed amount for ${row.customerName}`;
    }

    const modeError = contributorReceivedPaymentModeError(
      paid,
      normalizePaymentMethod(row.paymentMethod)
    );
    if (modeError) {
      return modeError;
    }
  }

  const total = rows.reduce((sum, row) => {
    const amount = Number.parseInt(row.amount, 10);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  if (total !== totalAmount) {
    return `Contributor amounts must equal ${formatCurrency(totalAmount)}`;
  }

  return null;
}

export function contributorRowsToPayload(rows: ContributorRow[]) {
  return rows.map((row) => {
    const paidAmount = Number.parseInt(row.paidAmount || "0", 10) || 0;
    const paymentMethod = explicitPaymentMethod(
      paidAmount,
      normalizePaymentMethod(row.paymentMethod)
    );
    return {
      customerId: row.customerId,
      amount: Number.parseInt(row.amount, 10),
      paidAmount,
      ...(paymentMethod ? { paymentMethod } : {}),
    };
  });
}
