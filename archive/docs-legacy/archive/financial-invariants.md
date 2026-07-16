# Corner Pockets — Financial Invariants

These are **non-negotiable rules** for the financial lifecycle. They must remain true even if implementation details change.

If code ever violates these invariants, **the implementation is wrong** (the ledger and financial outcome will not match the club workflow).

---

## Invariant A — Active visit owns the working state

1. An `ACTIVE` visit owns the customer for the purposes of:
   - Adding frames
   - Adding cafe items
   - Editing unpaid rows
   - Splitting rows
   - Reassigning rows
   - Collecting payments from checkout (working payments)
2. Only an `ACTIVE` visit may accept checkout allocations and update working totals (Bill `paidAmount` / `dueAmount`).

---

## Invariant B — Finished visit owns nothing

After a visit is finished:
1. The visit is `FINISHED` and **is immutable** for the financial lifecycle.
2. Checkout must never edit anything tied to that visit:
   - No checkout payments
   - No checkout allocations
   - No edits to frames
   - No edits to cafe items
   - No edits to row ownership
3. Counter must never allow:
   - frame edits
   - cafe edits
   - split/reassign operations

The only permitted “money-like” operations after finish are:
1. **Outstanding collection** on the Customer page
2. **Wallet events**
3. **Reversal operations** derived from ledger history

---

## Invariant C — Exactly one active visit per customer

At any moment:
1. There is **exactly one** `ACTIVE` visit per customer (or fewer if the customer is not currently playing).
2. A finished visit is **never reopened** and never reused as the next working chapter.
3. If a customer returns tomorrow, a **new** visit must be created; the old visit remains closed forever.

---

## Invariant D — Ledger only reads finished visits

1. The Customer ledger is a **finalized financial journal**.
2. Ledger generation must read **only** visits with `status = FINISHED`.
3. While a visit is `ACTIVE`:
   - no charge events
   - no payment events
   - no outstanding events
   must appear in the ledger.

---

## Invariant E — Payment ownership is strictly separated

There are two completely separate payment flows:

### E1) Working payments (ACTIVE visit)

1. Working payments can be collected **only** from Checkout.
2. Working payments update the active Bill (Paid/Due) in real time.
3. Working payments must **not** write to the customer ledger.
4. Checkout payments do not create outstanding history.

### E2) Finalized payments (FINISHED visit / Outstanding)

After Finish Visit:
1. Any remaining Due becomes **Outstanding**.
2. Outstanding collection can be performed **only** from the Customer page.
3. Checkout must never modify Outstanding.
4. Customer page must never modify an `ACTIVE` visit.

---

## Invariant F — Outstanding is created only during Finish Visit

1. The event “Moved to Outstanding” (or equivalent) is created **only** at Finish Visit.
2. Outstanding must not be created by:
   - dismissing checkout while still active
   - partial working payments
   - any counter/checkout operations prior to finish
3. If Due at finish is zero, Outstanding is not created.

---

## Invariant G — Ledger append-only journal

1. The ledger is append-only.
2. No existing ledger lines are overwritten.
3. Mistakes are corrected via reversal entries (reversal history remains visible).
4. Running Outstanding must be computed chronologically after each ledger event.

---

## Invariant H — Ledger event ordering (within a finished visit)

For a given finished visit chapter, ledger events must always be generated in this order:

1. Charges (one ledger event per frame / one per cafe item)
2. Visit Payments (one finalized payment ledger event per finalized payment, or an aggregated payment event if that’s your chosen implementation—must still occur after charges)
3. Moved to Outstanding **only if** Due > 0

Never emit “Moved to Outstanding” if the visit was fully paid.

---

## Invariant I — Bill status is not duplicated

1. The Bill represents a financial summary for the visit.
2. Keep Bill status simple:
   - `WORKING`
   - `FINISHED`
3. Do not encode redundant information twice (e.g., both a “status” field and the same outcome embedded again elsewhere).
4. The financial outcome is determined at finish by:
   - `dueAmount == 0`  => Paid
   - `dueAmount > 0`   => Outstanding

---

## Invariant J — Reversal is ledger-driven

1. Reversal operations originate from ledger history.
2. Reversal can only occur after a visit is finished (or as allowed by your reversal model for wallet history).
3. Reversal must preserve append-only ledger semantics.

---

## Final note

If any developer needs to change behavior, they must update these invariants (and the business docs) before changing code.

