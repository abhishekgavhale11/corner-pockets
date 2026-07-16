# Corner Pockets — Product Specification (Version 1 Draft)

This Product Specification is the source of truth for business rules.

Business rules may only change after discussion and explicit approval.

Implementation must follow this specification.

Sections marked **Pending Design** must not be implemented based on assumptions.

---

## Module Status

### Financial Engine

**Overall Progress: 85%**

#### Approved

- ✓ Visit Lifecycle
- ✓ Checkout
- ✓ Finish Visit
- ✓ Ledger
- ✓ Outstanding

#### Pending Design

- ○ Wallet
- ○ Reversal
- ○ Business Day
- ○ Reports
- ○ Cafe Financial Rules
- ○ Inventory

---

## Version History

### Version 0.1

- Initial Financial Engine

### Version 0.2

- Introduced Finish Visit lifecycle

### Version 0.3

- Checkout owns Active Visit payments

### Version 0.4

- Ledger generated only after Finish Visit

---

## 1. Scope & Design Philosophy

**Status: Approved**

- The software should behave like experienced counter staff.
- Simplicity over complexity; one action → one obvious workflow.
- Never lose or silently change financial history.
- Every money movement must be traceable.
- Counter must stay fast during peak hours.
- Optimize for real club workflow, not accounting theory.
- Currency: INR (₹), whole rupees.

---

## 2. Core Data Model (Conceptual)

**Status: Approved**

| Entity | Purpose |
|--------|---------|
| **Customer** | Lifetime relationship — wallet, outstanding, ledger |
| **Visit** | Represents one customer visit. Business-day assignment is **Pending Design**. |
| **Bill** | One bill per visit — game + cafe combined |
| **NotebookEntry** | Atomic charge row (frame, rummy, cafe item, session game charge) |
| **TableSession** | Timed pool/mini play with game + cafe sub-bill |
| **NotebookSettlement** | Checkout payment event (cash/GPay/wallet) |
| **CustomerBalancePayment** | Customer-page outstanding collection (FIFO) |
| **Transaction** | Wallet credit/debit |

### Golden rules

**Status: Approved**

1. One Visit = One Bill (game + cafe, never separate bills)
2. Visits are never merged
3. Counter manages **today's working state** only
4. Customer Page manages **lifetime** relationship
5. Ledger is **append-only** — reversals, never silent edits
6. Previous outstanding never auto-merges into today's visit

---

## 3. Working State vs Permanent History

**Status: Approved**

| Layer | Purpose | When it changes |
|-------|---------|-----------------|
| **Counter** | Today's notebook (tables, frames, cafe) | Continuously during play |
| **Visit Bill** | Live running bill for today's visit | When charges or checkout payments occur |
| **Ledger** | Finalized financial journal | Only when visit is **finished** |
| **Outstanding** | Debt after Finish Visit | After Finish Visit when `dueAmount > 0` |

- Counter rows may be edited freely **until that row receives payment allocation**.
- The ledger is not a live activity feed. Frames, edits, splits, and cafe items during an active visit are temporary checkout data and must not appear in the ledger until the visit is finished.

---

## 4. Visit Financial Lifecycle

**Status: Approved**

### Two-state lifecycle

| State | Meaning |
|-------|---------|
| **ACTIVE (Working)** | Visit is open. Frames, cafe, edits, splits, reassignments, and checkout payments are allowed. Checkout remains a working bill. Nothing from this state appears in the customer ledger. |
| **FINISHED** | Explicit staff action (**Finish Visit**). Freezes and closes the visit. Locks all rows. Creates ledger events. Removes customer from active counter/checkout working state. |

### Visit status model

**Status: Approved**

- `Visit.status`: `ACTIVE` | `FINISHED`
- `Bill.status`: `WORKING` | `FINISHED`
- Financial outcome at finish is determined by `dueAmount`:
  - `dueAmount == 0` → Paid
  - `dueAmount > 0` → Outstanding

### Exactly one active visit per customer

**Status: Approved**

1. There is **exactly one** `ACTIVE` visit per customer (or fewer if the customer is not currently playing).
2. A finished visit is **never reopened** and never reused as the next working chapter.
3. If a customer returns on a later day, a **new** visit must be created; the old visit remains closed forever.

---

## 5. Allowed vs Forbidden Operations by Lifecycle State

**Status: Approved**

### ACTIVE visit owns the working state

Only an `ACTIVE` visit may:

- Add frames
- Add cafe items
- Edit unpaid rows
- Split rows
- Reassign rows
- Collect payments from checkout (working payments)
- Accept checkout allocations and update working totals (Bill `paidAmount` / `dueAmount`)

### FINISHED visit owns nothing

After a visit is finished:

1. The visit is `FINISHED` and **is immutable** for the financial lifecycle.
2. Checkout must never edit anything tied to that visit:
   - No checkout payments
   - No checkout allocations
   - No edits to frames
   - No edits to cafe items
   - No edits to row ownership
3. Counter must never allow:
   - Frame edits
   - Cafe edits
   - Split/reassign operations

The only permitted “money-like” operations after finish are:

1. **Outstanding collection** on the Customer page
2. **Wallet events**
3. **Reversal operations** derived from ledger history *(reversal workflow itself is **Pending Design** — see Section 12)*

---

## 6. Checkout

**Status: Approved**

**Checkout is the only place for active-visit payments.**

Route: `/checkout`

### What checkout handles

- Games and cafe on the **active visit**
- Partial payments (FIFO allocation across selected entries)
- Full settlement
- Leave Due (working state; no ledger yet)
- Wallet / Cash / GPay
- Third-party pay (`paidByCustomerId` — ownership unchanged)

### What checkout must NEVER do

- Collect **outstanding** from previous visits
- Create ledger status events:
  - **Moved to Outstanding** — only during Finish Visit (when Due remains)
  - **Outstanding Paid** — only from Customer Page balance payments
- Modify Outstanding

### Leave Due (working state)

When staff leaves checkout with remaining due:

- The visit remains `ACTIVE` and checkout remains the working bill
- No ledger events are created
- No outstanding events are created
- The remaining amount becomes eligible for Outstanding only after **Finish Visit**

### Checkout eligibility

Entries in `PENDING` or `REVERSED` with remaining obligation appear in checkout queue.

---

## 7. Finish Visit

**Status: Approved**

**Finish Visit** is the explicit financial commit point.

When staff executes **Finish Visit**:

1. The visit becomes `FINISHED` and is immutable for the financial lifecycle
2. The bill becomes `FINISHED`
3. Ledger events are generated (see Section 9)
4. If Due remains `> 0`, Outstanding is created
5. If Due is `0`, Outstanding is not created

Outstanding must **not** be created by:

- Dismissing checkout while still active
- Partial working payments
- Any counter/checkout operations prior to finish

---

## 8. Payment Ownership

**Status: Approved**

There are two completely separate payment flows.

### Working payments (ACTIVE visit)

1. Working payments can be collected **only** from Checkout.
2. Working payments update the active Bill (Paid/Due) in real time.
3. Working payments must **not** write to the customer ledger.
4. Checkout payments do not create outstanding history.

### Finalized payments (FINISHED visit / Outstanding)

After Finish Visit:

1. Any remaining Due becomes **Outstanding**.
2. Outstanding collection can be performed **only** from the Customer page.
3. Checkout must never modify Outstanding.
4. Customer page must never modify an `ACTIVE` visit.

### Payment fields on entries

**Status: Approved**

| Field | Checkout payment | Outstanding collection |
|-------|------------------|------------------------|
| `paidAmount` | Checkout settlement | — |
| `balanceCollectedAmount` | — | Customer balance payment |

**Total settled** = `paidAmount + balanceCollectedAmount`

### Active visit block on Customer Page

**Status: Approved**

If customer has active visit due > 0:

- Customer Page Collect Payment is **hard-blocked**
- Message: *"This customer has an active visit due. Collect today's payment from Checkout."*
- Block uses `max(visitBillDue, checkoutQueueDue)`

---

## 9. Due vs Outstanding

**Status: Approved**

| Term | Scope | When |
|------|-------|------|
| **Due** | Today's working visit bill | During `WORKING` state |
| **Outstanding** | Customer lifetime debt | After Finish Visit when Due remains `> 0` |

Due is **not** outstanding until staff executes **Finish Visit** and finalizes the financial outcome.

Outstanding belongs to the **customer**, not today's visit.

### One bill rule

**Status: Approved**

```
Game Charges + Cafe Charges = Total Bill
Paid + Due = Total Bill
```

No separate game bill and cafe bill.

---

## 10. Outstanding

**Status: Approved**

### Creation

Outstanding is created when:

1. Staff executes **Finish Visit** and the Due at finish remains `> 0`

Outstanding is **never** created automatically during normal partial checkout payment.

The event “Moved to Outstanding” (or equivalent) is created **only** at Finish Visit.

If Due at finish is zero, Outstanding is not created.

### Collection

- **Only** from Customer Page → Collect Payment
- Uses `recordCustomerBalancePayment`
- Partial payments allowed (FIFO)
- FIFO: sort eligible entries by `createdAt` ascending; apply payment to oldest owed amount first
- Split-bill: FIFO per contributor slice for that customer

---

## 11. Ledger

**Status: Approved**

### Principles

- **Finalized financial journal** — not a live counter activity feed
- Append-only customer financial history
- No existing ledger lines are overwritten
- Running wallet balance and outstanding balance columns
- Running Outstanding must be computed chronologically after each ledger event

### Read scope

1. Ledger generation must read **only** visits with `status = FINISHED`.
2. While a visit is `ACTIVE`:
   - No charge events
   - No payment events
   - No outstanding events
   must appear in the ledger.

### Active visit — nothing in ledger

While checkout is **in progress** (open visit bill, partial payments allowed):

- Creating, editing, reassigning, or splitting frames → **no ledger entries**
- Adding cafe items → **no ledger entries**
- Partial checkout payments → **no ledger entries** until visit is finished

### Finish Visit — ledger batch

When staff explicitly executes **Finish Visit**, emit **one batch** in this order:

1. **Charge lines** — one per row (one ledger event per frame / one per cafe item)
2. **Visit payment** — after charges *(granularity: one per finalized payment or aggregated — see Open Questions)*
3. **Moved to Outstanding** — only if remainder due > 0 after payment. **Omit** if fully paid.

Never emit “Moved to Outstanding” if the visit was fully paid.

A bill batch is finalized only when **Visit is finished** (Finish Visit).

Partial payments during an open checkout do **not** finalize the batch.

### Customer Page payments (outstanding)

After Finish Visit with remaining Due, collections from Customer Page create:

- `Cash/GPay Received (Outstanding)`
- `Outstanding Paid` (when outstanding clears to zero)

### Payment context labels

**Status: Approved**

| Context | Example label |
|---------|---------------|
| `ACTIVE_VISIT` | Cash Received (Visit) |
| `OUTSTANDING` | GPay Received (Outstanding) |
| `WALLET` | Wallet Recharge / Wallet Payment |

### Outstanding column behavior

**Status: Approved**

- Visit charges and visit payments: do **not** affect running outstanding balance
- **Moved to Outstanding**: increases outstanding by remainder amount
- **Outstanding** balance payments: decrease outstanding
- **Outstanding Paid** status event: when balance payment clears outstanding to zero

---

## 12. Counter

**Status: Approved** *(core counter workflow)*

### Responsibilities

Staff may:

- Add games (Singles, Individual, Shuffle, Rummy, pool/mini sessions)
- Add cafe items
- Assign unassigned rows to customers
- Split bills between customers
- Edit amounts (while row is unlocked)
- Correct entries (audit trail)
- Cancel wrong entries (preserved as CANCELLED)

Staff must **not**:

- Collect outstanding balances from the counter
- Collect active-visit due from the Customer Page

### Entry states

**Status: Approved**

| Status | Meaning |
|--------|---------|
| `PENDING` | Open charge — may be unassigned, partial, or awaiting checkout |
| `PAID` | Fully settled |
| `REVERSED` | Settlement reversed — may be paid again |
| `CANCELLED` | Voided by staff — preserved for audit |

### Unassigned rows

**Status: Approved**

- Walk-ins may be logged without a customer
- Assign later via smart suggestions (playing → recent → frequent → all)

### Cafe financial rules

**Status: Pending Design**

Cafe-specific financial rules (pricing, reconciliation, reporting) are not finalized. See Module Status.

---

## 13. Editing & Locking

**Status: Approved**

**Edit lock is per row (entry), not per customer or visit.**

| Row state | Editable? |
|-----------|-----------|
| `paidAmount + balanceCollectedAmount = 0` | Yes |
| Partially paid | **Locked** |
| Fully paid (`PAID`) | **Locked** |
| Split frame: any contributor paid | **Locked** (whole frame) |

### FIFO must not cross-lock

Payments allocated to earlier rows via FIFO must **not** lock later unpaid rows.

`bill.lastPaymentAt` is used for display only — **not** for edit locks.

### Customer reassignment

Blocked when entry or any contributor has received payment.

### Corrections

Available via correction dialog; preserves audit trail. Does not rewrite payment history.

---

## 14. Split Bills

**Status: Approved**

One `NotebookEntry` may have multiple `contributors[]`.

### Each contributor has

- `customerId`, `customerName`, `amount`
- Own `paidAmount`, `balanceCollectedAmount`, `status`
- Own `billId` / `visitId` when assigned

### Payment

- Each contributor paid independently at checkout
- Third-party pay: `paidByCustomerId` on settlement — **ownership unchanged**

### Editing / reassignment

- Frame edit locks if **any** contributor on that frame has received payment
- Customer reassignment blocked after any payment on frame or contributor

---

## 15. Third-Party Payments

**Status: Approved**

Game/cafe item **always** belongs to the customer who consumed it.

If another customer pays:

- Original customer's history shows their frames/charges
- Ledger records **Paid By** on payment
- Ownership never transfers

---

## 16. Customer Page

**Status: Approved**

Route: `/customers/[id]`

### Displays

- Identity, wallet, outstanding, visit count, lifetime spend
- Last visit / last payment
- Ledger and visit history

### Actions

| Action | Allowed when |
|--------|--------------|
| Collect Outstanding | No active visit due |
| View Ledger | Always |
| Recharge Wallet | **Pending Design** *(see Section 17)* |
| Open Checkout | Has checkout queue items |
| WhatsApp | Always |

### Outstanding page

Route: `/notebook/balances` — customers with Outstanding balances.

---

## 17. Wallet

**Status: Pending Design**

Wallet is listed under Pending Design in Module Status.

The following have **not** been finalized as business rules:

- Wallet enablement policy
- Recharge plans and bonus rules
- Verification requirements at checkout vs outstanding collection
- Wallet reversal workflow
- Wallet reconciliation
- UI workflow for wallet operations

**Do not implement wallet behavior based on assumptions.**

---

## 18. Reversal

**Status: Pending Design**

### Agreed (partial)

- The ledger is **append-only**.
- No existing ledger lines are overwritten.
- Mistakes are corrected via reversal entries; reversal history remains visible.

### Not finalized (Pending Design)

The following have **not** been agreed:

- Manager approval requirements
- Time limits for reversal
- Reverse payment flow
- Reverse charge flow
- Wallet reversal
- Outstanding reversal
- UI workflow for reversals

**Do not implement reversal behavior based on assumptions.**

---

## 19. Business Day

**Status: Pending Design**

Business-day assignment for visits is not finalized.

The following have **not** been agreed:

- Business Day definition (e.g. 10 AM → 6 AM)
- Overnight visits
- How visits span or reset across business-day boundaries

**Do not implement business-day rules based on assumptions.**

---

## 20. Daily Closing

**Status: Pending Design**

Daily closing workflow is not finalized.

The following have **not** been agreed:

- Business Day (10 AM → 6 AM)
- Overnight visits
- Cash reconciliation
- Wallet reconciliation
- Cafe reconciliation
- Inventory reconciliation
- Daily reports
- End-of-day Due → Outstanding confirmation flow

**Do not implement daily closing behavior based on assumptions.**

---

## 21. Reports

**Status: Pending Design**

Daily and operational reporting requirements are not finalized.

**Do not implement reporting based on assumptions.**

---

## 22. Inventory

**Status: Pending Design**

Inventory reconciliation and related rules are not finalized.

**Do not implement inventory behavior based on assumptions.**

---

## 23. Excluded / Future (v1)

**Status: Approved**

Not in scope unless business need is confirmed:

- Bill transfer between customers
- Automatic split billing
- Complex accounting screens
- Activity log (separate from ledger)

---

## Open Questions

**Status: Under Discussion**

1. **Visit Payments ledger granularity** — One ledger event per finalized payment, or one aggregated payment event per finished visit? (Invariant requires visit payments occur after charges; aggregation vs per-payment is not finalized.)

2. **Ledger bundling configuration** — Business architecture references cafe charge bundling in time windows and same-minute counter charge grouping. Exact bundling rules are not finalized.

3. **Finish Visit UI workflow** — Explicit Finish Visit action wiring in checkout UI is pending implementation alignment with approved lifecycle rules.

---

## Document control

| Field | Value |
|-------|-------|
| Document | Product Specification |
| Version | 1.0 (Draft — pending freeze) |
| Supersedes | Informal architecture notes where they conflict |
| Canonical companions | `financial-invariants.md`, `business-architecture.md` |

If this document and implementation disagree, **this document takes precedence** for business rules until explicitly updated.
