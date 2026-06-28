# Corner Pockets Business Rules v1.1

## Counter • Billing • Due • Outstanding • Ledger

## Objective

The goal of the billing engine is to replace the physical notebook while remaining simple, accurate and fully auditable.

The software should always tell the staff:

* What the customer played.
* What the customer consumed.
* How much the customer owes today.
* How much has been paid.
* Whether the customer still has a Due amount.
* Whether that Due has become an Outstanding balance.

No money movement should ever be lost.

---

# 1. Core Philosophy

The software revolves around a **Visit**.

Every time a customer comes to the club, a new Visit is created.

Every Visit has exactly one Bill.

The Bill contains everything during that visit:

* Big Snooker
* Mini Snooker
* Pool
* Cafe
* Cigarettes
* Water
* Food
* Coffee
* Any future items

There should never be separate Game Bills and Cafe Bills.

There is only one Visit Bill.

---

# 2. Counter Responsibilities

The Counter only manages today's Visit.

The Counter should never manage previous Outstanding balances.

The Counter is responsible for:

* Creating game entries
* Adding cafe items
* Assigning customer
* Showing today's bill
* Showing payments received today
* Showing today's Due
* Continuing the visit until it is closed

---

# 3. Visit Bill

Each Visit automatically creates one Bill.

The Bill consists of:

Game Charges

+

Cafe Charges

=

Total Bill

The system automatically calculates:

* Total Bill
* Total Paid
* Due Amount

Example:

Game ₹500

Cafe ₹200

---

Bill ₹700

Paid ₹500

Due ₹200

---

# 4. Payments

Payments always belong to the current Visit.

Customers may pay multiple times.

Example:

Bill ₹700

Payment 1 ₹200

Payment 2 ₹300

Paid ₹500

Due ₹200

Payments reduce the Visit Bill.

They never directly modify Outstanding.

---

# 5. Due

Due means:

Money still unpaid during today's Visit.

Examples:

Customer is still playing.

Customer has gone outside for smoking.

Customer will return after dinner.

Customer is sitting with friends.

During these situations:

The amount remains Due.

It is NOT Outstanding.

---

# 6. Counter Display

When hovering over a customer, the staff should immediately see:

Customer Name

Today's Bill

Paid Today

Due Today

Below the summary, show the complete breakdown.

Example:

Rahul

Bill ₹700

Paid ₹500

Due ₹200

---

18:10 Singles ₹160

18:25 Individual ₹180

18:45 Shuffle ₹160

19:00 Gold Flake ₹20

19:05 Water ₹20

19:20 Chicken Sandwich ₹160

The breakdown explains how the bill was created.

The summary explains how much remains to be collected.

---

# 7. Partial Payments

Partial payments are allowed at any time.

Example:

Bill ₹700

Paid ₹300

Due ₹400

Later

Paid ₹200

Due ₹200

Later

Paid ₹200

Due ₹0

The system recalculates Due automatically after every payment.

---

# 8. Closing Process

During business hours the software only tracks Due.

Outstanding is NOT created immediately.

At Closing Time the system should show:

Customers with Due

Example:

Rahul ₹200

Mohit ₹100

Vishal ₹350

Staff reviews the list.

For each customer:

Convert Due → Outstanding

Only after confirmation does the Due become Outstanding.

This prevents accidental Outstanding balances during the day.

---

# 9. Outstanding

Outstanding belongs to the Customer.

Outstanding does not belong to today's Visit.

Outstanding is managed from the Customer page.

The Counter should never automatically merge previous Outstanding into today's Bill.

Today's Visit remains independent.

---

# 10. Customer Page

Customer page should display:

Customer Details

Phone Number

Visit Count

Lifetime Spend

Wallet Balance

Outstanding Balance

Last Visit

Current Visit (if active)

Buttons:

Collect Outstanding

View Ledger

View Visits

Edit Customer

WhatsApp Customer

---

# 11. Ledger

The Ledger is the complete financial history of the customer.

Nothing should ever be deleted.

Nothing should ever be overwritten.

Every event should be appended.

The Ledger should include:

Game Added

Cafe Item Added

Payment Received

Due Converted to Outstanding

Outstanding Paid

Wallet Recharge

Wallet Payment

Refund

Bill Edited (with old value and new value)

Reversal

Every entry should contain:

* Date
* Time
* Customer
* Visit ID
* Bill ID
* Staff User
* Action
* Description
* Amount
* Payment Method (if applicable)
* Running Outstanding Balance

Example:

27 Jun 18:10

Game Added

Singles

₹160

---

27 Jun 18:20

Cafe Added

Gold Flake Kings

₹20

---

27 Jun 19:00

Payment Received

Cash

₹200

---

27 Jun Closing

Due Converted to Outstanding

₹140

---

30 Jun

Outstanding Paid

GPay

₹140

---

# 12. Ledger Filters

Ledger should support filters for:

* All
* Games
* Cafe
* Cigarettes
* Food
* Payments
* Outstanding
* Refunds
* Wallet
* Date Range
* Visit

This allows future reporting without changing the database.

Examples:

How many cigarettes Rahul purchased.

Total cafe spending.

Total games played.

Lifetime spending.

Outstanding history.

Payment history.

---

# 13. Future Reporting Support

Because every event is stored in the ledger, future reports can be generated without changing business logic.

Examples:

* Lifetime Spend
* Visit Frequency
* Average Spend Per Visit
* Favourite Game
* Favourite Table
* Cafe Revenue
* Cigarette Sales
* Outstanding History
* Top Customers
* Customers Not Visited in 30 Days

---

# 14. Golden Rules

1. One Visit = One Bill.

2. One Bill contains both Game and Cafe.

3. Payments always reduce the Visit Bill.

4. Due exists only during the current business day.

5. Outstanding is created only during Closing after staff confirmation.

6. Counter manages Today's Visit.

7. Customer Page manages Lifetime Relationship.

8. Ledger is append-only.

9. No financial record is ever deleted.

10. Every money movement must always be traceable.
