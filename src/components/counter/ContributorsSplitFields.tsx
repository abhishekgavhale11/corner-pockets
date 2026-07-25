"use client";

import { useState } from "react";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import type { CustomerDTO } from "@/types";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import { formatCurrency } from "@/lib/utils/format";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import { frameDueAmount } from "@/lib/utils/frame-payment";
import { computeWalletUsed } from "@/lib/wallet/wallet-payment-math";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  resolveEntryPaymentSubmit,
  type RemainderPaymentMode,
} from "@/components/counter/EntryPaymentFields";

export type ContributorPaymentMode = "CASH" | "GPAY" | "WALLET";

/** Frame ownership row — each contributor owns amount, received, and payment mode. */
export type ContributorRow = {
  customerId: string;
  customerName: string;
  amount: string;
  paidAmount: string;
  /** Empty when Received = 0 (Unassigned). Required when Received > 0. */
  paymentMethod: ContributorPaymentMode | "";
  /** When true, wallet is auto-consumed (server computes amount). */
  useWallet?: boolean;
  walletBalance?: number;
  walletEnabled?: boolean;
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

function ContributorDueDisplay({
  amount,
  paid,
  paymentMethod,
  useWallet,
}: {
  amount: number;
  paid: number;
  paymentMethod: ContributorPaymentMode | "";
  useWallet?: boolean;
}) {
  const due = frameDueAmount(amount, paid);

  if (due <= 0) {
    if (paymentMethod === "WALLET") {
      return (
        <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold text-violet-800 bg-violet-50">
          {paymentMethodLabel("WALLET")}
        </span>
      );
    }
    if (paymentMethod === "CASH") {
      return (
        <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-50">
          {useWallet ? "Wallet + Cash" : paymentMethodLabel("CASH")}
        </span>
      );
    }
    if (paymentMethod === "GPAY") {
      return (
        <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold text-blue-800 bg-blue-50">
          {useWallet ? "Wallet + GPay" : paymentMethodLabel("GPAY")}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold text-emerald-700">Paid</span>
    );
  }

  return (
    <span className="text-sm font-semibold tabular-nums text-orange-700">
      {formatCurrency(due)}
    </span>
  );
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
        paidAmount: "0",
        paymentMethod: "",
        useWallet: false,
        walletBalance: customer.balance,
        walletEnabled: customer.walletEnabled,
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
              walletBalance: customer.balance,
              walletEnabled: customer.walletEnabled,
              useWallet:
                row.useWallet &&
                customer.walletEnabled &&
                (customer.balance ?? 0) > 0
                  ? true
                  : false,
              paymentMethod:
                row.paymentMethod === "WALLET" &&
                (customer.balance ?? 0) <
                  (Number.parseInt(row.paidAmount, 10) || 0)
                  ? ""
                  : row.paymentMethod,
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
  const remainderModes: RemainderPaymentMode[] = ["CASH", "GPAY"];

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
            const balance = row.walletBalance ?? 0;
            const showWallet = Boolean(row.walletEnabled) && balance > 0;
            const useWallet = Boolean(row.useWallet) && showWallet;
            const walletUsed = computeWalletUsed({
              paidAmount: rowPaid,
              useWallet,
              availableBalance: balance,
            });
            const remainder = Math.max(0, rowPaid - walletUsed);
            const needsRemainderMethod = rowPaid > 0 && remainder > 0;
            const fullyCoveredByWallet =
              rowPaid > 0 && useWallet && remainder === 0;
            const walletControlsDisabled =
              disabled || rowLocked || rowPaid <= 0;

            return (
              <div
                key={`${index}-${row.customerId}`}
                className="space-y-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                    {row.customerName}
                  </span>
                  {row.walletEnabled ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
                      Wallet {formatCurrency(balance)}
                    </span>
                  ) : null}
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
                          rows.filter(
                            (item) => item.customerId !== row.customerId
                          )
                        )
                      }
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Amount
                    </span>
                    <div className="relative w-[7.5rem]">
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
                          updateRow(index, { amount: digits });
                        }}
                        className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-5 pr-2 text-right text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Received
                    </span>
                    <div className="relative w-[7.5rem]">
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
                          if (nextPaid <= 0) {
                            updateRow(index, {
                              paidAmount: digits,
                              paymentMethod: "",
                              useWallet: false,
                            });
                            return;
                          }
                          const nextUseWallet = Boolean(row.useWallet);
                          const used = computeWalletUsed({
                            paidAmount: nextPaid,
                            useWallet: nextUseWallet && balance > 0,
                            availableBalance: balance,
                          });
                          let nextMethod: ContributorPaymentMode | "" =
                            row.paymentMethod;
                          if (nextUseWallet && used >= nextPaid) {
                            nextMethod = "WALLET";
                          } else if (row.paymentMethod === "WALLET") {
                            nextMethod = "";
                          }
                          updateRow(index, {
                            paidAmount: digits,
                            paymentMethod: nextMethod,
                          });
                        }}
                        className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-5 pr-2 text-right text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {showWallet ? (
                    <div className="space-y-1.5 rounded-md border border-gray-200/80 bg-white px-2 py-1.5">
                      <label
                        className={cn(
                          "flex items-center justify-between gap-3 text-xs",
                          walletControlsDisabled && "opacity-50"
                        )}
                      >
                        <span className="font-medium text-gray-800">
                          Use Wallet
                        </span>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-emerald-700"
                          checked={useWallet}
                          disabled={walletControlsDisabled}
                          onChange={(event) => {
                            const next = event.target.checked;
                            if (!next) {
                              updateRow(index, {
                                useWallet: false,
                                paymentMethod:
                                  row.paymentMethod === "WALLET"
                                    ? ""
                                    : row.paymentMethod,
                              });
                              return;
                            }
                            const used = computeWalletUsed({
                              paidAmount: rowPaid,
                              useWallet: true,
                              availableBalance: balance,
                            });
                            updateRow(index, {
                              useWallet: true,
                              paymentMethod:
                                used >= rowPaid && rowPaid > 0
                                  ? "WALLET"
                                  : row.paymentMethod === "WALLET"
                                    ? ""
                                    : row.paymentMethod,
                            });
                          }}
                        />
                      </label>
                      {useWallet && rowPaid > 0 ? (
                        <dl className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-1.5 text-xs">
                          <div>
                            <dt className="text-[10px] text-gray-500">
                              Wallet Used
                            </dt>
                            <dd className="font-semibold tabular-nums text-emerald-900">
                              {formatCurrency(walletUsed)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] text-gray-500">
                              Remaining
                            </dt>
                            <dd className="font-semibold tabular-nums text-gray-900">
                              {formatCurrency(remainder)}
                            </dd>
                          </div>
                        </dl>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {fullyCoveredByWallet
                        ? "Payment Mode"
                        : useWallet && needsRemainderMethod
                          ? "Remaining"
                          : "Payment Mode"}
                    </span>
                    {rowPaid <= 0 ? (
                      <span className="w-[9.5rem] text-right text-sm text-gray-400">
                        Unassigned
                      </span>
                    ) : fullyCoveredByWallet ? (
                      <span className="w-[9.5rem] rounded-md bg-violet-50 px-2 py-1.5 text-right text-xs font-semibold text-violet-900">
                        Wallet
                      </span>
                    ) : (
                      <div className="flex w-[9.5rem] gap-1 rounded-md bg-gray-100 p-0.5">
                        {remainderModes.map((mode) => {
                          const selected = row.paymentMethod === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              disabled={disabled || rowLocked}
                              onClick={() =>
                                updateRow(index, {
                                  paymentMethod: mode,
                                })
                              }
                              className={cn(
                                "flex-1 rounded px-1 py-1.5 text-[10px] font-semibold transition-colors",
                                selected
                                  ? mode === "CASH"
                                    ? "bg-emerald-50 text-emerald-900 shadow-sm"
                                    : "bg-blue-50 text-blue-900 shadow-sm"
                                  : "text-gray-600 hover:text-gray-900",
                                (disabled || rowLocked) &&
                                  "cursor-not-allowed opacity-50"
                              )}
                            >
                              {mode === "CASH" ? "Cash" : "GPay"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {useWallet && needsRemainderMethod && !row.paymentMethod ? (
                    <p className="text-[10px] text-amber-700">
                      Select Cash or GPay for the remaining{" "}
                      {formatCurrency(remainder)}.
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 border-t border-gray-200/80 pt-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Due
                    </span>
                    <div className="flex min-h-[28px] w-[7.5rem] items-center justify-end">
                      <ContributorDueDisplay
                        amount={rowAmount}
                        paid={rowPaid}
                        paymentMethod={row.paymentMethod}
                        useWallet={useWallet}
                      />
                    </div>
                  </div>
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

    const paymentCheck = resolveEntryPaymentSubmit({
      paidAmount: paid,
      useWallet: Boolean(row.useWallet),
      walletBalance: row.walletBalance ?? 0,
      paymentMode: row.paymentMethod,
    });
    if (!paymentCheck.valid) {
      return (
        paymentCheck.error ??
        `Select Cash or GPay for ${row.customerName}`
      );
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

/** Payload shape for setEntryContributors — server computes walletAmount. */
export function contributorRowsToPayload(rows: ContributorRow[]) {
  return rows.map((row) => {
    const paidAmount = Number.parseInt(row.paidAmount || "0", 10) || 0;
    const resolved = resolveEntryPaymentSubmit({
      paidAmount,
      useWallet: Boolean(row.useWallet),
      walletBalance: row.walletBalance ?? 0,
      paymentMode: row.paymentMethod,
    });
    return {
      customerId: row.customerId,
      amount: Number.parseInt(row.amount, 10),
      paidAmount,
      useWallet: resolved.useWallet,
      ...(paidAmount > 0 && resolved.paymentMethod
        ? { paymentMethod: resolved.paymentMethod }
        : {}),
    };
  });
}
