# Corner Pockets POS

# Business Architecture v1.0

## Purpose

This document is the single source of truth for the Corner Pockets POS billing engine.

Every implementation must follow this document.

If the implementation differs from this document, this document takes precedence.

Developers must never invent business logic. Any new business rule must first be added to this document before implementation.

---

# 1. Core Philosophy

The software should behave exactly like an experienced counter staff member.

The goal is not to build a complicated accounting system.

The goal is to replace the physical notebook with something faster, more reliable and easier to audit.

The software should always optimize for the real workflow of the club.

---

# 2. Core Principles

1. Simplicity over complexity.
2. One action should have one obvious workflow.
3. Never lose financial history.
4. Never silently change financial history.
5. Every money movement must always be traceable.
6. If staff rarely use a feature, don't build unnecessary complexity.
7. Counter should remain fast during busy hours.
8. **Operational Simplicity** — the software must always optimize for the real workflow of counter staff. Common operations should require the minimum possible clicks. Do not introduce additional dialogs or accounting concepts unless absolutely necessary.

---

# 3. Customer Visit

Every time a customer comes to the club, a new Visit is created.

A Visit contains:

* Game Entries
* Cafe Items
* Payments
* Notes

Every Visit has one Bill.

Visits are never merged.

---

# 4. Visit Bill

A Visit has only ONE Bill.

The Bill contains every charge during that visit.

Game Charges

+

Cafe Charges

=

Total Bill

Example:

Game Charges      ₹500

Cafe Charges      ₹200

---

Total Bill        ₹700

Paid              ₹500

Due               ₹200

There is never a separate Game Bill and Cafe Bill.

---

# 5. Counter Responsibilities

The Counter is a **working area** — not the customer's permanent financial history.

While a customer is playing, staff may:

* Add games and cafe items
* Edit amounts
* Assign or split customers
* Delete or correct wrong entries
* Receive payments

These are temporary working operations. Counter rows may change freely during the visit.

The Counter should never manage previous Outstanding balances.

The Counter does **not** write permanent customer history for individual frames or cafe items.

---

# 5a. Working State vs Permanent History

The system separates four concepts:

| Layer | Purpose | When it changes |
|-------|---------|-----------------|
| **Counter** | Today's working notebook (tables, frames, cafe) | Continuously during play |
| **Visit Bill** | Live running bill for today's visit | When charges or payments occur |
| **Payments** | Permanent financial events | **Immediately** when cash/GPay/wallet is received |
| **Visit Summary** | Permanent snapshot of a completed checkout | When checkout is completed |
| **Outstanding** | Debt carried after closing | Only at Closing after staff confirmation |

Frames and cafe items remain on the **Visit Bill** until checkout is completed. They do not appear as permanent history line-by-line.

**Payments are different.** Every payment received is a permanent financial event and must be recorded immediately — even while the visit is still active and the bill may still grow.

---

# 6. Payments

Customers may pay any amount at any time.

Payments are **permanent financial events**. When staff receives cash, GPay, or wallet payment, the system records it immediately.

Payments update the active Visit Bill (Paid and Due) but do **not** create Outstanding.

Examples:

Bill ₹700

Payment ₹200

Due ₹500

Later

Payment ₹300

Due ₹200

Later

Payment ₹200

Due ₹0

The software automatically recalculates the Due after every payment.

The customer may continue playing after a payment. New charges add to the same Visit Bill.

---

# 7. Due

Due means:

Money still unpaid during today's Visit.

Due is NOT Outstanding.

The customer may:

* Continue playing
* Buy more cafe items
* Return later today
* Pay before closing

Therefore the amount remains Due.

---

# 8. Closing

Outstanding is never created during business hours.

At Closing Time:

The software shows every customer who still has Due.

Example:

Rahul        ₹200

Mohit        ₹80

Vishal       ₹350

Staff reviews the list.

After confirmation:

Due

↓

Outstanding

Only then is Outstanding created.

---

# 9. Outstanding

Outstanding belongs to the Customer.

Outstanding does not belong to today's Visit.

Outstanding is managed from the Customer Page.

Previous Outstanding is never automatically merged into today's Visit.

---

# 10. Counter Display

Hovering over a customer should display:

Customer Name

Today's Bill

Paid Today

Due Today

Below the summary, show every Game and Cafe entry that created the bill.

Example:

Rahul

Bill ₹700

Paid ₹500

Due ₹200

---

Singles ₹160

Individual ₹180

Shuffle ₹160

Gold Flake ₹20

Water ₹20

Chicken Sandwich ₹160

The summary explains money.

The breakdown explains where the bill came from.

---

# 11. Partial Payments

Partial payments are allowed.

The Due amount automatically updates on the Visit Bill.

The customer can continue playing after making a partial payment.

Payments are recorded immediately as permanent financial events.

No Outstanding is created until Closing.

---

# 11a. Checkout

Checkout is the **commit point** for a visit session (or visit portion).

When checkout is completed, create a **Visit Summary** — a permanent snapshot containing:

* Visit ID
* Bill ID
* Total Bill
* Game Total
* Cafe Total
* Amount Paid
* Due (if any)
* Payment Method
* Paid By (if another customer paid)
* Staff Name
* Date & Time

Until checkout completes, frames and cafe items exist only on the working Visit Bill — not in permanent visit history.

Split bills: each customer sees and pays only **their own share** on their Visit Bill at checkout.

---

# 12. Customer Page

Customer Page manages the customer's lifetime relationship with the club.

It displays:

* Name
* Phone
* Total Visits
* Lifetime Spend
* Outstanding
* Wallet Balance
* Visit History
* Ledger

Actions:

* Collect Outstanding
* View Ledger
* View Visits
* Edit Customer
* WhatsApp Customer

---

# 13. Customer History (Ledger)

Customer History is the customer's **permanent financial record**.

It is append-only. Nothing is deleted. Nothing is overwritten.

Customer History does **not** mirror every counter operation. Individual frames and cafe items are working-state on the Visit Bill until checkout.

### What is recorded immediately

* **Payments received** (Cash, GPay, Wallet)
* Wallet recharge / deduction
* Due Converted to Outstanding (at Closing)
* Outstanding collected
* Refunds and Reversals

### What is recorded at checkout

* **Visit Summary** — final snapshot of the visit (totals, game/cafe breakdown, paid, due, staff, visit/bill IDs)

### What is NOT recorded line-by-line during play

* Individual game frames added on the counter
* Cafe items while still being edited
* Deleted or corrected working entries

Every permanent entry stores:

* Date & Time
* Customer
* Visit ID (when applicable)
* Bill ID (when applicable)
* Staff Name
* Action
* Amount
* Payment Method (if applicable)
* Paid By (if applicable)
* Notes (optional)

---

# 14. Third-Party Payments

Every Game or Cafe item always belongs to the customer who consumed it.

If another customer pays the bill (for example after losing a betting game), ownership of the bill does NOT change.

Example:

Rahul plays ₹320

Mohit plays ₹480

Rahul loses the bet and pays Mohit's bill.

Rahul's history:

Frames ₹320

Status: Paid

Mohit's history:

Frames ₹480

Status: Paid

Paid By: Rahul

The software should record who paid the bill, but it should never transfer ownership of the original customer's bill.

This keeps each customer's playing history accurate while still recording who actually settled the payment.

---

# 15. Reversal

Closed history is never edited.

If a mistake is found later:

Do NOT modify the original Bill.

Create a Reversal entry.

Every Reversal must store:

* Original Bill ID
* Reason
* Staff Name
* Date & Time

Possible outcomes:

* Cash Refund
* GPay Refund
* Wallet Credit
* Customer Credit

All Reversals remain permanently visible in the Ledger.

---

# 16. Bill Status

Every Bill always has one status.

ACTIVE

↓

DUE

↓

PAID

or

ACTIVE

↓

DUE

↓

OUTSTANDING

↓

SETTLED

Definitions:

**ACTIVE**
Customer is currently playing.

**DUE**
Money remains unpaid during today's Visit.

**PAID**
Bill completely settled.

**OUTSTANDING**
Due converted during Closing.

**SETTLED**
Outstanding paid later.

---

# 17. Search

Customer search supports:

* Name
* Phone Number
* Bill Number
* Visit ID

---

# 18. Future Features

These are intentionally excluded from v1.0:

* Bill Transfer
* Shared Bills
* Automatic Split Billing
* Activity Log
* Complex Accounting Screens

The software should remain simple unless a real business need appears.

---

# 19. Golden Rules

1. One Visit = One Bill.
2. One Bill contains both Game and Cafe.
3. Counter manages today's Visit only.
4. Customer Page manages the customer's lifetime history.
5. Payments always reduce today's Bill.
6. Due exists only during the current business day.
7. Outstanding is created only during Closing after staff confirmation.
8. Previous Outstanding never mixes with today's Visit.
9. Every customer's own Games remain in their own history.
10. Another customer may pay the bill.
11. In such cases, the Ledger simply records "Paid By".
12. History is append-only.
13. Financial records are never deleted.
14. Reversals are used instead of editing historical transactions.
15. The software should always prefer the simplest workflow that matches how the club actually operates.
