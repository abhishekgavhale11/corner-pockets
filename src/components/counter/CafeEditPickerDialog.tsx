"use client";

import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import {
  formatCafeLineExpanded,
  type CafeOpenTab,
} from "@/lib/utils/cafe-tabs";
import type { NotebookEntryDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { ENTRY_LOCKED_TOOLTIP } from "@/lib/visit-bill/entry-edit-lock-constants";
import { isNotebookEntryEditLocked } from "@/lib/visit-bill/entry-edit-lock-utils";
import { Button } from "@/components/ui/Button";
import { EntryLockIndicator } from "@/components/counter/EntryLockIndicator";
import { cn } from "@/lib/utils/cn";

interface CafeEditPickerDialogProps {
  tab: CafeOpenTab | null;
  onClose: () => void;
  onSelectEntry: (entry: NotebookEntryDTO) => void;
}

export function CafeEditPickerDialog({
  tab,
  onClose,
  onSelectEntry,
}: CafeEditPickerDialogProps) {
  if (!tab) return null;

  const title =
    tab.kind === "customer" ? tab.customerName : tab.tableName;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl">
        <h2 className="text-lg font-bold text-gray-900">Edit — {title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Select an item to edit. Locked items need reversal/adjustment.
        </p>
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {tab.lines.map((line) =>
            line.entries.map((entry) => {
              const locked = isNotebookEntryEditLocked(entry);

              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      if (locked) return;
                      onSelectEntry(entry);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left",
                      locked
                        ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-500"
                        : "border-gray-200 hover:border-emerald-400 hover:bg-emerald-50"
                    )}
                    title={locked ? ENTRY_LOCKED_TOOLTIP : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {locked ? <EntryLockIndicator /> : null}
                      <span
                        className={cn(
                          "truncate text-sm font-medium",
                          locked ? "text-gray-500" : "text-gray-900"
                        )}
                      >
                        {line.entries.length === 1
                          ? formatCafeLineExpanded(line)
                          : `${entryTypeLabel(entry.type)}${
                              entry.type !== "FOOD" && (entry.quantity ?? 1) > 1
                                ? ` x${entry.quantity}`
                                : entry.type === "FOOD" && entry.itemNote
                                  ? ` · ${entry.itemNote}`
                                  : ""
                            }`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
                      {formatCurrency(entry.amount)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 h-10 w-full text-sm"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
