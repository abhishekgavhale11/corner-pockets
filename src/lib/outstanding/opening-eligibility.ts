import mongoose from "mongoose";
import CafeOrder from "@/models/CafeOrder";
import Customer from "@/models/Customer";
import CustomerBalancePayment from "@/models/CustomerBalancePayment";
import NotebookEntry from "@/models/NotebookEntry";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import Transaction from "@/models/Transaction";
import { getCustomerOutstandingBalance } from "@/lib/outstanding/queries";
import type {
  CustomerActivityItemDTO,
  CustomerLedgerSummaryDTO,
} from "@/types";

export const OPENING_OUTSTANDING_INELIGIBLE_MESSAGE =
  "Opening Outstanding is only for brand-new customers with no timeline or financial activity in CPOS.";

/**
 * Pure eligibility check from Customer Detail page data.
 *
 * Brand-new only: Current Outstanding = ₹0 and no timeline / financial
 * activity surfaced on the customer page (visits/frames, collections,
 * balance payments, or any timeline event).
 */
export function isEligibleForOpeningOutstanding(input: {
  outstandingAmount: number;
  activityItems: readonly CustomerActivityItemDTO[];
  visitCount: number;
  lastVisitAt: string | null;
  lastPaymentAt: string | null;
}): boolean {
  if (input.outstandingAmount !== 0) return false;
  if (input.activityItems.length > 0) return false;
  if (input.visitCount > 0) return false;
  if (input.lastVisitAt) return false;
  if (input.lastPaymentAt) return false;
  return true;
}

export function isEligibleForOpeningOutstandingFromFinancials(
  summary: CustomerLedgerSummaryDTO,
  activityItems: readonly CustomerActivityItemDTO[]
): boolean {
  return isEligibleForOpeningOutstanding({
    outstandingAmount: summary.outstandingAmount,
    activityItems,
    visitCount: summary.visitCount,
    lastVisitAt: summary.lastVisitAt,
    lastPaymentAt: summary.lastPaymentAt,
  });
}

/**
 * Authoritative DB check — gates create so the UI button cannot be bypassed.
 * Existence-only probes; does not change Outstanding calculation/collection.
 */
export async function customerIsEligibleForOpeningOutstanding(
  customerId: string,
  session?: mongoose.ClientSession
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return false;
  }

  const customerObjectId = new mongoose.Types.ObjectId(customerId);

  const outstandingQuery = Outstanding.findOne({
    customerId: customerObjectId,
  }).select("_id");
  const collectionQuery = OutstandingCollection.findOne({
    customerId: customerObjectId,
  }).select("_id");
  const frameQuery = NotebookEntry.findOne({
    status: { $nin: ["CANCELLED", "REVERSED"] },
    $or: [{ customerId }, { "contributors.customerId": customerId }],
  }).select("_id");
  const cafeQuery = CafeOrder.findOne({
    customerId: customerObjectId,
    status: { $ne: "CANCELLED" },
  }).select("_id");
  const legacyTransactionQuery = Transaction.findOne({
    customerId: customerObjectId,
    isReversal: { $ne: true },
  }).select("_id");
  const balancePaymentQuery = CustomerBalancePayment.findOne({
    customerId,
  }).select("_id");
  const customerQuery = Customer.findById(customerObjectId).select("isActive");

  if (session) {
    outstandingQuery.session(session);
    collectionQuery.session(session);
    frameQuery.session(session);
    cafeQuery.session(session);
    legacyTransactionQuery.session(session);
    balancePaymentQuery.session(session);
    customerQuery.session(session);
  }

  const [
    outstandingBalance,
    anyOutstanding,
    anyCollection,
    anyFrame,
    anyCafe,
    anyLegacyTransaction,
    anyBalancePayment,
    customer,
  ] = await Promise.all([
    getCustomerOutstandingBalance(customerId),
    outstandingQuery.lean(),
    collectionQuery.lean(),
    frameQuery.lean(),
    cafeQuery.lean(),
    legacyTransactionQuery.lean(),
    balancePaymentQuery.lean(),
    customerQuery.lean(),
  ]);

  if (!customer || customer.isActive === false) return false;
  if (outstandingBalance !== 0) return false;
  if (anyOutstanding) return false;
  if (anyCollection) return false;
  if (anyFrame) return false;
  if (anyCafe) return false;
  if (anyLegacyTransaction) return false;
  if (anyBalancePayment) return false;

  return true;
}

export async function assertCustomerEligibleForOpeningOutstanding(
  customerId: string,
  session?: mongoose.ClientSession
): Promise<void> {
  const eligible = await customerIsEligibleForOpeningOutstanding(
    customerId,
    session
  );
  if (!eligible) {
    throw new Error(OPENING_OUTSTANDING_INELIGIBLE_MESSAGE);
  }
}
