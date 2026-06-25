import type { CafeTableId } from "@/lib/constants/counter-sections";
import { CAFE_TABLE_IDS } from "@/lib/constants/counter-sections";
import type { TableSessionDTO } from "@/types";
import { calculateGameChargeFromActiveMs } from "@/lib/utils/session-billing";
import { computeActivePlayMs } from "@/lib/utils/session-timer";
import { isPoolMiniTableId, isFrozenTableSessionStatus } from "@/lib/constants/table-sessions";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";

export const CAFE_ITEM_TYPES = [
  "CIGARETTE",
  "WATER",
  "COFFEE",
  "FOOD",
] as const;

export type CafeTabLine = {
  lineKey: string;
  type: NotebookEntryType;
  label: string;
  quantity: number;
  amount: number;
  itemNote?: string;
  entries: NotebookEntryDTO[];
};

export type CafeCustomerTab = {
  kind: "customer";
  tabKey: string;
  customerId: string;
  customerName: string;
  phoneNumber: string;
  cardId: string;
  total: number;
  lines: CafeTabLine[];
  entries: NotebookEntryDTO[];
  latestAt: string;
};

export type CafeTableTab = {
  kind: "table";
  tabKey: string;
  tableId: CafeTableId;
  tableName: string;
  cafeTotal: number;
  gameTotal: number;
  grandTotal: number;
  total: number;
  lines: CafeTabLine[];
  entries: NotebookEntryDTO[];
  latestAt: string;
};

export type CafeOpenTab = CafeCustomerTab | CafeTableTab;

const CAFE_SHORT_LABELS: Partial<Record<NotebookEntryType, string>> = {
  CIGARETTE: "Cig",
  WATER: "Water",
  COFFEE: "Coffee",
  FOOD: "Food",
};

function isOpenCafeEntry(entry: NotebookEntryDTO): boolean {
  return entry.status === "PENDING" || entry.status === "REVERSED";
}

export function isCafeItemType(type: NotebookEntryType): boolean {
  return (CAFE_ITEM_TYPES as readonly string[]).includes(type);
}

function cafeLineKey(entry: NotebookEntryDTO): string {
  if (entry.type === "FOOD") {
    const note = entry.itemNote?.trim() ?? "";
    const price = entry.unitPrice ?? entry.amount;
    return `FOOD:${note}:${price}`;
  }
  return entry.type;
}

export function buildLinesFromEntries(
  customerEntries: NotebookEntryDTO[]
): CafeTabLine[] {
  const lineMap = new Map<string, CafeTabLine>();

  for (const entry of customerEntries) {
    const key = cafeLineKey(entry);
    const existing = lineMap.get(key);
    const qty = entry.quantity ?? 1;
    if (existing) {
      existing.quantity += qty;
      existing.amount += entry.amount;
      existing.entries.push(entry);
    } else {
      lineMap.set(key, {
        lineKey: key,
        type: entry.type,
        label: entryTypeLabel(entry.type),
        quantity: qty,
        amount: entry.amount,
        itemNote: entry.itemNote,
        entries: [entry],
      });
    }
  }

  return [...lineMap.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function formatCafeLineCompact(line: CafeTabLine): string {
  const short = CAFE_SHORT_LABELS[line.type] ?? line.label;
  if (line.type === "FOOD") {
    return short;
  }
  if (line.quantity > 1) {
    return `${short} x${line.quantity}`;
  }
  return short;
}

export function formatCafeTabSummary(lines: CafeTabLine[]): string {
  return lines.map(formatCafeLineCompact).join(" · ");
}

export function formatCafeLineExpanded(line: CafeTabLine): string {
  if (line.type === "FOOD") {
    return line.itemNote ? `Food · ${line.itemNote}` : "Food";
  }
  const label = entryTypeLabel(line.type);
  if (line.quantity > 1) {
    return `${label} x${line.quantity}`;
  }
  return label;
}

export function matchesCafeTabSearch(tab: CafeOpenTab, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  if (tab.kind === "customer") {
    return (
      tab.customerName.toLowerCase().includes(term) ||
      tab.phoneNumber.toLowerCase().includes(term) ||
      tab.cardId.toLowerCase().includes(term)
    );
  }

  return tab.tableName.toLowerCase().includes(term);
}

export function buildEmptyCafeCustomerTab(customer: {
  id: string;
  name: string;
  phone?: string;
  cardId?: string;
}): CafeCustomerTab {
  return {
    kind: "customer",
    tabKey: `customer:${customer.id}`,
    customerId: customer.id,
    customerName: customer.name,
    phoneNumber: customer.phone ?? "",
    cardId: customer.cardId ?? "",
    total: 0,
    lines: [],
    entries: [],
    latestAt: new Date().toISOString(),
  };
}

export function buildEmptyCafeTableTab(tableId: CafeTableId): CafeTableTab {
  return {
    kind: "table",
    tabKey: `table:${tableId}`,
    tableId,
    tableName: sectionLabel(tableId),
    cafeTotal: 0,
    gameTotal: 0,
    grandTotal: 0,
    total: 0,
    lines: [],
    entries: [],
    latestAt: new Date().toISOString(),
  };
}

export function mergeCafeTabsWithStaged(
  entryTabs: CafeOpenTab[],
  stagedCustomers: {
    id: string;
    name: string;
    phone?: string;
    cardId?: string;
  }[],
  stagedTableIds: CafeTableId[]
): CafeOpenTab[] {
  const customerIds = new Set(
    entryTabs
      .filter((tab): tab is CafeCustomerTab => tab.kind === "customer")
      .map((tab) => tab.customerId)
  );
  const tableIds = new Set(
    entryTabs
      .filter((tab): tab is CafeTableTab => tab.kind === "table")
      .map((tab) => tab.tableId)
  );

  const stagedCustomerTabs = stagedCustomers
    .filter((customer) => !customerIds.has(customer.id))
    .map(buildEmptyCafeCustomerTab);

  const stagedTableTabs = stagedTableIds
    .filter((tableId) => !tableIds.has(tableId))
    .map(buildEmptyCafeTableTab);

  return [...stagedTableTabs, ...stagedCustomerTabs, ...entryTabs];
}

function computeTableGameTotal(
  tableId: CafeTableId,
  gameEntries: NotebookEntryDTO[]
): number {
  return gameEntries
    .filter(
      (entry) =>
        entry.section === tableId &&
        isOpenCafeEntry(entry) &&
        !isCafeItemType(entry.type)
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function buildCafeCustomerTabs(
  entries: NotebookEntryDTO[],
  cardIdByCustomerId: Record<string, string> = {}
): CafeCustomerTab[] {
  const openEntries = entries.filter(
    (entry) => isOpenCafeEntry(entry) && entry.customerId && !entry.tableId
  );
  const byCustomer = new Map<string, NotebookEntryDTO[]>();

  for (const entry of openEntries) {
    const key = entry.customerId!;
    const list = byCustomer.get(key) ?? [];
    list.push(entry);
    byCustomer.set(key, list);
  }

  const tabs: CafeCustomerTab[] = [];

  for (const customerEntries of byCustomer.values()) {
    const first = customerEntries[0];
    const lines = buildLinesFromEntries(customerEntries);
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const latestAt = customerEntries.reduce(
      (latest, entry) =>
        entry.createdAt > latest ? entry.createdAt : latest,
      customerEntries[0].createdAt
    );

    tabs.push({
      kind: "customer",
      tabKey: `customer:${first.customerId}`,
      customerId: first.customerId!,
      customerName: first.customerName,
      phoneNumber: first.phoneNumber,
      cardId: cardIdByCustomerId[first.customerId!] ?? "",
      total,
      lines,
      entries: customerEntries,
      latestAt,
    });
  }

  return tabs.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
}

export function buildCafeTableTabs(
  cafeEntries: NotebookEntryDTO[],
  gameEntries: NotebookEntryDTO[],
  poolMiniSessions: TableSessionDTO[] = []
): CafeTableTab[] {
  const sessionByTable = new Map(
    poolMiniSessions
      .filter(
        (session) =>
          session.status === "ACTIVE" || session.status === "PAUSED"
      )
      .map((session) => [session.tableId, session])
  );

  const openCafeEntries = cafeEntries.filter((entry) => {
    if (!isOpenCafeEntry(entry) || !entry.tableId || entry.customerId) {
      return false;
    }
    const session = sessionByTable.get(entry.tableId as CafeTableId);
    if (session && isPoolMiniTableId(entry.tableId)) {
      return entry.sessionId === session.id;
    }
    return !entry.sessionId;
  });
  const byTable = new Map<CafeTableId, NotebookEntryDTO[]>();

  for (const entry of gameEntries) {
    if (
      isOpenCafeEntry(entry) &&
      isPoolMiniTableId(entry.section) &&
      !entry.customerId &&
      !entry.sessionId &&
      !isCafeItemType(entry.type)
    ) {
      const tableId = entry.section as CafeTableId;
      if (!byTable.has(tableId) && !sessionByTable.has(tableId)) {
        byTable.set(tableId, []);
      }
    }
  }

  for (const session of poolMiniSessions) {
    if (
      (session.status === "ACTIVE" || session.status === "PAUSED") &&
      !byTable.has(session.tableId)
    ) {
      byTable.set(session.tableId, []);
    }
  }

  for (const entry of openCafeEntries) {
    const key = entry.tableId!;
    const list = byTable.get(key) ?? [];
    list.push(entry);
    byTable.set(key, list);
  }

  const tabs: CafeTableTab[] = [];

  for (const [tableId, tableEntries] of byTable.entries()) {
    const lines = buildLinesFromEntries(tableEntries);
    const cafeTotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const session = sessionByTable.get(tableId);
    const gameTotal = session
      ? isFrozenTableSessionStatus(session.status)
        ? session.gameChargeAmount
        : calculateGameChargeFromActiveMs(
            computeActivePlayMs({
              status: session.status,
              startedAt: session.startedAt,
              pausedAt: session.pausedAt,
              endedAt: session.endedAt,
              totalPausedMs: session.totalPausedMs,
            }),
            session.hourlyRate
          )
      : computeTableGameTotal(tableId, gameEntries);
    const openGameEntries = gameEntries.filter(
      (entry) =>
        isOpenCafeEntry(entry) &&
        entry.section === tableId &&
        !entry.customerId
    );
    const timestamps = [
      ...tableEntries.map((entry) => entry.createdAt),
      ...openGameEntries.map((entry) => entry.createdAt),
    ];
    const latestAt =
      timestamps.length > 0
        ? timestamps.reduce((latest, value) =>
            value > latest ? value : latest
          )
        : new Date().toISOString();

    tabs.push({
      kind: "table",
      tabKey: `table:${tableId}`,
      tableId,
      tableName: sectionLabel(tableId),
      cafeTotal,
      gameTotal,
      grandTotal: cafeTotal + gameTotal,
      total: cafeTotal,
      lines,
      entries: tableEntries,
      latestAt,
    });
  }

  return tabs.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
}

export function buildCafeOpenTabs(
  cafeEntries: NotebookEntryDTO[],
  gameEntries: NotebookEntryDTO[],
  cardIdByCustomerId: Record<string, string> = {},
  poolMiniSessions: TableSessionDTO[] = []
): CafeOpenTab[] {
  const customerTabs = buildCafeCustomerTabs(cafeEntries, cardIdByCustomerId);
  const tableTabs = buildCafeTableTabs(
    cafeEntries,
    gameEntries,
    poolMiniSessions
  );
  return [...tableTabs, ...customerTabs].sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
}
