import mongoose, { type Types } from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import BusinessDayFinalSummary, {
  type BusinessDayFinalSummaryCustomer,
  type BusinessDayFinalSummarySection,
} from "@/models/BusinessDayFinalSummary";
import {
  CAFE_SECTION,
  isBigSnookerSection,
  isPoolMiniSection,
} from "@/lib/constants/counter-sections";
import { attributePaymentCollections } from "@/lib/business-day/payment-collections";
import { countUnassignedCharges } from "@/lib/business-day/unassigned-charges";
import { getClosingOutstandingAtClose } from "@/lib/business-day/history-outstanding";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import {
  frameDueAmount,
  framePaidAmount,
  frameReceivedAmount,
} from "@/lib/utils/frame-payment";
import { resolveBusinessDate } from "@/lib/utils/business-date";
import type { NotebookEntryDTO } from "@/types";

export type BusinessDayFinalSummaryPayload = {
  businessDayId: string;
  businessDayNumber: number;
  businessDate: Date;
  closedAt: Date;
  bill: number;
  paid: number;
  outstandingCreated: number;
  cashCollection: number;
  gpayCollection: number;
  outstandingCollected: number;
  closingOutstanding: number;
  openingOutstanding: number;
  unassignedFrames: number;
  unassignedCafeItems: number;
  snooker: BusinessDayFinalSummarySection;
  bigSnooker: BusinessDayFinalSummarySection;
  poolMini: BusinessDayFinalSummarySection;
  cafe: BusinessDayFinalSummarySection;
  customers: BusinessDayFinalSummaryCustomer[];
};

type ChargeLine = {
  entryId: string;
  customerId?: string;
  customerName: string;
  section?: string;
  amount: number;
  paidAmount: number;
  paymentMethod?: NotebookEntryDTO["paymentMethod"];
  paymentAllocations?: NotebookEntryDTO["paymentAllocations"];
};

function rollupLines(
  lines: ChargeLine[],
  gamesPlayed: number
): BusinessDayFinalSummarySection {
  let bill = 0;
  let received = 0;
  let cashCollection = 0;
  let gpayCollection = 0;

  for (const line of lines) {
    bill += line.amount;
    const paid = framePaidAmount(line.paidAmount);
    received += paid;
    const portion = attributePaymentCollections({
      paidAmount: paid,
      paymentMethod: line.paymentMethod,
      paymentAllocations: line.paymentAllocations,
    });
    cashCollection += portion.cash;
    gpayCollection += portion.gpay;
  }

  return {
    bill,
    received,
    cashCollection,
    gpayCollection,
    outstandingCreated: frameDueAmount(bill, received),
    gamesPlayed,
  };
}

function collectFrameChargeLines(entry: NotebookEntryDTO): ChargeLine[] {
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.map((contributor) => ({
      entryId: entry.id,
      customerId: contributor.customerId,
      customerName: contributor.customerName,
      section: entry.section,
      amount: contributor.amount,
      paidAmount: frameReceivedAmount(
        contributor.paidAmount,
        contributor.balanceCollectedAmount
      ),
      paymentMethod: contributor.paymentMethod ?? entry.paymentMethod,
    }));
  }

  if (!entry.customerId) {
    return [];
  }

  return [
    {
      entryId: entry.id,
      customerId: entry.customerId,
      customerName: entry.customerName,
      section: entry.section,
      amount: entry.amount,
      paidAmount: frameReceivedAmount(
        entry.paidAmount,
        entry.balanceCollectedAmount
      ),
      paymentMethod: entry.paymentMethod,
      paymentAllocations: entry.paymentAllocations,
    },
  ];
}

function uniqueEntryCount(lines: ChargeLine[]): number {
  return new Set(lines.map((line) => line.entryId)).size;
}

function buildCustomerSettlements(
  frames: ChargeLine[],
  cafe: ChargeLine[]
): BusinessDayFinalSummaryCustomer[] {
  type Acc = {
    customerId: string;
    customerName: string;
    bigSnooker: number;
    poolMini: number;
    cafe: number;
    received: number;
    cashCollection: number;
    gpayCollection: number;
  };

  const byCustomer = new Map<string, Acc>();

  function ensure(customerId: string, customerName: string): Acc {
    const existing = byCustomer.get(customerId);
    if (existing) {
      if (customerName && existing.customerName === "—") {
        existing.customerName = customerName;
      }
      return existing;
    }
    const created: Acc = {
      customerId,
      customerName: customerName || "—",
      bigSnooker: 0,
      poolMini: 0,
      cafe: 0,
      received: 0,
      cashCollection: 0,
      gpayCollection: 0,
    };
    byCustomer.set(customerId, created);
    return created;
  }

  function addPayment(
    row: Acc,
    paidAmount: number,
    paymentMethod?: ChargeLine["paymentMethod"],
    paymentAllocations?: ChargeLine["paymentAllocations"]
  ) {
    const paid = framePaidAmount(paidAmount);
    row.received += paid;
    const portion = attributePaymentCollections({
      paidAmount: paid,
      paymentMethod,
      paymentAllocations,
    });
    row.cashCollection += portion.cash;
    row.gpayCollection += portion.gpay;
  }

  for (const line of frames) {
    if (!line.customerId) continue;
    const row = ensure(line.customerId, line.customerName);
    if (line.section && isBigSnookerSection(line.section)) {
      row.bigSnooker += line.amount;
    } else if (line.section && isPoolMiniSection(line.section)) {
      row.poolMini += line.amount;
    } else {
      row.bigSnooker += line.amount;
    }
    addPayment(
      row,
      line.paidAmount,
      line.paymentMethod,
      line.paymentAllocations
    );
  }

  for (const line of cafe) {
    if (!line.customerId) continue;
    const row = ensure(line.customerId, line.customerName);
    row.cafe += line.amount;
    addPayment(
      row,
      line.paidAmount,
      line.paymentMethod,
      line.paymentAllocations
    );
  }

  return [...byCustomer.values()]
    .map((row) => {
      const bill = row.bigSnooker + row.poolMini + row.cafe;
      const received = framePaidAmount(row.received);
      return {
        customerId: row.customerId,
        customerName: row.customerName,
        bigSnooker: row.bigSnooker,
        poolMini: row.poolMini,
        cafe: row.cafe,
        bill,
        received,
        cashCollection: row.cashCollection,
        gpayCollection: row.gpayCollection,
        due: frameDueAmount(bill, received),
      };
    })
    .sort((a, b) =>
      a.customerName.localeCompare(b.customerName, undefined, {
        sensitivity: "base",
      })
    );
}

async function sumOutstandingCollectedInWindow(
  openedAt: Date,
  closedAt: Date
): Promise<number> {
  const agg = await OutstandingCollection.aggregate<{ total: number }>([
    {
      $match: {
        createdAt: { $gte: openedAt, $lte: closedAt },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return agg[0]?.total ?? 0;
}

async function sumOpeningOutstandingThrough(asOf: Date): Promise<number> {
  const agg = await Outstanding.aggregate<{ total: number }>([
    {
      $match: {
        sourceType: "OPENING",
        createdAt: { $lte: asOf },
      },
    },
    { $group: { _id: null, total: { $sum: "$originalAmount" } } },
  ]);
  return agg[0]?.total ?? 0;
}

async function sumOpeningOutstandingBetween(
  afterExclusive: Date,
  throughInclusive: Date
): Promise<number> {
  const agg = await Outstanding.aggregate<{ total: number }>([
    {
      $match: {
        sourceType: "OPENING",
        createdAt: { $gt: afterExclusive, $lte: throughInclusive },
      },
    },
    { $group: { _id: null, total: { $sum: "$originalAmount" } } },
  ]);
  return agg[0]?.total ?? 0;
}

/**
 * Opening Outstanding for this day's trend — prefers prior Final Summary
 * closingOutstanding when available (immutable chain).
 */
async function resolveOpeningOutstanding(input: {
  businessDayNumber: number;
  closedAt: Date;
}): Promise<number> {
  const previousDay = await BusinessDay.findOne({
    status: "CLOSED",
    businessDayNumber: { $lt: input.businessDayNumber },
    closedAt: { $exists: true, $ne: null },
  })
    .sort({ businessDayNumber: -1 })
    .select("_id businessDayNumber closedAt")
    .lean();

  if (!previousDay?.closedAt) {
    return sumOpeningOutstandingThrough(input.closedAt);
  }

  const priorSummary = await BusinessDayFinalSummary.findOne({
    businessDayId: previousDay._id,
  })
    .select("closingOutstanding")
    .lean();

  const priorClosing =
    priorSummary?.closingOutstanding ??
    (await getClosingOutstandingAtClose({
      businessDayNumber: previousDay.businessDayNumber,
      closedAt: new Date(previousDay.closedAt),
    }));

  const midStreamOpening = await sumOpeningOutstandingBetween(
    new Date(previousDay.closedAt),
    input.closedAt
  );

  return priorClosing + midStreamOpening;
}

/**
 * Financial Summary Engine — complete finalized payload for one Business Day.
 * Execute once at Close and persist as BusinessDayFinalSummary.
 */
export async function buildBusinessDayFinalSummaryPayload(input: {
  businessDayId: Types.ObjectId | string;
  closedAt?: Date;
}): Promise<BusinessDayFinalSummaryPayload | null> {
  const businessDayId =
    typeof input.businessDayId === "string"
      ? new mongoose.Types.ObjectId(input.businessDayId)
      : input.businessDayId;

  const day = await BusinessDay.findById(businessDayId).lean();
  if (!day) return null;

  const closedAt = input.closedAt ?? day.closedAt ?? new Date();
  const businessDate = resolveBusinessDate(day.businessDate, day.openedAt);

  const [rawEntries, cafeOrders, unassigned] = await Promise.all([
    NotebookEntry.find({
      businessDayId,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    })
      .sort({ createdAt: 1 })
      .lean(),
    CafeOrder.find({
      businessDayId,
      status: "OPEN",
    })
      .sort({ createdAt: 1 })
      .lean(),
    countUnassignedCharges(businessDayId),
  ]);

  const entries = rawEntries.map((entry) => toNotebookEntryDTO(entry));
  const frameEntries = entries.filter((entry) => entry.section !== CAFE_SECTION);
  const legacyCafeEntries = entries.filter(
    (entry) => entry.section === CAFE_SECTION
  );

  const frameLines = frameEntries.flatMap(collectFrameChargeLines);
  const legacyCafeLines = legacyCafeEntries.flatMap(collectFrameChargeLines);

  const cafeOrderLines: ChargeLine[] = cafeOrders.map((order) => ({
    entryId: order._id.toString(),
    customerId: order.customerId?.toString(),
    customerName: order.customerName,
    amount: order.amount,
    paidAmount: framePaidAmount(order.received),
    paymentMethod: order.paymentMethod,
  }));

  const cafeMoneyLines = [...legacyCafeLines, ...cafeOrderLines];
  const customers = buildCustomerSettlements(frameLines, cafeMoneyLines);

  const bigFrames = frameLines.filter(
    (line) => line.section && isBigSnookerSection(line.section)
  );
  const poolFrames = frameLines.filter(
    (line) => line.section && isPoolMiniSection(line.section)
  );

  const bigSnooker = rollupLines(bigFrames, uniqueEntryCount(bigFrames));
  const poolMini = rollupLines(poolFrames, uniqueEntryCount(poolFrames));
  const snooker = rollupLines(frameLines, uniqueEntryCount(frameLines));
  const cafeSection = rollupLines(
    cafeMoneyLines,
    new Set(cafeOrderLines.map((line) => line.entryId)).size +
      uniqueEntryCount(legacyCafeLines)
  );

  const outstandingCreated = customers.reduce((sum, row) => sum + row.due, 0);
  const bill = snooker.bill + cafeSection.bill;
  const paid = snooker.received + cafeSection.received;
  const cashCollection = snooker.cashCollection + cafeSection.cashCollection;
  const gpayCollection = snooker.gpayCollection + cafeSection.gpayCollection;

  const [outstandingCollected, openingOutstanding] = await Promise.all([
    sumOutstandingCollectedInWindow(day.openedAt, closedAt),
    resolveOpeningOutstanding({
      businessDayNumber: day.businessDayNumber,
      closedAt,
    }),
  ]);

  const closingOutstanding = Math.max(
    0,
    openingOutstanding + outstandingCreated - outstandingCollected
  );

  return {
    businessDayId: businessDayId.toString(),
    businessDayNumber: day.businessDayNumber,
    businessDate,
    closedAt,
    bill,
    paid,
    outstandingCreated,
    cashCollection,
    gpayCollection,
    outstandingCollected,
    closingOutstanding,
    openingOutstanding,
    unassignedFrames: unassigned.unassignedFrames,
    unassignedCafeItems: unassigned.unassignedCafeItems,
    snooker,
    bigSnooker,
    poolMini,
    cafe: cafeSection,
    customers,
  };
}
