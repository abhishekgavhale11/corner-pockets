import type { PoolMiniTableId } from "@/lib/constants/table-sessions";
import type { TableSessionAuditEntryDTO } from "@/types";
import { formatClockTime } from "@/lib/utils/session-timer";

const TABLE_SHORT_NAMES: Record<PoolMiniTableId, string> = {
  MINI_SNOOKER: "Mini",
  POOL_1: "Pool 1",
  POOL_2: "Pool 2",
};

export function getTableShortName(tableId: PoolMiniTableId): string {
  return TABLE_SHORT_NAMES[tableId];
}

/** Staff-facing label: "Pool 1 - Session 2" or "Mini" */
export function formatTableSessionLabel(
  tableId: PoolMiniTableId,
  tableSessionNumber: number
): string {
  if (tableId === "MINI_SNOOKER") {
    return "Mini";
  }
  const short = getTableShortName(tableId);
  return `${short} - Session ${tableSessionNumber}`;
}

export function formatTableSessionLabelWithTable(
  tableId: PoolMiniTableId,
  tableSessionNumber: number
): string {
  return formatTableSessionLabel(tableId, tableSessionNumber);
}

export function formatCheckoutSessionTitle(
  tableId: PoolMiniTableId,
  tableSessionNumber: number
): string {
  if (tableId === "MINI_SNOOKER") {
    return `Mini Session ${tableSessionNumber}`;
  }
  return formatTableSessionLabel(tableId, tableSessionNumber);
}

export function formatAssignedCustomers(
  names: string[] | undefined
): string {
  const unique = [...new Set((names ?? []).map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return "Unassigned";
  return unique.join(", ");
}

export function formatAuditClockTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

const TIMELINE_ACTION_LABELS: Record<
  "STOPPED" | "RESUMED" | "PAUSED",
  string
> = {
  STOPPED: "Stopped",
  RESUMED: "Resumed",
  PAUSED: "Paused",
};

/** One-line session clock: Started · Stopped · Resumed … */
export function formatSessionActivityLine(input: {
  startedAt: string;
  auditLog?: TableSessionAuditEntryDTO[];
}): string {
  const parts = [`Started ${formatClockTime(input.startedAt)}`];

  const sorted = [...(input.auditLog ?? [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  for (const entry of sorted) {
    if (entry.action === "STOPPED" || entry.action === "RESUMED" || entry.action === "PAUSED") {
      parts.push(
        `${TIMELINE_ACTION_LABELS[entry.action]} ${formatClockTime(entry.at)}`
      );
    }
  }

  return parts.join(" · ");
}
