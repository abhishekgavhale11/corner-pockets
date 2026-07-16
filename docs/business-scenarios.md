# Business Scenarios

## Purpose

This document contains real operational scenarios.

These scenarios define how the software should behave during day-to-day operations.

Whenever a new feature is implemented, it should be validated against these scenarios.

**Progress handoff:** Live Done / Partial / Next status lives in `docs/01-financial-engine.md` **§0 Implementation Progress**. Update that section when a scenario’s rule is finished.

**Last progress update:** 2026-07-16

---

# Visit Scenarios

## Scenario 1

Customer arrives.

**Expected Behaviour**

- Customer is created or selected.
- An ACTIVE Visit starts.
- Customer appears on Counter.

---

## Scenario 2

Assign a frame.

**Expected Behaviour**

- Frame is assigned.
- Customer begins playing.
- Bill increases.
- Ledger remains unchanged.

---

## Scenario 3

Customer orders Cafe items.

**Expected Behaviour**

- Cafe items are added to the same Visit.
- Bill updates.
- Ledger remains unchanged.

---

## Scenario 4

Partial payment during play.

**Expected Behaviour**

- Checkout accepts payment.
- Bill updates.
- Customer continues playing.
- Ledger remains unchanged.
- Outstanding is not created.

---

## Scenario 5

Customer pays multiple times.

**Expected Behaviour**

- Multiple payments are allowed.
- Remaining Due updates correctly.
- Ledger remains unchanged.

---

## Scenario 6

Customer edits unpaid frame.

**Expected Behaviour**

- Editing is allowed.
- Bill recalculates.
- Ledger remains unchanged.

---

## Scenario 7

Customer transfers unpaid frame to another customer.

**Expected Behaviour**

- Transfer is allowed.
- Ownership changes.
- Bill recalculates.
- Ledger remains unchanged.

---

## Scenario 8

Customer tries to transfer a paid frame.

**Expected Behaviour**

- Transfer is NOT allowed.
- Paid rows remain locked.

---

## Scenario 8a — Partial frame lock (FR-FRM-001)

Shuffle frame split between Vishal and Raja. Vishal pays his ₹90 share in Checkout. Raja has not paid.

**Expected Behaviour**

- Frame Type, Frame Amount, and Split Amounts are locked.
- Vishal's row is locked (paid).
- Raja's row shows edit / reassign — cashier may assign Raja's ₹90 share to another customer.
- Reassignment preserves ₹90 split amount; Bill liability moves to the new customer.
- No recalculation of Vishal's settled payment.
- Ledger remains unchanged until Finish Visit.

---

## Scenario 9

Customer splits a frame before payment.

**Expected Behaviour**

- Split is allowed.
- Each customer owns their portion.
- Bills update correctly.

---

## Scenario 10

Customer leaves after full payment.

**Expected Behaviour**

- Finish Visit (after confirmation — **FR-VIS-017**).
- Ledger is created.
- No Outstanding.
- Visit becomes FINISHED.
- Customer is removed from Checkout open queue.
- Visit remains on Counter until Business Day close (read-only). — **FR-VIS-015**
- Counter shows ✓ Paid and 🔒 Finished. — **FR-VIS-016**

---

## Scenario 11

Customer leaves with Due remaining.

**Expected Behaviour**

- Finish Visit (after confirmation — **FR-VIS-017**).
- Outstanding is created (Due becomes Outstanding at finish — **FR-VIS-016**).
- Ledger records:
  - Charges
  - Payments
  - Moved to Outstanding
- Customer is removed from Checkout open queue.
- Visit remains on Counter until Business Day close (read-only). — **FR-VIS-015**
- Counter shows ₹X Paid, ₹Y Outstanding, and 🔒 Finished (never Due). — **FR-VIS-016**
- Outstanding becomes collectible only from Customer Page.

---

## Scenario 16 — Finish Visit: fully paid (verification)

Bill ₹300. Paid ₹300. Finish Visit.

**Expected Behaviour**

- Visit remains on Counter.
- Shows ✓ Paid.
- Shows 🔒 Finished.
- Entire visit is read-only.
- Checkout cannot be reopened.

**Rules:** FR-VIS-015, FR-VIS-016, FR-VIS-017

---

## Scenario 17 — Finish Visit: partial payment (verification)

Bill ₹500. Paid ₹300. Finish Visit.

**Expected Behaviour**

- Visit remains on Counter.
- Shows ₹300 Paid.
- Shows ₹200 Outstanding.
- Shows 🔒 Finished.
- Does **not** show Due.
- Entire visit is read-only.
- Checkout cannot be reopened.

**Rules:** FR-VIS-015, FR-VIS-016, FR-VIS-017

---

## Scenario 18 — Edit attempt on FINISHED Visit (verification)

Attempt to edit any aspect of a FINISHED Visit (frames, cafe, payments, customer assignment, split billing).

**Expected Behaviour**

- Editing is blocked everywhere in the UI.
- Checkout cannot be reopened.
- Server rejects all modification requests.

**Rules:** FR-VIS-015

---

## Scenario 19 — Reassign frame after checkout payment removed

Rahul has multiple frames. A temporary Checkout payment is recorded, then removed. A frame is reassigned from Rahul to Amit.

**Expected Behaviour**

- Rahul's ACTIVE Visit Bill / Paid / Due recalculate without the moved frame.
- Amit's ACTIVE Visit includes the reassigned frame with correct charges.
- Checkout summaries for both customers update immediately.
- No stale bill linkage (`billId` still pointing at the previous owner).

**Rules:** FR-FIN-005

---

## Scenario 20 — Third-party Cash payment (FR-PAY-001)

Rahul (Bill ₹300) pays Mohit's ₹400 bill using Cash. Optional: Paid By = Rahul.

**Expected Behaviour**

- Mohit's bill shows Paid ₹400; charge ownership remains Mohit's.
- Rahul's bill remains ₹300; Rahul's wallet unchanged.
- Mohit's ledger records the payment at Finish Visit.
- Paid By is stored as informational only.

**Rules:** FR-PAY-001, FR-PAY-002

---

## Scenario 21 — Wallet third-party payment rejected (FR-PAY-001)

Rahul attempts to pay Mohit's bill using Rahul's Wallet.

**Expected Behaviour**

- Transaction rejected.
- Mohit's bill unchanged.
- Rahul's wallet unchanged.

**Rules:** FR-PAY-001

---

## Scenario 22 — Counter does not show payment methods (FR-CTR-001)

Customer with multiple Cash and GPay payments during an ACTIVE Visit.

**Expected Behaviour**

- Counter shows Paid and Due totals only.
- Counter does not show Cash, GPay, Wallet, Paid By, or payment timestamps.
- Payment method and Paid By appear in Checkout only.

**Rules:** FR-CTR-001

---

## Scenario 12

Customer returns later to pay Outstanding.

**Expected Behaviour**

- Payment happens only from Customer Page.
- Outstanding reduces using FIFO allocation.
- Ledger records the payment.
- Checkout is not involved.

---

## Scenario 13

Wallet payment during ACTIVE Visit.

**Expected Behaviour**

- Wallet may only pay the wallet owner's own charges.
- Wallet cannot pay another customer's bill.
- Wallet is deducted on Finish Visit.

**Rules:** FR-PAY-001

---

## Scenario 14

Wallet recharge.

**Status:** Pending Design.

---

## Scenario 15

Reversal.

**Status:** Pending Design.

---

# Cafe Scenarios

- Cafe item sold.
- Cafe item edited before payment.
- Cafe item removed before payment.
- Cafe reporting.
- Inventory deduction.
- Stock purchase.
- Stock adjustment.
- Stock wastage.

**Status:** Pending Design.

---

# Inventory Scenarios

- Purchase inventory.
- Receive stock.
- Sell stock.
- Inventory adjustment.
- Damaged goods.
- Low stock warning.

**Status:** Pending Design.

---

# Business Day Scenarios

- Start Business Day.
- Close Business Day.
- Overnight customers.
- Cash reconciliation.
- Daily reports.

**Status:** Pending Design.

---

# Reports Scenarios

- Daily Report.
- Weekly Report.
- Monthly Report.
- Customer Report.
- Cafe Report.
- Inventory Report.
- Outstanding Report.
- Wallet Report.

**Status:** Pending Design.
