"use client";

import { useEffect, useState } from "react";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface CafeExistingCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerDTO) => void;
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
    void searchNotebookCustomers().then(setResults);
  }, [open]);

  if (!open) return null;

  const runSearch = async (value: string) => {
    setIsLoading(true);
    const customers = await searchNotebookCustomers(value.trim() || undefined);
    setResults(customers);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-t-2xl bg-white p-5 shadow-xl sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Existing Customer</h2>
            <p className="mt-1 text-sm text-gray-500">
              Search the full customer database
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <Input
          className="h-11 shrink-0 text-base"
          placeholder="Search name, phone, card ID"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            void runSearch(e.target.value);
          }}
          autoFocus
        />

        <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto sm:h-[28rem]">
          {isLoading ? (
            <li className="px-3 py-4 text-base text-gray-500">Searching...</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-4 text-base text-gray-500">
              No customers found.
            </li>
          ) : (
            results.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(customer);
                    onClose();
                  }}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="block text-base font-bold text-gray-900">
                    {customer.name}
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-500">
                    {formatCustomerContactLine(customer)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <Button
          type="button"
          variant="secondary"
          className="mt-4 h-11 w-full shrink-0 text-base font-semibold"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
