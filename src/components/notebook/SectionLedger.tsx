import type { NotebookEntryDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { formatTime } from "@/lib/utils/format-time";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";

interface SectionLedgerProps {
  entries: NotebookEntryDTO[];
  emptyMessage?: string;
}

export function SectionLedger({
  entries,
  emptyMessage = "No entries yet today.",
}: SectionLedgerProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-baseline justify-between gap-2 py-2.5 text-sm"
        >
          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-gray-400">
              {formatTime(entry.createdAt)}
            </span>{" "}
            <span className="font-medium text-gray-900">{entry.customerName}</span>
            <span className="ml-2 text-gray-500">
              {getEntryDisplayLabel(entry)}
            </span>
            {entry.status === "PAID" && (
              <span className="ml-2 text-xs text-emerald-600">Paid</span>
            )}
          </div>
          <span className="shrink-0 font-medium text-gray-700">
            {formatCurrency(entry.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
