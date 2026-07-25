import type { Types } from "mongoose";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";

export type UnassignedChargeCounts = {
  unassignedFrames: number;
  unassignedCafeItems: number;
};

/**
 * Unassigned operational charges for a Business Day (by businessDayId).
 * Frames = non-CAFE notebook entries without a customer.
 * Cafe = CafeOrder rows without a customer (plus legacy CAFE NotebookEntry).
 */
export async function countUnassignedCharges(
  businessDayId: Types.ObjectId | string
): Promise<UnassignedChargeCounts> {
  const dayFilter = { businessDayId };
  const unassignedCustomer = {
    $or: [{ customerId: { $exists: false } }, { customerId: null }],
  };
  const noContributors = {
    $or: [
      { contributors: { $exists: false } },
      { contributors: { $size: 0 } },
    ],
  };

  const [unassignedFrames, legacyUnassignedCafe, cafeOrdersUnassigned] =
    await Promise.all([
      NotebookEntry.countDocuments({
        ...dayFilter,
        status: { $nin: ["CANCELLED", "REVERSED"] },
        section: { $ne: "CAFE" },
        $and: [unassignedCustomer, noContributors],
      }),
      NotebookEntry.countDocuments({
        ...dayFilter,
        status: { $nin: ["CANCELLED", "REVERSED"] },
        section: "CAFE",
        $and: [unassignedCustomer, noContributors],
      }),
      CafeOrder.countDocuments({
        ...dayFilter,
        status: "OPEN",
        $or: [{ customerId: { $exists: false } }, { customerId: null }],
      }),
    ]);

  return {
    unassignedFrames,
    unassignedCafeItems: legacyUnassignedCafe + cafeOrdersUnassigned,
  };
}
