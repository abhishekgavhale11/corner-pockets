import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";

export async function nextOutstandingNumberFromDb(
  session?: mongoose.ClientSession
): Promise<number> {
  const query = Outstanding.findOne()
    .sort({ outstandingNumber: -1 })
    .select("outstandingNumber");
  if (session) {
    query.session(session);
  }
  const last = await query.lean();
  return (last?.outstandingNumber ?? 0) + 1;
}

export async function getCustomerOutstandingBalance(
  customerId: string
): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return 0;
  }

  const result = await Outstanding.aggregate<{ total: number }>([
    {
      $match: {
        customerId: new mongoose.Types.ObjectId(customerId),
        status: "PENDING",
      },
    },
    { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
  ]);

  return result[0]?.total ?? 0;
}
