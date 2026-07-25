import {
  isBigSnookerSection,
  isPoolMiniSection,
} from "@/lib/constants/counter-sections";
import { attributePaymentCollections } from "@/lib/business-day/payment-collections";
import { frameDueAmount, framePaidAmount } from "@/lib/utils/frame-payment";
import type {
  BusinessDayHistoryCafeLineDTO,
  BusinessDayHistoryCategorySummaryDTO,
  BusinessDayHistoryDetailDTO,
  BusinessDayHistoryFrameLineDTO,
  BusinessDayHistoryInsightsDTO,
  BusinessDayHistorySectionSummaryDTO,
} from "@/types";

/**
 * Presentation rollup of already-built History charge lines.
 * Same Bill / Received / Due primitives; Cash / GPay / Wallet label Received.
 */
export function rollupHistoryChargeLines(
  lines: Array<{
    amount: number;
    paidAmount: number;
    paymentMethod?: string;
    walletAmount?: number;
  }>
): BusinessDayHistoryCategorySummaryDTO {
  let bill = 0;
  let received = 0;
  let cashCollection = 0;
  let gpayCollection = 0;
  let walletCollection = 0;

  for (const line of lines) {
    bill += line.amount;
    const paid = framePaidAmount(line.paidAmount);
    received += paid;
    const portion = attributePaymentCollections({
      paidAmount: paid,
      paymentMethod: line.paymentMethod,
      walletAmount: line.walletAmount,
    });
    cashCollection += portion.cash;
    gpayCollection += portion.gpay;
    walletCollection += portion.wallet;
  }

  return {
    bill,
    received,
    cashCollection,
    gpayCollection,
    walletCollection,
    outstandingCreated: frameDueAmount(bill, received),
  };
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
    walletCollection: 0,
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
      walletCollection: 0,
      outstandingCreated: 0,
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
    walletCollection: a.walletCollection + b.walletCollection,
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

/** Presentation insights for one closed Business Day detail. */
export function buildDetailHistoryInsights(
  detail: BusinessDayHistoryDetailDTO
): BusinessDayHistoryInsightsDTO {
  const snooker = buildSnookerSectionInsights(detail.frames);
  return {
    overall: {
      totalRevenue: detail.summary.todaysBill,
      totalReceived: detail.summary.totalReceived,
      cashCollection: detail.summary.cashCollection,
      gpayCollection: detail.summary.gpayCollection,
      walletCollection: detail.summary.walletCollection,
      outstandingCreated: detail.summary.outstandingCreated,
    },
    ...snooker,
    cafe: withGamesPlayed(detail.cafeSummary, countCafeOrders(detail.cafe)),
  };
}
