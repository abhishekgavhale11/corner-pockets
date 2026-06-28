import {
  CAFE_SECTION,
  CAFE_TABLE_IDS,
  type CafeTableId,
} from "@/lib/constants/counter-sections";
import { isBigSnookerSection } from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import {
  isPoolMiniTableId,
} from "@/lib/constants/table-sessions";
import { formatTableSessionLabel } from "@/lib/utils/session-display";
import {
  entryAmountRemaining,
  isSessionPayableEntry,
  isUnassignedPayableEntry,
  sessionEntryAmountRemaining,
} from "@/lib/utils/entry-contributors";
import type {
  CustomerOpenTabSummaryDTO,
  NotebookEntryDTO,
  OpenTabSummaryDTO,
  SessionOpenTabSummaryDTO,
  TableOpenTabSummaryDTO,
} from "@/types";

export function isCafeTableId(section: string): section is CafeTableId {
  return (CAFE_TABLE_IDS as readonly string[]).includes(section);
}

export function isUnassignedTableGameEntry(entry: NotebookEntryDTO): boolean {
  if (isPoolMiniTableId(entry.section)) return false;
  if (entry.sessionId) return false;
  return isCafeTableId(entry.section) && isUnassignedPayableEntry(entry);
}

export function isUnassignedTableCafeEntry(entry: NotebookEntryDTO): boolean {
  if (entry.tableId && isPoolMiniTableId(entry.tableId)) return false;
  return (
    entry.section === CAFE_SECTION &&
    Boolean(entry.tableId) &&
    !entry.sessionId &&
    isUnassignedPayableEntry(entry)
  );
}

export function getTableIdForCheckoutEntry(
  entry: NotebookEntryDTO
): CafeTableId | null {
  if (isUnassignedTableGameEntry(entry)) {
    return entry.section as CafeTableId;
  }
  if (isUnassignedTableCafeEntry(entry)) {
    return entry.tableId!;
  }
  return null;
}

export function isTableCheckoutEntry(
  entry: NotebookEntryDTO,
  tableId: CafeTableId
): boolean {
  return getTableIdForCheckoutEntry(entry) === tableId;
}

export function buildTableOpenTabSummaries(
  entries: NotebookEntryDTO[]
): TableOpenTabSummaryDTO[] {
  const map = new Map<
    CafeTableId,
    { pendingAmount: number; pendingCount: number }
  >();

  for (const entry of entries) {
    const tableId = getTableIdForCheckoutEntry(entry);
    if (!tableId || isPoolMiniTableId(tableId) || isBigSnookerSection(tableId)) {
      continue;
    }

    const remaining = entryAmountRemaining(entry);
    if (remaining <= 0) continue;

    const existing = map.get(tableId) ?? { pendingAmount: 0, pendingCount: 0 };
    existing.pendingAmount += remaining;
    existing.pendingCount += 1;
    map.set(tableId, existing);
  }

  return [...map.entries()]
    .map(([tableId, totals]) => ({
      kind: "table" as const,
      tabKey: `table:${tableId}`,
      tableId,
      tableName: sectionLabel(tableId),
      pendingAmount: totals.pendingAmount,
      pendingCount: totals.pendingCount,
    }))
    .sort((a, b) => b.pendingAmount - a.pendingAmount);
}

export function buildSessionOpenTabSummaries(input: {
  sessions: {
    id: string;
    sessionNumber: number;
    tableSessionNumber: number;
    tableId: import("@/lib/constants/table-sessions").TableSessionTableId;
    gameChargeAmount: number;
    startedAt: string;
  }[];
  entries: NotebookEntryDTO[];
}): SessionOpenTabSummaryDTO[] {
  const cafeBySession = new Map<string, { amount: number; count: number }>();

  const gameBySession = new Map<string, number>();

  for (const entry of input.entries) {
    if (!entry.sessionId || entry.customerId) continue;

    if (entry.section === CAFE_SECTION) {
      const remaining = sessionEntryAmountRemaining(entry);
      if (remaining <= 0) continue;

      const existing = cafeBySession.get(entry.sessionId) ?? {
        amount: 0,
        count: 0,
      };
      existing.amount += remaining;
      existing.count += 1;
      cafeBySession.set(entry.sessionId, existing);
      continue;
    }

    if (!isSessionPayableEntry(entry, entry.sessionId)) continue;
    const gameRemaining = sessionEntryAmountRemaining(entry);
    if (gameRemaining <= 0) continue;
    gameBySession.set(entry.sessionId, gameRemaining);
  }

  return input.sessions
    .map((session) => {
      const cafe = cafeBySession.get(session.id) ?? { amount: 0, count: 0 };
      const gameFromEntry = gameBySession.get(session.id);
      const hasGameEntry = input.entries.some(
        (entry) =>
          entry.sessionId === session.id && entry.section !== CAFE_SECTION
      );
      const gameRemaining =
        gameFromEntry ??
        (!hasGameEntry && session.gameChargeAmount > 0
          ? session.gameChargeAmount
          : 0);
      const gameCount = gameRemaining > 0 ? 1 : 0;
      const pendingCount = gameCount + cafe.count;
      const pendingAmount = gameRemaining + cafe.amount;
      if (pendingCount === 0) return null;

      return {
        kind: "session" as const,
        tabKey: `session:${session.id}`,
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        tableSessionNumber: session.tableSessionNumber,
        displayLabel: formatTableSessionLabel(
          session.tableId,
          session.tableSessionNumber
        ),
        tableId: session.tableId,
        tableName: sectionLabel(session.tableId),
        startedAt: session.startedAt,
        gameAmount: gameRemaining,
        cafeAmount: cafe.amount,
        pendingAmount,
        pendingCount,
      };
    })
    .filter((row): row is SessionOpenTabSummaryDTO => row !== null)
    .sort((a, b) => b.pendingAmount - a.pendingAmount);
}

export function isSessionCheckoutEntry(
  entry: NotebookEntryDTO,
  sessionId: string
): boolean {
  return isSessionPayableEntry(entry, sessionId);
}

export function groupCheckoutTabs(tabs: OpenTabSummaryDTO[]) {
  const poolMini = tabs.filter(
    (tab): tab is SessionOpenTabSummaryDTO =>
      tab.kind === "session" && isPoolMiniTableId(tab.tableId)
  );
  const tables = tabs.filter(
    (tab): tab is TableOpenTabSummaryDTO => tab.kind === "table"
  );
  const customers = tabs.filter(
    (tab): tab is CustomerOpenTabSummaryDTO => tab.kind === "customer"
  );

  const summarize = (group: OpenTabSummaryDTO[]) => ({
    billCount: group.length,
    subtotal: group.reduce((sum, tab) => sum + tab.pendingAmount, 0),
  });

  return {
    poolMini,
    tables,
    customers,
    summaries: {
      poolMini: summarize(poolMini),
      tables: summarize(tables),
      customers: summarize(customers),
    },
  };
}

export function toCustomerOpenTabSummary(summary: {
  customerId: string;
  customerName: string;
  phoneNumber: string;
  cardId: string;
  walletEnabled: boolean;
  pendingAmount: number;
  pendingCount: number;
}): CustomerOpenTabSummaryDTO {
  return {
    kind: "customer",
    tabKey: `customer:${summary.customerId}`,
    ...summary,
  };
}
