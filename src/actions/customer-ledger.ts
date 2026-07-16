"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import {
  formatCafeItemLabel,
  getEntryDisplayLabel,
} from "@/lib/utils/notebook-entry-label";
import { repairCounterSnapshotsForEntries } from "@/lib/wallet/reconcile-entry-payments";
import {
  buildCheckoutFinalizationBatches,
  customerLedgerChargeAmount,
  settlementIdsAbsorbedByCheckoutBatches,
} from "@/lib/ledger/checkout-finalization";
import {
  formatLedgerBalanceLabel,
  formatPaymentReceivedDescription,
} from "@/lib/utils/customer-ledger-display";
import type {
  CustomerLedgerEventKind,
  CustomerLedgerEventSubtype,
  CustomerLedgerLineDTO,
  CustomerLedgerPaymentContext,
  CustomerLedgerSummaryDTO,
  CustomerOutstandingRowDTO,
} from "@/types";
import Customer from "@/models/Customer";
import CustomerBalancePayment from "@/models/CustomerBalancePayment";
import NotebookEntry from "@/models/NotebookEntry";
import NotebookSettlement from "@/models/NotebookSettlement";
import Transaction from "@/models/Transaction";
import Bill from "@/models/Bill";
import Visit from "@/models/Visit";
import { getCustomerPagePaymentBlockDue } from "@/lib/visit-bill/active-visit-checkout-due";

type RawLedgerEvent = {
  id: string;
  timestamp: Date;
  description: string;
  amount: number;
  kind: CustomerLedgerEventKind;
  eventSubtype?: CustomerLedgerEventSubtype;
  paymentContext?: CustomerLedgerPaymentContext;
  staffUsername: string;
  affectsOutstanding: boolean;
  affectsWallet: boolean;
  walletDelta: number;
  outstandingDelta: number;
  transactionId?: string;
  canReverseRecharge?: boolean;
};

type OutstandingDismissGroup = {
  timestamp: Date;
  staffUsername: string;
  total: number;
  firstEntryId: string;
};

const PAY_LATER_PREFIX_PATTERN = /^pay\s*later\b[\s\-—:]*/i;

const LEDGER_ENTRY_LIMIT = 500;

const LEDGER_STATUS_MOVED_TO_OUTSTANDING = "Moved to Outstanding";
const LEDGER_STATUS_OUTSTANDING_PAID = "Outstanding Paid";

function settlementPaymentContext(
  settlement: {
    entryIds: mongoose.Types.ObjectId[];
    contributorPayments?: {
      entryId: mongoose.Types.ObjectId;
      customerId: mongoose.Types.ObjectId;
      amount: number;
    }[];
  },
  customerId: string,
  entryDtoById: Map<string, ReturnType<typeof toNotebookEntryDTO>>
): CustomerLedgerPaymentContext {
  const contributorPayment = settlement.contributorPayments?.find(
    (payment) => payment.customerId.toString() === customerId
  );

  const entryIds = contributorPayment
    ? [contributorPayment.entryId.toString()]
    : settlement.entryIds
        .map((entryId) => entryId.toString())
        .filter((entryId) => {
          const dto = entryDtoById.get(entryId);
          if (!dto) return false;
          return customerLedgerChargeAmount(dto, customerId) != null;
        });

  if (entryIds.length === 0) {
    return "ACTIVE_VISIT";
  }

  let hasOutstandingEntry = false;
  let hasVisitEntry = false;

  for (const entryId of entryIds) {
    const dto = entryDtoById.get(entryId);
    if (!dto) continue;
    if (dto.checkoutDismissedAt) {
      hasOutstandingEntry = true;
    } else {
      hasVisitEntry = true;
    }
  }

  if (hasOutstandingEntry && !hasVisitEntry) {
    return "OUTSTANDING";
  }

  return "ACTIVE_VISIT";
}

function chargeDescription(
  entry: ReturnType<typeof toNotebookEntryDTO>
): string {
  if (entry.section === "CAFE") {
    return formatCafeItemLabel(entry);
  }
  return getEntryDisplayLabel(entry);
}

function isLegacyPayLaterDescription(description: string): boolean {
  return PAY_LATER_PREFIX_PATTERN.test(description.trim());
}

function stripLegacyPayLaterPrefix(description: string): string {
  return description.trim().replace(PAY_LATER_PREFIX_PATTERN, "").trim();
}

function ledgerEventSortPriority(event: RawLedgerEvent): number {
  if (event.kind === "charge") return 10;
  if (event.kind === "payment") return 20;
  if (
    event.eventSubtype === "moved_to_outstanding" ||
    event.description === LEDGER_STATUS_MOVED_TO_OUTSTANDING
  ) {
    return 30;
  }
  if (
    event.eventSubtype === "outstanding_paid" ||
    event.description === LEDGER_STATUS_OUTSTANDING_PAID
  ) {
    return 40;
  }
  if (event.kind === "status") return 25;
  return 50;
}

function applyRunningBalances(
  events: RawLedgerEvent[],
  openingTimestamp: Date
): CustomerLedgerLineDTO[] {
  const sorted = [...events].sort((a, b) => {
    const diff = a.timestamp.getTime() - b.timestamp.getTime();
    if (diff !== 0) return diff;
    const priorityDiff =
      ledgerEventSortPriority(a) - ledgerEventSortPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.id.localeCompare(b.id);
  });

  let walletBalance = 0;
  let outstandingBalance = 0;
  const lines: CustomerLedgerLineDTO[] = [
    {
      ledgerId: "opening",
      id: "opening",
      timestamp: openingTimestamp.toISOString(),
      description: "Balance Brought Forward",
      amount: 0,
      kind: "status",
      eventSubtype: "opening",
      staffUsername: "—",
      walletBalance: 0,
      outstandingBalance: 0,
      balanceLabel: "₹0",
    },
  ];

  for (const event of sorted) {
    const outstandingBefore = outstandingBalance;

    if (event.affectsWallet) {
      walletBalance = Math.max(0, walletBalance + event.walletDelta);
    }
    if (event.affectsOutstanding) {
      outstandingBalance = Math.max(
        0,
        outstandingBalance + event.outstandingDelta
      );
    }

    lines.push({
      ledgerId: event.id,
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      description: event.description,
      amount: event.amount,
      kind: event.kind,
      eventSubtype: event.eventSubtype,
      paymentContext: event.paymentContext,
      staffUsername: event.staffUsername,
      walletBalance,
      outstandingBalance,
      balanceLabel: formatLedgerBalanceLabel(walletBalance, outstandingBalance),
      transactionId: event.transactionId,
      canReverseRecharge: event.canReverseRecharge,
    });

    if (
      event.kind === "payment" &&
      event.paymentContext === "OUTSTANDING" &&
      event.id.startsWith("balance-payment-") &&
      outstandingBefore > 0 &&
      outstandingBalance === 0
    ) {
      const settledAmount = Math.min(
        Math.abs(event.amount),
        outstandingBefore
      );
      lines.push({
        ledgerId: `${event.id}-outstanding-paid`,
        id: `${event.id}-outstanding-paid`,
        timestamp: new Date(event.timestamp.getTime() + 1).toISOString(),
        description: LEDGER_STATUS_OUTSTANDING_PAID,
        amount: settledAmount,
        kind: "status",
        eventSubtype: "outstanding_paid",
        paymentContext: "OUTSTANDING",
        staffUsername: event.staffUsername,
        walletBalance,
        outstandingBalance,
        balanceLabel: formatLedgerBalanceLabel(walletBalance, outstandingBalance),
      });
    }
  }

  return lines;
}

function normalizeLegacyPayLaterEvents(events: RawLedgerEvent[]): RawLedgerEvent[] {
  const grouped = new Map<string, OutstandingDismissGroup>();
  const normalized: RawLedgerEvent[] = [];

  for (const event of events) {
    if (!isLegacyPayLaterDescription(event.description)) {
      normalized.push(event);
      continue;
    }

    const groupKey = `${event.timestamp.getTime()}::${event.staffUsername}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.total += Math.abs(event.amount);
      continue;
    }

    grouped.set(groupKey, {
      timestamp: event.timestamp,
      staffUsername: event.staffUsername,
      total: Math.abs(event.amount),
      firstEntryId: event.id,
    });
  }

  for (const group of grouped.values()) {
    normalized.push({
      id: `outstanding-created-legacy-${group.firstEntryId}`,
      timestamp: group.timestamp,
      description: LEDGER_STATUS_MOVED_TO_OUTSTANDING,
      amount: group.total,
      kind: "status",
      eventSubtype: "moved_to_outstanding",
      staffUsername: group.staffUsername,
      affectsOutstanding: false,
      affectsWallet: false,
      walletDelta: 0,
      outstandingDelta: 0,
    });
  }

  return normalized;
}

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

  const [finishedOutstandingBills, lastVisitEntry, lastPayment, visitCount, activeVisitDueAmount] =
    await Promise.all([
      Bill.find({
        customerId: new mongoose.Types.ObjectId(customerId),
        status: "FINISHED",
        dueAmount: { $gt: 0 },
      })
        .select("_id")
        .lean(),
      NotebookEntry.findOne({
        status: { $ne: "CANCELLED" },
        $or: [{ customerId }, { "contributors.customerId": customerId }],
      })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean(),
      findLastCustomerPayment(customerId),
      countCustomerVisits(customerId),
      getCustomerPagePaymentBlockDue(customerId),
    ]);

  const ledgerLines = await buildCustomerLedgerLines(customerId, customer);
  const outstandingAmount =
    ledgerLines.at(-1)?.outstandingBalance ?? 0;

  return {
    walletBalance: customer.walletEnabled ? customer.balance : 0,
    outstandingAmount,
    activeVisitDueAmount,
    hasActiveVisitWithDue: activeVisitDueAmount > 0,
    openBillsCount: finishedOutstandingBills.length,
    visitCount,
    lastVisitAt: lastVisitEntry?.createdAt?.toISOString() ?? null,
    lastPaymentAt: lastPayment?.createdAt ?? null,
    lastPaymentAmount: lastPayment?.amount ?? null,
  };
}

async function findLastCustomerPayment(customerId: string): Promise<{
  createdAt: string;
  amount: number;
} | null> {
  const [lastSettlement, lastBalancePayment] = await Promise.all([
    findLastPaymentSettlement(customerId),
    CustomerBalancePayment.findOne({ customerId })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const candidates = [
    lastSettlement
      ? {
          createdAt: lastSettlement.createdAt.toISOString(),
          amount: lastSettlement.totalAmount,
        }
      : null,
    lastBalancePayment
      ? {
          createdAt: lastBalancePayment.createdAt.toISOString(),
          amount: lastBalancePayment.amount,
        }
      : null,
  ].filter((row): row is { createdAt: string; amount: number } => row !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]!;
}

async function findLastPaymentSettlement(customerId: string) {
  const customerEntries = await NotebookEntry.find({
    $or: [{ customerId }, { "contributors.customerId": customerId }],
  })
    .select("settlementId contributors")
    .lean();

  const settlementIds = [
    ...new Set(
      customerEntries.flatMap((entry) => {
        const ids: string[] = [];
        if (entry.settlementId) {
          ids.push(entry.settlementId.toString());
        }
        for (const contributor of entry.contributors ?? []) {
          if (
            contributor.customerId.toString() === customerId &&
            contributor.settlementId
          ) {
            ids.push(contributor.settlementId.toString());
          }
        }
        return ids;
      })
    ),
  ];

  if (settlementIds.length === 0) {
    return null;
  }

  return NotebookSettlement.findOne({
    _id: { $in: settlementIds },
    status: "COMPLETED",
  })
    .sort({ createdAt: -1 })
    .lean();
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

  return buildCustomerLedgerLines(customerId, customer);
}

async function buildCustomerLedgerLines(
  customerId: string,
  customer: { createdAt: Date }
): Promise<CustomerLedgerLineDTO[]> {
  const events: RawLedgerEvent[] = [];

  const [finishedBills, finishedVisits] = await Promise.all([
    Bill.find({
      customerId: new mongoose.Types.ObjectId(customerId),
      status: "FINISHED",
    })
      .select("_id dueAmount")
      .lean(),
    Visit.find({
      customerId: new mongoose.Types.ObjectId(customerId),
      status: "FINISHED",
    })
      .select("billId finishedAt ledgerCommittedAt")
      .lean(),
  ]);

  const finishedBillIds = finishedBills.map((bill) => bill._id);
  const finalizedAtByBillId = new Map<string, Date>();
  for (const visit of finishedVisits) {
    const at = visit.ledgerCommittedAt ?? visit.finishedAt;
    if (!at) continue;
    finalizedAtByBillId.set(visit.billId.toString(), at);
  }
  const dueAmountByBillId = new Map(
    finishedBills.map((bill) => [bill._id.toString(), bill.dueAmount])
  );

  const entries = await NotebookEntry.find({
    $or: [
      {
        customerId: new mongoose.Types.ObjectId(customerId),
        billId: { $in: finishedBillIds },
      },
      {
        contributors: {
          $elemMatch: {
            customerId: new mongoose.Types.ObjectId(customerId),
            billId: { $in: finishedBillIds },
          },
        },
      },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(LEDGER_ENTRY_LIMIT)
    .lean();

  const entryIds = entries.map((entry) => entry._id.toString());
  await repairCounterSnapshotsForEntries(entryIds);

  const refreshedEntries = await NotebookEntry.find({
    _id: { $in: entryIds },
  })
    .sort({ createdAt: 1 })
    .lean();

  const entryDtoById = new Map(
    refreshedEntries.map((entry) => [entry._id.toString(), toNotebookEntryDTO(entry)])
  );

  const entryDtos = refreshedEntries.map((entry) =>
    toNotebookEntryDTO(entry)
  );

  const settlementIds = [
    ...new Set(
      refreshedEntries.flatMap((entry) => {
        const ids: string[] = [];
        if (entry.settlementId) {
          ids.push(entry.settlementId.toString());
        }
        for (const contributor of entry.contributors ?? []) {
          if (contributor.settlementId) {
            ids.push(contributor.settlementId.toString());
          }
        }
        return ids;
      })
    ),
  ];

  const settlements = await NotebookSettlement.find({
    _id: { $in: settlementIds },
    status: "COMPLETED",
  })
    .sort({ createdAt: 1 })
    .lean();

  const checkoutBatches = buildCheckoutFinalizationBatches(
    entryDtos,
    settlements,
    customerId,
    finalizedAtByBillId,
    dueAmountByBillId
  );
  const absorbedCheckoutSettlementIds =
    settlementIdsAbsorbedByCheckoutBatches(checkoutBatches);

  for (const batch of checkoutBatches) {
    const batchEntries = batch.entryIds
      .map((entryId) => entryDtoById.get(entryId))
      .filter((entry): entry is ReturnType<typeof toNotebookEntryDTO> =>
        Boolean(entry)
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    for (const dto of batchEntries) {
      const chargeAmount = customerLedgerChargeAmount(dto, customerId);
      if (chargeAmount == null || chargeAmount <= 0) {
        continue;
      }

      const rawDescription = chargeDescription(dto);
      if (isLegacyPayLaterDescription(rawDescription)) {
        continue;
      }

      const entry = refreshedEntries.find((row) => row._id.toString() === dto.id);
      events.push({
        id: `charge-${dto.id}`,
        timestamp: batch.finalizedAt,
        description: stripLegacyPayLaterPrefix(rawDescription),
        amount: -chargeAmount,
        kind: "charge",
        eventSubtype: "charge",
        staffUsername: entry?.createdBy ?? batch.staffUsername,
        affectsOutstanding: true,
        affectsWallet: false,
        walletDelta: 0,
        outstandingDelta: chargeAmount,
      });
    }

    if (batch.visitPaymentTotal > 0) {
      const method = batch.paymentMethod ?? "CASH";
      events.push({
        id: `${batch.id}-payment`,
        timestamp: batch.finalizedAt,
        description: formatPaymentReceivedDescription(method, "ACTIVE_VISIT"),
        amount: batch.visitPaymentTotal,
        kind: "payment",
        eventSubtype: "payment",
        paymentContext: "ACTIVE_VISIT",
        staffUsername: batch.staffUsername,
        affectsOutstanding: true,
        affectsWallet: method === "WALLET",
        walletDelta: method === "WALLET" ? -batch.visitPaymentTotal : 0,
        outstandingDelta: -batch.visitPaymentTotal,
      });
    }

    if (batch.outstandingAtFinalize > 0) {
      events.push({
        id: `${batch.id}-moved-to-outstanding`,
        timestamp: batch.finalizedAt,
        description: LEDGER_STATUS_MOVED_TO_OUTSTANDING,
        amount: batch.outstandingAtFinalize,
        kind: "status",
        eventSubtype: "moved_to_outstanding",
        staffUsername: batch.staffUsername,
        affectsOutstanding: false,
        affectsWallet: false,
        walletDelta: 0,
        outstandingDelta: 0,
      });
    }
  }

  const settlementWalletTxnIds = new Set(
    settlements
      .map((s) => s.walletTransactionId?.toString())
      .filter((id): id is string => Boolean(id))
  );

  const balancePayments = await CustomerBalancePayment.find({ customerId })
    .sort({ createdAt: 1 })
    .lean();

  function ledgerAppliedFromBalancePayment(
    payment: (typeof balancePayments)[number]
  ): number {
    return payment.allocations.reduce((sum, allocation) => {
      const entry = refreshedEntries.find(
        (row) => row._id.toString() === allocation.entryId.toString()
      );
      const billId = entry?.billId?.toString();
      if (!billId || !finalizedAtByBillId.has(billId)) {
        return sum;
      }
      return sum + allocation.amount;
    }, 0);
  }

  const balancePaymentWalletTxnIds = new Set(
    balancePayments
      .map((p) => p.walletTransactionId?.toString())
      .filter((id): id is string => Boolean(id))
  );

  for (const payment of balancePayments) {
    const ledgerApplied = ledgerAppliedFromBalancePayment(payment);
    if (ledgerApplied <= 0) {
      continue;
    }

    const method = payment.paymentMethod;
    events.push({
      id: `balance-payment-${payment._id.toString()}`,
      timestamp: payment.createdAt,
      description: formatPaymentReceivedDescription(method, "OUTSTANDING"),
      amount: ledgerApplied,
      kind: "payment",
      eventSubtype: "payment",
      paymentContext: "OUTSTANDING",
      staffUsername: payment.createdBy,
      affectsOutstanding: true,
      affectsWallet: method === "WALLET",
      walletDelta: method === "WALLET" ? -payment.amount : 0,
      outstandingDelta: -ledgerApplied,
    });
  }

  for (const settlement of settlements) {
    const settlementId = settlement._id.toString();
    if (absorbedCheckoutSettlementIds.has(settlementId)) {
      continue;
    }

    const contributorPayment = settlement.contributorPayments?.find(
      (payment) => payment.customerId.toString() === customerId
    );

    let paymentAmount = 0;

    if (contributorPayment) {
      paymentAmount = contributorPayment.amount;
    } else if ((settlement.contributorPayments?.length ?? 0) === 0) {
      const linkedToCustomer = refreshedEntries.some(
        (entry) =>
          entry.settlementId?.toString() === settlement._id.toString() &&
          (entry.customerId?.toString() === customerId ||
            entry.contributors?.some(
              (row) => row.customerId.toString() === customerId
            ))
      );

      if (linkedToCustomer) {
        paymentAmount = settlement.totalAmount;
      }
    }

    if (paymentAmount <= 0) {
      continue;
    }

    const method = settlement.paymentMethod;
    const paymentContext = settlementPaymentContext(
      settlement,
      customerId,
      entryDtoById
    );

    events.push({
      id: `payment-${settlement._id.toString()}`,
      timestamp: settlement.createdAt,
      description: formatPaymentReceivedDescription(method, paymentContext),
      amount: paymentAmount,
      kind: "payment",
      eventSubtype: "payment",
      paymentContext,
      staffUsername: settlement.createdBy,
      affectsOutstanding: paymentContext === "OUTSTANDING",
      affectsWallet: method === "WALLET",
      walletDelta: method === "WALLET" ? -paymentAmount : 0,
      outstandingDelta:
        paymentContext === "OUTSTANDING" ? -paymentAmount : 0,
    });
  }

  const transactions = await Transaction.find({ customerId })
    .sort({ createdAt: 1 })
    .limit(LEDGER_ENTRY_LIMIT)
    .lean();

  for (const tx of transactions) {
    const txnId = tx._id.toString();
    if (settlementWalletTxnIds.has(txnId)) {
      continue;
    }
    if (balancePaymentWalletTxnIds.has(txnId)) {
      continue;
    }

    if (tx.type === "credit") {
      const credited = tx.creditedAmount ?? tx.paidAmount ?? 0;
      const isReversal = Boolean(tx.isReversal);
      const canReverseRecharge =
        !isReversal && !tx.reversedAt && credited > 0;
      events.push({
        id: `wallet-${tx._id.toString()}`,
        timestamp: tx.createdAt,
        description: isReversal
          ? "Refund — Wallet Recharge"
          : "Wallet Recharge",
        amount: isReversal ? -credited : credited,
        kind: "status",
        eventSubtype: isReversal ? "wallet_refund" : "wallet_recharge",
        paymentContext: isReversal ? "REFUND" : "WALLET",
        staffUsername: tx.staffUsername,
        affectsWallet: true,
        affectsOutstanding: false,
        walletDelta: isReversal ? -credited : credited,
        outstandingDelta: 0,
        transactionId: txnId,
        canReverseRecharge,
      });
      continue;
    }

    const debitAmount = tx.amount ?? 0;
    events.push({
      id: `wallet-${tx._id.toString()}`,
      timestamp: tx.createdAt,
      description: tx.isReversal
        ? "Refund — Wallet Deduction"
        : "Wallet Deduction",
      amount: -debitAmount,
      kind: "status",
      eventSubtype: tx.isReversal ? "wallet_refund" : "wallet_deduct",
      paymentContext: tx.isReversal ? "REFUND" : "WALLET",
      staffUsername: tx.staffUsername,
      affectsWallet: true,
      affectsOutstanding: false,
      walletDelta: -debitAmount,
      outstandingDelta: 0,
    });
  }

  return applyRunningBalances(
    normalizeLegacyPayLaterEvents(events),
    customer.createdAt
  );
}

export async function getCustomerFinancials(
  customerId: string
): Promise<{
  summary: CustomerLedgerSummaryDTO;
  ledgerLines: CustomerLedgerLineDTO[];
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

  const [ledgerLines, lastVisitEntry, lastPayment, visitCount, finishedOutstandingBills, activeVisitDueAmount] =
    await Promise.all([
      buildCustomerLedgerLines(customerId, customer),
      NotebookEntry.findOne({
        status: { $ne: "CANCELLED" },
        $or: [{ customerId }, { "contributors.customerId": customerId }],
      })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean(),
      findLastCustomerPayment(customerId),
      countCustomerVisits(customerId),
      Bill.find({
        customerId: new mongoose.Types.ObjectId(customerId),
        status: "FINISHED",
        dueAmount: { $gt: 0 },
      })
        .select("_id")
        .lean(),
      getCustomerPagePaymentBlockDue(customerId),
    ]);

  const summary: CustomerLedgerSummaryDTO = {
    walletBalance: customer.walletEnabled ? customer.balance : 0,
    outstandingAmount: ledgerLines.at(-1)?.outstandingBalance ?? 0,
    activeVisitDueAmount,
    hasActiveVisitWithDue: activeVisitDueAmount > 0,
    openBillsCount: finishedOutstandingBills.length,
    visitCount,
    lastVisitAt: lastVisitEntry?.createdAt?.toISOString() ?? null,
    lastPaymentAt: lastPayment?.createdAt ?? null,
    lastPaymentAmount: lastPayment?.amount ?? null,
  };

  return { summary, ledgerLines };
}

export async function getCustomersWithOutstanding(
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<CustomerOutstandingRowDTO[]> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return [];
  }

  const query =
    typeof searchParams.q === "string" ? searchParams.q.trim().toLowerCase() : "";

  await connectDB();

  const totalsByCustomer = new Map<
    string,
    { outstandingAmount: number; openBillsCount: number }
  >();

  const finishedBills = await Bill.find({
    status: "FINISHED",
    dueAmount: { $gt: 0 },
  })
    .select("customerId dueAmount")
    .lean();

  for (const bill of finishedBills) {
    const customerId = bill.customerId.toString();
    const existing = totalsByCustomer.get(customerId) ?? {
      outstandingAmount: 0,
      openBillsCount: 0,
    };
    existing.outstandingAmount += bill.dueAmount;
    existing.openBillsCount += 1;
    totalsByCustomer.set(customerId, existing);
  }

  if (totalsByCustomer.size === 0) {
    return [];
  }

  const customers = await Customer.find({
    _id: { $in: [...totalsByCustomer.keys()] },
    isActive: true,
  }).lean();

  const rows: CustomerOutstandingRowDTO[] = [];

  for (const customer of customers) {
    const totals = totalsByCustomer.get(customer._id.toString());
    if (!totals || totals.outstandingAmount <= 0) continue;

    const customerId = customer._id.toString();
    const name = customer.name;
    const phone = customer.phone ?? "";

    if (query) {
      const haystack = `${name} ${phone}`.toLowerCase();
      if (!haystack.includes(query)) continue;
    }

    const [lastVisitEntry, lastPayment, activeVisitDueAmount] = await Promise.all([
      NotebookEntry.findOne({
        status: { $ne: "CANCELLED" },
        $or: [{ customerId }, { "contributors.customerId": customerId }],
      })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean(),
      findLastCustomerPayment(customerId),
      getCustomerPagePaymentBlockDue(customerId),
    ]);

    rows.push({
      customerId,
      customerName: name,
      phoneNumber: phone,
      outstandingAmount: totals.outstandingAmount,
      activeVisitDueAmount,
      hasActiveVisitWithDue: activeVisitDueAmount > 0,
      openBillsCount: totals.openBillsCount,
      lastVisitAt: lastVisitEntry?.createdAt?.toISOString() ?? null,
      lastPaymentAt: lastPayment?.createdAt ?? null,
      lastPaymentAmount: lastPayment?.amount ?? null,
      walletEnabled: customer.walletEnabled ?? false,
      cardId: customer.cardId ?? "",
    });
  }

  return rows.sort((a, b) => b.outstandingAmount - a.outstandingAmount);
}
