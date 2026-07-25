"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignCounterEntryCustomer } from "@/actions/notebook-entries";
import {
  getAssignCustomerSuggestions,
  type AssignCustomerSuggestionGroup,
} from "@/actions/notebook-ledger";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import { formatCurrency } from "@/lib/utils/format";
import { formatTime } from "@/lib/utils/format-time";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import type { CustomerDTO, NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { invalidateCustomerGlanceCache } from "@/components/counter/CustomerPreviewContext";
import { cn } from "@/lib/utils/cn";

interface UnassignedEntryDialogProps {
  entry: NotebookEntryDTO | null;
  onClose: () => void;
  onSplit: (entry: NotebookEntryDTO) => void;
  allowSplit?: boolean;
}

const GROUP_HEADER: Record<
  AssignCustomerSuggestionGroup["id"],
  { emoji: string; className: string }
> = {
  playing: { emoji: "⭐", className: "text-amber-700" },
  recent: { emoji: "🕒", className: "text-sky-700" },
  frequent: { emoji: "👥", className: "text-violet-700" },
  others: { emoji: "", className: "text-gray-600" },
};

function CustomerListItem({
  customer,
  isSelected,
  disabled,
  onSelect,
}: {
  customer: CustomerDTO;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "w-full rounded-md px-3 py-2.5 text-left transition-colors",
          isSelected
            ? "border border-emerald-600 bg-emerald-50"
            : "border border-transparent bg-white hover:border-emerald-200 hover:bg-emerald-50/60"
        )}
      >
        <span className="block text-sm font-bold text-gray-900">
          {customer.name}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">
          {formatCustomerContactLine(customer)}
        </span>
      </button>
    </li>
  );
}

export function UnassignedEntryDialog({
  entry,
  onClose,
  onSplit,
  allowSplit = true,
}: UnassignedEntryDialogProps) {
  const router = useRouter();
  const open = entry !== null;
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<AssignCustomerSuggestionGroup[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setGroups([]);
      setSelectedCustomer(null);
      setError(null);
      return;
    }

    const trimmed = query.trim();
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      void getAssignCustomerSuggestions(trimmed || undefined).then(
        (suggestionGroups) => {
          setGroups(suggestionGroups);
          setIsLoading(false);
        }
      );
    }, trimmed ? 200 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, entry?.id, query]);

  const totalCustomers = useMemo(
    () => groups.reduce((count, group) => count + group.customers.length, 0),
    [groups]
  );

  const assign = () => {
    if (!entry || !selectedCustomer) return;

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("customerId", selectedCustomer.id);
      const result = await assignCounterEntryCustomer(formData);
      if (result.success) {
        invalidateCustomerGlanceCache(selectedCustomer.id);
        router.refresh();
        onClose();
        return;
      }
      setError(result.error);
    });
  };

  const handleSplit = () => {
    if (!entry) return;
    onClose();
    onSplit(entry);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Assign Customer">
      {entry && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {formatTime(entry.createdAt)} · {getEntryDisplayLabel(entry)} ·{" "}
            {formatCurrency(entry.amount)}
          </p>

          <div>
            <Input
              className="h-10 text-sm"
              placeholder="Search name or phone…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedCustomer(null);
              }}
              autoFocus
            />

            <div className="mt-2 max-h-72 min-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-1">
              {isLoading ? (
                <p className="px-3 py-3 text-sm text-gray-500">Searching…</p>
              ) : totalCustomers === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-500">
                  No customers found.
                </p>
              ) : (
                <ul className="space-y-3">
                  {groups.map((group) => {
                    const header = GROUP_HEADER[group.id];
                    return (
                      <li key={group.id}>
                        <p
                          className={cn(
                            "sticky top-0 z-[1] bg-gray-50/95 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm",
                            header.className
                          )}
                        >
                          {header.emoji ? `${header.emoji} ` : ""}
                          {group.label}
                        </p>
                        <ul className="space-y-1">
                          {group.customers.map((customer) => (
                            <CustomerListItem
                              key={customer.id}
                              customer={customer}
                              isSelected={selectedCustomer?.id === customer.id}
                              disabled={isPending}
                              onSelect={() => setSelectedCustomer(customer)}
                            />
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {selectedCustomer && (
            <p className="text-sm text-gray-700">
              Selected:{" "}
              <span className="font-semibold text-gray-900">
                {selectedCustomer.name}
              </span>
            </p>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            type="button"
            fullWidth
            onClick={assign}
            disabled={!selectedCustomer || isPending}
          >
            {isPending ? "Assigning…" : "Assign Customer"}
          </Button>

          {allowSplit ? (
            <div className="border-t border-gray-200 pt-4">
              <p className="mb-2 text-center text-xs text-gray-500">
                Need to split this bill?
              </p>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={handleSplit}
                disabled={isPending}
              >
                Split Bill
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
