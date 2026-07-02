"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import {
  formatCafeItemLabel,
  getEntryDisplayLabel,
} from "@/lib/utils/notebook-entry-label";
import { getLedgerObligations, isEntryLedgerChargeable } from "@/lib/utils/entry-contributors";
import { payLaterBalanceAtDismiss } from "@/lib/utils/freeze-counter-pay-snapshot";
import { repairCounterSnapshotsForEntries } from "@/lib/wallet/reconcile-entry-payments";
import {
  bundleLedgerCharges,
  type LedgerChargeCandidate,
} from "@/lib/utils/ledger-charge-bundles";
import {
  formatLedgerBalanceLabel,
} from "@/lib/utils/customer-ledger-display";
import type {
  CustomerLedgerEventKind,
  CustomerLedgerLineDTO,
  CustomerLedgerSummaryDTO,
  CustomerOutstandingRowDTO,
} from "@/types";
import Customer from "@/models/Customer";
import CustomerBalancePayment from "@/models/CustomerBalancePayment";
import NotebookEntry from "@/models/NotebookEntry";
import NotebookSettlement from "@/models/NotebookSettlement";
import Transaction from "@/models/Transaction";
import { getActiveVisitCheckoutDueAmount } from "@/lib/visit-bill/active-visit-checkout-due";

type RawLedgerEvent = {
  id: string;
  timestamp: Date;
  description: string;
  amount: number;
  kind: CustomerLedgerEventKind;
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

function paymentReceivedLabel(method: NotebookPaymentMethod): string {
  switch (method) {
    case "CASH":
      return "Cash Received";
    case "GPAY":
      return "GPay Received";
    case "WALLET":
      return "Paid from Wallet";
  }
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

function customerLedgerChargeAmount(
  entry: ReturnType<typeof toNotebookEntryDTO>,
  customerId: string
): number | null {
  if (entry.status === "CANCELLED") {
    return null;
  }

  const contributor = entry.contributors?.find(
    (row) => row.customerId === customerId
  );
  if (contributor) {
    return contributor.amount;
  }

  if (entry.customerId === customerId) {
    return entry.amount;
  }

  return null;
}

function customerOutstandingAmount(
  entry: ReturnType<typeof toNotebookEntryDTO>,
  customerId: string
): number {
  return getLedgerObligations(entry)
    .filter((obligation) => obligation.customerId === customerId)
    .reduce((sum, obligation) => sum + obligation.amount, 0);
}

function applyRunningBalances(
  events: RawLedgerEvent[],
  openingTimestamp: Date
): CustomerLedgerLineDTO[] {
  const sorted = [...events].sort((a, b) => {
    const diff = a.timestamp.getTime() - b.timestamp.getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  let walletBalance = 0;
  let outstandingBalance = 0;
  const lines: CustomerLedgerLineDTO[] = [
    {
      id: "opening",
      timestamp: openingTimestamp.toISOString(),
      description: "Balance Brought Forward",
      amount: 0,
      kind: "status",
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
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      description: event.description,
      amount: event.amount,
      kind: event.kind,
      staffUsername: event.staffUsername,
      walletBalance,
      outstandingBalance,
      balanceLabel: formatLedgerBalanceLabel(walletBalance, outstandingBalance),
      transactionId: event.transactionId,
      canReverseRecharge: event.canReverseRecharge,
    });

    if (
      event.kind === "payment" &&
      outstandingBefore > 0 &&
      outstandingBalance === 0
    ) {
      lines.push({
        id: `${event.id}-settled`,
        timestamp: new Date(event.timestamp.getTime() + 1).toISOString(),
        description: "Outstanding Settled",
        amount: 0,
        kind: "status",
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
      description: "Outstanding Created",
      amount: group.total,
      kind: "status",
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

  const [pendingItems, lastVisitEntry, lastPayment, visitCount, activeVisitDueAmount] =
    await Promise.all([
      NotebookEntry.find({
        status: { $in: ["PENDING", "REVERSED", "PAID"] },
        $or: [{ customerId }, { "contributors.customerId": customerId }],
      }).lean(),
      NotebookEntry.findOne({
        status: { $ne: "CANCELLED" },
        $or: [{ customerId }, { "contributors.customerId": customerId }],
      })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean(),
      findLastCustomerPayment(customerId),
      countCustomerVisits(customerId),
      getActiveVisitCheckoutDueAmount(customerId),
    ]);

  let openBillsCount = 0;

  for (const entry of pendingItems) {
    const dto = toNotebookEntryDTO(entry);
    const remaining = customerOutstandingAmount(dto, customerId);
    if (remaining <= 0) continue;
    openBillsCount += 1;
  }

  const ledgerLines = await buildCustomerLedgerLines(customerId, customer);
  const outstandingAmount =
    ledgerLines.at(-1)?.outstandingBalance ?? 0;

  return {
    walletBalance: customer.walletEnabled ? customer.balance : 0,
    outstandingAmount,
    activeVisitDueAmount,
    hasActiveVisitWithDue: activeVisitDueAmount > 0,
    openBillsCount,
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
  const chargeCandidates: LedgerChargeCandidate[] = [];

  const entries = await NotebookEntry.find({
    $or: [{ customerId }, { "contributors.customerId": customerId }],
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

  for (const entry of refreshedEntries) {
    const dto = toNotebookEntryDTO(entry);
    const chargeAmount = customerLedgerChargeAmount(dto, customerId);
    if (chargeAmount == null || dto.status === "CANCELLED") {
      continue;
    }
    if (!isEntryLedgerChargeable(dto)) {
      continue;
    }

    const rawDescription = chargeDescription(dto);
    if (isLegacyPayLaterDescription(rawDescription)) {
      continue;
    }

    chargeCandidates.push({
      entryId: entry._id.toString(),
      section: dto.section,
      timestamp: entry.createdAt,
      description: stripLegacyPayLaterPrefix(rawDescription),
      amount: chargeAmount,
      staffUsername: entry.createdBy,
    });
  }

  for (const bundle of bundleLedgerCharges(chargeCandidates)) {
    events.push({
      id: bundle.id,
      timestamp: bundle.timestamp,
      description: bundle.description,
      amount: -bundle.amount,
      kind: "charge",
      staffUsername: bundle.staffUsername,
      affectsOutstanding: true,
      affectsWallet: false,
      walletDelta: 0,
      outstandingDelta: bundle.amount,
    });
  }

  const dismissGroups = new Map<string, OutstandingDismissGroup>();

  for (const entry of refreshedEntries) {
    if (!entry.checkoutDismissedAt) {
      continue;
    }

    const dto = entryDtoById.get(entry._id.toString());
    if (!dto || !isEntryLedgerChargeable(dto)) {
      continue;
    }

    const isCustomerEntry =
      entry.customerId?.toString() === customerId ||
      entry.contributors?.some(
        (row) => row.customerId.toString() === customerId
      );
    if (!isCustomerEntry) {
      continue;
    }

    const balanceAtDismiss = payLaterBalanceAtDismiss(dto);
    if (balanceAtDismiss <= 0) {
      continue;
    }

    const dismissedAt = entry.checkoutDismissedAt;
    const staffUsername =
      entry.checkoutDismissedBy ?? entry.assignedBy ?? entry.createdBy;
    const groupKey = `${dismissedAt.getTime()}::${staffUsername}`;
    const existing = dismissGroups.get(groupKey);

    if (existing) {
      existing.total += balanceAtDismiss;
      continue;
    }

    dismissGroups.set(groupKey, {
      timestamp: dismissedAt,
      staffUsername,
      total: balanceAtDismiss,
      firstEntryId: entry._id.toString(),
    });
  }

  for (const group of dismissGroups.values()) {
    events.push({
      id: `outstanding-created-${group.firstEntryId}-${group.timestamp.getTime()}`,
      timestamp: group.timestamp,
      description: "Outstanding Created",
      amount: group.total,
      kind: "status",
      staffUsername: group.staffUsername,
      affectsOutstanding: false,
      affectsWallet: false,
      walletDelta: 0,
      outstandingDelta: 0,
    });
  }

  const settlementIds = [
    ...new Set(
      refreshedEntries.flatMap((entry) => {
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

  const settlements = await NotebookSettlement.find({
    _id: { $in: settlementIds },
    status: "COMPLETED",
  })
    .sort({ createdAt: 1 })
    .lean();

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
      const dto = entryDtoById.get(allocation.entryId.toString());
      if (!dto || !isEntryLedgerChargeable(dto)) {
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
      description: paymentReceivedLabel(method),
      amount: ledgerApplied,
      kind: "payment",
      staffUsername: payment.createdBy,
      affectsOutstanding: true,
      affectsWallet: method === "WALLET",
      walletDelta: method === "WALLET" ? -payment.amount : 0,
      outstandingDelta: -ledgerApplied,
    });
  }

  for (const settlement of settlements) {
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

    events.push({
      id: `payment-${settlement._id.toString()}`,
      timestamp: settlement.createdAt,
      description: paymentReceivedLabel(method),
      amount: paymentAmount,
      kind: "payment",
      staffUsername: settlement.createdBy,
      affectsOutstanding: true,
      affectsWallet: method === "WALLET",
      walletDelta: method === "WALLET" ? -paymentAmount : 0,
      outstandingDelta: -paymentAmount,
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
        description: isReversal ? "Refund — Wallet Recharge" : "Wallet Recharge",
        amount: isReversal ? -credited : credited,
        kind: "status",
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
      description: tx.isReversal ? "Refund — Wallet Deduction" : "Wallet Deduction",
      amount: -debitAmount,
      kind: "status",
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

  const [ledgerLines, lastVisitEntry, lastPayment, visitCount, pendingItems, activeVisitDueAmount] =
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
      NotebookEntry.find({
        status: { $in: ["PENDING", "REVERSED", "PAID"] },
        $or: [{ customerId }, { "contributors.customerId": customerId }],
      }).lean(),
      getActiveVisitCheckoutDueAmount(customerId),
    ]);

  let openBillsCount = 0;
  for (const entry of pendingItems) {
    const dto = toNotebookEntryDTO(entry);
    const remaining = customerOutstandingAmount(dto, customerId);
    if (remaining <= 0) continue;
    openBillsCount += 1;
  }

  const summary: CustomerLedgerSummaryDTO = {
    walletBalance: customer.walletEnabled ? customer.balance : 0,
    outstandingAmount: ledgerLines.at(-1)?.outstandingBalance ?? 0,
    activeVisitDueAmount,
    hasActiveVisitWithDue: activeVisitDueAmount > 0,
    openBillsCount,
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

  const entries = await NotebookEntry.find({
    status: { $in: ["PENDING", "REVERSED"] },
  }).lean();

  const totalsByCustomer = new Map<
    string,
    { outstandingAmount: number; openBillsCount: number }
  >();

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    const obligations = getLedgerObligations(dto);
    for (const obligation of obligations) {
      const existing = totalsByCustomer.get(obligation.customerId) ?? {
        outstandingAmount: 0,
        openBillsCount: 0,
      };
      existing.outstandingAmount += obligation.amount;
      existing.openBillsCount += 1;
      totalsByCustomer.set(obligation.customerId, existing);
    }
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
      getActiveVisitCheckoutDueAmount(customerId),
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
