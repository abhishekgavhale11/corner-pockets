import {
  isBigSnookerSection,
  isPoolMiniSection,
} from "@/lib/constants/counter-sections";
import { rollupAttributedChargeLines } from "@/lib/financial-summary/charge-line-rollup";
import type {
  BusinessDayHistoryCafeLineDTO,
  BusinessDayHistoryCategorySummaryDTO,
  BusinessDayHistoryFrameLineDTO,
  BusinessDayHistoryInsightsDTO,
  BusinessDayHistorySectionSummaryDTO,
} from "@/types";

/**
 * Presentation rollup of already-built History charge lines.
 * Delegates Bill / Received / Cash / GPay / Created to the Financial Summary Engine.
 */
export function rollupHistoryChargeLines(
  lines: Array<{
    amount: number;
    paidAmount: number;
    paymentMethod?: string;
    paymentAllocations?: Array<{ paymentMethod: string; amount: number }>;
  }>
): BusinessDayHistoryCategorySummaryDTO {
  return rollupAttributedChargeLines(lines);
}

function uniqueEntryCount(lines: Array<{ entryId: string }>): number {
  return new Set(lines.map((line) => line.entryId)).size;
}

/** Cafe display lines use `${orderId}-${index}` for order items. */
export function countCafeOrders(
  cafe: BusinessDayHistoryCafeLineDTO[]
): number {
  if (cafe.length === 0) return 0;
  return new Set(cafe.map((line) => line.entryId.replace(/-\d+$/, ""))).size;
}

function withGamesPlayed(
  summary: BusinessDayHistoryCategorySummaryDTO,
  gamesPlayed: number
): BusinessDayHistorySectionSummaryDTO {
  return { ...summary, gamesPlayed };
}

export function emptySectionSummary(): BusinessDayHistorySectionSummaryDTO {
  return {
    bill: 0,
    received: 0,
    cashCollection: 0,
    gpayCollection: 0,
    outstandingCreated: 0,
    gamesPlayed: 0,
  };
}

export function emptyHistoryInsights(): BusinessDayHistoryInsightsDTO {
  return {
    overall: {
      totalRevenue: 0,
      totalReceived: 0,
      cashCollection: 0,
      gpayCollection: 0,
      outstandingCreated: 0,
      outstandingRecovered: 0,
    },
    bigSnooker: emptySectionSummary(),
    poolMini: emptySectionSummary(),
    totalSnooker: emptySectionSummary(),
    cafe: emptySectionSummary(),
  };
}

export function addSectionSummaries(
  a: BusinessDayHistorySectionSummaryDTO,
  b: BusinessDayHistorySectionSummaryDTO
): BusinessDayHistorySectionSummaryDTO {
  return {
    bill: a.bill + b.bill,
    received: a.received + b.received,
    cashCollection: a.cashCollection + b.cashCollection,
    gpayCollection: a.gpayCollection + b.gpayCollection,
    outstandingCreated: a.outstandingCreated + b.outstandingCreated,
    gamesPlayed: a.gamesPlayed + b.gamesPlayed,
  };
}

export function buildSnookerSectionInsights(
  frames: BusinessDayHistoryFrameLineDTO[]
): Pick<
  BusinessDayHistoryInsightsDTO,
  "bigSnooker" | "poolMini" | "totalSnooker"
> {
  const bigFrames = frames.filter((line) => isBigSnookerSection(line.section));
  const poolFrames = frames.filter((line) => isPoolMiniSection(line.section));

  return {
    bigSnooker: withGamesPlayed(
      rollupHistoryChargeLines(bigFrames),
      uniqueEntryCount(bigFrames)
    ),
    poolMini: withGamesPlayed(
      rollupHistoryChargeLines(poolFrames),
      uniqueEntryCount(poolFrames)
    ),
    totalSnooker: withGamesPlayed(
      rollupHistoryChargeLines(frames),
      uniqueEntryCount(frames)
    ),
  };
}

export { buildDetailHistoryInsights } from "@/lib/business-day/history-insights-display";
