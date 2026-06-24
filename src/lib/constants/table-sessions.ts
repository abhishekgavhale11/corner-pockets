import { POOL_MINI_SECTIONS } from "@/lib/constants/counter-sections";

export const POOL_MINI_TABLE_IDS = POOL_MINI_SECTIONS;

export type PoolMiniTableId = (typeof POOL_MINI_TABLE_IDS)[number];

export const TABLE_SESSION_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "STOPPED",
  "ENDED",
  "CHECKOUT_PENDING",
  "PAID",
] as const;

export type TableSessionStatus = (typeof TABLE_SESSION_STATUSES)[number];

export const ACTIVE_TABLE_SESSION_STATUSES = ["ACTIVE", "PAUSED"] as const;

export type ActiveTableSessionStatus =
  (typeof ACTIVE_TABLE_SESSION_STATUSES)[number];

/** Stopped / unpaid — table is free for a new session until paid. */
export const UNPAID_TABLE_SESSION_STATUSES = [
  "STOPPED",
  "ENDED",
  "CHECKOUT_PENDING",
] as const;

export const OPEN_TABLE_SESSION_STATUSES = [
  ...ACTIVE_TABLE_SESSION_STATUSES,
  ...UNPAID_TABLE_SESSION_STATUSES,
] as const;

export type OpenTableSessionStatus = (typeof OPEN_TABLE_SESSION_STATUSES)[number];

export const TABLE_SESSION_AUDIT_ACTIONS = [
  "STARTED",
  "PAUSED",
  "RESUMED",
  "STOPPED",
  "ENDED",
] as const;

export type TableSessionAuditAction =
  (typeof TABLE_SESSION_AUDIT_ACTIONS)[number];

export const TABLE_SESSION_AUDIT_LABELS: Record<TableSessionAuditAction, string> =
  {
    STARTED: "Session started",
    PAUSED: "Session paused",
    RESUMED: "Session resumed",
    STOPPED: "Session stopped",
    ENDED: "Session ended",
  };

export function isPoolMiniTableId(section: string): section is PoolMiniTableId {
  return (POOL_MINI_TABLE_IDS as readonly string[]).includes(section);
}

/** Map legacy CLOSED rows to PAID. */
export function normalizeTableSessionStatus(
  status: string
): TableSessionStatus {
  if (status === "CLOSED") return "PAID";
  return status as TableSessionStatus;
}

export function isFrozenTableSessionStatus(status: TableSessionStatus): boolean {
  return (
    status === "STOPPED" ||
    status === "ENDED" ||
    status === "CHECKOUT_PENDING" ||
    status === "PAID"
  );
}

export function isStoppedUnpaidStatus(status: TableSessionStatus): boolean {
  return (UNPAID_TABLE_SESSION_STATUSES as readonly string[]).includes(status);
}

export function poolMiniGameType(
  tableId: PoolMiniTableId
): "MINI" | "POOL" {
  return tableId === "MINI_SNOOKER" ? "MINI" : "POOL";
}

export function tableSessionStatusLabel(status: TableSessionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PAUSED":
      return "Paused";
    case "STOPPED":
      return "Stopped";
    case "ENDED":
      return "Ended";
    case "CHECKOUT_PENDING":
      return "Checkout pending";
    case "PAID":
      return "Paid";
  }
}
