# Corner Pockets — Changelog

Append-only record of completed work.  
**Format:** Date → Feature → Files → Reason → Notes

---

## 2026-07-09

### Documentation consolidation — Financial Engine

**Files:** `docs/01-financial-engine.md` (new), archived `business-architecture.md`, `financial-invariants.md`, `product-specification.md`, `business-rules-v1.1.md`, legacy docs

**Reason:** One module = one document. Financial Engine business rules now live in a single source of truth.

**Notes:** Approved rules preserved. Wallet, Reversal, Business Day, Reports, Cafe Financial Rules, Inventory remain Pending Design.

---

## 2026-07-07

### Visit-owned financial lifecycle backend

**Files:** `src/models/Visit.ts`, `src/models/Bill.ts`, `src/lib/constants/visit-bill.ts`, `src/lib/visit-bill/finalize-visit.ts`, `src/actions/notebook-entries.ts`, `src/actions/notebook-settlements.ts`, `src/actions/customer-ledger.ts`, `src/actions/customer-balance-payments.ts`, `src/actions/notebook-ledger.ts`

**Reason:** Move financial ownership to `Visit`/`Bill` so checkout stays a working state and ledger/outstanding only read finalized visits.

**Notes:** Added `Visit.status = ACTIVE|FINISHED`, `Bill.status = WORKING|FINISHED`, finish-visit backend flow, finished-visit-only ledger/outstanding reads, and active-visit-only checkout/counter filters. Current full-pay checkout path auto-finishes the visit until an explicit Finish Visit UI action is wired.

---

### Ledger finalization — checkout-completed batches only

**Files:** `src/actions/customer-ledger.ts`, `src/lib/ledger/checkout-finalization.ts`, `src/lib/utils/entry-contributors.ts`

**Reason:** Ledger is a finalized financial journal. Active visit activity (frames, edits, partial payments) must not appear until checkout is completed.

**Notes:** `buildCheckoutFinalizationBatches()` emits charges + aggregated visit payment + Moved to Outstanding at finalization. Regression: REG-005, REG-008.

---

## 2026-07-03

### Documentation-first workflow

**Files:** `docs/business-architecture.md`, `docs/current-status.md`, `docs/testing-checklist.md`, `docs/technical-architecture.md`, `docs/changelog.md`, `docs/known-bugs.md`

**Reason:** Enable any developer or Cursor session to understand the project without chat history.

**Notes:** Supersedes scattered legacy docs. Read `/docs` before implementing.

---

### Fix: Checkout visit payment incorrectly creates Outstanding Paid ledger event

**Files:** `src/actions/customer-ledger.ts`, `src/lib/utils/ledger-charge-bundles.ts`

**Reason:** Visit checkout payments must only create charge + visit payment lines. Outstanding status events belong to Customer Page workflow only.

**Notes:** `applyRunningBalances` now emits Outstanding Paid only for `balance-payment-*`. Visit charges use `payLaterAmount` for outstanding delta. Regression: REG-001.

---

### Fix: Edit lock applied at visit level instead of row level

**Files:** `src/lib/visit-bill/entry-edit-lock-utils.ts`, `src/lib/visit-bill/entry-edit-lock-constants.ts`, `src/lib/visit-bill/entry-edit-lock.ts`

**Reason:** FIFO payments on earlier rows must not lock later unpaid rows. Lock only when `paidAmount + balanceCollectedAmount > 0` on that row (or contributor).

**Notes:** Removed `bill.lastPaymentAt` from edit lock logic. Regression: REG-002.

---

## 2026-07 (Notebook v2 hardening)

### Active visit payment block on Customer Page

**Files:** `src/lib/visit-bill/active-visit-checkout-due.ts`, `src/lib/constants/customer-page-payments.ts`, `src/actions/customer-balance-payments.ts`, `src/components/customers/CollectPaymentTrigger.tsx`

**Reason:** Business rule — active visit payments only via Checkout.

**Notes:** `getCustomerPagePaymentBlockDue` = max(visit bill due, checkout queue due). Regression: REG-004.

---

### Ledger charge timing — commit at checkout only

**Files:** `src/lib/utils/entry-contributors.ts`, `src/actions/customer-ledger.ts`

**Reason:** Counter working rows should not appear in permanent ledger until checkout commit.

**Notes:** `isEntryLedgerCommitted` gates charges. Timestamp from settlement/dismiss.

---

### Customer reassignment block after payment

**Files:** `src/lib/visit-bill/entry-edit-lock-utils.ts`, `src/actions/notebook-entries.ts`, `SnookerFrameEditDialog.tsx`, `EntryCorrectionDialog.tsx`

**Reason:** Changing customer after payment breaks allocation and ledger history.

**Notes:** `entryBlocksCustomerReassignment` enforced server-side.

---

### Ledger UI polish and payment context labels

**Files:** `src/actions/customer-ledger.ts`, `src/lib/utils/customer-ledger-display.ts`, `CustomerFinancialHistory.tsx`, `CustomerLedgerView.tsx`, `src/types/index.ts`

**Reason:** Clearer ledger readability; Visit vs Outstanding payment labels.

**Notes:** Renamed status events to Moved to Outstanding / Outstanding Paid.

---

### Wallet disabled when customer has no wallet

**Files:** `PaymentMethodSelector`, `CollectPaymentDialog`, `CheckoutDrawer`, `CheckoutList`

**Reason:** Prevent wallet payment for `walletEnabled === false` customers.

**Notes:** Regression: REG-003.

---

## 2026-06 — Notebook v2 core

### Customer ledger and outstanding collection

**Files:** `customer-ledger.ts`, `customer-balance-payments.ts`, `apply-balance-payment.ts`, `CustomerBalancePayment` model, `OutstandingPage.tsx`, `CollectPaymentDialog.tsx`

**Reason:** Replace notebook balances with FIFO outstanding collection and unified ledger.

**Notes:** `balanceCollectedAmount` separate from checkout `paidAmount`.

---

### Checkout POS redesign

**Files:** `CheckoutList.tsx`, `checkout-payment.tsx`, `SessionCheckoutPanel.tsx`

**Reason:** Fast checkout UX for peak hours.

**Notes:** Cash/GPay/Wallet segmented control; inline expand.

---

### Visit + Bill engine

**Files:** `Visit.ts`, `Bill.ts`, `ensure-visit-bill.ts`, `sync-bill-totals.ts`, `attach-entry.ts`

**Reason:** One visit, one bill — game + cafe combined.

**Notes:** Foundation for visit-scoped due tracking.

---

### Split bills (contributors)

**Files:** `NotebookEntry` contributors schema, `ContributorsSplitDialog.tsx`, `entry-contributors.ts`

**Reason:** Multiple customers on one frame.

**Notes:** Independent payment per contributor.

---

### Big Snooker counter ledger UX

**Files:** `CounterGrid.tsx`, `CompactLedgerRow.tsx`, `CounterLedgerTable.tsx`

**Reason:** Dense, readable counter during busy hours.

**Notes:** Time | Type | Name | Amount | Pay columns.

---

## 2025 — Phase 1 (Wallet)

### Wallet recharge and deduct

**Files:** `transactions.ts`, `Transaction.ts`, `RechargeForm.tsx`, `DeductForm.tsx`

**Reason:** Initial POS scope — student/club wallet plans.

**Notes:** Card ID verification; recharge plans in `recharge-plans.ts`.

---

### Customer CRM and staff auth

**Files:** `customers.ts`, `Customer.ts`, `Staff.ts`, NextAuth config

**Reason:** Foundation for club customer management.

**Notes:** Auto card ID generation `CP0001`.

---

## Template

```markdown
## YYYY-MM-DD

### Feature title

**Files:** ...

**Reason:** ...

**Notes:** ...
```
