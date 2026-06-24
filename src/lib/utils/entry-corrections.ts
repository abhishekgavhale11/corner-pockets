import type { NotebookCorrectionField } from "@/lib/constants/notebook-corrections";
import type {
  NotebookEntryCorrectionChangeDTO,
  NotebookEntryCorrectionDTO,
  NotebookEntryDTO,
} from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { getEntryDisplayLabel, getNotebookEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";

export interface FieldCorrectionDisplay {
  field: NotebookCorrectionField;
  from: string;
  to: string;
}

export function getAggregatedCorrections(
  entry: Pick<
    NotebookEntryDTO,
    | "corrections"
    | "type"
    | "amount"
    | "playerCount"
    | "quantity"
    | "itemNote"
    | "customerName"
    | "isUnassigned"
    | "snookerGame"
    | "rateType"
  >
): FieldCorrectionDisplay[] {
  if (!entry.corrections?.length) {
    return [];
  }

  const firstByField = new Map<NotebookCorrectionField, string>();

  for (const correction of entry.corrections) {
    for (const change of correction.changes) {
      if (!firstByField.has(change.field)) {
        firstByField.set(change.field, change.fromLabel);
      }
    }
  }

  const current = getCurrentCorrectionLabels(entry);
  const result: FieldCorrectionDisplay[] = [];

  for (const field of firstByField.keys()) {
    const from = firstByField.get(field)!;
    const to = current[field];
    if (from !== to) {
      result.push({ field, from, to });
    }
  }

  return result;
}

export function entryHasCorrections(
  entry: Pick<NotebookEntryDTO, "corrections">
): boolean {
  return Boolean(entry.corrections?.length);
}

function getCurrentCorrectionLabels(
  entry: Pick<
    NotebookEntryDTO,
    | "type"
    | "amount"
    | "playerCount"
    | "quantity"
    | "itemNote"
    | "customerName"
    | "isUnassigned"
    | "snookerGame"
    | "rateType"
  >
): Record<NotebookCorrectionField, string> {
  const customerName = entry.isUnassigned ? "Unassigned" : entry.customerName;
  const entryType = getEntryDisplayLabel(entry);

  return {
    customer: customerName,
    entryType,
    amount: formatCurrency(entry.amount),
    playerCount: entry.playerCount ? `${entry.playerCount}P` : "",
    quantity: entry.quantity ? `×${entry.quantity}` : "",
    itemNote: entry.itemNote?.trim() || "",
  };
}

export function buildSnookerAmountCorrectionChanges(
  type: NotebookEntryType,
  fromAmount: number,
  toAmount: number
): NotebookEntryCorrectionChangeDTO[] {
  const changes: NotebookEntryCorrectionChangeDTO[] = [];
  const fromTypeLabel = getNotebookEntryDisplayLabel(type, fromAmount);
  const toTypeLabel = getNotebookEntryDisplayLabel(type, toAmount);

  if (fromTypeLabel !== toTypeLabel) {
    changes.push({
      field: "entryType",
      fromLabel: fromTypeLabel,
      toLabel: toTypeLabel,
    });
  }

  if (fromAmount !== toAmount) {
    changes.push({
      field: "amount",
      fromLabel: formatCurrency(fromAmount),
      toLabel: formatCurrency(toAmount),
    });
  }

  return changes;
}

export function formatCorrectionHistoryEntry(
  correction: NotebookEntryCorrectionDTO
): string {
  const changes = correction.changes
    .map((c) => `${c.fromLabel} → ${c.toLabel}`)
    .join(", ");
  return `${changes} — ${correction.correctionReason}`;
}
