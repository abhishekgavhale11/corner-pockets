"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEntryContributors } from "@/actions/notebook-entries";
import { searchNotebookCustomers } from "@/actions/notebook-ledger";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";

type ContributorRow = {
  customerId: string;
  customerName: string;
  amount: string;
};

interface ContributorsSplitDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
}

export function ContributorsSplitDialog({
  entry,
  onClose,
}: ContributorsSplitDialogProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ContributorRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = entry !== null;

  const entryId = entry?.id;

  useEffect(() => {
    if (!open || !entryId || !entry) return;
    if (entry.contributors?.length) {
      setRows(
        entry.contributors.map((contributor) => ({
          customerId: contributor.customerId,
          customerName: contributor.customerName,
          amount: String(contributor.amount),
        }))
      );
    } else {
      setRows([]);
    }
    setQuery("");
    setResults([]);
    setError(null);
    // Only re-init when the dialog opens or a different entry is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entry data read on open/entryId change only
  }, [open, entryId]);

  const total = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const amount = Number.parseInt(row.amount, 10);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [rows]
  );

  const remaining = entry ? entry.amount - total : 0;

  const searchCustomers = async (q: string) => {
    const customers = await searchNotebookCustomers(q.trim() || undefined);
    setResults(customers);
  };

  const addCustomer = (customer: CustomerDTO) => {
    setRows((current) => {
      if (current.some((row) => row.customerId === customer.id)) return current;
      const currentTotal = current.reduce((sum, row) => {
        const amount = Number.parseInt(row.amount, 10);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      const left = entry ? Math.max(0, entry.amount - currentTotal) : 0;
      return [
        ...current,
        {
          customerId: customer.id,
          customerName: customer.name,
          amount: left > 0 ? String(left) : "",
        },
      ];
    });
    setQuery("");
    setResults([]);
  };

  const submit = () => {
    if (!entry) return;
    if (rows.length === 0) {
      setError("Add at least one contributor");
      return;
    }
    if (total !== entry.amount) {
      setError(`Contributor total must equal ${formatCurrency(entry.amount)}`);
      return;
    }

    const contributors = rows.map((row) => ({
      customerId: row.customerId,
      amount: Number.parseInt(row.amount, 10),
    }));

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("contributors", JSON.stringify(contributors));
      const result = await setEntryContributors(formData);
      if (result.success) {
        router.refresh();
        onClose();
        return;
      }
      setError(result.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Assign Contributors">
      {entry && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Total {formatCurrency(entry.amount)} · Remaining{" "}
            <span
              className={
                remaining === 0 ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"
              }
            >
              {formatCurrency(remaining)}
            </span>
          </p>

          <div>
            <Label>+ Add Contributor</Label>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                void searchCustomers(e.target.value);
              }}
              onFocus={() => void searchCustomers(query)}
              placeholder="Search customer"
              className="mt-1 text-sm"
            />
            {results.length > 0 && (
              <ul className="mt-1 max-h-28 overflow-y-auto rounded border border-gray-200">
                {results.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-1.5 text-left text-xs hover:bg-emerald-50"
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
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <p className="text-xs text-gray-500">No contributors yet — search and add above.</p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={row.customerId}
                  className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {row.customerName}
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
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setRows((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, amount: digits } : item
                          )
                        );
                      }}
                      className="w-20 rounded-md border border-gray-300 bg-white py-1.5 pl-5 pr-2 text-right text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${row.customerName}`}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    onClick={() =>
                      setRows((current) =>
                        current.filter((item) => item.customerId !== row.customerId)
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="button" fullWidth disabled={isPending} onClick={submit}>
              {isPending ? "Saving..." : "Save Split"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
