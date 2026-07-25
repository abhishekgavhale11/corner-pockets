import BusinessDay from "@/models/BusinessDay";
import NotebookEntry from "@/models/NotebookEntry";
import CafeOrder from "@/models/CafeOrder";
import type {
  BusinessDayCloseCategoryPreviewDTO,
  BusinessDayClosePreviewDTO,
} from "@/types";
import { attributePaymentCollections } from "@/lib/business-day/payment-collections";
import { countUnassignedCharges } from "@/lib/business-day/unassigned-charges";
import type { Types } from "mongoose";

const CAFE_SECTION = "CAFE";

type LeanCharge = {
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  paymentMethod?: "CASH" | "GPAY" | "WALLET";
  walletAmount?: number;
  contributors?: Array<{
    amount: number;
    paidAmount?: number;
    balanceCollectedAmount?: number;
    paymentMethod?: "CASH" | "GPAY" | "WALLET";
    walletAmount?: number;
  }>;
};

type LeanNotebookCharge = LeanCharge & {
  section: string;
};

function linePaid(paidAmount?: number, balanceCollectedAmount?: number): number {
  return (paidAmount ?? 0) + (balanceCollectedAmount ?? 0);
}

function emptyCategory(): BusinessDayCloseCategoryPreviewDTO {
  return {
    revenue: 0,
    cashCollection: 0,
    gpayCollection: 0,
    walletCollection: 0,
    outstandingCreated: 0,
  };
}

function aggregateCategory(entries: LeanCharge[]): BusinessDayCloseCategoryPreviewDTO {
  let revenue = 0;
  let received = 0;
  let cashCollection = 0;
  let gpayCollection = 0;
  let walletCollection = 0;

  for (const entry of entries) {
    const hasContributors = (entry.contributors?.length ?? 0) > 0;

    if (hasContributors) {
      for (const row of entry.contributors ?? []) {
        revenue += row.amount;
        const paid = linePaid(row.paidAmount, row.balanceCollectedAmount);
        received += paid;
        const portion = attributePaymentCollections({
          paidAmount: paid,
          paymentMethod: row.paymentMethod,
          walletAmount: row.walletAmount,
        });
        cashCollection += portion.cash;
        gpayCollection += portion.gpay;
        walletCollection += portion.wallet;
      }
    } else {
      revenue += entry.amount;
      const paid = linePaid(entry.paidAmount, entry.balanceCollectedAmount);
      received += paid;
      const portion = attributePaymentCollections({
        paidAmount: paid,
        paymentMethod: entry.paymentMethod,
        walletAmount: entry.walletAmount,
      });
      cashCollection += portion.cash;
      gpayCollection += portion.gpay;
      walletCollection += portion.wallet;
    }
  }

  return {
    revenue,
    cashCollection,
    gpayCollection,
    walletCollection,
    outstandingCreated: Math.max(0, revenue - received),
  };
}

function combineCategories(
  snooker: BusinessDayCloseCategoryPreviewDTO,
  cafe: BusinessDayCloseCategoryPreviewDTO
): Omit<
  BusinessDayClosePreviewDTO,
  "unassignedFrames" | "unassignedCafeItems" | "snooker" | "cafe"
> {
  const todaysBill = snooker.revenue + cafe.revenue;
  const cashCollection = snooker.cashCollection + cafe.cashCollection;
  const gpayCollection = snooker.gpayCollection + cafe.gpayCollection;
  const walletCollection = snooker.walletCollection + cafe.walletCollection;
  const outstandingAmount =
    snooker.outstandingCreated + cafe.outstandingCreated;
  const totalPaid = Math.max(0, todaysBill - outstandingAmount);

  return {
    todaysBill,
    totalPaid,
    cashCollection,
    gpayCollection,
    walletCollection,
    outstandingAmount,
  };
}

/**
 * Builds the Business Day Closing Summary from operational charges
 * owned by a Business Day (businessDayId). Never uses createdAt.
 */
export async function buildBusinessDayCloseSummaryForId(
  businessDayId: Types.ObjectId | string
): Promise<BusinessDayClosePreviewDTO | null> {
  const [entries, cafeOrders] = await Promise.all([
    NotebookEntry.find({
      businessDayId,
      status: { $nin: ["CANCELLED", "REVERSED"] },
    })
      .select(
        "section amount paidAmount balanceCollectedAmount paymentMethod walletAmount contributors"
      )
      .lean() as Promise<LeanNotebookCharge[]>,
    CafeOrder.find({
      businessDayId,
      status: "OPEN",
    })
      .select("amount received paymentMethod walletAmount")
      .lean(),
  ]);

  const snookerEntries = entries.filter(
    (entry) => entry.section !== CAFE_SECTION
  );
  const legacyCafeEntries = entries.filter(
    (entry) => entry.section === CAFE_SECTION
  );

  const cafeAsCharges: LeanCharge[] = [
    ...legacyCafeEntries,
    ...cafeOrders.map((order) => ({
      amount: order.amount,
      paidAmount: order.received ?? 0,
      paymentMethod: order.paymentMethod,
      walletAmount: order.walletAmount,
    })),
  ];

  const snooker = aggregateCategory(snookerEntries);
  const cafe =
    cafeAsCharges.length > 0 ? aggregateCategory(cafeAsCharges) : emptyCategory();

  const { unassignedFrames, unassignedCafeItems } =
    await countUnassignedCharges(businessDayId);

  return {
    ...combineCategories(snooker, cafe),
    snooker,
    cafe,
    unassignedFrames,
    unassignedCafeItems,
  };
}

/**
 * Builds the Business Day Closing Summary for the OPEN Business Day.
 */
export async function buildBusinessDayCloseSummary(): Promise<BusinessDayClosePreviewDTO | null> {
  const day = await BusinessDay.findOne({ status: "OPEN" }).lean();
  if (!day) {
    return null;
  }

  return buildBusinessDayCloseSummaryForId(day._id);
}
