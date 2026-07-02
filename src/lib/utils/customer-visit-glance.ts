import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import {
  buildLinesFromEntries,
  isCafeItemType,
  type CafeTabLine,
} from "@/lib/utils/cafe-tabs";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import type {
  CustomerPendingItemDTO,
  CustomerVisitGlanceDTO,
  FrameGlanceLineDTO,
  NotebookEntryDTO,
} from "@/types";

function isGameEntry(entry: NotebookEntryDTO): boolean {
  return entry.section !== CAFE_SECTION && !isCafeItemType(entry.type);
}

export function formatVisitGlanceCafeLine(line: CafeTabLine): string {
  if (line.itemNote?.trim()) {
    const label = line.itemNote.trim();
    return line.quantity > 1 ? `${label} ×${line.quantity}` : label;
  }

  if (line.type === "FOOD") {
    return line.quantity > 1 ? `Food ×${line.quantity}` : "Food";
  }

  const label = line.label;
  return line.quantity > 1 ? `${label} ×${line.quantity}` : label;
}

export function formatVisitGlanceGameLine(line: FrameGlanceLineDTO): string {
  return line.quantity > 1 ? `${line.label} ×${line.quantity}` : line.label;
}

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function buildCustomerVisitGlance(input: {
  customerId: string;
  customerName: string;
  visitStartedAt?: string;
  billTotal: number;
  paidAmount: number;
  dueAmount: number;
  items: CustomerPendingItemDTO[];
}): CustomerVisitGlanceDTO {
  const gameMap = new Map<string, FrameGlanceLineDTO>();
  const cafeEntries: NotebookEntryDTO[] = [];

  for (const item of input.items) {
    const entry = item.entry;
    const lineTotal = item.lineAmount ?? entry.amount;
    if (lineTotal <= 0) continue;

    if (entry.section === CAFE_SECTION || isCafeItemType(entry.type)) {
      cafeEntries.push({
        ...entry,
        amount: lineTotal,
        quantity: entry.quantity ?? 1,
      });
      continue;
    }

    if (!isGameEntry(entry)) continue;

    const typeLabel = getEntryDisplayLabel(entry);
    const label = `${sectionLabel(entry.section)} · ${typeLabel}`;
    const existing = gameMap.get(label);

    if (existing) {
      existing.quantity += 1;
      existing.amount += lineTotal;
    } else {
      gameMap.set(label, { label, quantity: 1, amount: lineTotal });
    }
  }

  const games = [...gameMap.values()];
  const cafe = buildLinesFromEntries(cafeEntries);

  return {
    customerId: input.customerId,
    customerName: input.customerName,
    hasActiveVisit: true,
    visitStartedAt: input.visitStartedAt,
    billTotal: input.billTotal,
    paidAmount: input.paidAmount,
    dueAmount: input.dueAmount,
    games,
    cafe,
  };
}

export function emptyCustomerVisitGlance(
  customerId: string,
  customerName: string
): CustomerVisitGlanceDTO {
  return {
    customerId,
    customerName,
    hasActiveVisit: false,
    billTotal: 0,
    paidAmount: 0,
    dueAmount: 0,
    games: [],
    cafe: [],
  };
}
