"use client";

import { CAFE_TABLE_IDS } from "@/lib/constants/counter-sections";
import type { CafeTableId } from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

interface CafeTableTabDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (tableId: CafeTableId) => void;
}

export function CafeTableTabDialog({
  open,
  onClose,
  onSelect,
}: CafeTableTabDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl">
        <h2 className="text-lg font-bold text-gray-900">Table Tab</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Select a table for cafe charges
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-1.5">
          {CAFE_TABLE_IDS.map((tableId) => (
            <li key={tableId}>
              <button
                type="button"
                onClick={() => {
                  onSelect(tableId);
                  onClose();
                }}
                className={cn(
                  "w-full rounded border border-gray-200 px-3 py-2.5 text-left text-sm font-semibold text-gray-800 hover:border-emerald-400 hover:bg-emerald-50"
                )}
              >
                {sectionLabel(tableId)}
              </button>
            </li>
          ))}
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
