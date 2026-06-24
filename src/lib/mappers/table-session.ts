import type { ITableSession } from "@/models/TableSession";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import {
  isFrozenTableSessionStatus,
  normalizeTableSessionStatus,
} from "@/lib/constants/table-sessions";
import { calculateGameChargeFromActiveMs } from "@/lib/utils/session-billing";
import { formatTableSessionLabel } from "@/lib/utils/session-display";
import { computeActivePlayMs } from "@/lib/utils/session-timer";
import type { TableSessionDTO } from "@/types";

export function toTableSessionDTO(
  session: ITableSession,
  cafeChargeAmount = 0
): TableSessionDTO {
  const status = normalizeTableSessionStatus(session.status);
  const tableSessionNumber = session.tableSessionNumber ?? session.sessionNumber;

  const activePlayMs = isFrozenTableSessionStatus(status)
    ? session.activePlayMs
    : computeActivePlayMs({
        status,
        startedAt: session.startedAt,
        pausedAt: session.pausedAt,
        endedAt: session.endedAt,
        totalPausedMs: session.totalPausedMs,
      });

  const gameChargeAmount = isFrozenTableSessionStatus(status)
    ? session.gameChargeAmount
    : calculateGameChargeFromActiveMs(activePlayMs, session.hourlyRate);

  const assignedCustomers = (session.assignedCustomers ?? []).map((row) => ({
    customerId: row.customerId.toString(),
    customerName: row.customerName,
  }));
  const assignedCustomerNames = assignedCustomers.map((row) => row.customerName);

  return {
    id: session._id.toString(),
    sessionNumber: session.sessionNumber,
    tableSessionNumber,
    displayLabel: formatTableSessionLabel(
      session.tableId,
      tableSessionNumber
    ),
    tableId: session.tableId,
    tableName: sectionLabel(session.tableId),
    status,
    rateType: session.rateType,
    startedAt: session.startedAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString(),
    endedAt: session.endedAt?.toISOString(),
    totalPausedMs: session.totalPausedMs,
    activePlayMs,
    hourlyRate: session.hourlyRate,
    gameChargeAmount,
    cafeChargeAmount,
    totalChargeAmount: gameChargeAmount + cafeChargeAmount,
    gameEntryId: session.gameEntryId?.toString(),
    assignedCustomerNames,
    assignedCustomers,
    auditLog: session.auditLog.map((entry) => ({
      action: entry.action,
      at: entry.at.toISOString(),
      by: entry.by,
    })),
    createdBy: session.createdBy,
    createdAt: session.createdAt.toISOString(),
  };
}
