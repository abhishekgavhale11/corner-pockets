"use client";

import { useEffect, useMemo, useState } from "react";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import {
  formatCustomerContactLine,
  getCustomerMembershipLabel,
} from "@/lib/utils/customer-display";
import { cn } from "@/lib/utils/cn";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface CafeExistingCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerDTO) => void;
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function sortCustomersAlphabetically(customers: CustomerDTO[]): CustomerDTO[] {
  return [...customers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function CafeExistingCustomerDialog({
  open,
  onClose,
  onSelect,
}: CafeExistingCustomerDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    void searchNotebookCustomers(undefined, { alphabetical: true }).then(
      (customers) => setResults(sortCustomersAlphabetically(customers))
    );
  }, [open]);

  const sortedResults = useMemo(
    () => sortCustomersAlphabetically(results),
    [results]
  );

  if (!open) return null;

  const runSearch = async (value: string) => {
    setIsLoading(true);
    const customers = await searchNotebookCustomers(value.trim() || undefined, {
      alphabetical: true,
    });
    setResults(sortCustomersAlphabetically(customers));
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="cafe-existing-customer-title"
        className="relative z-10 flex h-[min(90vh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-amber-200/70 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-amber-100 bg-gradient-to-b from-amber-50/90 to-white px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl leading-none"
                aria-hidden
              >
                ☕
              </div>
              <div className="min-w-0">
                <h2
                  id="cafe-existing-customer-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Existing customer
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Choose who to add cafe items for
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <span className="text-lg leading-none">✕</span>
            </button>
          </div>
        </div>

        <div className="shrink-0 px-5 pt-4">
          <label htmlFor="cafe-customer-search" className="sr-only">
            Search customers
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <Input
              id="cafe-customer-search"
              className="h-11 border-gray-200 bg-gray-50/80 pl-10 text-base shadow-sm focus:bg-white"
              placeholder="Name, phone, or card ID"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                void runSearch(e.target.value);
              }}
              autoFocus
            />
          </div>
        </div>

        <div className="mx-5 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50/60">
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-2">
            {isLoading ? (
              <li className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-gray-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-amber-600" />
                Searching…
              </li>
            ) : sortedResults.length === 0 ? (
              <li className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No customers found
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Try a different search or create a new customer first
                </p>
              </li>
            ) : (
              sortedResults.map((customer) => {
                const contact = formatCustomerContactLine(customer);
                const membership = getCustomerMembershipLabel(customer);

                return (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(customer);
                        onClose();
                      }}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border border-transparent bg-white px-3 py-2.5 text-left shadow-sm transition-all",
                        "hover:border-amber-300 hover:bg-amber-50/80 hover:shadow-md",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                      )}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-sm font-bold text-white"
                        aria-hidden
                      >
                        {customerInitials(customer.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-bold text-gray-900">
                            {customer.name}
                          </span>
                          {membership !== "Regular" && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                              {membership}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-gray-500">
                          {contact}
                        </span>
                      </span>
                      <span
                        className="shrink-0 text-gray-300 transition-colors group-hover:text-amber-600"
                        aria-hidden
                      >
                        →
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="mt-4 shrink-0 border-t border-gray-100 px-5 py-3">
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-full text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
