import type { CustomerDTO, TransactionDTO } from "@/types";

type LeanCustomerDetailFieldChange = {
  field: "name" | "phone";
  from: string;
  to: string;
};

type LeanCustomerDetailChange = {
  changedAt: Date;
  changedBy: string;
  changes: LeanCustomerDetailFieldChange[];
};

type LeanCustomer = {
  _id: { toString(): string };
  cardId: string;
  name: string;
  phone: string;
  isStudent: boolean;
  studentStatusChangedAt?: Date;
  studentStatusChangedBy?: string;
  detailChanges?: LeanCustomerDetailChange[];
  balance: number;
  isActive: boolean;
  createdAt: Date;
};

type LeanTransaction = {
  _id: { toString(): string };
  customerId: { toString(): string };
  type: "credit" | "debit";
  paidAmount?: number;
  bonusAmount?: number;
  creditedAmount?: number;
  amount?: number;
  balanceAfter: number;
  description: string;
  staffUsername: string;
  isReversal?: boolean;
  reversesTransactionId?: { toString(): string };
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  reversalTransactionId?: { toString(): string };
  verificationMethod?: "CARD" | "PHONE";
  createdAt: Date;
};

export function toCustomerDTO(customer: LeanCustomer): CustomerDTO {
  const detailChanges = [...(customer.detailChanges ?? [])].sort(
    (a, b) => b.changedAt.getTime() - a.changedAt.getTime()
  );

  return {
    id: customer._id.toString(),
    cardId: customer.cardId,
    name: customer.name,
    phone: customer.phone,
    isStudent: customer.isStudent,
    studentStatusChangedAt: customer.studentStatusChangedAt?.toISOString(),
    studentStatusChangedBy: customer.studentStatusChangedBy,
    detailChanges: detailChanges.map((entry) => ({
      changedAt: entry.changedAt.toISOString(),
      changedBy: entry.changedBy,
      changes: entry.changes.map((change) => ({
        field: change.field,
        from: change.from,
        to: change.to,
      })),
    })),
    balance: customer.balance,
    isActive: customer.isActive,
    createdAt: customer.createdAt.toISOString(),
  };
}

export function toTransactionDTO(transaction: LeanTransaction): TransactionDTO {
  return {
    id: transaction._id.toString(),
    customerId: transaction.customerId.toString(),
    type: transaction.type,
    paidAmount: transaction.paidAmount,
    bonusAmount: transaction.bonusAmount,
    creditedAmount: transaction.creditedAmount,
    amount: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description,
    staffUsername: transaction.staffUsername,
    isReversal: transaction.isReversal ?? false,
    reversesTransactionId: transaction.reversesTransactionId?.toString(),
    reversedAt: transaction.reversedAt?.toISOString(),
    reversedBy: transaction.reversedBy,
    reversalReason: transaction.reversalReason,
    reversalTransactionId: transaction.reversalTransactionId?.toString(),
    verificationMethod: transaction.verificationMethod,
    createdAt: transaction.createdAt.toISOString(),
  };
}
