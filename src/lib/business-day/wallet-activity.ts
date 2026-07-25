import mongoose, { type Types } from "mongoose";
import Customer from "@/models/Customer";
import Transaction from "@/models/Transaction";
import type {
  BusinessDayHistoryWalletActivityDTO,
  BusinessDayHistoryWalletRechargeLineDTO,
} from "@/types";

export function emptyWalletActivity(): BusinessDayHistoryWalletActivityDTO {
  return {
    totalRecharges: 0,
    rechargeReceived: 0,
    bonusIssued: 0,
    walletCreditIssued: 0,
    recharges: [],
  };
}

/**
 * Informational Wallet Recharge audit for History.
 * Does NOT feed Business Revenue / Business Summary cards.
 */
export async function buildWalletActivityForBusinessDays(
  businessDayIds: Types.ObjectId[]
): Promise<BusinessDayHistoryWalletActivityDTO> {
  if (businessDayIds.length === 0) {
    return emptyWalletActivity();
  }

  const txns = await Transaction.find({
    type: "credit",
    isReversal: false,
    businessDayId: { $in: businessDayIds },
    creditedAmount: { $gt: 0 },
  })
    .sort({ createdAt: 1 })
    .select(
      "customerId paidAmount bonusAmount creditedAmount paymentMethod staffUsername createdAt"
    )
    .lean();

  if (txns.length === 0) {
    return emptyWalletActivity();
  }

  const customerIds = [
    ...new Set(
      txns.map((txn) => txn.customerId.toString()).filter(Boolean)
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const customers = await Customer.find({ _id: { $in: customerIds } })
    .select("name")
    .lean();
  const nameById = new Map(
    customers.map((c) => [c._id.toString(), c.name as string])
  );

  const recharges: BusinessDayHistoryWalletRechargeLineDTO[] = txns.map(
    (txn) => {
      const customerId = txn.customerId.toString();
      const paidAmount = Math.round(txn.paidAmount ?? 0);
      const bonusAmount = Math.round(txn.bonusAmount ?? 0);
      const walletCredit = Math.round(txn.creditedAmount ?? 0);
      return {
        id: txn._id.toString(),
        customerId,
        customerName: nameById.get(customerId) ?? "—",
        paidAmount,
        bonusAmount,
        walletCredit,
        paymentMethod:
          txn.paymentMethod === "CASH" || txn.paymentMethod === "GPAY"
            ? txn.paymentMethod
            : null,
        createdAt: txn.createdAt.toISOString(),
        createdBy: txn.staffUsername || "—",
      };
    }
  );

  return {
    totalRecharges: recharges.length,
    rechargeReceived: recharges.reduce((sum, row) => sum + row.paidAmount, 0),
    bonusIssued: recharges.reduce((sum, row) => sum + row.bonusAmount, 0),
    walletCreditIssued: recharges.reduce(
      (sum, row) => sum + row.walletCredit,
      0
    ),
    recharges,
  };
}
