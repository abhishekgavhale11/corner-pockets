import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import {
  buildLinesFromEntries,
  formatCafeLineExpanded,
  formatCafeTabSummary,
  isCafeItemType,
  type CafeTabLine,
} from "@/lib/utils/cafe-tabs";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import { formatCurrency } from "@/lib/utils/format";
import type {
  CustomerTodayGlanceDTO,
  FrameGlanceLineDTO,
  NotebookEntryDTO,
} from "@/types";

function entryAppliesToCustomer(
  entry: NotebookEntryDTO,
  customerId: string
): boolean {
  if (entry.customerId === customerId) return true;
  return entry.contributors?.some((c) => c.customerId === customerId) ?? false;
}

function customerShareAmount(
  entry: NotebookEntryDTO,
  customerId: string
): number {
  const contributor = entry.contributors?.find(
    (c) => c.customerId === customerId
  );
  return contributor?.amount ?? entry.amount;
}

function isCafeEntryForCustomer(
  entry: NotebookEntryDTO,
  customerId: string
): boolean {
  return (
    entry.section === CAFE_SECTION &&
    entry.customerId === customerId &&
    !entry.tableId
  );
}

function isFrameEntry(entry: NotebookEntryDTO): boolean {
  return entry.section !== CAFE_SECTION && !isCafeItemType(entry.type);
}

export function buildCustomerTodayGlance(
  entries: NotebookEntryDTO[],
  customerId: string
): CustomerTodayGlanceDTO {
  const frameMap = new Map<string, FrameGlanceLineDTO>();
  const cafeEntries: NotebookEntryDTO[] = [];

  for (const entry of entries) {
    if (entry.status === "CANCELLED") continue;
    if (!entryAppliesToCustomer(entry, customerId)) continue;

    if (isCafeEntryForCustomer(entry, customerId)) {
      cafeEntries.push(entry);
      continue;
    }

    if (!isFrameEntry(entry)) continue;

    const amount = customerShareAmount(entry, customerId);
    const typeLabel = getEntryDisplayLabel(entry);
    const label = `${sectionLabel(entry.section)} · ${typeLabel}`;
    const existing = frameMap.get(label);

    if (existing) {
      existing.quantity += 1;
      existing.amount += amount;
    } else {
      frameMap.set(label, { label, quantity: 1, amount });
    }
  }

  const frames = [...frameMap.values()];
  const cafe = buildLinesFromEntries(cafeEntries);
  const frameCount = frames.reduce((sum, line) => sum + line.quantity, 0);
  const frameTotal = frames.reduce((sum, line) => sum + line.amount, 0);
  const cafeTotal = cafe.reduce(
    (sum: number, line: CafeTabLine) => sum + line.amount,
    0
  );

  return {
    frameCount,
    frameTotal,
    cafeTotal,
    grandTotal: frameTotal + cafeTotal,
    frames,
    cafe,
  };
}

export function formatCustomerTodayGlanceSummary(
  glance: CustomerTodayGlanceDTO
): string {
  if (glance.frameCount === 0 && glance.cafe.length === 0) {
    return "Nothing yet today";
  }

  const parts: string[] = [];

  if (glance.frameCount > 0) {
    parts.push(
      `${glance.frameCount} frame${glance.frameCount === 1 ? "" : "s"} (${formatCurrency(glance.frameTotal)})`
    );
  }

  if (glance.cafe.length > 0) {
    parts.push(formatCafeTabSummary(glance.cafe));
  }

  return parts.join(" · ");
}

export function cafeGlanceCountForType(
  glance: CustomerTodayGlanceDTO,
  type: NotebookEntryType
): number {
  return glance.cafe
    .filter((line) => line.type === type)
    .reduce((sum, line) => sum + line.quantity, 0);
}

export function formatFrameGlanceLine(line: FrameGlanceLineDTO): string {
  if (line.quantity > 1) {
    return `${line.label} ×${line.quantity}`;
  }
  return line.label;
}

export type { CafeTabLine };

export { formatCafeLineExpanded, formatCafeTabSummary };
