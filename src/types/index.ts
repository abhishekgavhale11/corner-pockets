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
  /** Full display name (firstName + lastName). */
  name: string;
  firstName: string;
  lastName: string;
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

/** Customers list row — identification only; collection stays on Customer Details. */
export interface CustomerListRowDTO {
  id: string;
  name: string;
  phone: string;
  outstandingAmount: number;
  lastVisitAt: string | null;
}

/** Expense register row — independent of Business Day. */
export interface ExpenseDTO {
  id: string;
  category: import("@/lib/constants/expenses").ExpenseCategory;
  amount: number;
  /** YYYY-MM-DD calendar date. */
  expenseDate: string;
  description: string;
  paidTo: string;
  paymentMethod: import("@/lib/constants/expenses").ExpensePaymentMethod;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResult {
  items: ExpenseDTO[];
  totalAmount: number;
  from: string;
  to: string;
  category: "all" | import("@/lib/constants/expenses").ExpenseCategory;
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
  paymentMethod?: "CASH" | "GPAY";
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

/** Customers list page result with All / Outstanding filter counts. */
export interface CustomerListResult extends PaginatedResult<CustomerListRowDTO> {
  limit: number;
  allCount: number;
  outstandingCount: number;
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
  walletAmount?: number;
  settlementId?: string;
  paidAt?: string;
  visitId?: string;
  billId?: string;
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

export interface CustomerCounterDrawerDTO {
  customerId: string;
  customerName: string;
  todaysBill: number;
  /** Sum of received amounts for this customer today. */
  totalReceived: number;
  totalDue: number;
  // TODO(Module 7): previousOutstanding when Outstanding module exists
  todaysFrames: NotebookEntryDTO[];
  /** Open Business Day cafe for this customer (CafeOrder module). */
  todaysCafeOrders: import("@/lib/mappers/cafe-order").CafeOrderDTO[];
}

/** @deprecated Use CustomerCounterDrawerDTO — visit glance removed with settlement. */
export interface CustomerVisitGlanceDTO {
  customerId: string;
  customerName: string;
  hasActiveVisit: boolean;
  visitStatus?: "ACTIVE" | "FINISHED" | "CLOSED";
  visitStartedAt?: string;
  visitFinishedAt?: string;
  billTotal: number;
  paidAmount: number;
  dueAmount: number;
  totalOutstanding: number;
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
  walletAmount?: number;
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
  playStartedAt?: string;
  playEndedAt?: string;
  notes?: string;
  corrections?: NotebookEntryCorrectionDTO[];
  assignedAt?: string;
  assignedBy?: string;
  checkoutDismissedAt?: string;
  checkoutDismissedBy?: string;
  counterPaidAmount?: number;
  counterBalanceAmount?: number;
  visitId?: string;
  billId?: string;
  isLocked?: boolean;
  contributors?: NotebookEntryContributorDTO[];
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
  /** Current Outstanding balance (Pending remaining). */
  outstandingAmount: number;
  /** Distinct Business Days with remaining Outstanding > 0. */
  unpaidBusinessDayCount: number;
  /** Earliest businessDate among pending Outstanding for this customer. */
  oldestOutstandingDate: string;
}

export interface CustomerOutstandingItemDTO {
  id: string;
  publicId: string;
  customerId: string;
  businessDayId: string;
  businessDayPublicId: string;
  businessDate: string;
  sourceType: import("@/lib/constants/outstanding").OutstandingSourceType;
  sourceRecordId: string;
  originalAmount: number;
  remainingAmount: number;
  status: import("@/lib/constants/outstanding").OutstandingStatus;
  createdAt: string;
  collectedAt: string | null;
  paymentMethod: import("@/lib/constants/outstanding").OutstandingPaymentMethod | null;
}

export type CustomerActivityEventKind =
  | "BUSINESS_DAY_SUMMARY"
  | "OUTSTANDING_COLLECTED"
  | "OUTSTANDING_PARTIALLY_COLLECTED"
  | "WALLET_RECHARGE"
  | "WALLET_PAYMENT"
  | "LEDGER";

export interface CustomerActivityCountLineDTO {
  label: string;
  quantity: number;
  amount: number;
}

export interface CustomerActivityBusinessDaySummaryDTO {
  games: CustomerActivityCountLineDTO[];
  cafe: CustomerActivityCountLineDTO[];
  todaysBill: number;
  /** Today's Payment (Received). */
  todaysPayment: number;
  /** Today's Due = Bill − Payment. */
  todaysDue: number;
  /** Outstanding before this Business Day closed. */
  previousOutstanding: number;
  /** Outstanding after this Business Day = Previous + Today's Due. */
  currentOutstanding: number;
}

export interface CustomerActivityItemDTO {
  id: string;
  /** Sort / event time (Business Day closedAt, or collection createdAt). */
  timestamp: string;
  /** Business Date for display on Business Day Closed cards. */
  businessDate?: string;
  kind: CustomerActivityEventKind;
  label: string;
  /** Present on collection / wallet events */
  amount?: number;
  bonusAmount?: number;
  creditedAmount?: number;
  paymentMethod?: string;
  paymentMethodLabel?: string;
  /** Wallet balance after this wallet event. */
  walletBalanceAfter?: number;
  /** Cash/GPay used for remainder when Wallet did not cover the full bill. */
  remainingPaymentMethod?: "CASH" | "GPAY";
  remainingPaymentMethodLabel?: string;
  /** Wallet Payment story — purpose + bill breakdown. */
  walletPayment?: {
    purpose: string;
    purposeLabel: string;
    billAmount: number;
    walletUsed: number;
    remainderAmount: number;
    remainderMethod?: "CASH" | "GPAY";
    remainderMethodLabel?: string;
    totalPaid: number;
    lines?: { label: string; quantity?: number }[];
    billAmountLabel: string;
  };
  /** Who collected / recharged. */
  createdBy?: string;
  /** Outstanding before this event (Balance History story). */
  previousOutstanding?: number;
  /** Outstanding after this event (Balance History story). */
  outstandingBalance?: number;
  /** Present on Business Day Closed / Wallet events */
  businessDayId?: string;
  businessDayPublicId?: string;
  businessDaySummary?: CustomerActivityBusinessDaySummaryDTO;
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

export interface BusinessDayDTO {
  id: string;
  businessDayNumber: number;
  status: import("@/lib/constants/business-day").BusinessDayStatus;
  businessDate: string;
  openedAt: string;
  openedBy: string;
  closedAt?: string;
  closedBy?: string;
  openingCash: number;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Per-category totals shown on the Close Business Day confirmation modal. */
export interface BusinessDayCloseCategoryPreviewDTO {
  revenue: number;
  cashCollection: number;
  gpayCollection: number;
  walletCollection: number;
  outstandingCreated: number;
}

export interface BusinessDayClosePreviewDTO {
  todaysBill: number;
  totalPaid: number;
  cashCollection: number;
  gpayCollection: number;
  walletCollection: number;
  outstandingAmount: number;
  snooker: BusinessDayCloseCategoryPreviewDTO;
  cafe: BusinessDayCloseCategoryPreviewDTO;
  unassignedFrames: number;
  unassignedCafeItems: number;
}

export type BusinessDayClosePreflightValidationName =
  | "BUSINESS_DAY_SCOPE"
  | "OWNERSHIP"
  | "SPLIT_INTEGRITY"
  | "RECEIVED"
  | "PAYMENT_MODE"
  | "CAFE_SOURCE"
  | "DUPLICATE_OWNERSHIP";

export type BusinessDayClosePreflightAffectedRecord = {
  recordType: "NOTEBOOK_ENTRY" | "CAFE_ORDER";
  recordId: string;
  section?: string;
  customerName?: string;
  detail?: string;
};

export type BusinessDayClosePreflightIssue = {
  validation: BusinessDayClosePreflightValidationName;
  reason: string;
  affectedRecords: BusinessDayClosePreflightAffectedRecord[];
};

export type BusinessDayClosePreflightResult =
  | {
      status: "PASS";
      businessDayId: string;
      checkedRecords: number;
    }
  | {
      status: "FAIL";
      businessDayId?: string;
      checkedRecords?: number;
      issues: BusinessDayClosePreflightIssue[];
    };

export type BusinessDayCloseFinancialProofInvariant =
  | "BUSINESS_DAY_BILL_IDENTITY"
  | "CUSTOMER_DUE_EQUALS_BUSINESS_DAY_DUE"
  | "CUSTOMER_BILL_IDENTITY"
  | "NO_NEGATIVE_DUE";

export type BusinessDayCloseFinancialProofIssue = {
  invariant: BusinessDayCloseFinancialProofInvariant;
  expected: number;
  actual: number;
  affectedCustomers: string[];
  reason: string;
};

export type BusinessDayCloseFinancialProofResult =
  | {
      status: "PASS";
      businessDayId: string;
      businessDayBill: number;
      businessDayReceived: number;
      businessDayDue: number;
      customerCount: number;
    }
  | {
      status: "FAIL";
      businessDayId?: string;
      businessDayBill?: number;
      businessDayReceived?: number;
      businessDayDue?: number;
      customerCount?: number;
      issues: BusinessDayCloseFinancialProofIssue[];
    };

export type FinancialProofOwnershipLine = {
  customerId?: string;
  customerName: string;
  bill: number;
  received: number;
  due: number;
  sourceType: "FRAME" | "CAFE";
  sourceRecordId: string;
  recordType: "NOTEBOOK_ENTRY" | "CAFE_ORDER";
};

export type FinancialProofCustomerTotals = {
  customerId: string;
  customerName: string;
  bill: number;
  received: number;
  due: number;
};

export type FinancialProofSnapshot = {
  businessDayId: string;
  businessDayBill: number;
  businessDayReceived: number;
  businessDayDue: number;
  customerCount: number;
  customers: FinancialProofCustomerTotals[];
  ownershipLines: FinancialProofOwnershipLine[];
  unassignedBill: number;
  unassignedReceived: number;
  unassignedDue: number;
};

export type BusinessDayCloseOutstandingProofValidation =
  | "FINANCIAL_PROOF_PREREQUISITE"
  | "CUSTOMER_DUE_EQUALS_CANDIDATE_SUM"
  | "BUSINESS_DAY_DUE_EQUALS_CANDIDATE_SUM"
  | "OWNERSHIP_LINE_DUE_MATCH"
  | "NO_SKIPPED_OWNERSHIP_LINES"
  | "NO_EXTRA_CANDIDATES"
  | "NO_DUPLICATE_CANDIDATES";

export type BusinessDayCloseOutstandingProofIssue = {
  validation: BusinessDayCloseOutstandingProofValidation;
  expected: number;
  actual: number;
  affectedCustomers: string[];
  affectedRecords: string[];
  rootCause: string;
};

export type BusinessDayCloseOutstandingProofResult =
  | {
      status: "PASS";
      businessDayId: string;
      businessDayDue: number;
      totalOutstandingToCreate: number;
      customerCount: number;
      outstandingRecordCount: number;
    }
  | {
      status: "FAIL";
      businessDayId?: string;
      businessDayDue?: number;
      totalOutstandingToCreate?: number;
      customerCount?: number;
      outstandingRecordCount?: number;
      issues: BusinessDayCloseOutstandingProofIssue[];
    };

export type BusinessDayCloseStage =
  | "IDEMPOTENCY"
  | "PREFLIGHT"
  | "FINANCIAL_PROOF"
  | "OUTSTANDING_PROOF"
  | "TRANSACTION"
  | "POST_COMMIT_VALIDATION";

export type BusinessDayCloseExecutionFailure = {
  status: "FAIL";
  stage: BusinessDayCloseStage;
  reason: string;
  validation?: string;
  affectedRecords?: string[];
  /** Optional structured detail from Phase 1A / 1B / 2. */
  details?: unknown;
};

export type BusinessDayCloseExecutionCritical = {
  status: "CRITICAL";
  stage: "POST_COMMIT_VALIDATION";
  reason: string;
  businessDayId?: string;
};

export type BusinessDayCloseExecutionResult =
  | {
      status: "SUCCESS";
      day: BusinessDayDTO;
      outstandingCreated: number;
    }
  | {
      status: "ALREADY_CLOSED";
      day: BusinessDayDTO;
      reason: string;
    }
  | BusinessDayCloseExecutionFailure
  | BusinessDayCloseExecutionCritical;

export interface BusinessDayHistoryListItemDTO {
  id: string;
  businessDayNumber: number;
  publicId: string;
  businessDate: string;
  openedAt: string;
  closedAt: string;
  todaysBill: number;
  totalReceived: number;
  outstandingCreated: number;
}

/** Section rollup for History insight cards (Big Snooker / Pool & Mini / Cafe). */
export interface BusinessDayHistorySectionSummaryDTO {
  bill: number;
  received: number;
  cashCollection: number;
  gpayCollection: number;
  walletCollection: number;
  outstandingCreated: number;
  /** Frames / games / cafe orders played in this section. */
  gamesPlayed: number;
}

/** Presentation insights shared by single-day and range History views. */
export interface BusinessDayHistoryInsightsDTO {
  overall: {
    totalRevenue: number;
    totalReceived: number;
    cashCollection: number;
    gpayCollection: number;
    walletCollection: number;
    outstandingCreated: number;
  };
  bigSnooker: BusinessDayHistorySectionSummaryDTO;
  poolMini: BusinessDayHistorySectionSummaryDTO;
  totalSnooker: BusinessDayHistorySectionSummaryDTO;
  cafe: BusinessDayHistorySectionSummaryDTO;
}

/** One Wallet Recharge row for Business Day History (informational, not revenue). */
export interface BusinessDayHistoryWalletRechargeLineDTO {
  id: string;
  customerId: string;
  customerName: string;
  /** Real money received for the recharge. */
  paidAmount: number;
  /** Promotional credit — kept separate from paidAmount. */
  bonusAmount: number;
  /** Amount added to the customer's Wallet (paid + bonus). */
  walletCredit: number;
  paymentMethod: "CASH" | "GPAY" | null;
  createdAt: string;
  createdBy: string;
}

/**
 * Wallet Activity audit block for History.
 * Wallet Recharge is NOT Business Revenue — do not fold into summary cards.
 */
export interface BusinessDayHistoryWalletActivityDTO {
  totalRecharges: number;
  /** Sum of Paid Amount (real money). */
  rechargeReceived: number;
  /** Sum of Bonus. */
  bonusIssued: number;
  /** Sum of Wallet Credit. */
  walletCreditIssued: number;
  recharges: BusinessDayHistoryWalletRechargeLineDTO[];
}

export interface BusinessDayHistorySummaryDTO {
  totalBusinessDays: number;
  totalBill: number;
  totalReceived: number;
  outstandingCreated: number;
  /** Richer cards for the History list / range view. */
  insights: BusinessDayHistoryInsightsDTO;
  /** Informational Wallet Recharge audit for the selected range. */
  walletActivity: BusinessDayHistoryWalletActivityDTO;
}

export interface BusinessDayHistoryListResultDTO {
  from: string;
  to: string;
  items: BusinessDayHistoryListItemDTO[];
  summary: BusinessDayHistorySummaryDTO;
}

export interface BusinessDayHistoryChargeLineDTO {
  entryId: string;
  customerId?: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  paymentMethod?: import("@/lib/constants/notebook-payments").NotebookPaymentMethod;
  /** Wallet portion of paidAmount when mixed with Cash/GPay. */
  walletAmount?: number;
  createdAt: string;
}

export interface BusinessDayHistoryFrameLineDTO
  extends BusinessDayHistoryChargeLineDTO {
  section: import("@/lib/constants/notebook-sections").NotebookSection;
  table: string;
  gameType: string;
}

export interface BusinessDayHistoryCafeLineDTO
  extends BusinessDayHistoryChargeLineDTO {
  item: string;
}

export interface BusinessDayHistorySettlementRowDTO {
  customerId: string;
  customerName: string;
  bigSnooker: number;
  poolMini: number;
  cafe: number;
  bill: number;
  received: number;
  cashCollection: number;
  gpayCollection: number;
  walletCollection: number;
  due: number;
}

/** Category rollup for Games or Cafe on Business Day History. */
export interface BusinessDayHistoryCategorySummaryDTO {
  bill: number;
  received: number;
  cashCollection: number;
  gpayCollection: number;
  walletCollection: number;
  outstandingCreated: number;
}

export interface BusinessDayHistoryDetailDTO {
  day: BusinessDayDTO;
  publicId: string;
  businessDate: string;
  summary: {
    todaysBill: number;
    totalReceived: number;
    cashCollection: number;
    gpayCollection: number;
    walletCollection: number;
    outstandingCreated: number;
  };
  gamesSummary: BusinessDayHistoryCategorySummaryDTO;
  cafeSummary: BusinessDayHistoryCategorySummaryDTO;
  /** Informational Wallet Recharge audit — not part of Business Revenue. */
  walletActivity: BusinessDayHistoryWalletActivityDTO;
  settlements: BusinessDayHistorySettlementRowDTO[];
  frames: BusinessDayHistoryFrameLineDTO[];
  cafe: BusinessDayHistoryCafeLineDTO[];
}
