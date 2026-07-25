# Customer Module

Version: 1.1

Status: Approved

---

# Purpose

The Customer module manages the lifetime relationship between the customer and the club.

It is not a Counter.

It is not Business Day History.

It is not Checkout.

The Customer page exists to answer questions about a customer quickly.

The cashier should be able to understand the customer's financial relationship and visit history within a few seconds.

---

# Responsibilities

The Customer module owns:

- Customer Information
- Outstanding Collection UI
- Customer Timeline display
- Balance History display

The Customer module does NOT own:

- Counter
- Business Day
- Checkout
- Reports
- Financial calculations

The Customer module never calculates Bill, Received, Due, Cash, GPay, Outstanding Created, or Outstanding Remaining.

It consumes the Financial Summary Engine.

Customer Timeline, Outstanding, Balance History, and Business Day summaries on the Customer page must all be produced from the Financial Summary Engine.

---

# Customer Summary

The left panel displays a quick summary.

Current fields:

- Customer Name (Name + Surname)
- Outstanding
- Phone Number
- Member Status
- Last Visit

Future fields:

- Total Visits
- Lifetime Spend
- Favorite Game
- Membership
- Wallet

Outstanding displayed here is always the customer's current Outstanding balance.

That figure comes from the Financial Summary Engine.

---

# Outstanding

Outstanding represents the amount currently owed by the customer.

Outstanding increases only when a Business Day closes with Due remaining.

Outstanding decreases only when Outstanding is collected.

Outstanding is never edited manually.

Outstanding is never collected from Checkout.

Outstanding collection belongs to the Customer module.

Outstanding totals come from the Financial Summary Engine.

---

# Collect Outstanding

Outstanding can only be collected from the Customer page.

Customers with Outstanding are shown via the Outstanding filter on the Customers page.

It never collects payment.

Selecting a customer opens the Customer page.

Cashier enters:

- Amount
- Payment Mode

Supported payment methods:

- Cash
- GPay

Collection immediately updates:

- Outstanding Balance
- Customer Timeline

Outstanding Collection never modifies Business Day History.

---

# Customer Timeline

The Customer Timeline is the heart of the Customer module.

It tells the customer's complete story.

The timeline supports two modes.

---

# Timeline Modes

## 1. All Activity (Default)

Purpose:

Show every completed interaction between the customer and the club.

Includes:

- Every closed Business Day
- Every Outstanding Collection

Business Days are displayed even when:

Today's Due = ₹0

Reason:

Customers often ask:

"I came yesterday and paid everything."

The cashier should immediately see that visit without opening Business Day History.

---

## Fully Paid Business Day

If:

Today's Due = ₹0

Display:

✓ Paid in Full

instead of Outstanding movement.

No Previous Outstanding.

No Current Outstanding.

The visit did not affect the customer's Outstanding balance.

---

## Outstanding Business Day

If:

Today's Due > ₹0

Display:

Games Summary

Cafe Summary

Bill

Paid

Due

Outstanding Movement

Bill, Paid, Due, and Outstanding Movement come from the Financial Summary Engine.

Example

Outstanding

₹600

↓

₹900

This explains how the customer's balance increased.

---

## Outstanding Collection

Outstanding Collection always appears in the timeline.

Display:

Collected Amount

Payment Mode

Collected By

Outstanding Movement

Example

Outstanding

₹900

↓

₹500

This explains how the customer's balance decreased.

---

# Balance History

Balance History is a filtered view of the Customer Timeline.

Purpose:

Show only events that changed the customer's Outstanding.

Includes:

- Business Days where Due > ₹0
- Outstanding Collections

Excludes:

- Fully Paid Business Days

This creates a clean financial passbook.

---

# Timeline Philosophy

The Customer Timeline answers two different questions.

Operational

"When did this customer visit?"

Answered by:

All Activity

Financial

"Why is this customer's Outstanding this amount?"

Answered by:

Balance History

Both views use the same underlying timeline.

Only the filtering changes.

---

# Business Day Relationship

Operational modules own:

- Frames
- Cafe Orders
- Pool & Mini records
- Payments recorded on those records

The Financial Summary Engine owns:

- Bill
- Received
- Due
- Cash
- GPay
- Outstanding Created
- Outstanding Remaining

For each customer, per Business Day, there is one combined financial summary.

It may include Big Snooker, Pool & Mini, and Cafe.

Customer page never edits Business Day.

Customer page only displays summaries from the Financial Summary Engine.

Detailed verification always happens through:

View Business Day

---

# View Business Day

Every Business Day card contains:

View Business Day

Selecting it opens the complete Business Day History.

Business Day History remains the detailed audit.

Customer Timeline remains the readable summary.

---

# UI Philosophy

The Customer page is designed for speed.

The cashier should not perform mental calculations.

Every card should immediately explain:

- What happened
- How it affected Outstanding
- Current financial state

The UI should feel like:

- A bank passbook
- A financial timeline

NOT

- A dashboard
- A report

The timeline should display many events on one screen while remaining easy to read.

Business Day cards should be compact.

Outstanding Collection cards should be compact.

Visual hierarchy should prioritize information over decoration.

---

# Design Principles

The Customer page follows these principles.

1.

One page.

One responsibility.

2.

Business Day History is the audit.

Customer Timeline is the story.

3.

Never duplicate Business Day details.

Only summarize.

4.

Never calculate financial totals on the Customer page.

Consume the Financial Summary Engine.

5.

Outstanding belongs to the customer.

Never to the Counter.

6.

The cashier should understand the customer's relationship with the club within seconds.

---

# Future Features

The following are intentionally postponed.

- Wallet
- Membership
- Customer Notes
- Customer Tags
- Lifetime Spend Analytics
- Favorite Games
- WhatsApp
- Loyalty Program

These features must never complicate the Customer workflow.

---

# Final Principle

The Customer page should answer every question a cashier or customer may ask.

Examples:

How much does this customer owe?

When did the balance increase?

When did the customer pay Outstanding?

Did the customer pay in full yesterday?

What did the customer play?

How much did they spend?

The Customer page should become the customer's passbook.

Business Day History remains the complete audit.

Customer Timeline remains the readable story.

End of Document.
