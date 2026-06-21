export interface CustomerDetailFieldChangeDTO {
  field: "name" | "phone";
  from: string;
  to: string;
}

export interface CustomerDetailChangeDTO {
  changedAt: string;
  changedBy: string;
  changes: CustomerDetailFieldChangeDTO[];
}

export interface CustomerDTO {
  id: string;
  cardId: string;
  name: string;
  phone: string;
  isStudent: boolean;
  studentStatusChangedAt?: string;
  studentStatusChangedBy?: string;
  detailChanges: CustomerDetailChangeDTO[];
  balance: number;
  isActive: boolean;
  createdAt: string;
}

export interface RechargeAmounts {
  paidAmount: number;
  bonusAmount: number;
  creditedAmount: number;
}

export interface TransactionDTO {
  id: string;
  customerId: string;
  type: "credit" | "debit";
  paidAmount?: number;
  bonusAmount?: number;
  creditedAmount?: number;
  amount?: number;
  balanceAfter: number;
  description: string;
  staffUsername: string;
  isReversal: boolean;
  reversesTransactionId?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  reversalTransactionId?: string;
  verificationMethod?: "CARD" | "PHONE";
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DashboardStats {
  todayRecharges: number;
  todayDeductions: number;
  todayTransactionCount: number;
}

export interface StaffAccountDTO {
  id: string;
  username: string;
  name: string;
  role: import("@/lib/auth/roles").StaffRole;
  isActive: boolean;
  createdAt: string;
}
