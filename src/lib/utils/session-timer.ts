import type { TableSessionStatus } from "@/lib/constants/table-sessions";
import { isFrozenTableSessionStatus } from "@/lib/constants/table-sessions";
import { formatAuditClockTime } from "@/lib/utils/session-display";

export type SessionTimerInput = {
  status: TableSessionStatus;
  startedAt: string | Date;
  pausedAt?: string | Date | null;
  endedAt?: string | Date | null;
  totalPausedMs: number;
  now?: Date;
};

export function computeActivePlayMs(input: SessionTimerInput): number {
  const started = new Date(input.startedAt).getTime();
  const now = input.now ? input.now.getTime() : Date.now();
  const totalPausedMs = input.totalPausedMs ?? 0;

  if (input.status === "PAUSED" && input.pausedAt) {
    const paused = new Date(input.pausedAt).getTime();
    return Math.max(0, paused - started - totalPausedMs);
  }

  if (isFrozenTableSessionStatus(input.status) && input.endedAt) {
    const ended = new Date(input.endedAt).getTime();
    return Math.max(0, ended - started - totalPausedMs);
  }

  if (input.status === "ACTIVE") {
    return Math.max(0, now - started - totalPausedMs);
  }

  return 0;
}

export function formatActiveDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m`;
}

export function formatClockTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function formatTimeRange(
  start: string | Date,
  end?: string | Date | null
): string {
  const startLabel = formatClockTime(start).replace(/\s/g, "");
  if (!end) return startLabel;
  const endLabel = formatClockTime(end).replace(/\s/g, "");
  return `${startLabel}-${endLabel}`;
}

export function formatCompactDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  return `${minutes}m`;
}

export function formatSessionTimeRange(
  start: string | Date,
  end: string | Date,
  durationMs: number
): string {
  const startLabel = formatAuditClockTime(start);
  const endLabel = formatAuditClockTime(end);
  return `${startLabel} → ${endLabel} (${formatCompactDuration(durationMs)})`;
}

export function formatDurationMinutes(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hours}h`;
  return `${hours}h ${rem}m`;
}
