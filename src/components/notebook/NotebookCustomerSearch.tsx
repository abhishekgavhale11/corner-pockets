"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  createQuickCustomer,
  updateCustomerNotes,
} from "@/actions/customers";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import type { CustomerDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

interface NotebookCustomerSearchProps {
  selectedCustomer: CustomerDTO | null;
  onSelect: (customer: CustomerDTO | null) => void;
}

export function NotebookCustomerSearch({
  selectedCustomer,
  onSelect,
}: NotebookCustomerSearchProps) {
  const [mode, setMode] = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [name, setName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedCustomer) {
      setNotes(selectedCustomer.notes ?? "");
    }
  }, [selectedCustomer]);

  const loadResults = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    const customers = await searchNotebookCustomers(
      searchQuery.trim() || undefined
    );
    setResults(customers);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (mode === "search" && !selectedCustomer) {
      const timer = setTimeout(() => {
        void loadResults(query);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [query, mode, selectedCustomer, loadResults]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      if (newPhone.trim()) {
        formData.set("phone", newPhone.trim());
      }
      const result = await createQuickCustomer(formData);
      if (result.success) {
        onSelect(result.data);
        setMode("search");
        setName("");
        setNewPhone("");
        return;
      }
      setError(result.error);
    });
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", selectedCustomer.id);
      formData.set("notes", notes);
      const result = await updateCustomerNotes(formData);
      if (result.success) {
        onSelect(result.data);
        return;
      }
      setError(result.error);
    });
  };

  if (selectedCustomer) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div>
          <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
          <p className="text-sm text-gray-600">
            {formatCustomerContactLine(selectedCustomer)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {selectedCustomer.walletEnabled
              ? "Wallet member"
              : "Regular customer"}
          </p>
        </div>

        <div>
          <Label htmlFor="customer-notes">Notes</Label>
          <Textarea
            id="customer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Usually pays later. Friend of Rahul."
            rows={2}
            className="mt-1"
          />
          {notes !== (selectedCustomer.notes ?? "") && (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={isPending}
              onClick={handleSaveNotes}
            >
              {isPending ? "Saving..." : "Save notes"}
            </Button>
          )}
          {selectedCustomer.notes && notes === (selectedCustomer.notes ?? "") && (
            <p className="mt-1 text-xs text-amber-700">{selectedCustomer.notes}</p>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            onSelect(null);
            setNotes("");
          }}
        >
          Change customer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "search" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMode("search")}
        >
          Search
        </Button>
        <Button
          type="button"
          variant={mode === "create" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMode("create")}
        >
          Quick Customer
        </Button>
      </div>

      {mode === "search" ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="nb-search">Name, phone, or card ID</Label>
            <Input
              id="nb-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers..."
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500">
            {query.trim()
              ? "Search results"
              : "Recent notebook customers shown first"}
          </p>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {results.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    onSelect(customer);
                    setNotes(customer.notes ?? "");
                  }}
                  className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-600 hover:bg-emerald-50"
                >
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-600">
                    {formatCustomerContactLine(customer)}
                  </p>
                  {customer.notes && (
                    <p className="mt-1 truncate text-xs text-amber-700">
                      {customer.notes}
                    </p>
                  )}
                </button>
              ))}
              {!isLoading && results.length === 0 && (
                <p className="text-sm text-gray-500">No customers found.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <Label htmlFor="nb-name">Name</Label>
            <Input
              id="nb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="nb-new-phone">Phone (optional)</Label>
            <Input
              id="nb-new-phone"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500">
            Saved to the main customer database. Upgrade to member anytime from
            their profile.
          </p>
          <Button type="submit" fullWidth disabled={isPending}>
            {isPending ? "Creating..." : "Create & Select"}
          </Button>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
