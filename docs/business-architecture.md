# Corner Pockets — Business Architecture

**Single source of truth for business rules.**  
If code and this document disagree, **this document takes precedence** until the document is updated deliberately.

---

## Documentation workflow

Before any feature or bug fix:

1. Read `business-architecture.md`
2. Read `current-status.md`
3. Read `known-bugs.md`

After implementation:

- Update `current-status.md`
- Append to `changelog.md`
- Update this file if business rules changed
- Update `testing-checklist.md` if a new scenario exists

---

## 1. Core philosophy

The software should behave like an experienced counter staff member.

- Simplicity over complexity
- One action → one obvious workflow
- Never lose or silently change financial history
- Every money movement must be traceable
- Counter must stay fast during peak hours
- Optimize for real club workflow, not accounting theory

**Currency:** INR (₹), whole rupees.

---

## 2. Core entities

| Entity | Purpose |
|--------|---------|
| **Customer** | Lifetime relationship — wallet, outstanding, ledger |
| **Visit** | One customer visit on one business day |
| **Bill** | One bill per visit — game + cafe combined |
| **NotebookEntry** | Atomic charge row (frame, rummy, cafe item, session game charge) |
| **TableSession** | Timed pool/mini play with game + cafe sub-bill |
| **NotebookSettlement** | Checkout payment event (cash/GPay/wallet) |
| **CustomerBalancePayment** | Customer-page outstanding collection (FIFO) |
| **Transaction** | Wallet credit/debit |

### Golden rules

1. One Visit = One Bill (game + cafe, never separate bills)
2. Visits are never merged
3. Counter manages **today's working state** only
4. Customer Page manages **lifetime** relationship
5. Ledger is **append-only** — reversals, never silent edits
6. Previous outstanding never auto-merges into today's visit

---

## 3. Working state vs permanent history

| Layer | Purpose | When it changes |
|-------|---------|-----------------|
| **Counter** | Today's notebook (tables, frames, cafe) | Continuously during play |
| **Visit Bill** | Live running bill for today's visit | Charges and checkout payments |
| **Payments** | Permanent financial events | Immediately when money is received |
| **Ledger charges** | Permanent charge lines | After checkout commit (paid or pay-later dismiss) |
| **Outstanding** | Debt after pay-later / closing | Pay-later dismiss or closing confirmation |

Counter rows may be edited freely **until that row receives payment allocation**.

---

## 4. Counter workflow

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

### Sections

| Route | Area |
|-------|------|
| `/counter/big-snooker` | Big Snooker tables 1–3 |
| `/counter/pool-mini` | Mini Snooker, Pool 1, Pool 2 |
| `/counter/cafe` | Cafe items per customer tab |

### Entry states

| Status | Meaning |
|--------|---------|
| `PENDING` | Open charge — may be unassigned, partial, or awaiting checkout |
| `PAID` | Fully settled |
| `REVERSED` | Settlement reversed — may be paid again |
| `CANCELLED` | Voided by staff — preserved for audit |

### Unassigned rows

- Walk-ins may be logged without a customer
- Amber highlight in UI
- Assign later via smart suggestions (playing → recent → frequent → all)

---

## 5. Checkout workflow

**Checkout is the only place for active-visit payments.**

Route: `/checkout`

### What checkout handles

- Games and cafe on the **active visit**
- Partial payments (FIFO allocation across selected entries)
- Full settlement
- Pay Later (dismiss bill — moves due to outstanding path)
- Wallet / Cash / GPay
- Third-party pay (`paidByCustomerId` — ownership unchanged)

### What checkout must NEVER do

- Collect **outstanding** from previous visits
- Create ledger status events:
  - **Moved to Outstanding** — only from pay-later dismiss
  - **Outstanding Paid** — only from Customer Page balance payments

### Checkout payment ledger output (active visit)

For a visit payment, ledger shows **only**:

- Charge entries (after commit)
- Payment entries: `Cash Received (Visit)`, `GPay Received (Visit)`, `Wallet Payment (Visit)`

No outstanding status events from checkout settlement.

### Pay Later (dismiss)

When staff dismisses checkout without full payment:

- Entry gets `checkoutDismissedAt`
- Ledger shows **Moved to Outstanding** (grouped by dismiss event)
- Charge appears in ledger (committed)
- Remaining balance collectible from Customer Page

### Checkout eligibility

Entries in `PENDING` or `REVERSED` with remaining obligation appear in checkout queue.

---

## 6. Visit / Bill engine

### Visit lifecycle

1. Customer assigned or first charge → `ensureVisitBill` creates Visit + Bill
2. Entries link to `visitId` and `billId`
3. `syncBillTotals` maintains `totalAmount`, `paidAmount`, `dueAmount`
4. Visit status: `ACTIVE` → `CLOSED` when appropriate

### Bill status

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Customer playing today |
| `DUE` | Unpaid portion on today's visit |
| `PAID` | Fully settled |
| `OUTSTANDING` | Due converted / pay-later |
| `SETTLED` | Outstanding collected later |

### Due vs Outstanding

| Term | Scope | When |
|------|-------|------|
| **Due** | Today's visit bill | During business hours |
| **Outstanding** | Customer lifetime debt | After pay-later dismiss or closing |

Due is **not** outstanding until staff confirms conversion.

### One bill rule

```
Game Charges + Cafe Charges = Total Bill
Paid + Due = Total Bill
```

No separate game bill and cafe bill.

---

## 7. FIFO payment rules

### Checkout (active visit)

When paying multiple entries in one settlement:

- Allocations follow entry order / explicit allocation amounts
- Each entry's `paidAmount` updated independently
- Partial payment on entry A does **not** lock entry B if B has `paidAmount = 0`

### Customer Page (outstanding)

`applyBalancePaymentFifo` in `src/lib/wallet/apply-balance-payment.ts`:

1. Sort eligible entries by `createdAt` ascending
2. Only entries with `checkoutDismissedAt` (pay-later / outstanding path)
3. Apply payment to oldest owed amount first
4. Split-bill: FIFO per contributor slice for that customer
5. Record `CustomerBalancePayment` with per-entry `allocations[]`

### Payment fields on entries

| Field | Checkout payment | Outstanding collection |
|-------|------------------|------------------------|
| `paidAmount` | Checkout settlement | — |
| `balanceCollectedAmount` | — | Customer balance payment |

**Total settled** = `paidAmount + balanceCollectedAmount`

---

## 8. Outstanding rules

### Creation

Outstanding is created when:

1. Staff uses **Pay Later** at checkout (`checkoutDismissedAt` set), or
2. Staff confirms **Closing** conversion (Due → Outstanding) — business-day end process

Outstanding is **never** created automatically during normal partial checkout payment.

### Collection

- **Only** from Customer Page → Collect Payment
- Uses `recordCustomerBalancePayment`
- Partial payments allowed (FIFO)
- Wallet option disabled when `customer.walletEnabled === false`

### Active visit block

If customer has active visit due > 0:

- Customer Page Collect Payment is **hard-blocked**
- Message: *"This customer has an active visit due. Collect today's payment from Checkout."*
- Block uses `max(visitBillDue, checkoutQueueDue)`

### Ownership

Outstanding belongs to the **customer**, not today's visit.

---

## 9. Ledger rules

Engine: `src/actions/customer-ledger.ts`

### Principles

- Append-only customer financial history
- Running wallet balance and outstanding balance columns
- Status events always show amounts (no `—`)
- Event ordering tie-break: charge → payment → moved to outstanding → outstanding paid

### When charges appear

Charges appear in ledger only after **checkout commit**:

- Entry fully paid at checkout, OR
- Entry dismissed pay-later (`checkoutDismissedAt`)

`isEntryLedgerCommitted` gates charge eligibility.

Charge timestamp uses settlement/dismiss time, not row `createdAt`.

### Payment context labels

| Context | Example label |
|---------|---------------|
| `ACTIVE_VISIT` | Cash Received (Visit) |
| `OUTSTANDING` | GPay Received (Outstanding) |
| `WALLET` | Wallet Recharge / Wallet Payment |

### Outstanding column behavior

- **Active visit** charges/payments: do **not** affect running outstanding balance
- **Pay-later** charges: increase outstanding
- **Outstanding** balance payments: decrease outstanding
- **Outstanding Paid** status event: only when `balance-payment-*` clears outstanding to zero

### Status events

| Event | Source |
|-------|--------|
| Moved to Outstanding | Pay-later dismiss |
| Outstanding Paid | Customer Page balance payment clears outstanding |
| Wallet Recharge / Refund | Wallet transactions |

### Bundling

- Cafe charges: bundled in 30-minute windows
- Same-minute counter charges: grouped where configured

---

## 10. Wallet rules

### Enablement

- `customer.walletEnabled` must be true for wallet pay/recharge
- UI disables wallet option when disabled (no silent default to enabled)

### Recharge plans

| Type | Example |
|------|---------|
| Student | Pay ₹1,000 → Credited ₹1,100 |
| Club | ₹3,000 / ₹5,000 / ₹10,000 plans with bonus |

### Wallet at checkout

- Card ID or phone verification required
- Creates `Transaction` debit linked to settlement
- Deducts `customer.balance`

### Wallet at outstanding collection

- Same verification flow
- Recorded as balance payment, not visit settlement

### Reversal

Wallet recharge can be reversed if not already reversed.

---

## 11. Reversal strategy

**Never edit closed financial history.**

### Settlement reversal

- Creates `NotebookSettlementReversal`
- Restores entry `paidAmount` / contributor payments
- Entry may return to `PENDING` or partial state
- Counter shows `REVERSED` badge
- Ledger shows reversal trail

### Entry correction (not reversal)

- Allowed on **unlocked** rows
- Stored in `corrections[]` audit array
- Does not rewrite payment history

### Wallet reversal

- Creates compensating `Transaction`
- Links via `reversesTransactionId`

---

## 12. Split bill rules

One `NotebookEntry` may have multiple `contributors[]`.

### Each contributor has

- `customerId`, `customerName`, `amount`
- Own `paidAmount`, `balanceCollectedAmount`, `status`
- Own `billId` / `visitId` when assigned

### Payment

- Each contributor paid independently at checkout
- Third-party pay: `paidByCustomerId` on settlement — **ownership unchanged**

### Display

- Contributor rows do not inherit parent unassigned amber styling
- Each row shows own payment badge

### Editing / reassignment

- Frame edit locks if **any** contributor on that frame has received payment
- Customer reassignment blocked after any payment on frame or contributor

---

## 13. Editing rules

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

Implementation: `src/lib/visit-bill/entry-edit-lock-utils.ts`

### Customer reassignment

Blocked when entry or any contributor has received payment.

### Corrections

Available via correction dialog; preserves audit trail.

---

## 14. Customer page rules

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
| Recharge Wallet | `walletEnabled` |
| Open Checkout | Has checkout queue items |
| WhatsApp | Always |

### Outstanding page

Route: `/notebook/balances` — customers with pay-later / outstanding balances.

---

## 15. Third-party payments

Game/cafe item **always** belongs to the customer who consumed it.

If another customer pays:

- Original customer's history shows their frames/charges
- Ledger records **Paid By** on payment
- Ownership never transfers

---

## 16. Closing process

At end of business day:

1. System lists customers with Due
2. Staff reviews
3. On confirmation: Due → Outstanding
4. Ledger: **Moved to Outstanding** (or equivalent closing event)

Outstanding is not created casually during the day.

---

## 17. Search

Customer search supports: name, phone, card ID (`CP0001`), bill number, visit ID.

---

## 18. Future / excluded (v1)

Not in scope unless business need confirmed:

- Bill transfer between customers
- Automatic split billing
- Complex accounting screens
- Activity log (separate from ledger)

---

## 19. Architecture decisions log

| Date | Decision |
|------|----------|
| 2026-07 | Checkout payments never create Outstanding Paid ledger events |
| 2026-07 | Ledger charges only after checkout commit, not at counter create time |
| 2026-07 | Edit lock per-row by `paidAmount`, not visit `lastPaymentAt` |
| 2026-07 | Customer Page blocked when active visit due > 0 |
| 2026-07 | `paidAmount` = checkout; `balanceCollectedAmount` = outstanding collection |

*Append new decisions here when they change business behavior.*
