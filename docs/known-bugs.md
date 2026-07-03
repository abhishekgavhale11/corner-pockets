# Corner Pockets — Known Bugs

Append-only bug tracker. **Never delete entries** — mark as Fixed with date.

---

## Open bugs

| ID | Bug | Root cause | Reported | Fix status |
|----|-----|------------|----------|------------|
| — | *No open bugs* | — | — | — |

---

## Fixed bugs

### BUG-001 — Checkout visit payment creates "Outstanding Paid" ledger event

| Field | Detail |
|-------|--------|
| **Symptom** | Paying ₹130 at checkout for active visit showed: charge, Cash Received (Visit), and incorrect **Outstanding Paid ₹130** |
| **Expected** | Only charge + visit payment. No outstanding status events from checkout |
| **Root cause** | `applyRunningBalances` emitted Outstanding Paid when any payment drove outstanding 0; visit charges/payments incorrectly used `affectsOutstanding: true` |
| **Fix** | Outstanding Paid only for `balance-payment-*` events; visit charges/payments use `paymentContext === ACTIVE_VISIT` without outstanding delta |
| **Files** | `src/actions/customer-ledger.ts`, `src/lib/utils/ledger-charge-bundles.ts` |
| **Fixed** | 2026-07-03 |
| **Regression** | `testing-checklist.md` → Ledger → REG-001 |

---

### BUG-002 — FIFO checkout payment locks unrelated unpaid rows

| Field | Detail |
|-------|--------|
| **Symptom** | After paying Individual ₹180, later rows (Singles ₹0 paid, Unassigned Singles ₹0 paid) showed locked |
| **Expected** | Only rows with `paidAmount > 0` (or partial/full paid) locked |
| **Root cause** | `isNotebookEntryEditLocked` used `bill.lastPaymentAt` — any row created before last visit payment was locked |
| **Fix** | Edit lock based solely on row `paidAmount + balanceCollectedAmount` and contributor payment state |
| **Files** | `src/lib/visit-bill/entry-edit-lock-utils.ts`, `src/lib/visit-bill/entry-edit-lock.ts` |
| **Fixed** | 2026-07-03 |
| **Regression** | `testing-checklist.md` → Editing → REG-002 |

---

### BUG-003 — Wallet payment option enabled when customer has no wallet

| Field | Detail |
|-------|--------|
| **Symptom** | Wallet selectable in checkout/collect payment when `walletEnabled === false` |
| **Expected** | Wallet option disabled |
| **Root cause** | `PaymentMethodSelector` defaulted `walletEnabled` to true |
| **Fix** | Explicit `walletEnabled` prop; `SegmentedControl` disabled state |
| **Files** | `PaymentMethodSelector`, `CollectPaymentDialog`, `CheckoutDrawer`, `CheckoutList` |
| **Fixed** | 2026-06 (Notebook v2) |
| **Regression** | `testing-checklist.md` → Wallet → REG-003 |

---

### BUG-004 — Customer Page could collect payment during active visit

| Field | Detail |
|-------|--------|
| **Symptom** | Collect Payment on Customer Page possible while customer had open checkout due |
| **Expected** | Hard block — active visit payments only via Checkout |
| **Root cause** | No server/UI guard aligning visit due with outstanding collection |
| **Fix** | `getCustomerPagePaymentBlockDue`, `CollectPaymentTrigger` block, `recordCustomerBalancePayment` server block |
| **Files** | `active-visit-checkout-due.ts`, `customer-balance-payments.ts`, `CollectPaymentTrigger.tsx` |
| **Fixed** | 2026-07 |
| **Regression** | `testing-checklist.md` → Payment separation → REG-004 |

---

## Template for new bugs

```markdown
### BUG-XXX — Title

| Field | Detail |
|-------|--------|
| **Symptom** | |
| **Expected** | |
| **Root cause** | |
| **Fix** | |
| **Files** | |
| **Fixed** | YYYY-MM-DD or Open |
| **Regression** | testing-checklist.md → |
```
