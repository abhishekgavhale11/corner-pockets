# CornerPockets Operating System (CPOS)

Version: 2.2

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

Business Day History

↓

Reports

Every module has one responsibility.

No module should duplicate another module's work.

Operational modules must never perform their own financial aggregation.

Outstanding is not a standalone module. Customers with Outstanding are identified via the Outstanding filter on the Customers page. Collection remains on Customer Details.

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

Business Day Close is a protected financial operation.

Business Day Close must either:

Complete successfully

OR

Leave the system completely unchanged.

Partial Business Day Close is never allowed.

Business Day Close must never continue if financial validation fails.

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

# 7a. Pricing (Rate Card)

CPOS uses a fixed club rate card for new Frames and hourly sessions.

Happy Hour windows (Asia/Kolkata):

• Monday–Friday: 10:00 AM – 4:00 PM

• Saturday–Sunday: 10:00 AM – 2:00 PM

The cashier chooses Regular or Happy Hour when billing. CPOS does not auto-switch rates from the clock.

Base rates (₹):

• Big Snooker Per Frame (Singles): Regular 160 · Happy Hour 130

• Big Snooker Individual: Regular 190 · Happy Hour 150

• Shuffle: Regular 120 · Happy Hour 100

• Mini Snooker (hourly): Regular 260 · Happy Hour 220

• Pool (hourly): Regular 240 · Happy Hour 200

Extra Player is never calculated automatically. When applicable, staff enter the Extra Player fee manually during billing.

The amount resolved at create time is stored on the Frame / session. Historical bills keep their original amounts after rate-card updates.

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

Payment Mode becomes mandatory (Cash or GPay).

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

## Financial Summary Principle

During an OPEN Business Day, operational modules may compute temporary values to support cashier workflows.

After a Business Day is CLOSED, all financial views must derive their values from the shared Financial Summary calculations. No module may implement its own Bill, Received, Due, Cash, GPay, or Outstanding aggregation logic.

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

If two screens display the same financial metric, they must never calculate it independently. They must consume the same shared aggregation service.

Business Day Close is the financial boundary. After a Business Day is closed, all financial screens must consume the same finalized financial summaries. No module may perform independent financial aggregation of finalized data.

At Business Day Close, the Financial Summary Engine runs once and persists an immutable **Business Day Final Summary**. That record is the financial truth of the closed day (Bill, Paid, Due, Cash, GPay, Outstanding Created, Outstanding Collected, and per-customer settlements). It is never updated when Outstanding Remaining changes after close.

Outstanding remains the live customer ledger for collections. History, Timeline, Lifetime Paid, and Reports read finalized totals from the Business Day Final Summary. Operational collections may still supply drill-down detail (frame lines, cafe items, timestamps) but must not re-derive finalized totals after Close.

---

# 12. Customer

Customers own their financial relationship with the club.

Customer Page owns:

Outstanding Collection UI

Balance History display

Customer Information

Customer Timeline display

Customer Summary display

The Customer module never calculates financial data.

It consumes the Financial Summary Engine.

Customer Timeline, Outstanding figures, Balance History, and Business Day summaries shown on the Customer page must all be produced from the Financial Summary Engine.

The Customer page never edits Frames.

The Customer page never edits Cafe Orders.

Customer Details page summary fields are:

Customer Name

Phone Number

Member Status

Last Visit

Current Outstanding

Total Visits

Lifetime Paid

Current Outstanding come from the Financial Summary Engine.

Total Visits represents the number of unique Business Days on which the customer visited the club.

Total Visits rules:

- One Business Day = One Visit.
- Multiple visits during the same Business Day count as a single visit.
- Only finalized (closed) Business Days contribute.
- Display as a whole number.

Lifetime Paid represents the total finalized money received from the customer throughout their relationship with the club.

Lifetime Paid includes:

- Cash
- GPay

Lifetime Paid excludes:
- Pending/Open Business Day payments
- Opening Outstanding
- Outstanding amounts not yet collected

Lifetime Paid is derived from finalized financial records.

Customer information is simple.

Name

Surname

Mobile Number

Status

Customer page sensitive value behavior:

- Lifetime Paid is hidden by default.
- An Eye icon reveals or hides Lifetime Paid.
- This is a UI-only feature.
- No business logic or financial calculations change.

Customers page footer summary:

- Total Outstanding

Customers page footer rules:

- Totals are calculated from the currently visible customer list.
- Search and filters affect these totals.
- Hidden by default.
- One Eye icon reveals or hides both values together.
- This is a presentation feature only.

Customers page sorting supports:

- Customer Name
- Outstanding

Customers page sorting rules:

- Clicking a column toggles ascending and descending order.
- Sorting is numeric for monetary values.
- Sorting never changes business data.
- Sorting only affects presentation.

Customers are never deleted.

Only deactivated.

---

# 13. Outstanding

Outstanding is customer debt.

Outstanding is created when a Business Day closes with unpaid amounts.

Outstanding may also be created once per customer as Opening Outstanding — an Admin-only migration for debt that existed before CPOS went live.

Opening Outstanding:

• Does not create a Business Day, Frame, Cafe Order, or Payment

• Immediately increases Current Outstanding

• Participates in normal Outstanding Collection (FIFO) like any other Outstanding row

• Is never counted as Today's Bill, Revenue, Due, or Outstanding Created for any Business Day

• Is a historical baseline included in Closing Outstanding and Current Outstanding

Outstanding is never created during normal Counter operations.

Outstanding Balance

increases

when a Business Day closes with unpaid amounts,

or when Admin records Opening Outstanding.

Outstanding Balance

decreases

when the customer pays later.

The cashier always collects the total Outstanding.

The cashier never chooses individual records.

CPOS must never create, lose or incorrectly assign customer debt.

At Business Day Close:

Every Due amount must belong to exactly one customer.

Outstanding is created only from the validated Due amounts of the Business Day.

The total Outstanding created must equal the total Due of the Business Day.

If these conditions cannot be proven, Business Day Close must fail.

Current Outstanding identity:

Current Outstanding
=
Opening Outstanding
+ Business Day Outstanding Created
− Outstanding Recovered

---

# Expenses

Expenses records money spent while operating the club.

Expenses is completely independent from Business Day.

Expenses never affect Counter, Customers, Outstanding, or Business Day History.

Only two categories exist:

- Cafe
- Snooker & Other

Payment methods:

- Cash
- GPay

Expenses exist so Reports can later calculate business expenses and estimated profit.

Do not build reporting screens inside the Expenses module.

---

# 14. Business Day History

Business Day History is the audit system.

Every closed Business Day becomes read only.

Business Day History explains what happened during that Business Day.

Business Day History contains:

Business Summary

Games Summary

Cafe Summary

Customer Settlement Summary

Counter Snapshot

• Big Snooker

• Pool & Mini

Cafe Snapshot

Business Summary is the complete Business Day total.

Games Summary combines Big Snooker, Pool and Mini Snooker.

Cafe Summary covers Cafe only.

Business Summary / Business Performance may include Outstanding Created as a day or range total.

Club Outstanding (End of Day) is the club receivable when that Business Day closed. It is historical for that day and must not change when later collections occur. It is not shown as a column on the Business Day History list.

Outstanding Recovered is not part of that day's business. It is recovery of prior Outstanding via the Customer page. It must not appear inside Business Performance (Revenue / Business Collection / Outstanding Created). History exposes collections on a dedicated Outstanding tab (Outstanding Collection Ledger), filtered by OutstandingCollection time — never mixed into Revenue or Business Collection.

Business Day History must not display individual Outstanding debt records. Collection ledger rows are OutstandingCollection events only.

Business Day History must not expose internal Outstanding implementation details.

Outstanding management belongs to the Customer module.

Business Summary figures come from the Financial Summary Engine.

Nothing inside Business Day History can be edited.

Business Day History always represents exactly what happened on that day.

---

# 15. Balance History

Every customer has a Balance History.

Balance History explains:

How the customer's balance increased.

How the customer's balance decreased.

Opening Outstanding

increases balance (Admin migration baseline).

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

Never hide financial calculations inside the system logic.

12.

Sensitive financial values may be hidden by default in the UI.

13.

The Eye icon is used to reveal or hide sensitive values.

14.

Tables may support click-to-sort.

15.

Summary totals always reflect the currently displayed dataset.

16.

UI enhancements must never change business logic or financial calculations.

17.

Operational speed is preferred over visual complexity.

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
- Expenses owns the club expense register (independent of Business Day).
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

Outstanding

Identity:

Revenue = Cash + GPay + Outstanding

Examples:

Overall Business

Snooker

Cafe

Customer Settlement

Outstanding Collections (Cash / GPay only)

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
