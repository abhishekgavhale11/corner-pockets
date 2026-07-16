# CornerPockets POS

# Project Vision

## Purpose

CornerPockets POS is not intended to be a generic Point of Sale software.

It is being built specifically around the real workflow of a Snooker Club and its day-to-day operations.

The objective is to build software that behaves exactly like an experienced counter staff member who understands how the club operates.

The software should reduce mistakes, simplify operations, and provide complete financial visibility while remaining easy for staff to use.

---

# Long-Term Vision

The final system should manage the complete business.

It should not only generate bills but also help run the entire club.

The system will eventually include:

- Customer Management
- Visit Management
- Counter Operations
- Checkout
- Ledger
- Outstanding Management
- Wallet
- Cafe
- Inventory
- Business Day
- Reports
- Analytics
- Memberships
- Settings

Every module should work together without duplicating responsibilities.

---

# Business Philosophy

The software should always prefer simplicity over complexity.

Every feature should have one clear owner.

Examples:

- Checkout owns Active Visit payments.
- Customer Page owns Outstanding payments.
- Ledger owns finalized financial history.
- Inventory owns stock.
- Reports own analytics.

No responsibility should exist in multiple places.

---

# Financial Philosophy

The most important requirement is financial correctness.

- Money should never disappear.
- Money should never be silently modified.
- Every financial event should be traceable.
- Financial history must always be understandable months later.

The Ledger is a finalized financial journal.

It is NOT a live activity feed.

---

# Counter Philosophy

The counter is a working area.

- Customers arrive.
- Customers play.
- Frames are assigned.
- Cafe items are added.
- Bills are edited.
- Payments may happen.

Nothing becomes permanent until the visit is finished.

---

# Staff Experience

The software should feel natural.

Staff should never need to think about database concepts.

They should simply operate the club.

The software should guide them naturally.

Every screen should have one clear responsibility.

---

# Customer Experience

Customers should receive correct bills.

Partial payments should work naturally.

Outstanding balances should always be correct.

Wallet balances should always be correct.

Financial disputes should be easy to resolve because the Ledger preserves complete history.

---

# Operational Vision

At any point I should know exactly what is happening in my business.

Examples:

- Who is currently playing?
- Which tables are occupied?
- Who has outstanding payments?
- Which customers use wallets?
- Who are my top customers?
- What is today's revenue?
- What is this month's revenue?
- What was today's cafe revenue?
- What inventory is remaining?
- Which products are selling most?
- Which tables generate the highest revenue?
- How much was collected in Cash?
- How much was collected through GPay?
- How much came from Wallet?
- How much Outstanding was recovered?
- How much Outstanding still remains?
- How much money is physically expected in the cash drawer?

Everything should be available without manual calculations.

---

# Cafe Vision

The Cafe should become a complete business module.

It should manage:

- Menu
- Cafe Orders
- Cafe Revenue
- Popular Items
- Inventory
- Purchases
- Stock Consumption
- Remaining Stock
- Profit Estimation
- Wastage
- Supplier Purchases (future)

---

# Inventory Vision

Every stock movement should be recorded.

Examples:

- Purchase
- Sale
- Adjustment
- Damage
- Wastage

The system should always know current stock.

Eventually inventory should automatically reduce whenever cafe items are sold.

---

# Business Day Vision

A business day is not necessarily a calendar day.

The club currently operates approximately:

```
10:00 AM
    ↓
Next Day 6:00 AM
```

This operational day should become one Business Day.

At the end of every Business Day I should be able to review and close the day's business.

Business Day design is still pending.

---

# Reporting Vision

At the end of every day, week, month, or year I should be able to answer questions like:

- How much revenue did we earn?
- How much came from Snooker?
- How much came from Cafe?
- How much Cash was collected?
- How much GPay was collected?
- How much Wallet was used?
- How much Outstanding was recovered?
- How much Outstanding is still pending?
- How much inventory was sold?
- What products sold the most?
- Who are my highest value customers?
- Which tables generate the most revenue?
- What are my busiest hours?
- What is the average spend per visit?

The system should provide these answers automatically.

---

# Development Philosophy

We build one module at a time.

Each module follows this process:

```
Discuss
    ↓
Challenge assumptions
    ↓
Finalize Business Rules
    ↓
Update Product Specification
    ↓
Implement
    ↓
Test
    ↓
Complete
```

Only after a module is stable do we move to the next one.

---

# Final Goal

The final software should become the complete operating system for my Snooker Club.

I should be able to run the entire business using this software.

From opening the club in the morning...

to closing the Business Day at night...

everything should be managed from one place.

At any time I should know:

- What happened.
- Why it happened.
- Who did it.
- How much money was involved.
- Where every rupee came from.
- Where every rupee went.

The software should become something I can confidently run my business on for many years.
