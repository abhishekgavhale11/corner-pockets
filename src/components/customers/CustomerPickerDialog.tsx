"use client";

import { useEffect, useState, useTransition } from "react";
import { createQuickCustomer } from "@/actions/customers";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface CustomerPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerDTO) => void;
  title?: string;
  subtitle?: string;
  selectLabel?: string;
  disabled?: boolean;
}

export function CustomerPickerDialog({
  open,
  onClose,
  onSelect,
  title = "Select customer",
  subtitle,
  selectLabel = "Select",
  disabled = false,
}: CustomerPickerDialogProps) {
  const [mode, setMode] = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setMode("search");
      setQuery("");
      setResults([]);
      setFirstName("");
      setLastName("");
      setPhone("");
      setError(null);
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

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("firstName", firstName.trim());
      formData.set("lastName", lastName.trim());
      if (phone.trim()) {
        formData.set("phone", phone.trim());
      }
      const result = await createQuickCustomer(formData);
      if (result.success) {
        onSelect(result.data);
        onClose();
        return;
      }
      setError(result.error);
    });
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
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex shrink-0 gap-2">
          <Button
            type="button"
            variant={mode === "search" ? "primary" : "secondary"}
            className="h-10 px-4 text-sm font-semibold"
            onClick={() => setMode("search")}
          >
            Search
          </Button>
          <Button
            type="button"
            variant={mode === "create" ? "primary" : "secondary"}
            className="h-10 px-4 text-sm font-semibold"
            onClick={() => setMode("create")}
          >
            + Quick Customer
          </Button>
        </div>

        <div className="flex h-[28rem] min-h-[28rem] flex-col">
          {mode === "search" ? (
            <>
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
              <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
                {isLoading ? (
                  <li className="px-3 py-4 text-base text-gray-500">
                    Searching...
                  </li>
                ) : results.length === 0 ? (
                  <li className="px-3 py-4 text-base text-gray-500">
                    No customers found.
                  </li>
                ) : (
                  results.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        disabled={disabled || isPending}
                        onClick={() => onSelect(customer)}
                        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
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
            </>
          ) : (
            <form onSubmit={handleCreate} className="flex h-full flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quick-customer-first-name" className="text-sm">
                    Name
                  </Label>
                  <Input
                    id="quick-customer-first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoFocus
                    placeholder="Name"
                    className="mt-1.5 h-11 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="quick-customer-last-name" className="text-sm">
                    Surname
                  </Label>
                  <Input
                    id="quick-customer-last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Surname"
                    className="mt-1.5 h-11 text-base"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="quick-customer-phone" className="text-sm">
                  Phone (optional)
                </Label>
                <Input
                  id="quick-customer-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-11 text-base"
                />
              </div>
              <p className="text-sm text-gray-500">
                Saved to the same customer database. Upgrade to member anytime
                from their profile.
              </p>
              <Button
                type="submit"
                className="mt-auto h-11 w-full text-base font-semibold"
                disabled={isPending}
              >
                {isPending ? "Creating..." : `${selectLabel} new customer`}
              </Button>
            </form>
          )}
        </div>

        {error && (
          <p className="mt-3 shrink-0 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

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
