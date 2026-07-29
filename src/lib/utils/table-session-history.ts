import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import {
  normalizeTableSessionStatus,
  isFrozenTableSessionStatus,
} from "@/lib/constants/table-sessions";
import { calculateGameChargeFromActiveMs } from "@/lib/utils/session-billing";
import { formatTableSessionLabel, formatSessionActivityLine } from "@/lib/utils/session-display";
import { computeActivePlayMs } from "@/lib/utils/session-timer";
import type {
  TableSessionHistoryDTO,
  TableSessionHistoryPaymentStatus,
  TableSessionPaymentEventDTO,
} from "@/types";
import type { ITableSession } from "@/models/TableSession";

type LeanEntry = {
  _id: { toString(): string };
  sessionId?: { toString(): string };
  section: string;
  amount: number;
  status: string;
  customerId?: { toString(): string };
  customerName?: string;
  paidByName?: string;
  paymentMethod?: NotebookPaymentMethod;
  settlementId?: { toString(): string };
  contributors?: {
    customerName: string;
    status: string;
  }[];
};

type LeanSettlement = {
  _id: { toString(): string };
  entryIds: { toString(): string }[];
  totalAmount: number;
  paymentMethod: NotebookPaymentMethod;
  paidByName: string;
  status: "COMPLETED" | "REVERSED";
  createdAt: Date;
  reversedAt?: Date;
  reversalReason?: string;
};

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

function collectCustomerNames(entries: LeanEntry[]): string[] {
  const names: string[] = [];
  for (const entry of entries) {
    if (entry.paidByName?.trim()) {
      names.push(entry.paidByName.trim());
    }
    if (entry.customerName?.trim()) {
      names.push(entry.customerName.trim());
    }
    for (const contributor of entry.contributors ?? []) {
      if (contributor.customerName?.trim()) {
        names.push(contributor.customerName.trim());
      }
    }
  }
  return uniqueNames(names);
}

function buildPaymentEvents(
  settlements: LeanSettlement[]
): TableSessionPaymentEventDTO[] {
  const events: TableSessionPaymentEventDTO[] = [];

  for (const settlement of settlements) {
    events.push({
      kind: "paid",
      at: settlement.createdAt.toISOString(),
      amount: settlement.totalAmount,
      paymentMethod: settlement.paymentMethod,
      customerName: settlement.paidByName,
    });
    if (settlement.status === "REVERSED" && settlement.reversedAt) {
      events.push({
        kind: "reversed",
        at: settlement.reversedAt.toISOString(),
        reversalReason: settlement.reversalReason,
      });
    }
  }

  return events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

function resolvePaymentStatus(
  session: ITableSession,
  entries: LeanEntry[],
  settlements: LeanSettlement[]
): TableSessionHistoryPaymentStatus {
  const status = normalizeTableSessionStatus(session.status);
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "PAUSED") return "PAUSED";
  if (status === "PAID") return "PAID";

  const hasPaidEntry = entries.some((entry) => entry.status === "PAID");
  const hasPendingEntry = entries.some(
    (entry) => entry.status === "PENDING" || entry.status === "REVERSED"
  );
  const lastSettlement = settlements[settlements.length - 1];

  if (hasPaidEntry && !hasPendingEntry) return "PAID";
  if (lastSettlement?.status === "REVERSED" && hasPendingEntry) {
    return "REVERSED";
  }
  if (
    status === "STOPPED" ||
    status === "ENDED" ||
    status === "CHECKOUT_PENDING" ||
    hasPendingEntry
  ) {
    return "PENDING";
  }
  if (hasPaidEntry) return "PAID";
  return "PENDING";
}

export function buildTableSessionHistoryRow(
  session: ITableSession,
  entries: LeanEntry[],
  settlements: LeanSettlement[]
): TableSessionHistoryDTO {
  const sessionId = session._id.toString();
  const sessionEntries = entries.filter(
    (entry) => entry.sessionId?.toString() === sessionId
  );

  const cafeAmount = sessionEntries
    .filter((entry) => entry.section === CAFE_SECTION)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const status = normalizeTableSessionStatus(session.status);
  const tableSessionNumber =
    session.tableSessionNumber ?? session.sessionNumber;

  const activePlayMs = isFrozenTableSessionStatus(status)
    ? session.activePlayMs
    : computeActivePlayMs({
        status,
        startedAt: session.startedAt,
        pausedAt: session.pausedAt,
        endedAt: session.endedAt,
        totalPausedMs: session.totalPausedMs,
      });

  const gameAmount = isFrozenTableSessionStatus(status)
    ? session.gameChargeAmount
    : calculateGameChargeFromActiveMs(activePlayMs, session.hourlyRate);

  const paymentEvents = buildPaymentEvents(settlements);
  const paymentStatus = resolvePaymentStatus(
    session,
    sessionEntries,
    settlements
  );

  const customerNames = uniqueNames([
    ...(session.assignedCustomers ?? []).map((row) => row.customerName),
    ...collectCustomerNames(sessionEntries),
    ...settlements.map((s) => s.paidByName),
  ]);

  return {
    sessionId,
    sessionNumber: session.sessionNumber,
    tableSessionNumber,
    displayLabel: formatTableSessionLabel(session.tableId, tableSessionNumber),
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString(),
    activityLine: formatSessionActivityLine({
      startedAt: session.startedAt.toISOString(),
      auditLog: (session.auditLog ?? []).map((entry) => ({
        action: entry.action,
        at: entry.at.toISOString(),
        by: entry.by,
      })),
    }),
    activePlayMs,
    gameAmount,
    cafeAmount,
    totalAmount: gameAmount + cafeAmount,
    paymentStatus,
    customerNames,
    paymentEvents,
  };
}

export function isHistorySessionRow(
  session: Pick<ITableSession, "status">
): boolean {
  const status = normalizeTableSessionStatus(session.status);
  return status !== "ACTIVE" && status !== "PAUSED";
}

export function paymentMethodLabel(
  method?: NotebookPaymentMethod
): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "GPAY":
      return "GPay";
    default:
      return "";
  }
}

export function paymentStatusLabel(
  status: TableSessionHistoryPaymentStatus
): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PAUSED":
      return "Paused";
    case "PENDING":
      return "Pending";
    case "PAID":
      return "Paid";
    case "REVERSED":
      return "Reversed";
  }
}
