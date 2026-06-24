import type {
  DailyClosingDTO,
  CustomerOpenTabSummaryDTO,
  NotebookEntryDTO,
  NotebookSettlementDTO,
} from "@/types";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import type {
  NotebookEntryStatus,
  NotebookPaymentMethod,
  NotebookSettlementStatus,
} from "@/lib/constants/notebook-payments";
import type { NotebookSection } from "@/lib/constants/notebook-sections";

type LeanNotebookEntry = {
  _id: { toString(): string };
  section: NotebookSection;
  type: NotebookEntryType;
  amount: number;
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
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  quantity?: number;
  unitPrice?: number;
  itemNote?: string;
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
  contributors?: {
    customerId: { toString(): string };
    customerName: string;
    amount: number;
    status: "PENDING" | "PAID";
    paymentMethod?: NotebookPaymentMethod;
    settlementId?: { toString(): string };
    paidAt?: Date;
  }[];
  createdBy: string;
  createdAt: Date;
};

type LeanNotebookSettlement = {
  _id: { toString(): string };
  entryIds: { toString(): string }[];
  totalAmount: number;
  paymentMethod: NotebookPaymentMethod;
  paidByName: string;
  paidByCustomerId?: { toString(): string };
  walletTransactionId?: { toString(): string };
  contributorPayments?: {
    entryId: { toString(): string };
    customerId: { toString(): string };
    customerName: string;
    amount: number;
  }[];
  status: NotebookSettlementStatus;
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
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
    reversedAt: entry.reversedAt?.toISOString(),
    reversedBy: entry.reversedBy,
    reversalReason: entry.reversalReason,
    cancelledAt: entry.cancelledAt?.toISOString(),
    cancelledBy: entry.cancelledBy,
    cancellationReason: entry.cancellationReason,
    quantity: entry.quantity,
    unitPrice: entry.unitPrice,
    itemNote: entry.itemNote,
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
    contributors: entry.contributors?.map((contributor) => ({
      customerId: contributor.customerId.toString(),
      customerName: contributor.customerName,
      amount: contributor.amount,
      status: contributor.status,
      paymentMethod: contributor.paymentMethod,
      settlementId: contributor.settlementId?.toString(),
      paidAt: contributor.paidAt?.toISOString(),
    })),
    createdBy: entry.createdBy,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toNotebookSettlementDTO(
  settlement: LeanNotebookSettlement
): NotebookSettlementDTO {
  return {
    id: settlement._id.toString(),
    entryIds: settlement.entryIds.map((id) => id.toString()),
    totalAmount: settlement.totalAmount,
    paymentMethod: settlement.paymentMethod,
    paidByName: settlement.paidByName,
    paidByCustomerId: settlement.paidByCustomerId?.toString(),
    walletTransactionId: settlement.walletTransactionId?.toString(),
    contributorPayments: settlement.contributorPayments?.map((payment) => ({
      entryId: payment.entryId.toString(),
      customerId: payment.customerId.toString(),
      customerName: payment.customerName,
      amount: payment.amount,
    })),
    status: settlement.status,
    reversedAt: settlement.reversedAt?.toISOString(),
    reversedBy: settlement.reversedBy,
    reversalReason: settlement.reversalReason,
    createdBy: settlement.createdBy,
    createdAt: settlement.createdAt.toISOString(),
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
