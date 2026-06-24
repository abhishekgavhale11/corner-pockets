import type { CounterRateType } from "@/lib/constants/counter-rates";
import { resolveCounterRateAmount } from "@/lib/constants/counter-rates";
import {
  poolMiniGameType,
  type PoolMiniTableId,
  type TableSessionStatus,
} from "@/lib/constants/table-sessions";
import { computeActivePlayMs } from "@/lib/utils/session-timer";

export function resolveHourlyRate(
  tableId: PoolMiniTableId,
  rateType: CounterRateType
): number {
  const type = poolMiniGameType(tableId);
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
  tableId: import("@/lib/constants/table-sessions").PoolMiniTableId;
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
