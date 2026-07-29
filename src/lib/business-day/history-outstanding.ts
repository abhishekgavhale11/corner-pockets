import mongoose, { type Types } from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import Customer from "@/models/Customer";
import { getBusinessDateRangeBounds } from "@/lib/utils/business-date";
import type {
  BusinessDayHistoryOutstandingCreatedRowDTO,
  BusinessDayHistoryOutstandingRecoveredRowDTO,
  BusinessDayHistoryOutstandingTrendDTO,
  BusinessDayHistorySettlementRowDTO,
} from "@/types";

type ClosedDayLean = {
  _id: Types.ObjectId;
  businessDayNumber: number;
  openedAt: Date;
  closedAt: Date;
};

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
 * Club-wide Outstanding balance as of a Business Day close instant.
 *
 * Closing Outstanding =
 *   Σ OPENING originalAmount with createdAt ≤ closedAt
 * + Σ FRAME/CAFE originalAmount on CLOSED days numbered ≤ this day
 * − Σ Outstanding Collection amounts with createdAt ≤ this closedAt
 *
 * Opening is a historical baseline — never counted as this day's Created.
 * Read-only. Does not change Outstanding or collection records.
 */
export async function getClosingOutstandingAtClose(input: {
  businessDayNumber: number;
  closedAt: Date;
}): Promise<number> {
  const priorOrSameDays = await BusinessDay.find({
    status: "CLOSED",
    businessDayNumber: { $lte: input.businessDayNumber },
    closedAt: { $exists: true, $ne: null },
  })
    .select("_id")
    .lean();

  const dayIds = priorOrSameDays.map((day) => day._id);

  const [openingTotal, createdAgg, collectedAgg] = await Promise.all([
    sumOpeningOutstandingThrough(input.closedAt),
    dayIds.length > 0
      ? Outstanding.aggregate<{ total: number }>([
          {
            $match: {
              businessDayId: { $in: dayIds },
              sourceType: { $in: ["FRAME", "CAFE"] },
            },
          },
          { $group: { _id: null, total: { $sum: "$originalAmount" } } },
        ])
      : Promise.resolve([] as { total: number }[]),
    OutstandingCollection.aggregate<{ total: number }>([
      { $match: { createdAt: { $lte: input.closedAt } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const created = createdAgg[0]?.total ?? 0;
  const collected = collectedAgg[0]?.total ?? 0;
  return Math.max(0, openingTotal + created - collected);
}

/**
 * Batch Closing Outstanding for many closed days (one pass over collections).
 * Returns map of businessDayId → closing outstanding.
 */
export async function getClosingOutstandingByDayIds(
  days: ClosedDayLean[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (days.length === 0) return result;

  const maxNumber = Math.max(...days.map((d) => d.businessDayNumber));
  const maxClosedAt = new Date(
    Math.max(...days.map((d) => d.closedAt.getTime()))
  );

  const allClosed = await BusinessDay.find({
    status: "CLOSED",
    businessDayNumber: { $lte: maxNumber },
    closedAt: { $exists: true, $ne: null },
  })
    .select("_id businessDayNumber closedAt")
    .sort({ businessDayNumber: 1 })
    .lean();

  const dayIds = allClosed.map((d) => d._id as Types.ObjectId);

  const [openingRows, createdByDay, collections] = await Promise.all([
    Outstanding.find({
      sourceType: "OPENING",
      createdAt: { $lte: maxClosedAt },
    })
      .select("originalAmount createdAt")
      .sort({ createdAt: 1 })
      .lean(),
    dayIds.length > 0
      ? Outstanding.aggregate<{ _id: Types.ObjectId; total: number }>([
          {
            $match: {
              businessDayId: { $in: dayIds },
              sourceType: { $in: ["FRAME", "CAFE"] },
            },
          },
          {
            $group: {
              _id: "$businessDayId",
              total: { $sum: "$originalAmount" },
            },
          },
        ])
      : Promise.resolve([] as { _id: Types.ObjectId; total: number }[]),
    OutstandingCollection.find({ createdAt: { $lte: maxClosedAt } })
      .select("amount createdAt")
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  const createdMap = new Map<string, number>();
  for (const row of createdByDay) {
    createdMap.set(row._id.toString(), row.total);
  }

  let cumCreated = 0;
  const cumCreatedByNumber = new Map<number, number>();
  for (const day of allClosed) {
    cumCreated += createdMap.get(day._id.toString()) ?? 0;
    cumCreatedByNumber.set(day.businessDayNumber, cumCreated);
  }

  const openingTimes: number[] = [];
  const openingPrefix: number[] = [0];
  for (const row of openingRows) {
    openingTimes.push(new Date(row.createdAt).getTime());
    openingPrefix.push(
      openingPrefix[openingPrefix.length - 1] + row.originalAmount
    );
  }

  function openingThrough(closedAt: Date): number {
    const t = closedAt.getTime();
    let lo = 0;
    let hi = openingTimes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (openingTimes[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return openingPrefix[lo] ?? 0;
  }

  const collectionTimes: number[] = [];
  const collectionPrefix: number[] = [0];
  for (const row of collections) {
    collectionTimes.push(new Date(row.createdAt).getTime());
    collectionPrefix.push(
      collectionPrefix[collectionPrefix.length - 1] + row.amount
    );
  }

  function collectedThrough(closedAt: Date): number {
    const t = closedAt.getTime();
    let lo = 0;
    let hi = collectionTimes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (collectionTimes[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return collectionPrefix[lo] ?? 0;
  }

  for (const day of days) {
    const createdThrough = cumCreatedByNumber.get(day.businessDayNumber) ?? 0;
    const opening = openingThrough(day.closedAt);
    const collected = collectedThrough(day.closedAt);
    result.set(
      day._id.toString(),
      Math.max(0, opening + createdThrough - collected)
    );
  }

  return result;
}

/**
 * Outstanding Recovered per Business Day — same window as detail Outstanding tab:
 * Σ OutstandingCollection.amount where openedAt ≤ createdAt ≤ closedAt.
 *
 * Read-only. Does not invent a new formula.
 */
export async function getOutstandingRecoveredByDayIds(
  days: ClosedDayLean[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (days.length === 0) return result;

  for (const day of days) {
    result.set(day._id.toString(), 0);
  }

  const minOpenedAt = new Date(
    Math.min(...days.map((d) => d.openedAt.getTime()))
  );
  const maxClosedAt = new Date(
    Math.max(...days.map((d) => d.closedAt.getTime()))
  );

  const collections = await OutstandingCollection.find({
    createdAt: { $gte: minOpenedAt, $lte: maxClosedAt },
  })
    .select("amount createdAt")
    .lean();

  for (const row of collections) {
    const t = new Date(row.createdAt).getTime();
    for (const day of days) {
      if (t >= day.openedAt.getTime() && t <= day.closedAt.getTime()) {
        const id = day._id.toString();
        result.set(id, (result.get(id) ?? 0) + row.amount);
        break;
      }
    }
  }

  return result;
}

/**
 * Outstanding Recovered for a History REPORT RANGE (Outstanding Movement card).
 *
 * Σ OutstandingCollection.amount where createdAt is inside the selected
 * Business Date range bounds — independent of Business Day open/close windows.
 * Collections between closed days still count when their timestamp falls in range.
 */
export async function getOutstandingRecoveredForReportRange(
  from: string,
  to: string
): Promise<number> {
  const { start, end } = getBusinessDateRangeBounds(from, to);

  const agg = await OutstandingCollection.aggregate<{ total: number }>([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return agg[0]?.total ?? 0;
}

function paymentModeLabel(
  method: string | null | undefined
): "Cash" | "GPay" | "—" {
  if (method === "CASH") return "Cash";
  if (method === "GPAY") return "GPay";
  return "—";
}

/**
 * Outstanding trend block for one CLOSED Business Day (detail Outstanding tab).
 * Customer-level totals only — does not expose Outstanding document internals.
 * Opening Outstanding is baseline only; never listed under Created.
 */
export async function buildBusinessDayOutstandingTrend(input: {
  businessDayNumber: number;
  openedAt: Date;
  closedAt: Date;
  settlements: BusinessDayHistorySettlementRowDTO[];
  /** Already-proven day Due total (Settlement path). */
  outstandingCreated: number;
  /** When present, use Final Summary frozen figures (do not recompute). */
  snapshotted?: {
    openingOutstanding: number;
    closingOutstanding: number;
    outstandingRecovered: number;
  };
}): Promise<BusinessDayHistoryOutstandingTrendDTO> {
  const previousDay = await BusinessDay.findOne({
    status: "CLOSED",
    businessDayNumber: { $lt: input.businessDayNumber },
    closedAt: { $exists: true, $ne: null },
  })
    .sort({ businessDayNumber: -1 })
    .select("_id businessDayNumber closedAt")
    .lean();

  const previousClosedAt = previousDay?.closedAt
    ? new Date(previousDay.closedAt)
    : null;

  const recoveryDocs = await OutstandingCollection.find({
    createdAt: {
      $gte: input.openedAt,
      $lte: input.closedAt,
    },
  })
    .select("customerId amount paymentMethod createdAt")
    .sort({ createdAt: 1 })
    .lean();

  let openingOutstanding: number;
  let closingOutstanding: number;

  if (input.snapshotted) {
    openingOutstanding = input.snapshotted.openingOutstanding;
    closingOutstanding = input.snapshotted.closingOutstanding;
  } else {
    [openingOutstanding, closingOutstanding] = await Promise.all([
      previousDay && previousClosedAt
        ? (async () => {
            const priorClosing = await getClosingOutstandingAtClose({
              businessDayNumber: previousDay.businessDayNumber,
              closedAt: previousClosedAt,
            });
            const midStreamOpening = await sumOpeningOutstandingBetween(
              previousClosedAt,
              input.closedAt
            );
            return priorClosing + midStreamOpening;
          })()
        : sumOpeningOutstandingThrough(input.closedAt),
      getClosingOutstandingAtClose({
        businessDayNumber: input.businessDayNumber,
        closedAt: input.closedAt,
      }),
    ]);
  }

  const customerIds = [
    ...new Set(recoveryDocs.map((row) => row.customerId.toString())),
  ];
  const customers =
    customerIds.length > 0
      ? await Customer.find({
          _id: {
            $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("name")
          .lean()
      : [];

  const nameById = new Map(
    customers.map((c) => [c._id.toString(), c.name as string])
  );

  const recovered: BusinessDayHistoryOutstandingRecoveredRowDTO[] =
    recoveryDocs.map((row) => {
      const id = row.customerId.toString();
      return {
        customerId: id,
        customerName: nameById.get(id) ?? "—",
        amount: row.amount,
        paymentMethod: paymentModeLabel(row.paymentMethod),
        collectedAt: new Date(row.createdAt).toISOString(),
      };
    });

  const created: BusinessDayHistoryOutstandingCreatedRowDTO[] = input.settlements
    .filter((row) => row.due > 0)
    .map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      amount: row.due,
    }))
    .sort((a, b) =>
      a.customerName.localeCompare(b.customerName, undefined, {
        sensitivity: "base",
      })
    );

  const outstandingRecovered = input.snapshotted
    ? input.snapshotted.outstandingRecovered
    : recovered.reduce((sum, row) => sum + row.amount, 0);
  const newOutstandingCreated = input.outstandingCreated;
  const netChange = newOutstandingCreated - outstandingRecovered;

  return {
    openingOutstanding,
    newOutstandingCreated,
    outstandingRecovered,
    netChange,
    closingOutstanding,
    created,
    recovered,
  };
}
