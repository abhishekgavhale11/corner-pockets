# Corner Pockets — Testing Checklist

Manual QA scenarios. **Add a regression entry whenever a bug is fixed.**

Run after major changes. Login: `admin` / `corner123` (or `rahul` / `corner123` if seeded).

---

## How to use

- [ ] = not tested
- [x] = passed
- [!] = failed — log in `known-bugs.md`

Prefix **REG-** scenarios must never fail again.

---

## 1. Counter — Happy paths

### HP-C01 — Quick frame entry (Big Snooker)

1. Open `/counter/big-snooker`
2. Tap + Singles on a table
3. **Expected:** New PENDING row, correct amount, timestamp preserved

### HP-C02 — Assign unassigned row

1. Create unassigned Singles
2. Click row → assign customer
3. **Expected:** Customer name appears; amber unassigned styling removed

### HP-C03 — Rummy entry

1. + Rummy → select players → confirm
2. **Expected:** Rummy row with correct amount; tap to edit players/amount while unlocked

### HP-C04 — Cafe item

1. Open `/counter/cafe` → add item to customer tab
2. **Expected:** Item on customer tab; appears in checkout for that customer

### HP-C05 — Pool/Mini session

1. Start session on pool table → assign customer → add cafe item
2. Stop session
3. **Expected:** Session appears in checkout; game + cafe totals correct

### HP-C06 — Split bill

1. Create frame → split between 2 customers
2. **Expected:** Two contributor rows; each shows own amount; no parent amber on contributors

### HP-C07 — Cancel entry

1. Cancel a pending row
2. **Expected:** Status CANCELLED; row preserved; not in checkout queue

---

## 2. Checkout — Happy paths

### HP-K01 — Full cash payment (active visit)

1. Customer with one ₹160 Singles, assigned
2. Checkout → pay ₹160 Cash
3. **Expected:** Entry PAID; ledger shows charge + Cash Received (Visit) only

### HP-K02 — Partial payment

1. Bill ₹700, pay ₹300
2. **Expected:** Due ₹400; entry partial; customer can keep playing

### HP-K03 — Multiple partial payments

1. Pay ₹200, then ₹300, then ₹200 on ₹700 bill
2. **Expected:** Due reaches ₹0; each payment recorded

### HP-K04 — GPay payment

1. Settle with GPay
2. **Expected:** Ledger: `GPay Received (Visit)`

### HP-K05 — Wallet payment

1. Customer with wallet enabled and balance
2. Verify → pay with wallet
3. **Expected:** Balance deducted; ledger shows Wallet Payment (Visit)

### HP-K06 — Pay Later (dismiss)

1. Checkout → dismiss / pay later with balance remaining
2. **Expected:** `checkoutDismissedAt` set; ledger shows charge + **Moved to Outstanding**; no Outstanding Paid

### HP-K07 — Third-party pay

1. Customer A's bill, Customer B pays
2. **Expected:** A's charges remain A's; payment shows Paid By B

### HP-K08 — Session checkout

1. Complete pool session checkout
2. **Expected:** Game + cafe settled; session closed appropriately

---

## 3. Customer Page — Happy paths

### HP-P01 — Collect outstanding (no active visit)

1. Customer with pay-later balance, no active visit due
2. Collect Payment partial then full
3. **Expected:** FIFO allocation; ledger shows GPay/Cash Received (Outstanding); **Outstanding Paid** when cleared

### HP-P02 — View ledger

1. Open `/customers/[id]/ledger`
2. **Expected:** Chronological events; running outstanding never negative; status rows show amounts

### HP-P03 — Wallet recharge

1. Recharge student/club plan
2. **Expected:** Balance increases; ledger Wallet Recharge entry

### HP-P04 — Open checkout from customer

1. Customer with checkout queue items
2. **Expected:** Deep link to checkout works

---

## 4. Edge cases

### EC-01 — Unassigned pay at checkout

1. Unassigned row in checkout
2. Pay and select customer at checkout
3. **Expected:** Customer assigned; payment recorded

### EC-02 — Split bill partial pay

1. Split ₹320 / ₹320 frame
2. Pay only one contributor's share
3. **Expected:** That contributor PAID; other still PENDING; frame locked for paid contributor only at contributor level

### EC-03 — Settlement reversal

1. Pay entry → reverse settlement
2. **Expected:** Entry returns to payable state; REVERSED badge; can pay again

### EC-04 — Entry correction on unlocked row

1. Edit amount on row with ₹0 paid
2. **Expected:** Correction saved in audit trail

### EC-05 — Wallet disabled customer

1. Customer `walletEnabled: false`
2. Open checkout and collect payment dialogs
3. **Expected:** Wallet option disabled (REG-003)

### EC-06 — Outstanding FIFO order

1. Three pay-later entries: ₹100, ₹200, ₹300 (oldest first)
2. Pay ₹250 on Customer Page
3. **Expected:** ₹100 fully cleared, ₹150 on second entry, third untouched

### EC-07 — Mixed visit + outstanding in ledger

1. Customer with pay-later history pays new visit at checkout
2. **Expected:** Visit payment does not affect outstanding column incorrectly

### EC-08 — Re-assign customer before payment

1. Assign customer A → change to customer B before any payment
2. **Expected:** Allowed

### EC-09 — Re-assign after payment

1. Partially pay frame → try change customer
2. **Expected:** Blocked with reassignment message

---

## 5. Regression tests (must not break)

### REG-001 — Checkout must not create Outstanding Paid

**From:** BUG-001

1. Active visit: one charge ₹130
2. Pay ₹130 at checkout (Cash)
3. **Expected ledger:**
   - Charge −₹130
   - Cash Received (Visit) +₹130
   - **No** Outstanding Paid, Moved to Outstanding, or other outstanding status events

### REG-002 — Edit lock is per-row, not per-visit

**From:** BUG-002

Setup on same customer visit:

| Row | Paid | Due |
|-----|------|-----|
| Individual ₹180 | ₹180 | ₹0 |
| Rummy ₹480 | ₹320 | ₹160 |
| Singles ₹160 | ₹0 | ₹160 |
| Unassigned Singles ₹160 | ₹0 | ₹160 |

**Expected edit state:**

| Row | Locked? |
|-----|---------|
| Individual | Yes (fully paid) |
| Rummy | Yes (partially paid) |
| Singles | **No** |
| Unassigned Singles | **No** |

### REG-003 — Wallet disabled in UI

**From:** BUG-003

1. `walletEnabled: false`
2. **Expected:** Wallet segment disabled in PaymentMethodSelector

### REG-004 — Customer Page blocked during active visit

**From:** BUG-004

1. Customer with checkout due > 0
2. Open Collect Payment on Customer Page
3. **Expected:** Blocked; message directs to Checkout; dialog does not open

### REG-005 — Ledger empty during active visit

**From:** Ledger finalization refactor

1. Add frames and cafe items on counter (do not complete checkout)
2. View customer ledger
3. **Expected:** **No** charge lines, **no** visit payments

4. Complete checkout (full pay or pay-later)
5. **Expected:** All charges + visit payment appear together; Moved to Outstanding only if due remains

### REG-008 — Checkout completion ledger batch order

**From:** Ledger finalization refactor

1. Active visit: Individual ₹180, Rummy ₹480, Singles ₹160, Cafe ₹40 (₹860 total)
2. Complete checkout: pay ₹220, remainder to outstanding
3. **Expected ledger order:**
   - Individual −₹180
   - Rummy −₹480
   - Singles −₹160
   - Cafe −₹40
   - Cash/GPay Received (Visit) +₹220
   - Moved to Outstanding ₹640
4. **Not expected:** ledger entries while visit is still open; per-settlement lines during partial pay before completion

### REG-008b — Full pay omits Moved to Outstanding

1. Complete checkout with full payment
2. **Expected:** charges + visit payment only; **no** Moved to Outstanding

### REG-005b — Partial pay during open checkout not in ledger

1. Open checkout, pay ₹100 partial, do **not** complete checkout
2. **Expected:** Ledger still empty for this visit

### REG-006 — Active visit payment context in ledger

1. Pay at checkout
2. **Expected:** Description suffix `(Visit)`, not `(Outstanding)`

### REG-007 — Outstanding payment context in ledger

1. Collect on Customer Page
2. **Expected:** Description suffix `(Outstanding)`

---

## 6. Payment separation

| Scenario | Checkout | Customer Page |
|----------|----------|---------------|
| Active visit due | ✅ Collect | ❌ Blocked |
| Pay-later / outstanding | ❌ N/A | ✅ Collect |
| Wallet recharge | ❌ | ✅ |

---

## 7. Editing rules

| paidAmount | balanceCollectedAmount | status | Editable? |
|------------|------------------------|--------|-----------|
| 0 | 0 | PENDING | Yes |
| >0 | any | PENDING | No |
| any | any | PAID | No |

---

## 8. Reversal

### REV-01 — Settlement reversal

1. Pay → reverse with reason
2. **Expected:** Counter shows reversed; timeline Paid → Reversed → can pay again

### REV-02 — Wallet recharge reversal

1. Recharge → reverse (if available)
2. **Expected:** Compensating transaction; balance restored

---

## 9. Auth & permissions

### AUTH-01 — Staff login

1. Wrong password → error
2. `admin` / `corner123` → dashboard

### AUTH-02 — Permission gates

1. Staff without `NOTEBOOK_SETTLE` cannot settle
2. Staff without `WALLET_RECHARGE` cannot recharge

---

## 10. Build & deploy smoke

```bash
npm run build
npx tsc --noEmit
```

**Expected:** No errors.

---

## Adding new scenarios

When fixing a bug:

1. Add **REG-XXX** section with steps and expected result
2. Reference bug ID in `known-bugs.md`
3. Note in `changelog.md`

Format:

```markdown
### REG-XXX — Short title

**From:** BUG-XXX

1. Steps...
**Expected:** ...
```
