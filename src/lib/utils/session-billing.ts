import type { CounterRateType } from "@/lib/constants/counter-rates";
import { resolveBigSnookerHourlyRate, resolveCounterRateAmount } from "@/lib/constants/counter-rates";
import {
  isBigSnookerTableId,
  poolMiniGameType,
  type PoolMiniTableId,
  type TableSessionStatus,
  type TableSessionTableId,
} from "@/lib/constants/table-sessions";
import { computeActivePlayMs } from "@/lib/utils/session-timer";

export function resolveHourlyRate(
  tableId: TableSessionTableId,
  rateType: CounterRateType
): number {
  if (isBigSnookerTableId(tableId)) {
    return resolveBigSnookerHourlyRate(rateType);
  }
  const type = poolMiniGameType(tableId as PoolMiniTableId);
  return resolveCounterRateAmount({ type, rateType }) ?? 0;
}

export function calculateGameChargeFromActiveMs(
  activeMs: number,
  hourlyRate: number
): number {
  if (activeMs <= 0 || hourlyRate <= 0) return 0;
  const activeMinutes = activeMs / 60000;
  return Math.round((activeMinutes * hourlyRate) / 60);
}

export function calculateSessionGameCharge(input: {
  tableId: TableSessionTableId;
  rateType: CounterRateType;
  startedAt: string | Date;
  pausedAt?: string | Date | null;
  endedAt?: string | Date | null;
  totalPausedMs: number;
  status: TableSessionStatus;
}): { activeMs: number; amount: number; hourlyRate: number } {
  const hourlyRate = resolveHourlyRate(input.tableId, input.rateType);
  const activeMs = computeActivePlayMs({
    status: input.status,
    startedAt: input.startedAt,
    pausedAt: input.pausedAt,
    endedAt: input.endedAt,
    totalPausedMs: input.totalPausedMs,
    now: input.endedAt ? new Date(input.endedAt) : new Date(),
  });

  return {
    activeMs,
    hourlyRate,
    amount: calculateGameChargeFromActiveMs(activeMs, hourlyRate),
  };
}
