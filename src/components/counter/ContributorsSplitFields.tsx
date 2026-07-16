"use client";

import { useState } from "react";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import type { CustomerDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export type ContributorRow = {
  customerId: string;
  customerName: string;
  amount: string;
};

interface ContributorsSplitFieldsProps {
  totalAmount: number;
  rows: ContributorRow[];
  onRowsChange: (rows: ContributorRow[]) => void;
  disabled?: boolean;
  lockedCustomerIds?: string[];
  lockedRowIndexes?: number[];
  /** FR-FRM-001 — frame type/amount/split amounts locked; only customer reassignment allowed */
  partiallyLocked?: boolean;
}

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
            }
          : row
      )
    );
    setReassignIndex(null);
    setQuery("");
    setResults([]);
  };

  const amountsLocked = partiallyLocked;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Contributors</Label>
        {!partiallyLocked ? (
          <p className="text-[11px] text-gray-500">
            Remaining{" "}
            <span
              className={
                remaining === 0
                  ? "font-semibold text-emerald-700"
                  : "font-semibold text-amber-700"
              }
            >
              {formatCurrency(remaining)}
            </span>
          </p>
        ) : null}
      </div>

      {!partiallyLocked ? (
        <>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              void searchCustomers(e.target.value);
            }}
            onFocus={() => void searchCustomers(query)}
            placeholder="Search to add contributor"
            disabled={disabled}
            className="text-sm"
          />
          {results.length > 0 && (
            <ul className="max-h-28 overflow-y-auto rounded border border-gray-200">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-emerald-50"
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
          )}
        </>
      ) : null}

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-500">
            No contributors yet — optional, you can add them later.
          </p>
        ) : (
          rows.map((row, index) => {
            const rowLocked = partiallyLocked
              ? lockedRowIndexes.includes(index)
              : lockedCustomerIds.includes(row.customerId);
            const canReassign = partiallyLocked && !rowLocked;
            const isReassigning = reassignIndex === index;

            return (
              <div key={`${index}-${row.customerId}`} className="space-y-1">
                <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {row.customerName}
                    {rowLocked ? (
                      <span className="ml-1 text-[10px] font-semibold text-slate-500">
                        (paid)
                      </span>
                    ) : canReassign ? (
                      <span className="ml-1 text-[10px] font-semibold text-emerald-700">
                        (reassignable)
                      </span>
                    ) : null}
                  </span>
                  <div className="relative shrink-0">
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
                        onRowsChange(
                          rows.map((item, i) =>
                            i === index ? { ...item, amount: digits } : item
                          )
                        );
                      }}
                      className="w-20 rounded-md border border-gray-300 bg-white py-1.5 pl-5 pr-2 text-right text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20 disabled:opacity-60"
                    />
                  </div>
                  {canReassign ? (
                    <button
                      type="button"
                      className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50"
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
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                      onClick={() =>
                        onRowsChange(
                          rows.filter((item) => item.customerId !== row.customerId)
                        )
                      }
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                {isReassigning ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-2">
                    <Input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        void searchCustomers(e.target.value);
                      }}
                      onFocus={() => void searchCustomers(query)}
                      placeholder="Search new customer"
                      disabled={disabled}
                      className="text-sm"
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
  options?: { requireAtLeastOne?: boolean }
): string | null {
  if (rows.length === 0) {
    return options?.requireAtLeastOne ? "Add at least one contributor" : null;
  }

  const total = rows.reduce((sum, row) => {
    const amount = Number.parseInt(row.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return sum;
    }
    return sum + amount;
  }, 0);

  if (total !== totalAmount) {
    return `Contributor total must equal ${formatCurrency(totalAmount)}`;
  }

  for (const row of rows) {
    const amount = Number.parseInt(row.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Enter a valid amount for each contributor";
    }
  }

  return null;
}
