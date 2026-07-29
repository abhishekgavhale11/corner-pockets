import mongoose from "mongoose";
import Customer from "@/models/Customer";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import type {
  OutstandingIntegrityCustomerRow,
  OutstandingIntegrityFailureReason,
  OutstandingIntegrityReport,
} from "@/types";

type OutstandingAggRow = {
  _id: mongoose.Types.ObjectId;
  totalCreated: number;
  totalRemaining: number;
  customerName?: string;
  countNegativeRemaining: number;
  countExceedsOriginal: number;
  countCollectedWithRemaining: number;
  countPendingNonPositive: number;
};

type CollectionAggRow = {
  _id: mongoose.Types.ObjectId;
  totalCollected: number;
};

/**
 * Read-only Outstanding ledger integrity check.
 *
 * Identity (integer rupees, exact equality):
 *   Σ originalAmount − Σ collection.amount === Σ remainingAmount
 *
 * Plus per-document status/amount invariants.
 * Does not write, repair, or recompute Due from operational modules.
 */
export async function verifyOutstandingIntegrity(): Promise<OutstandingIntegrityReport> {
  const startedAt = new Date();

  const [outstandingRows, collectionRows] = await Promise.all([
    Outstanding.aggregate<OutstandingAggRow>([
      {
        $group: {
          _id: "$customerId",
          totalCreated: { $sum: "$originalAmount" },
          totalRemaining: { $sum: "$remainingAmount" },
          countNegativeRemaining: {
            $sum: {
              $cond: [{ $lt: ["$remainingAmount", 0] }, 1, 0],
            },
          },
          countExceedsOriginal: {
            $sum: {
              $cond: [
                { $gt: ["$remainingAmount", "$originalAmount"] },
                1,
                0,
              ],
            },
          },
          countCollectedWithRemaining: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "COLLECTED"] },
                    { $gt: ["$remainingAmount", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          countPendingNonPositive: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "PENDING"] },
                    { $lte: ["$remainingAmount", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          totalCreated: 1,
          totalRemaining: 1,
          countNegativeRemaining: 1,
          countExceedsOriginal: 1,
          countCollectedWithRemaining: 1,
          countPendingNonPositive: 1,
          customerName: {
            $ifNull: ["$customer.name", "Unknown customer"],
          },
        },
      },
    ]),
    OutstandingCollection.aggregate<CollectionAggRow>([
      {
        $group: {
          _id: "$customerId",
          totalCollected: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const outstandingByCustomer = new Map<string, OutstandingAggRow>();
  for (const row of outstandingRows) {
    outstandingByCustomer.set(row._id.toString(), row);
  }

  const collectedByCustomer = new Map<string, number>();
  for (const row of collectionRows) {
    collectedByCustomer.set(row._id.toString(), row.totalCollected);
  }

  const customerIds = new Set<string>([
    ...outstandingByCustomer.keys(),
    ...collectedByCustomer.keys(),
  ]);

  // Names for collection-only customers (no Outstanding rows → no lookup yet).
  const orphanCollectionIds = [...customerIds].filter(
    (id) => !outstandingByCustomer.has(id)
  );
  const orphanNameById = new Map<string, string>();
  if (orphanCollectionIds.length > 0) {
    const objectIds = orphanCollectionIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const customers = await Customer.find({ _id: { $in: objectIds } })
      .select("name")
      .lean();

    for (const customer of customers) {
      orphanNameById.set(
        customer._id.toString(),
        customer.name?.trim() || "Unknown customer"
      );
    }
  }

  const customers: OutstandingIntegrityCustomerRow[] = [];
  let passed = 0;
  let failed = 0;
  let totalOutstandingCreated = 0;
  let totalOutstandingCollected = 0;
  let totalOutstandingRemaining = 0;

  for (const customerId of customerIds) {
    const outstanding = outstandingByCustomer.get(customerId);
    const totalCreated = outstanding?.totalCreated ?? 0;
    const totalRemaining = outstanding?.totalRemaining ?? 0;
    const totalCollected = collectedByCustomer.get(customerId) ?? 0;
    const expectedRemaining = totalCreated - totalCollected;

    const failureReasons: OutstandingIntegrityFailureReason[] = [];

    if (expectedRemaining !== totalRemaining) {
      failureReasons.push("Ledger identity mismatch");
    }
    if ((outstanding?.countNegativeRemaining ?? 0) > 0) {
      failureReasons.push("remainingAmount < 0");
    }
    if ((outstanding?.countExceedsOriginal ?? 0) > 0) {
      failureReasons.push("remainingAmount > originalAmount");
    }
    if ((outstanding?.countCollectedWithRemaining ?? 0) > 0) {
      failureReasons.push("COLLECTED status with remainingAmount > 0");
    }
    if ((outstanding?.countPendingNonPositive ?? 0) > 0) {
      failureReasons.push("PENDING status with remainingAmount <= 0");
    }

    const status = failureReasons.length === 0 ? "PASS" : "FAIL";
    if (status === "PASS") {
      passed += 1;
    } else {
      failed += 1;
    }

    totalOutstandingCreated += totalCreated;
    totalOutstandingCollected += totalCollected;
    totalOutstandingRemaining += totalRemaining;

    const customerName =
      outstanding?.customerName ??
      orphanNameById.get(customerId) ??
      "Unknown customer";

    const row: OutstandingIntegrityCustomerRow = {
      customerId,
      customerName,
      totalCreated,
      totalCollected,
      totalRemaining,
      status,
      failureReasons,
    };

    if (status === "FAIL") {
      row.expectedRemaining = expectedRemaining;
      row.actualRemaining = totalRemaining;
      row.difference = totalRemaining - expectedRemaining;
    }

    customers.push(row);
  }

  customers.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "FAIL" ? -1 : 1;
    }
    return a.customerName.localeCompare(b.customerName, undefined, {
      sensitivity: "base",
    });
  });

  const finishedAt = new Date();

  return {
    summary: {
      customersChecked: customers.length,
      passed,
      failed,
      totalOutstandingCreated,
      totalOutstandingCollected,
      totalOutstandingRemaining,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    },
    customers,
  };
}
