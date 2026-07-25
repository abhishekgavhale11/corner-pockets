"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import {
  formatLedgerBalanceLabel,
} from "@/lib/utils/customer-ledger-display";
import type {
  CustomerLedgerLineDTO,
  CustomerLedgerSummaryDTO,
  CustomerActivityItemDTO,
  CustomerOutstandingRowDTO,
} from "@/types";
import Customer from "@/models/Customer";
import CustomerBalancePayment from "@/models/CustomerBalancePayment";
import NotebookEntry from "@/models/NotebookEntry";
import Outstanding from "@/models/Outstanding";
import Transaction from "@/models/Transaction";
import { getCustomerActivityTimeline } from "@/lib/outstanding/activity-timeline";
import { getCustomerOutstandingBalance } from "@/lib/outstanding/queries";

/**
 * Financial Engine V1 (Visit/Bill/Settlement) removed.
 * Ledger APIs compile and return wallet-aware stubs / light aggregates
 * from CustomerBalancePayment + Transaction + NotebookEntry only.
 */

async function countCustomerVisits(customerId: string): Promise<number> {
  const customerObjectId = new mongoose.Types.ObjectId(customerId);
  const result = await NotebookEntry.aggregate<{ visits: number }>([
    {
      $match: {
        status: { $ne: "CANCELLED" },
        $or: [
          { customerId: customerObjectId },
          { "contributors.customerId": customerObjectId },
        ],
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Kolkata",
          },
        },
      },
    },
    { $count: "visits" },
  ]);

  return result[0]?.visits ?? 0;
}

async function findLastCustomerPayment(customerId: string): Promise<{
  createdAt: string;
  amount: number;
} | null> {
  const lastBalancePayment = await CustomerBalancePayment.findOne({
    customerId,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!lastBalancePayment) {
    return null;
  }

  return {
    createdAt: lastBalancePayment.createdAt.toISOString(),
    amount: lastBalancePayment.amount,
  };
}

function emptySummary(
  walletBalance: number,
  extras?: Partial<CustomerLedgerSummaryDTO>
): CustomerLedgerSummaryDTO {
  return {
    walletBalance,
    outstandingAmount: 0,
    activeVisitDueAmount: 0,
    hasActiveVisitWithDue: false,
    openBillsCount: 0,
    visitCount: 0,
    lastVisitAt: null,
    lastPaymentAt: null,
    lastPaymentAmount: null,
    ...extras,
  };
}

function openingLedgerLine(customerCreatedAt: Date): CustomerLedgerLineDTO {
  return {
    ledgerId: "opening",
    id: "opening",
    timestamp: customerCreatedAt.toISOString(),
    description: "Opening",
    amount: 0,
    kind: "status",
    eventSubtype: "opening",
    staffUsername: "—",
    walletBalance: 0,
    outstandingBalance: 0,
    balanceLabel: formatLedgerBalanceLabel(0, 0),
  };
}

export async function getCustomerLedgerSummary(
  customerId: string
): Promise<CustomerLedgerSummaryDTO | null> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return null;
  }

  await connectDB();

  const customer = await Customer.findById(customerId).lean();
  if (!customer) {
    return null;
  }

  const [lastVisitEntry, lastPayment, visitCount, outstandingAmount] =
    await Promise.all([
    NotebookEntry.findOne({
      status: { $ne: "CANCELLED" },
      $or: [{ customerId }, { "contributors.customerId": customerId }],
    })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean(),
    findLastCustomerPayment(customerId),
    countCustomerVisits(customerId),
    getCustomerOutstandingBalance(customerId),
  ]);

  return emptySummary(customer.balance ?? 0, {
    outstandingAmount,
    visitCount,
    lastVisitAt: lastVisitEntry?.createdAt?.toISOString() ?? null,
    lastPaymentAt: lastPayment?.createdAt ?? null,
    lastPaymentAmount: lastPayment?.amount ?? null,
  });
}

export async function getCustomerLedger(
  customerId: string
): Promise<CustomerLedgerLineDTO[]> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const customer = await Customer.findById(customerId).lean();
  if (!customer) {
    return [];
  }

  const lines: CustomerLedgerLineDTO[] = [
    openingLedgerLine(customer.createdAt),
  ];

  const transactions = await Transaction.find({ customerId })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  let walletBalance = 0;
  for (const tx of transactions) {
    const amount = tx.amount ?? tx.creditedAmount ?? tx.paidAmount ?? 0;
    const isCredit = tx.type === "credit" && !tx.isReversal;
    walletBalance += isCredit ? amount : -amount;

    lines.push({
      ledgerId: `tx-${tx._id.toString()}`,
      id: `tx-${tx._id.toString()}`,
      timestamp: tx.createdAt.toISOString(),
      description: tx.description,
      amount,
      kind: "payment",
      eventSubtype: isCredit ? "wallet_recharge" : "wallet_deduct",
      paymentContext: "WALLET",
      staffUsername: tx.staffUsername,
      walletBalance,
      outstandingBalance: 0,
      balanceLabel: formatLedgerBalanceLabel(walletBalance, 0),
      transactionId: tx._id.toString(),
      canReverseRecharge: Boolean(
        isCredit && !tx.reversedAt && !tx.isReversal
      ),
    });
  }

  return lines;
}

export async function getCustomerFinancials(customerId: string): Promise<{
  summary: CustomerLedgerSummaryDTO;
  activityItems: CustomerActivityItemDTO[];
} | null> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return null;
  }

  await connectDB();

  const customer = await Customer.findById(customerId).lean();
  if (!customer) {
    return null;
  }

  const [summary, activityItems] = await Promise.all([
    getCustomerLedgerSummary(customerId),
    getCustomerActivityTimeline(customerId),
  ]);

  if (!summary) {
    return null;
  }

  return { summary, activityItems };
}

export async function getCustomersWithOutstanding(
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<CustomerOutstandingRowDTO[]> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const aggregated = await Outstanding.aggregate<{
    _id: mongoose.Types.ObjectId;
    outstandingAmount: number;
    unpaidBusinessDays: mongoose.Types.ObjectId[];
    oldestOutstandingDate: Date;
  }>([
    { $match: { status: "PENDING", remainingAmount: { $gt: 0 } } },
    {
      $group: {
        _id: "$customerId",
        outstandingAmount: { $sum: "$remainingAmount" },
        unpaidBusinessDays: { $addToSet: "$businessDayId" },
        oldestOutstandingDate: { $min: "$businessDate" },
      },
    },
    { $match: { outstandingAmount: { $gt: 0 } } },
    { $sort: { oldestOutstandingDate: 1, outstandingAmount: -1 } },
  ]);

  if (aggregated.length === 0) {
    return [];
  }

  const customerIds = aggregated.map((row) => row._id);
  const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
  const customerById = new Map(
    customers.map((customer) => [customer._id.toString(), customer])
  );

  const query =
    typeof searchParams.q === "string" ? searchParams.q.trim().toLowerCase() : "";

  const rows: CustomerOutstandingRowDTO[] = [];

  for (const row of aggregated) {
    const customer = customerById.get(row._id.toString());
    if (!customer) continue;

    if (
      query &&
      !customer.name.toLowerCase().includes(query) &&
      !(customer.firstName ?? "").toLowerCase().includes(query) &&
      !(customer.lastName ?? "").toLowerCase().includes(query) &&
      !customer.phone.includes(query)
    ) {
      continue;
    }

    rows.push({
      customerId: customer._id.toString(),
      customerName: customer.name,
      phoneNumber: customer.phone,
      outstandingAmount: row.outstandingAmount,
      unpaidBusinessDayCount: row.unpaidBusinessDays.length,
      oldestOutstandingDate: row.oldestOutstandingDate.toISOString(),
    });
  }

  return rows;
}
