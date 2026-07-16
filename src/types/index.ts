export interface CustomerDetailFieldChangeDTO {
  field: "name" | "phone" | "cardId";
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
  notes?: string;
  isStudent: boolean;
  studentStatusChangedAt?: string;
  studentStatusChangedBy?: string;
  detailChanges: CustomerDetailChangeDTO[];
  balance: number;
  walletEnabled: boolean;
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

export interface CustomerActivityEventDTO {
  id: string;
  kind:
    | "COUNTER_ENTRY"
    | "CAFE_ENTRY"
    | "SETTLEMENT"
    | "SETTLEMENT_REVERSAL"
    | "WALLET_RECHARGE"
    | "WALLET_DEDUCT"
    | "BALANCE_RECORDED"
    | "NOTE";
  timestamp: string;
  title: string;
  amount?: number;
  staffUsername: string;
  paymentMethod?: string;
  reversalReason?: string;
  section?: string;
  entryType?: string;
  playerCount?: number;
  contributionAmount?: number;
  contributionPaymentMethod?: string;
  correctionSummary?: NotebookEntryCorrectionChangeDTO[];
  corrections?: NotebookEntryCorrectionDTO[];
  settlementId?: string;
  transactionId?: string;
  walletRechargeReversed?: boolean;
  walletTransactionIsReversal?: boolean;
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

export interface NotebookEntryCorrectionChangeDTO {
  field: import("@/lib/constants/notebook-corrections").NotebookCorrectionField;
  fromLabel: string;
  toLabel: string;
}

export interface NotebookEntryContributorDTO {
  customerId: string;
  customerName: string;
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  counterPaidAmount?: number;
  counterBalanceAmount?: number;
  status: "PENDING" | "PAID";
  paymentMethod?: import("@/lib/constants/notebook-payments").NotebookPaymentMethod;
  settlementId?: string;
  paidAt?: string;
  visitId?: string;
  billId?: string;
  visitStatus?: import("@/lib/constants/visit-bill").VisitStatus;
}

export interface FrameGlanceLineDTO {
  label: string;
  quantity: number;
  amount: number;
}

export interface CustomerTodayGlanceDTO {
  frameCount: number;
  frameTotal: number;
  cafeTotal: number;
  grandTotal: number;
  frames: FrameGlanceLineDTO[];
  cafe: import("@/lib/utils/cafe-tabs").CafeTabLine[];
}

export interface CustomerVisitGlanceDTO {
  customerId: string;
  customerName: string;
  hasActiveVisit: boolean;
  visitStatus?: import("@/lib/constants/visit-bill").VisitStatus;
  visitStartedAt?: string;
  visitFinishedAt?: string;
  billTotal: number;
  paidAmount: number;
  dueAmount: number;
  games: FrameGlanceLineDTO[];
  cafe: import("@/lib/utils/cafe-tabs").CafeTabLine[];
}

export interface CustomerPendingItemDTO {
  entry: NotebookEntryDTO;
  contributionAmount: number;
  contributorCustomerId: string;
  /** Customer's share of the line (split bills). */
  lineAmount?: number;
  linePaidAmount?: number;
}

export interface SettlementContributorPaymentDTO {
  entryId: string;
  customerId: string;
  customerName: string;
  amount: number;
}

export interface NotebookEntryCorrectionDTO {
  changes: NotebookEntryCorrectionChangeDTO[];
  correctedBy: string;
  correctedAt: string;
  correctionReason: string;
}

export interface NotebookEntryDTO {
  id: string;
  section: import("@/lib/constants/notebook-sections").NotebookSection;
  type: import("@/lib/constants/notebook-entry-types").NotebookEntryType;
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  customerId?: string;
  tableId?: import("@/lib/constants/counter-sections").CafeTableId;
  sessionId?: string;
  customerName: string;
  phoneNumber: string;
  isUnassigned: boolean;
  status: import("@/lib/constants/notebook-payments").NotebookEntryStatus;
  paymentMethod?: import("@/lib/constants/notebook-payments").NotebookPaymentMethod;
  settlementId?: string;
  paidByName?: string;
  paidByCustomerId?: string;
  walletTransactionId?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  playerCount?: number;
  snookerGame?: import("@/lib/constants/counter-rates").SnookerGame;
  rateType?: import("@/lib/constants/counter-rates").CounterRateType;
  quantity?: number;
  unitPrice?: number;
  itemNote?: string;
  corrections?: NotebookEntryCorrectionDTO[];
  assignedAt?: string;
  assignedBy?: string;
  checkoutDismissedAt?: string;
  checkoutDismissedBy?: string;
  counterPaidAmount?: number;
  counterBalanceAmount?: number;
  visitId?: string;
  billId?: string;
  visitStatus?: import("@/lib/constants/visit-bill").VisitStatus;
  isLocked?: boolean;
  contributors?: NotebookEntryContributorDTO[];
  createdBy: string;
  createdAt: string;
}

export interface ActiveVisitBillDTO {
  visit: VisitDTO;
  bill: BillDTO;
}

export interface BillDTO {
  id: string;
  publicId: string;
  visitId?: string;
  customerId: string;
  businessDate: string;
  status: import("@/lib/constants/visit-bill").BillStatus;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  lastPaymentAt?: string;
  convertedToOutstandingAt?: string;
  convertedToOutstandingBy?: string;
  createdBy: string;
  createdAt: string;
}

export interface VisitDTO {
  id: string;
  publicId: string;
  customerId: string;
  billId: string;
  businessDate: string;
  status: import("@/lib/constants/visit-bill").VisitStatus;
  startedAt: string;
  finishedAt?: string;
  finishedBy?: string;
  ledgerCommittedAt?: string;
  closedAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface CustomerOpenTabSummaryDTO {
  kind: "customer";
  tabKey: string;
  customerId: string;
  customerName: string;
  phoneNumber: string;
  cardId: string;
  walletEnabled: boolean;
  pendingAmount: number;
  pendingCount: number;
}

export interface TableOpenTabSummaryDTO {
  kind: "table";
  tabKey: string;
  tableId: import("@/lib/constants/counter-sections").CafeTableId;
  tableName: string;
  pendingAmount: number;
  pendingCount: number;
}

export type OpenTabSummaryDTO =
  | CustomerOpenTabSummaryDTO
  | TableOpenTabSummaryDTO
  | SessionOpenTabSummaryDTO;

export interface TableSessionAuditEntryDTO {
  action: import("@/lib/constants/table-sessions").TableSessionAuditAction;
  at: string;
  by: string;
}

export interface TableSessionDTO {
  id: string;
  sessionNumber: number;
  tableSessionNumber: number;
  displayLabel: string;
  tableId: import("@/lib/constants/table-sessions").TableSessionTableId;
  tableName: string;
  status: import("@/lib/constants/table-sessions").TableSessionStatus;
  rateType?: import("@/lib/constants/counter-rates").CounterRateType;
  billingMethod?: import("@/lib/constants/table-sessions").SessionBillingMethod;
  startedAt: string;
  pausedAt?: string;
  endedAt?: string;
  totalPausedMs: number;
  activePlayMs: number;
  hourlyRate: number;
  gameChargeAmount: number;
  cafeChargeAmount: number;
  totalChargeAmount: number;
  gameEntryId?: string;
  assignedCustomerNames: string[];
  assignedCustomers: { customerId: string; customerName: string }[];
  auditLog: TableSessionAuditEntryDTO[];
  createdBy: string;
  createdAt: string;
}

export type TableSessionPaymentEventKind = "paid" | "reversed";

export interface TableSessionPaymentEventDTO {
  kind: TableSessionPaymentEventKind;
  at: string;
  amount?: number;
  paymentMethod?: import("@/lib/constants/notebook-payments").NotebookPaymentMethod;
  customerName?: string;
  reversalReason?: string;
}

export type TableSessionHistoryPaymentStatus =
  | "ACTIVE"
  | "PAUSED"
  | "PENDING"
  | "PAID"
  | "REVERSED";

export interface TableSessionHistoryDTO {
  sessionId: string;
  sessionNumber: number;
  tableSessionNumber: number;
  displayLabel: string;
  startedAt: string;
  endedAt?: string;
  activityLine: string;
  activePlayMs: number;
  gameAmount: number;
  cafeAmount: number;
  totalAmount: number;
  paymentStatus: TableSessionHistoryPaymentStatus;
  customerNames: string[];
  paymentEvents: TableSessionPaymentEventDTO[];
}

export interface PoolMiniTableSummaryDTO {
  revenueToday: number;
  sessionsToday: number;
  pendingCount: number;
}

export interface SessionOpenTabSummaryDTO {
  kind: "session";
  tabKey: string;
  sessionId: string;
  sessionNumber: number;
  tableSessionNumber: number;
  displayLabel: string;
  tableId: import("@/lib/constants/table-sessions").TableSessionTableId;
  tableName: string;
  startedAt: string;
  gameAmount: number;
  cafeAmount: number;
  pendingAmount: number;
  pendingCount: number;
}

export type CompactSessionCheckoutLineDTO =
  | {
      kind: "game";
      startAt: string;
      endAt: string;
      durationMs: number;
      label: string;
      amount: number;
    }
  | {
      kind: "cafe";
      at: string;
      label: string;
      amount: number;
    };

export interface SessionSnookerFrameLineDTO {
  entryId: string;
  label: string;
  snookerGame: import("@/lib/constants/counter-rates").SnookerGame;
  amount: number;
}

export interface SessionCafeEditItemDTO {
  entryId: string;
  label: string;
  amount: number;
  itemType: import("@/lib/constants/notebook-entry-types").NotebookEntryType;
  itemNote?: string;
  unitPrice?: number;
  quantity?: number;
  isLocked?: boolean;
}

export interface SessionCheckoutDetailsDTO {
  session: TableSessionDTO;
  timeline: CompactSessionCheckoutLineDTO[];
  defaultPayer: CustomerDTO | null;
}

/** @deprecated Use CompactSessionCheckoutLineDTO */
export interface SessionCheckoutTimelineLineDTO {
  at: string;
  label: string;
  amount: number;
  kind: "start" | "game" | "cafe" | "pause" | "resume" | "end";
}

export interface CheckoutSectionSummaryDTO {
  billCount: number;
  subtotal: number;
}

export interface NotebookSettlementDTO {
  id: string;
  entryIds: string[];
  totalAmount: number;
  paymentMethod: import("@/lib/constants/notebook-payments").NotebookPaymentMethod;
  paidByName: string;
  paidByCustomerId?: string;
  walletTransactionId?: string;
  contributorPayments?: SettlementContributorPaymentDTO[];
  status: import("@/lib/constants/notebook-payments").NotebookSettlementStatus;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  createdBy: string;
  createdAt: string;
}

export interface DailyClosingDTO {
  date: string;
  cashCollection: number;
  gpayCollection: number;
  walletCollection: number;
  pendingAmount: number;
  grandTotal: number;
  sectionSummary: {
    section: import("@/lib/constants/notebook-sections").NotebookSection;
    amount: number;
  }[];
}

export interface CustomerLedgerSummaryDTO {
  walletBalance: number;
  outstandingAmount: number;
  activeVisitDueAmount: number;
  hasActiveVisitWithDue: boolean;
  openBillsCount: number;
  visitCount: number;
  lastVisitAt: string | null;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
}

export type CustomerLedgerEventKind = "charge" | "payment" | "status";

/** What a payment was applied against — presentation metadata only */
export type CustomerLedgerPaymentContext =
  | "ACTIVE_VISIT"
  | "OUTSTANDING"
  | "WALLET"
  | "REFUND";

/** Stable subtype for ledger rows — used for future detail / adjustment / refund flows */
export type CustomerLedgerEventSubtype =
  | "opening"
  | "charge"
  | "payment"
  | "moved_to_outstanding"
  | "outstanding_paid"
  | "wallet_recharge"
  | "wallet_deduct"
  | "wallet_refund";

export interface CustomerLedgerLineDTO {
  /** Stable ledger row id for future View Details / Adjustment / Refund actions */
  ledgerId: string;
  id: string;
  timestamp: string;
  description: string;
  amount: number;
  kind: CustomerLedgerEventKind;
  eventSubtype?: CustomerLedgerEventSubtype;
  paymentContext?: CustomerLedgerPaymentContext;
  staffUsername: string;
  walletBalance: number;
  outstandingBalance: number;
  balanceLabel: string;
  transactionId?: string;
  canReverseRecharge?: boolean;
}

export interface CustomerOutstandingRowDTO {
  customerId: string;
  customerName: string;
  phoneNumber: string;
  outstandingAmount: number;
  activeVisitDueAmount: number;
  hasActiveVisitWithDue: boolean;
  openBillsCount: number;
  lastVisitAt: string | null;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
  walletEnabled: boolean;
  cardId: string;
}

export interface CustomerBalancePaymentDTO {
  id: string;
  customerId: string;
  amount: number;
  appliedAmount: number;
  paymentMethod: import("@/lib/constants/notebook-payments").NotebookPaymentMethod;
  walletTransactionId?: string;
  createdBy: string;
  createdAt: string;
}
