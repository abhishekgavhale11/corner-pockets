import type {
  DailyClosingDTO,
  CustomerOpenTabSummaryDTO,
  NotebookEntryDTO,
} from "@/types";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import type {
  NotebookEntryStatus,
  NotebookPaymentMethod,
} from "@/lib/constants/notebook-payments";
import type { NotebookSection } from "@/lib/constants/notebook-sections";

type LeanNotebookEntry = {
  _id: { toString(): string };
  section: NotebookSection;
  type: NotebookEntryType;
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  customerId?: { toString(): string };
  tableId?: import("@/lib/constants/counter-sections").CafeTableId;
  sessionId?: { toString(): string };
  customerName: string;
  phoneNumber: string;
  status: NotebookEntryStatus;
  paymentMethod?: NotebookPaymentMethod;
  settlementId?: { toString(): string };
  paidByName?: string;
  paidByCustomerId?: { toString(): string };
  walletTransactionId?: { toString(): string };
  walletAmount?: number;
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  quantity?: number;
  unitPrice?: number;
  itemNote?: string;
  playStartedAt?: Date;
  playEndedAt?: Date;
  notes?: string;
  playerCount?: number;
  snookerGame?: import("@/lib/constants/counter-rates").SnookerGame;
  rateType?: import("@/lib/constants/counter-rates").CounterRateType;
  corrections?: {
    changes: {
      field: import("@/lib/constants/notebook-corrections").NotebookCorrectionField;
      fromLabel: string;
      toLabel: string;
    }[];
    correctedBy: string;
    correctedAt: Date;
    correctionReason: string;
  }[];
  assignedAt?: Date;
  assignedBy?: string;
  checkoutDismissedAt?: Date;
  checkoutDismissedBy?: string;
  counterPaidAmount?: number;
  counterBalanceAmount?: number;
  visitId?: { toString(): string };
  billId?: { toString(): string };
  contributors?: {
    customerId: { toString(): string };
    customerName: string;
    amount: number;
    paidAmount?: number;
    balanceCollectedAmount?: number;
    counterPaidAmount?: number;
    counterBalanceAmount?: number;
    status: "PENDING" | "PAID";
    paymentMethod?: NotebookPaymentMethod;
    walletAmount?: number;
    settlementId?: { toString(): string };
    paidAt?: Date;
    visitId?: { toString(): string };
    billId?: { toString(): string };
  }[];
  createdBy: string;
  createdAt: Date;
};

export function toNotebookEntryDTO(entry: LeanNotebookEntry): NotebookEntryDTO {
  const customerId = entry.customerId?.toString();
  return {
    id: entry._id.toString(),
    section: entry.section,
    type: entry.type,
    amount: entry.amount,
    paidAmount: entry.paidAmount ?? 0,
    balanceCollectedAmount: entry.balanceCollectedAmount ?? 0,
    customerId,
    tableId: entry.tableId,
    sessionId: entry.sessionId?.toString(),
    customerName: entry.customerName,
    phoneNumber: entry.phoneNumber,
    isUnassigned: !customerId,
    status: entry.status,
    paymentMethod: entry.paymentMethod,
    settlementId: entry.settlementId?.toString(),
    paidByName: entry.paidByName,
    paidByCustomerId: entry.paidByCustomerId?.toString(),
    walletTransactionId: entry.walletTransactionId?.toString(),
    walletAmount: entry.walletAmount,
    reversedAt: entry.reversedAt?.toISOString(),
    reversedBy: entry.reversedBy,
    reversalReason: entry.reversalReason,
    cancelledAt: entry.cancelledAt?.toISOString(),
    cancelledBy: entry.cancelledBy,
    cancellationReason: entry.cancellationReason,
    quantity: entry.quantity,
    unitPrice: entry.unitPrice,
    itemNote: entry.itemNote,
    playStartedAt: entry.playStartedAt?.toISOString(),
    playEndedAt: entry.playEndedAt?.toISOString(),
    notes: entry.notes,
    playerCount: entry.playerCount,
    snookerGame: entry.snookerGame,
    rateType: entry.rateType,
    corrections: entry.corrections?.map((correction) => ({
      changes: correction.changes.map((change) => ({
        field: change.field,
        fromLabel: change.fromLabel,
        toLabel: change.toLabel,
      })),
      correctedBy: correction.correctedBy,
      correctedAt: new Date(correction.correctedAt).toISOString(),
      correctionReason: correction.correctionReason,
    })),
    assignedAt: entry.assignedAt?.toISOString(),
    assignedBy: entry.assignedBy,
    checkoutDismissedAt: entry.checkoutDismissedAt?.toISOString(),
    checkoutDismissedBy: entry.checkoutDismissedBy,
    counterPaidAmount: entry.counterPaidAmount,
    counterBalanceAmount: entry.counterBalanceAmount,
    visitId: entry.visitId?.toString(),
    billId: entry.billId?.toString(),
    contributors: entry.contributors?.map((contributor) => ({
      customerId: contributor.customerId.toString(),
      customerName: contributor.customerName,
      amount: contributor.amount,
      paidAmount: contributor.paidAmount ?? 0,
      balanceCollectedAmount: contributor.balanceCollectedAmount ?? 0,
      counterPaidAmount: contributor.counterPaidAmount,
      counterBalanceAmount: contributor.counterBalanceAmount,
      status: contributor.status,
      paymentMethod: contributor.paymentMethod,
      walletAmount: contributor.walletAmount,
      settlementId: contributor.settlementId?.toString(),
      paidAt: contributor.paidAt?.toISOString(),
      visitId: contributor.visitId?.toString(),
      billId: contributor.billId?.toString(),
    })),
    createdBy: entry.createdBy,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toOpenTabSummaryDTO(
  summary: Omit<CustomerOpenTabSummaryDTO, "kind" | "tabKey">
): CustomerOpenTabSummaryDTO {
  return {
    kind: "customer",
    tabKey: `customer:${summary.customerId}`,
    ...summary,
  };
}

export function toDailyClosingDTO(data: DailyClosingDTO): DailyClosingDTO {
  return data;
}
