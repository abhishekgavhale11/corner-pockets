# CornerPockets Operating System (CPOS)

Version: 2.1

Status: Approved

This document is the single source of truth for the CornerPockets Operating System (CPOS).

Every business rule, implementation decision and future module must follow the philosophy defined in this document.

If any implementation conflicts with this document, this document takes precedence.

---

# 1. What is CPOS?

CPOS (CornerPockets Operating System) is software built specifically for operating CornerPockets Snooker Club.

It is not a generic Point of Sale software.

It is not accounting software.

It is not inventory software.

It is the complete operating system used to run the club every day.

Its responsibility is to simplify daily operations while maintaining complete financial accuracy.

The software should feel exactly like an experienced cashier operating the club.

---

# 2. Core Philosophy

CPOS follows one principle.

> The cashier makes every business decision.
> CPOS records and calculates.

The software never makes business decisions.

It never decides:

• Who should pay
• How much someone should pay
• Which frame gets paid first
• How payments should be allocated

The cashier decides.

Operational modules record operational data.

The Financial Summary Engine calculates financial summaries.

There is only one place allowed to calculate Bill, Received, Due, Cash, GPay, Outstanding Created, and Outstanding Remaining.

---

# 3. Simplicity First

CPOS always prefers simplicity over cleverness.

If there are two possible solutions:

Choose the simpler one.

The software is built for speed.

The cashier should never stop and think.

Every workflow should feel natural.

---

# 4. Operational Workflow

Every operational day follows exactly the same flow.

Business Day

↓

Counter

↓

Customer

↓

Cafe

↓

Outstanding

↓

Business Day History

↓

Reports

Every module has one responsibility.

No module should duplicate another module's work.

Operational modules must never perform their own financial aggregation.

---

# 5. Business Day

Business Day is the operational boundary.

Everything belongs to one Business Day.

Every Frame

Every Cafe Order

Every Outstanding

Every Report

belongs to exactly one Business Day.

Business Day is opened manually.

Business Day is closed manually.

The system never closes automatically.

Closing a Business Day finalizes that day's operations.

---

# 6. Counter

The Counter is today's notebook.

Nothing more.

The Counter is where the cashier records today's operations.

The Counter owns:

• Frames
• Payments
• Customer Assignment
• Split Frames
• Cafe Orders

The Counter never owns:

• Outstanding Collection
• Reports
• History
• Financial aggregation (Bill, Received, Due, Cash, GPay totals)

The Counter records operational charges and payments.

The Counter displays financial summaries produced by the Financial Summary Engine.

The Counter only shows the currently OPEN Business Day.

---

# 7. Frames

Frames represent games played inside the club.

Supported Games

• Individual

• Singles

• Shuffle

• Rummy

Frames support Split.

Each contributor owns:

Amount

Received

Payment Mode

Due

Every contributor is independent.

Split represents ownership.

Split does not represent payment allocation.

---

# 8. Cafe

Cafe behaves exactly like Frames.

The only difference is:

Cafe does NOT support Split.

CafeOrder is the only operational Cafe source of truth.

NotebookEntry where section is CAFE is deprecated.

No new operational Cafe data may be created using NotebookEntry.

A Cafe Order contains:

Customer

Item

Quantity

Amount

Received

Payment Mode

Due

Customers may purchase Cafe items without playing.

Cafe Orders follow the same payment rules as Frames.

Cafe contributes operational records to the customer's combined Business Day financial summary.

Cafe never owns financial summaries.

---

# 9. Payment Model

Frames and Cafe use exactly the same payment model.

Every operational record contains:

Amount

Received

Payment Mode

Due

Formula

Due = Amount − Received

Due is never stored on operational records.

Line Due follows this formula.

Customer-day and Business Day totals for Bill, Received, Due, Cash, and GPay are calculated only by the Financial Summary Engine.

Supported Payment Modes

Cash

GPay

If Received = 0

Payment Mode becomes Unassigned.

If Received > 0

Payment Mode becomes mandatory.

There is:

No FIFO

No automatic allocation

No settlement engine

No hidden payment logic

---

# 10. Combined Customer Financial Summary

One Customer

↓

One Combined Financial Summary

↓

Per Business Day

The summary may contain operational records from:

• Big Snooker

• Pool & Mini

• Cafe

Operational modules remain independent.

Financially they become one combined customer bill.

The customer should never have separate bills per module.

---

# 11. Financial Summary Engine

The Financial Summary Engine is the only place allowed to calculate:

• Bill

• Received

• Due

• Cash

• GPay

• Outstanding Created

• Outstanding Remaining

Operational modules own operational records.

Examples:

• Counter

• Frames

• Cafe

• Pool & Mini

They contribute data.

They never invent their own Bill, Received, or Due totals.

The Financial Summary Engine owns:

• Customer Business Day financial summaries

• Business Day financial summaries

• Customer Drawer financial totals

• Outstanding Created and Outstanding Remaining calculations used by History, Timeline, and Reports

Every screen that shows Bill, Received, Due, Cash, GPay, or Outstanding totals must consume the Financial Summary Engine.

No second aggregation path is allowed.

---

# 12. Customer

Customers own their financial relationship with the club.

Customer Page owns:

Outstanding Collection UI

Balance History display

Customer Information

Customer Timeline display

The Customer module never calculates financial data.

It consumes the Financial Summary Engine.

Customer Timeline, Outstanding figures, Balance History, and Business Day summaries shown on the Customer page must all be produced from the Financial Summary Engine.

The Customer page never edits Frames.

The Customer page never edits Cafe Orders.

Customer information is simple.

Name

Mobile Number

Status

Customers are never deleted.

Only deactivated.

---

# 13. Outstanding

Outstanding is customer debt.

Outstanding is created only when a Business Day closes.

Outstanding is never created during normal Counter operations.

Outstanding Balance

increases

when a Business Day closes with unpaid amounts.

Outstanding Balance

decreases

when the customer pays later.

The cashier always collects the total Outstanding.

The cashier never chooses individual records.

---

# 14. Business Day History

Business Day History is the audit system.

Every closed Business Day becomes read only.

Business Day History shows:

Business Summary

Counter Snapshot

Cafe Orders

Outstanding Created

Business Summary figures come from the Financial Summary Engine.

Nothing inside Business Day History can be edited.

Business Day History always represents exactly what happened on that day.

---

# 15. Balance History

Every customer has a Balance History.

Balance History explains:

How the customer's balance increased.

How the customer's balance decreased.

Business Day Close

increases balance.

Outstanding Collection

decreases balance.

The running Outstanding Balance should always be understandable.

Balance History figures come from the Financial Summary Engine.

---

# 16. Design Principles

CPOS follows these rules.

1.

One screen.

One responsibility.

2.

One module.

One owner.

3.

No duplicated business logic.

4.

One Financial Summary Engine.

No second Bill, Received, or Due calculator.

5.

Historical data is read only.

6.

The software behaves like the club's notebook.

7.

Financial history must always be traceable.

8.

Every operational record belongs to one Business Day.

9.

The cashier should understand every screen within seconds.

10.

Prefer simple workflows over complex automation.

11.

Never hide financial calculations.

---

# 17. Current Modules

Business Day

Counter

Customer

Frames

Cafe

Pool & Mini

Outstanding

Business Day History

Reports

Financial Summary Engine

Future modules may be added later.

---

# 18. Future Modules

The following modules are intentionally postponed.

Wallet

Inventory

Membership

Notifications

Analytics

Settings

These modules must never complicate the existing operational workflow.

---

# 19. Non Goals

CPOS is NOT:

Accounting Software

ERP

Restaurant POS

Inventory Software

Billing Software for multiple businesses

Generic POS

CPOS exists only to operate CornerPockets Snooker Club.

Every future feature must support this objective.

---

# 20. Reporting Philosophy

Reports are the only place where business analytics are displayed.

Operational modules should never own reporting screens.

Modules own operational data.

The Financial Summary Engine owns financial totals.

Reports own analytics presentation.

Examples:

- Counter owns today's operations.
- Business Day owns the operational day boundary.
- Customer owns the customer relationship and Outstanding collection UI.
- Cafe owns Cafe Orders and Cafe Purchases.
- The Financial Summary Engine owns Bill, Received, Due, Cash, GPay, and Outstanding totals.
- Reports owns business analytics screens.

Every report must support the same date filters:

- Today
- Yesterday
- This Week
- This Month
- Custom Date Range

The owner should never visit multiple pages to understand the business.

Reports should provide one complete business summary.

---

# 21. Payment Reporting Philosophy

Payment method reporting is mandatory.

Every report must classify money by payment method.

Supported payment methods:

- Cash
- GPay

Where applicable, every report should display:

Revenue

Cash

GPay

Examples:

Overall Business

Snooker

Cafe

Outstanding Collections

The owner should immediately know:

- Total Revenue
- Cash Received
- GPay Received
- Outstanding Collected
- Outstanding Remaining

No manual calculations should ever be required.

Report totals must come from the Financial Summary Engine.

---

# 22. Final Principle

If a feature makes the cashier think too much...

it is probably the wrong feature.

CPOS should always feel faster than using a notebook.

The software exists to reduce mistakes, reduce manual calculations, and make running the club easier.

Every future decision should follow this philosophy.

End of Document.
