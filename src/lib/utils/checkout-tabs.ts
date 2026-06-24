import {
  CAFE_SECTION,
  CAFE_TABLE_IDS,
  type CafeTableId,
} from "@/lib/constants/counter-sections";
import { isBigSnookerSection } from "@/lib/constants/counter-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { isPoolMiniTableId } from "@/lib/constants/table-sessions";
import { formatTableSessionLabel } from "@/lib/utils/session-display";
import {
  entryHasContributors,
  isEntryCheckoutEligible,
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
  return (
    isCafeTableId(entry.section) &&
    !entry.sessionId &&
    !entry.customerId &&
    !entryHasContributors(entry) &&
    isEntryCheckoutEligible(entry)
  );
}

export function isUnassignedTableCafeEntry(entry: NotebookEntryDTO): boolean {
  if (entry.tableId && isPoolMiniTableId(entry.tableId)) return false;
  return (
    entry.section === CAFE_SECTION &&
    Boolean(entry.tableId) &&
    !entry.sessionId &&
    !entry.customerId &&
    !entryHasContributors(entry) &&
    isEntryCheckoutEligible(entry)
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
    if (!tableId || isPoolMiniTableId(tableId)) continue;

    const existing = map.get(tableId) ?? { pendingAmount: 0, pendingCount: 0 };
    existing.pendingAmount += entry.amount;
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
    tableId: import("@/lib/constants/table-sessions").PoolMiniTableId;
    gameChargeAmount: number;
    startedAt: string;
  }[];
  entries: NotebookEntryDTO[];
}): SessionOpenTabSummaryDTO[] {
  const cafeBySession = new Map<string, { amount: number; count: number }>();

  for (const entry of input.entries) {
    if (!entry.sessionId || entry.section !== CAFE_SECTION) continue;
    if (!isEntryCheckoutEligible(entry) || entry.customerId) continue;

    const existing = cafeBySession.get(entry.sessionId) ?? {
      amount: 0,
      count: 0,
    };
    existing.amount += entry.amount;
    existing.count += 1;
    cafeBySession.set(entry.sessionId, existing);
  }

  return input.sessions
    .map((session) => {
      const cafe = cafeBySession.get(session.id) ?? { amount: 0, count: 0 };
      const gameCount = session.gameChargeAmount > 0 ? 1 : 0;
      const pendingCount = gameCount + cafe.count;
      const pendingAmount = session.gameChargeAmount + cafe.amount;
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
        gameAmount: session.gameChargeAmount,
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
  return entry.sessionId === sessionId && isEntryCheckoutEligible(entry);
}

export function groupCheckoutTabs(tabs: OpenTabSummaryDTO[]) {
  const bigSnooker = tabs.filter(
    (tab): tab is TableOpenTabSummaryDTO =>
      tab.kind === "table" && isBigSnookerSection(tab.tableId)
  );
  const poolMini = tabs.filter(
    (tab): tab is SessionOpenTabSummaryDTO => tab.kind === "session"
  );
  const customers = tabs.filter(
    (tab): tab is CustomerOpenTabSummaryDTO => tab.kind === "customer"
  );

  const summarize = (group: OpenTabSummaryDTO[]) => ({
    billCount: group.length,
    subtotal: group.reduce((sum, tab) => sum + tab.pendingAmount, 0),
  });

  return {
    bigSnooker,
    poolMini,
    customers,
    summaries: {
      bigSnooker: summarize(bigSnooker),
      poolMini: summarize(poolMini),
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
