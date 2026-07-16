# Financial Engine — Functional Specification (Phase 1)

**Status:** APPROVED FOR IMPLEMENTATION  
**Version:** 1.0  
**Last progress update:** 2026-07-16

This document is the **implementation contract** for Phase 1. Only the business rules defined in this document may be implemented. Anything not defined here belongs to Phase 2 and must not be assumed.

**Documentation rule:** One module = one document. Every business discussion for the Financial Engine updates **only this file**.

**Companion docs:**
- `docs/business-scenarios.md` — operational validation scenarios
- `docs/business-vision.md` — product vision (context only; not the implementation contract)

---

## 0. Implementation Progress (work completed so far)

This section is the handoff status for continuing work on any machine. Keep it accurate when a milestone is finished.

### Completed foundations

| Area | Status | Notes |
|------|--------|--------|
| Visit lifecycle ACTIVE → Finish Visit → FINISHED | **Done** | Explicit `finishVisit` only; no auto-finish on full payment or checkout dismiss |
| ACTIVE visit Checkout (partial / multiple payments) | **Done** | Temporary payments; `PAID` status deferred until Finish Visit while visit is ACTIVE |
| Checkout payment remove (ACTIVE only) | **Done** | `reverseNotebookSettlement`; unlocks Counter edits after removal |
| Finish Visit → Ledger + Outstanding if Due > 0 | **Done** | `finalize-visit.ts` |
| Counter keeps FINISHED visits for the day | **Done** | Date-scoped counter queries; not filtered to ACTIVE only |
| Customer Page Outstanding / Wallet recharge paths | **In place** | Collect outstanding from Customer Page; wallet rules still evolving |

### Approved rule status

| Rule | Spec | Code | Notes |
|------|------|------|--------|
| **FR-VIS-015** Finished visits visible + read-only on Counter | Yes | **Mostly done** | Server locks + Counter/Cafe UI locks; checkout reopen blocked for finished visits |
| **FR-VIS-016** Due vs Outstanding on Counter | Yes | **Mostly done** | `counter-visit-display.ts` / Pay column uses Due (ACTIVE) and Outstanding (FINISHED) |
| **FR-VIS-017** Finish Visit confirmation dialog | Yes | **Mostly done** | `ConfirmDialog` in Checkout before `finishVisit`; verify copy against spec |
| **FR-FIN-005** ACTIVE Visit recalculation | Yes | **Partial** | Ownership reassignment / corrections / splits recalculate via `recalculate-active-visit.ts`; not every trigger in the rule is wired yet |
| **FR-FRM-001** Partial frame locking after payment | Yes | **Verify** | Spec + Scenario 8a in place; confirm Counter split edit behaviour matches rule |
| **FR-CTR-001** Counter display principle (no payment methods) | Yes | **Mostly done** | Counter Pay column shows amounts/status, not Cash/GPay/Wallet history; session boards may still show method labels — verify |
| **FR-PAY-001** Third-party Cash/GPay; Wallet own charges only | Yes | **Partial** | `paidByName` / `paidByCustomerId` exist; full Cash/GPay “Paid By” UX + hard Wallet third-party rejection need verification |
| **FR-PAY-002** Charge owner vs payment owner | Yes | **Partial** | Same as FR-PAY-001 — informational payer must never move bill/ledger ownership |

### Key code locations

| Concern | Path |
|---------|------|
| Finish Visit | `src/lib/visit-bill/finalize-visit.ts`, `src/actions/visit-bill.ts` |
| Bill totals sync | `src/lib/visit-bill/sync-bill-totals.ts` |
| Ownership recalculation | `src/lib/visit-bill/recalculate-active-visit.ts` |
| Finished visit locks | `src/lib/visit-bill/finished-visit-lock.ts`, `entry-edit-lock.ts` |
| Counter Due/Outstanding display | `src/lib/utils/counter-visit-display.ts`, `counter-pay-display.ts` |
| Checkout + Finish confirm | `src/components/checkout/CheckoutList.tsx` |
| Settlements / reverse payment | `src/actions/notebook-settlements.ts` |

### How to continue on another laptop

1. Pull / copy this repo (including `docs/` and `src/`).
2. Read **this file** (§0 progress + the rule you will implement) and `docs/business-scenarios.md`.
3. Implement **one approved rule (or remaining gap) at a time**; wait for user approval before the next.
4. Keep business logic in `src/lib/visit-bill/` and server actions — not React.
5. After finishing a gap, update **this §0 table** and §11 pending list.

### Suggested next work (confirm with user before coding)

1. Close remaining **FR-FIN-005** triggers (add/remove frame, cafe remove/cancel, payment removal always resyncs all affected bills).
2. Verify / finish **FR-PAY-001** + **FR-PAY-002** (Wallet reject third-party; optional Paid By for Cash/GPay only).
3. Verify **FR-FRM-001** (Scenario 8a — unpaid split contributor reassignment after partial payment).
4. Spot-check **FR-CTR-001** / **FR-VIS-016** / **FR-VIS-015** / **FR-VIS-017** against Scenarios 16–22.
5. Wallet deducted only at Finish Visit (spec) — confirm current code and migrate if still deducting at checkout settlement.

---

## 1. Financial Philosophy

The Financial Engine separates temporary operational data from permanent financial history.

### ACTIVE Visit

- Temporary working state.
- Frames, cafe items and payments remain editable.
- No ledger entries exist.

### FINISHED Visit

- Created only through Finish Visit.
- Visit becomes immutable.
- Ledger is generated.
- Outstanding is created if required.
- Frames remain on Counter until the Business Day is closed (read-only). See **FR-VIS-015**.
- Any remaining Due becomes Outstanding immediately at Finish Visit. See **FR-VIS-016** / **FR-CTR-001**.

### Core Principles

- Checkout owns today's payments.
- Customer Page owns Outstanding and Wallet.
- Ledger stores only permanent financial history.
- Every financial object has one owner.

### Core Financial Invariants

These invariants apply across Counter, Checkout, and the Financial Engine during Phase 1.

```
Bill = Total Charges
Paid = Sum(Checkout Payments)
Due = Bill - Paid
```

After every ACTIVE Visit recalculation (see **FR-FIN-005**):

```
Bill = Paid + Due
```

#### FR-FIN-005 — ACTIVE Visit Recalculation

**Rule:** Any modification to an ACTIVE Visit must immediately trigger a complete recalculation of the ACTIVE Visit before the user continues.

**Purpose:** To ensure that the Counter, Checkout, and Financial Engine always display consistent financial information during an ACTIVE Visit.

**Business rules — the following actions must trigger a recalculation:**

- Customer reassignment
- Frame transfer
- Split billing changes
- Cafe item additions, edits, or removals
- Frame additions, edits, or removals
- Checkout payment removal
- Any operation that changes bill ownership or charge amount

**Recalculation requirements — the Financial Engine must immediately recalculate:**

- Bill
- Paid
- Due
- Customer allocations
- Split allocations
- Checkout summary

**Financial invariant — after every recalculation:**

- Bill = Paid + Due
- Counter totals must match Checkout totals.
- Every charge must belong to exactly one customer.
- No stale financial values may remain after an ACTIVE Visit is modified.
- Entry bill linkage (`billId` / `visitId`, and contributor bill links for splits) must match the entry's **current** owner(s).
- When ownership changes, the **previous** owner's ACTIVE Visit bill must be resynced so removed lines no longer count toward their Bill / Paid / Due.

---

## 2. Visit Lifecycle

Customer arrives → Visit Created → ACTIVE Visit → Checkout → Finish Visit → FINISHED Visit.

### ACTIVE Visit

- Add/Edit/Delete Frames
- Add/Edit/Delete Cafe
- Split Frames
- Transfer Frames
- Partial Payments
- Multiple Payments
- Editable Checkout Payments

### FINISHED Visit

- No editing
- No reopening
- No reassignment
- No payment changes
- Remains visible on Counter until Business Day close (read-only). See **FR-VIS-015**.

Corrections belong to Phase 2 Reversal.

---

## 2.1 Visit Business Rules (Approved)

### FR-VIS-015 — Finished Visits remain visible on the Counter

**Rule:** After a Visit is marked as FINISHED, it must remain visible on the Counter until the Business Day is closed.

**Purpose:** The Counter represents the operational history of the current Business Day. Staff should be able to review everything that happened during the day without opening the Customer page or Ledger.

**Business rules:**

- The visit remains visible.
- The visit becomes read-only.
- Checkout cannot be reopened.
- Frames cannot be edited.
- Cafe items cannot be edited.
- Payments cannot be edited.
- Customer assignment cannot be changed.
- Split billing cannot be modified.

### FR-VIS-016 — Counter Status Display

**Rule:** The word **Due** is used only while the Visit is ACTIVE. Immediately after Finish Visit, any remaining Due becomes **Outstanding**. The Counter must display **Outstanding**, not Due, for FINISHED Visits.

This rule is part of the broader Counter display contract. See **FR-CTR-001**.

#### ACTIVE Visit

Display:

- Bill
- Paid
- Due

Example:

- Bill ₹500
- Paid ₹300
- Due ₹200

#### FINISHED Visit (fully paid)

Display:

- ✓ Paid
- 🔒 Finished

#### FINISHED Visit (with remaining balance)

Display:

- ₹X Paid
- ₹Y Outstanding
- 🔒 Finished

**Rule:** The Counter must never display Due for a FINISHED Visit.

### FR-VIS-017 — Finish Visit Confirmation

**Rule:** Before executing Finish Visit, the system must display a confirmation dialog. The cashier must explicitly confirm before the action is executed.

#### If Outstanding will be created

Example dialog content:

```
Outstanding Amount: ₹200

Finishing this Visit will:

• Generate the Customer Ledger
• Move ₹200 to Outstanding
• Lock this Visit permanently

This action cannot be undone in Phase 1.
```

**Buttons:** Cancel | Finish Visit

#### If no Outstanding will be created

Display the same confirmation dialog **without** the Outstanding message. The dialog must still state that the Visit will be completed and locked permanently.

**Buttons:** Cancel | Finish Visit

---

## 3. Counter

### Purpose

Operational workspace for club staff. The Counter is designed for running the club, not for auditing financial history. See **FR-CTR-001**.

### FR-CTR-001 — Counter Display Principle

**Purpose:** Keep the Counter fast, simple, and operational. Detailed financial information belongs in Checkout (ACTIVE Visits) or the Customer Ledger (FINISHED Visits).

**Rule:** The Counter displays only the minimum information required to manage the current Business Day. It must never duplicate Checkout or Ledger functionality.

#### Counter displays

For every visit line:

- Customer Name
- Frame Type (or item type)
- Charge Amount
- Paid Amount
- Due (ACTIVE Visits only)
- Outstanding (FINISHED Visits only)
- Finished Status

Also at tab / visit level:

- Active Customers
- Finished Customers (read-only, until Business Day close) — **FR-VIS-015**
- Table Number
- Current Bill
- Previous Outstanding (read-only, informational)

#### Counter never displays

The Counter must **never** display:

- Cash payments
- GPay payments
- Wallet payments
- Payment method history
- Payment timestamps
- Payment ownership (`Paid By`)
- Payment notes
- Ledger history
- Outstanding history (prior days)

Those details belong to:

- **Checkout** — ACTIVE Visits
- **Customer Ledger** — FINISHED Visits

#### Business rules

**ACTIVE Visit** — display Paid and Due.

Example:

- Bill ₹500
- Paid ₹300
- Due ₹200

**FINISHED Visit (with balance)** — display Paid, Outstanding, and Finished. The word **Due** must never appear.

Example:

- Bill ₹500
- Paid ₹300
- Outstanding ₹200
- 🔒 Finished

**FINISHED Visit (fully paid):**

- Bill ₹500
- ✓ Paid
- 🔒 Finished

Immediately after Finish Visit: **Due → Outstanding**.

#### Acceptance criteria

- ✓ Counter never shows payment methods.
- ✓ Counter never shows payment ownership.
- ✓ Counter shows Due only for ACTIVE Visits.
- ✓ Counter shows Outstanding only for FINISHED Visits.
- ✓ Counter remains clean and readable regardless of the number of payments.

### Counter displays (summary)

See **FR-CTR-001** and **FR-VIS-016** for the full display contract.

- Paid / Due (ACTIVE) or Paid / Outstanding + Finished (FINISHED)
- Due (ACTIVE visits only) — **FR-CTR-001**
- Outstanding (FINISHED visits only) — **FR-CTR-001**

### Counter status display

See **FR-CTR-001** and **FR-VIS-016**.
### Customer Assignment

Frames are initially created as Unassigned.

Selecting Unassigned opens Customer Search.

If customer does not exist:

Create Customer → Save → Automatically assign to selected frame.

### Rules

- Checkout cannot proceed while any frame is Unassigned.
- Finish Visit cannot proceed while any frame is Unassigned.
- Previous Outstanding is informational only.
- Previous Outstanding is never merged into today's Bill.
- **Finish Visit does not remove frames or customers from Counter.** Today's frames stay visible on Counter until the Business Day is closed with their final paid/outstanding state. After Finish Visit, counter lines are read-only. — **FR-VIS-015**
- Finish Visit removes the customer from the **Checkout** open queue only.
- Checkout cannot be reopened for a FINISHED Visit. — **FR-VIS-015**
- Frames, cafe items, payments, customer assignment, and split billing are locked after Finish Visit. — **FR-VIS-015**
- Any modification to an ACTIVE Visit must trigger immediate recalculation per **FR-FIN-005**.

### Editing Rules

See **FR-FRM-001** for partial frame locking after Checkout payment.

If a frame has **no** Checkout payment allocated, normal editing applies.

If a frame has **any** Checkout payment allocated:

- The frame becomes **partially locked**.
- **Locked:** Frame Type, Frame Amount, Split Amounts, Paid contributor assignment.
- **Editable:** Only contributors that have received **no** Checkout payment. Those contributors may be reassigned to another customer.
- Reassignment must preserve Split Amount, Frame Type, and Frame Amount. No financial recalculation is required — the unpaid liability simply moves from one customer to another.

To unlock structure editing entirely:

1. Open Checkout.
2. Remove the Checkout payment.
3. Return to Counter.
4. Full edit becomes available again.

### FR-FRM-001 — Partial Frame Locking

Once any Checkout payment has been allocated to a contributor (or to a single-customer frame):

- The frame becomes partially locked.
- Frame Type, Frame Amount, and Split Amounts cannot change.
- Paid contributor rows cannot be reassigned.
- Unpaid contributor rows may be reassigned to another customer at the same split amount.
- Liability moves to the new customer's ACTIVE Visit Bill without recalculating settled amounts.

---

## 4. Checkout

### Purpose

Checkout is a temporary working area. Nothing inside Checkout becomes permanent until Finish Visit.

### Checkout owns

- Bill
- Paid
- Due
- Temporary Payment History (including payment method, Paid By, and Payment Note — **FR-PAY-001** / **FR-PAY-002**)

### Business Rules

- Partial payments allowed.
- Multiple payments allowed.
- FIFO payment allocation.
- Payments may be edited or removed.
- Bill, Paid and Due recalculate immediately. — **FR-FIN-005**
- Ledger is never updated.

---

## 5. Finish Visit

Finish Visit is an atomic transaction.

### Confirmation — **FR-VIS-017**

Before executing Finish Visit, the system must show a confirmation dialog.

- If Due > 0 at finish: clearly state the Outstanding amount, that the Customer Ledger will be generated, that the balance moves to Outstanding, and that the Visit becomes permanently read-only.
- If Due = 0: state that the Visit will be completed and locked permanently (no Outstanding message).
- Require explicit cashier confirmation. Buttons: **Cancel** | **Finish Visit**.
- This action cannot be undone in Phase 1.

### System actions

1. Validate all frames assigned.
2. Lock Visit.
3. Lock Bill.
4. Commit Cash/GPay/Wallet payments.
5. Deduct Wallet.
6. Generate Ledger.
7. Create Outstanding if Due > 0 (Due becomes Outstanding at this moment — **FR-VIS-016**).
8. Remove customer from Checkout open queue.

Either all steps succeed or none are applied.

**Counter is not affected by Finish Visit.** Frames and customer lines remain on Counter until the Business Day is closed. — **FR-VIS-015**

---

## 6. Ledger

### Purpose

Permanent customer financial timeline.

### Ledger records only

- Finalized Charges
- Finalized Payments
- Outstanding Created
- Outstanding Collected
- Wallet Transactions

### Rules

- Ledger never reads ACTIVE Visits.
- Ledger only reads FINISHED Visits.
- Ledger is append-only.

---

## 7. Outstanding

Outstanding is created only during Finish Visit.

### Rules

- Checkout never collects previous Outstanding.
- Customer Page collects Outstanding.
- Counter and Checkout display previous Outstanding as read-only.
- Today's Visit and Previous Outstanding are always settled separately.

---

## 8. Wallet

### Recharge

- Recharge from Customer Page only.
- Plan based.
- Bonus calculated automatically.

### Usage

- Wallet belongs to one customer. — **FR-PAY-001**
- Wallet cannot pay another customer's charges. — **FR-PAY-001**
- Wallet is selected in Checkout.
- Wallet is deducted only on Finish Visit.
- If insufficient:
  - Wallet balance is used first.
  - Remaining amount is collected via Cash/GPay.
- Wallet never becomes negative.

---

## 9. Payment Rules

Payment responsibility and charge ownership are separate concepts. See **FR-PAY-001** and **FR-PAY-002**.

### FR-PAY-001 — Third-Party Payments

**Purpose:** Allow another person to physically pay a customer's bill without changing the ownership of the financial charges. This supports common club situations where one player settles another player's bill due to betting, friendship, or convenience while preserving correct financial ownership.

**Rule:** A payment may be made by someone other than the customer who incurred the charges. However, payment responsibility and charge ownership are two separate concepts. Receiving payment from another person must **never** change the owner of the charges.

#### Charge ownership

- Every charge belongs to exactly one customer.
- Charge ownership never changes because someone else pays.

#### Accepted payment methods

- **Cash** may be paid by anyone.
- **GPay** may be paid by anyone.
- **Wallet** may only pay the wallet owner's own charges.

#### Wallet restriction

Wallet benefits belong exclusively to the wallet owner. Therefore:

- Wallet cannot pay another customer's charges.
- Wallet cannot be transferred.
- Wallet cannot be shared between customers.
- Wallet discounts and bonuses always remain with the wallet owner.

#### Payment information (informational only)

For Cash and GPay payments the cashier may optionally record:

- **Paid By**
- **Payment Note**

These fields are informational only. They do **not** affect:

- Charge ownership
- Ledger ownership
- FIFO allocation
- Outstanding ownership

#### Example 1

Rahul — Bill ₹300. Mohit — Bill ₹400. Rahul pays Mohit's ₹400 using Cash.

**Result:**

- Rahul Bill = ₹300
- Mohit Bill = Paid ₹400
- Rahul Wallet = Unchanged
- Mohit's Ledger records the payment
- Optional: Paid By = Rahul

#### Example 2

Rahul attempts to pay Mohit's bill using Wallet.

**Result:** Transaction rejected. Wallet may only pay the wallet owner's own charges.

#### Acceptance criteria

- ✓ Cash allows third-party payments.
- ✓ GPay allows third-party payments.
- ✓ Wallet rejects third-party payments.
- ✓ Charge ownership never changes.
- ✓ Ledger remains attached to the charge owner.

### FR-PAY-002 — Payment Ownership vs Charge Ownership

**Purpose:** Separate who owes the money from who physically handed over the money. This prevents financial ambiguity while preserving an accurate customer history.

**Rule:** The Financial Engine must treat **Charge Ownership** and **Payment Ownership** as two independent concepts.

#### Charge owner

The customer who consumed the service:

- Played the frame
- Ordered cafe items
- Owns the bill

This customer is always responsible for the financial record.

#### Payment owner

The person who physically handed over the payment:

- Friend
- Parent
- Team captain
- Betting winner

Payment ownership is **informational only**. It never changes financial ownership.

#### Business rules

Changing the payer must **never**:

- Move the bill
- Change FIFO allocation
- Transfer Outstanding
- Transfer Ledger history
- Transfer Wallet ownership

#### Example

Rahul pays Mohit's bill using Cash.

**Result:**

| Concept | Value |
|--------|--------|
| Charge owner | Mohit |
| Payment owner | Rahul (informational) |
| Ledger | Recorded against Mohit |
| Optional note | Paid By Rahul |

#### Acceptance criteria

- ✓ Charge owner remains unchanged.
- ✓ Payment owner is stored only as additional information.
- ✓ Financial calculations always use the charge owner.

---

## 10. Business Day

- Start manually.
- End manually.
- Cannot close while ACTIVE Visits exist.
- Cannot be reopened in Phase 1.
- FINISHED Visits remain visible on Counter until the Business Day is closed. — **FR-VIS-015**

---

## 11. Phase 1 Completion Criteria

Phase 1 is complete when the following are **implemented and verified** in production use:

- Counter (operational day board)
- Customer Assignment
- Checkout (ACTIVE temporary payments)
- Finish Visit (explicit; atomic)
- Ledger (FINISHED only)
- Outstanding (created at Finish Visit; collected on Customer Page)
- Wallet (recharge + own-charges usage)
- Payment Rules (**FR-PAY-001**, **FR-PAY-002**)
- Counter Display (**FR-CTR-001**, **FR-VIS-016**)
- Partial frame locking (**FR-FRM-001**)
- Financial Invariants including **FR-FIN-005**
- Finished visit lock (**FR-VIS-015**)
- Finish Visit confirmation (**FR-VIS-017**)

See **§0 Implementation Progress** for the live Done / Partial / Next table. Update §0 whenever a milestone lands.

### Pending for Phase 2

- Reversal Workflow
- Reports
- Business Day Summary
- Wallet Administration
- Analytics

### Gaps to close before calling Phase 1 “complete”

Confirm with the user, then work **one item at a time**:

1. **FR-FIN-005** — wire recalculation for every listed trigger (still Partial)
2. **FR-PAY-001 / FR-PAY-002** — complete third-party Cash/GPay + Wallet rejection (still Partial)
3. **FR-FRM-001** — verify partial-split lock behaviour (Scenario 8a)
4. **FR-CTR-001 / FR-VIS-016 / FR-VIS-015 / FR-VIS-017** — end-to-end check against Scenarios 16–22
5. Wallet deduct only on Finish Visit (if still deducted earlier in Checkout)
