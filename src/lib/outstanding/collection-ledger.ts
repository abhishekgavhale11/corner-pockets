import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import Customer from "@/models/Customer";
import {
  getBusinessDateRangeBounds,
  getDefaultBusinessDayHistoryRange,
} from "@/lib/utils/business-date";
import type { OutstandingCollectionLedgerResultDTO } from "@/types";

/** Live club receivable = Σ PENDING remainingAmount (same as Customers outstanding total). */
async function getLiveClubOutstandingTotal(): Promise<number> {
  const agg = await Outstanding.aggregate<{ total: number }>([
    {
      $match: {
        status: "PENDING",
        remainingAmount: { $gt: 0 },
      },
    },
    { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
  ]);
  return agg[0]?.total ?? 0;
}

/**
 * Read-only Outstanding Collection ledger for History → Outstanding tab.
 * Filters by OutstandingCollection.createdAt within Business Date range bounds.
 * Does not change collection, Outstanding rows, or any financial engines.
 */
export async function getOutstandingCollectionLedger(options?: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<OutstandingCollectionLedgerResultDTO> {
  const defaults = getDefaultBusinessDayHistoryRange();
  const from = options?.from?.trim() || defaults.from;
  const to = options?.to?.trim() || defaults.to;
  const limit = options?.limit ?? 2000;

  const { start, end } = getBusinessDateRangeBounds(from, to);

  const [docs, totalClubOutstanding] = await Promise.all([
    OutstandingCollection.find({
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    getLiveClubOutstandingTotal(),
  ]);

  const customerIds = [
    ...new Set(docs.map((doc) => doc.customerId.toString())),
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

  const items = docs.map((doc) => {
    const amount = doc.amount;
    const remainingOutstanding = doc.remainingBalanceAfter;
    const previousOutstanding = amount + remainingOutstanding;
    return {
      id: doc._id.toString(),
      collectedAt: new Date(doc.createdAt).toISOString(),
      customerId: doc.customerId.toString(),
      customerName: nameById.get(doc.customerId.toString()) ?? "—",
      amountCollected: amount,
      paymentMethod: doc.paymentMethod,
      previousOutstanding,
      remainingOutstanding,
      collectedBy:
        doc.receivedByUsername?.trim() || doc.createdBy?.trim() || null,
    };
  });

  const totalOutstandingRecovered = items.reduce(
    (sum, row) => sum + row.amountCollected,
    0
  );
  const customerSet = new Set(items.map((row) => row.customerId));

  return {
    from,
    to,
    summary: {
      totalClubOutstanding,
      totalOutstandingRecovered,
      collectionCount: items.length,
      customersPaidCount: customerSet.size,
    },
    items,
  };
}
