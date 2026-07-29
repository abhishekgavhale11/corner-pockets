import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import OutstandingCollection from "@/models/OutstandingCollection";
import BusinessDayFinalSummary from "@/models/BusinessDayFinalSummary";

export type CustomerLifetimeStats = {
  /** Distinct closed Business Days the customer participated in. */
  totalVisits: number;
  /** Finalized Cash + GPay payments (excludes recharges). */
  lifetimePaid: number;
};

/**
 * Read-only lifetime customer stats from Business Day Final Summaries.
 * Open Business Days do not contribute until they close.
 * Outstanding collections remain part of Lifetime Paid (live ledger events).
 */
export async function getCustomerLifetimeStats(
  customerId: string
): Promise<CustomerLifetimeStats> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return { totalVisits: 0, lifetimePaid: 0 };
  }

  const customerObjectId = new mongoose.Types.ObjectId(customerId);

  const [finalDayRows, collectionPaid] = await Promise.all([
    BusinessDayFinalSummary.aggregate<{
      _id: mongoose.Types.ObjectId;
      received: number;
    }>([
      { $unwind: "$customers" },
      { $match: { "customers.customerId": customerId } },
      {
        $group: {
          _id: "$businessDayId",
          received: { $sum: "$customers.received" },
        },
      },
    ]),
    OutstandingCollection.aggregate<{ total: number }>([
      { $match: { customerId: customerObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  if (finalDayRows.length === 0) {
    return {
      totalVisits: 0,
      lifetimePaid: Math.round(collectionPaid[0]?.total ?? 0),
    };
  }

  const closedDays = await BusinessDay.find({
    _id: { $in: finalDayRows.map((row) => row._id) },
    status: "CLOSED",
  })
    .select("_id")
    .lean();

  const closedIdSet = new Set(closedDays.map((day) => day._id.toString()));
  let framesAndCafePaid = 0;
  let totalVisits = 0;

  for (const row of finalDayRows) {
    if (!closedIdSet.has(row._id.toString())) continue;
    totalVisits += 1;
    framesAndCafePaid += row.received;
  }

  const lifetimePaid = Math.round(
    framesAndCafePaid + (collectionPaid[0]?.total ?? 0)
  );

  return { totalVisits, lifetimePaid };
}
