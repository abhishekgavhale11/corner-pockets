import type { NotebookEntryDTO } from "@/types";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";

export type CheckoutFinalizationBatch = {
  id: string;
  billKey: string;
  customerId: string;
  finalizedAt: Date;
  entryIds: string[];
  mode: "dismiss" | "full_pay";
  visitPaymentTotal: number;
  outstandingAtFinalize: number;
  settlementIds: string[];
  paymentMethod?: NotebookPaymentMethod;
  staffUsername: string;
};

type SettlementRow = {
  _id: { toString(): string };
  createdAt: Date;
  createdBy: string;
  paymentMethod: NotebookPaymentMethod;
  entryIds: { toString(): string }[];
  contributorPayments?: {
    entryId: { toString(): string };
    customerId: { toString(): string };
  }[];
};

export function entryBelongsToCustomer(
  entry: NotebookEntryDTO,
  customerId: string
): boolean {
  if (entry.customerId === customerId) {
    return true;
  }
  return (
    entry.contributors?.some(
      (contributor) => contributor.customerId === customerId
    ) ?? false
  );
}

export function customerLedgerChargeAmount(
  entry: NotebookEntryDTO,
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

export function customerCheckoutPaidAmount(
  entry: NotebookEntryDTO,
  customerId: string
): number {
  const contributor = entry.contributors?.find(
    (row) => row.customerId === customerId
  );
  if (contributor) {
    return contributor.paidAmount ?? 0;
  }
  if (entry.customerId === customerId) {
    return entry.paidAmount ?? 0;
  }
  return 0;
}

function billGroupKey(entry: NotebookEntryDTO): string {
  if (entry.billId) {
    return entry.billId;
  }
  return `entry:${entry.id}`;
}

function chargeableEntriesForCustomer(
  entries: NotebookEntryDTO[],
  customerId: string,
  billKey: string
): NotebookEntryDTO[] {
  return entries
    .filter((entry) => entryBelongsToCustomer(entry, customerId))
    .filter((entry) => billGroupKey(entry) === billKey)
    .filter((entry) => customerLedgerChargeAmount(entry, customerId) != null)
    .filter((entry) => entry.status !== "CANCELLED");
}

function collectBatchSettlementIds(
  entryIds: Set<string>,
  settlements: SettlementRow[]
): string[] {
  const ids = new Set<string>();

  for (const settlement of settlements) {
    const touchesBatch =
      settlement.entryIds.some((entryId) =>
        entryIds.has(entryId.toString())
      ) ||
      settlement.contributorPayments?.some((payment) =>
        entryIds.has(payment.entryId.toString())
      );

    if (touchesBatch) {
      ids.add(settlement._id.toString());
    }
  }

  return [...ids];
}

function resolveBatchPaymentMethod(
  settlementIds: string[],
  settlements: SettlementRow[]
): NotebookPaymentMethod | undefined {
  const batchSettlements = settlements
    .filter((settlement) => settlementIds.includes(settlement._id.toString()))
    .sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

  return batchSettlements[0]?.paymentMethod;
}

function resolveBatchStaffUsername(
  chargeable: NotebookEntryDTO[],
  settlements: SettlementRow[],
  settlementIds: string[]
): string {
  const dismissedBy = chargeable
    .map((entry) => entry.checkoutDismissedBy)
    .find(Boolean);
  if (dismissedBy) {
    return dismissedBy;
  }

  const batchSettlement = settlements
    .filter((settlement) => settlementIds.includes(settlement._id.toString()))
    .sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];

  if (batchSettlement) {
    return batchSettlement.createdBy;
  }

  return chargeable[0]?.createdBy ?? "—";
}

export function buildCheckoutFinalizationBatches(
  entries: NotebookEntryDTO[],
  settlements: SettlementRow[],
  customerId: string,
  finalizedAtByBillId: Map<string, Date>,
  dueAmountByBillId: Map<string, number>
): CheckoutFinalizationBatch[] {
  const billKeys = new Set(
    entries
      .filter((entry) => entryBelongsToCustomer(entry, customerId))
      .map((entry) => billGroupKey(entry))
  );

  const batches: CheckoutFinalizationBatch[] = [];

  for (const billKey of billKeys) {
    const finalizedAt = finalizedAtByBillId.get(billKey);
    if (!finalizedAt) {
      continue;
    }

    const chargeable = chargeableEntriesForCustomer(
      entries,
      customerId,
      billKey
    );
    if (chargeable.length === 0) {
      continue;
    }

    const entryIds = new Set(chargeable.map((entry) => entry.id));
    const settlementIds = collectBatchSettlementIds(entryIds, settlements);
    const visitPaymentTotal = chargeable.reduce(
      (sum, entry) => sum + customerCheckoutPaidAmount(entry, customerId),
      0
    );
    const outstandingAtFinalize = dueAmountByBillId.get(billKey) ?? 0;
    const mode = outstandingAtFinalize > 0 ? "dismiss" : "full_pay";

    batches.push({
      id: `checkout-batch-${billKey}-${customerId}-${finalizedAt.getTime()}`,
      billKey,
      customerId,
      finalizedAt,
      entryIds: [...entryIds],
      mode,
      visitPaymentTotal,
      outstandingAtFinalize,
      settlementIds,
      paymentMethod: resolveBatchPaymentMethod(settlementIds, settlements),
      staffUsername: resolveBatchStaffUsername(
        chargeable,
        settlements,
        settlementIds
      ),
    });
  }

  return batches.sort(
    (a, b) => a.finalizedAt.getTime() - b.finalizedAt.getTime()
  );
}

export function entryIdsInFinalizedCheckout(
  batches: CheckoutFinalizationBatch[]
): Set<string> {
  const ids = new Set<string>();
  for (const batch of batches) {
    for (const entryId of batch.entryIds) {
      ids.add(entryId);
    }
  }
  return ids;
}

export function settlementIdsAbsorbedByCheckoutBatches(
  batches: CheckoutFinalizationBatch[]
): Set<string> {
  const ids = new Set<string>();
  for (const batch of batches) {
    for (const settlementId of batch.settlementIds) {
      ids.add(settlementId);
    }
  }
  return ids;
}
