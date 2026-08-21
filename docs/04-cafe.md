# Cafe Module

Version: 1.1

Status: Approved

----------------------------------------------------------
Purpose
----------------------------------------------------------

The Cafe module manages all food and beverage sales inside CornerPockets.

The objective is fast billing.

The Cafe module is intentionally simple.

It is NOT:

- Restaurant POS
- Inventory System
- Kitchen Management Software

It exists only to quickly record customer purchases.

----------------------------------------------------------
Responsibilities
----------------------------------------------------------

The Cafe module owns:

- Cafe Orders
- Cafe Purchases

CafeOrder is the only operational Cafe source of truth.

NotebookEntry where section is CAFE is deprecated.

No new operational Cafe data may be created using NotebookEntry.

The Cafe module does NOT own:

- Inventory
- Counter
- Checkout
- Reports
- Financial summaries

Cafe contributes operational records.

Cafe never owns Bill, Received, Due, Cash, GPay, or Business Day totals.

Those come from the Financial Summary Engine.

----------------------------------------------------------
Cafe Philosophy
----------------------------------------------------------

Cafe supports the Snooker Club.

Speed is more important than detailed menu management.

The cashier should be able to add Cafe items within seconds.

If a feature slows down the cashier without significant business value, it should not be added.

----------------------------------------------------------
Cafe Items
----------------------------------------------------------

Cafe supports three item categories.

1.

Cigarette

Input

- Quantity
- Unit Price

Example

Quantity

3

Unit Price

₹30

Total

₹90

----------------------------------------------------------

2.

Water

Input

- Quantity
- Unit Price

Example

Quantity

2

Unit Price

₹10

Total

₹20

----------------------------------------------------------

3.

Food & Beverages

Manual Entry

Input

- Description
- Amount

Example

Description

Sandwich / Maggi / Coca-Cola 750ml

Amount

₹80

The system should not maintain a Food & Beverages menu.

The cashier simply enters the description and amount.

Historical records may still store internal types FOOD or COLD_DRINK; staff UI and Business Summary present both as Food & Beverages.

----------------------------------------------------------
Cafe Orders
----------------------------------------------------------

Cafe Orders may be added:

- During play
- Before payment
- After games
- Even if the customer is not playing Snooker

Cafe Orders always belong to one customer.

Cafe Orders cannot be split.

Cafe Orders may be edited until the Business Day closes.

----------------------------------------------------------
Cafe Payment Model
----------------------------------------------------------

Cafe follows exactly the same payment model as Games.

Every Cafe Order contains:

Amount

Received

Payment Mode

Due

Formula

Due = Amount − Received

Cafe never has its own checkout.

Cafe Orders become part of the customer's combined Business Day financial summary.

That summary may also include Big Snooker and Pool & Mini.

Operationally Cafe remains independent.

Financially Cafe is one part of one customer bill per Business Day.

----------------------------------------------------------
Cafe Purchases
----------------------------------------------------------

Cafe Purchases record money spent purchasing Cafe materials.

This is NOT inventory.

This is simply an expense register.

Fields:

Date

Amount

Description

Vendor (optional)

Payment Mode

Notes (optional)

Example

Date

21 Jul

Amount

₹2,000

Description

Weekly Cafe Purchase

Vendor

D-Mart

Payment Mode

Cash

----------------------------------------------------------
Inventory
----------------------------------------------------------

Inventory management is intentionally out of scope.

The system will NOT manage:

- Stock
- Remaining Quantity
- Recipes
- Ingredients
- Kitchen
- Supplier Stock

If inventory is required in the future it will become its own module.

Cafe Purchases are sufficient for the current business.

----------------------------------------------------------
Business Day Relationship
----------------------------------------------------------

Cafe Orders become part of the Business Day.

Business Day Summary should include:

- Cafe Revenue
- Cafe Orders

Those summary figures come from the Financial Summary Engine.

Business Day History displays Cafe Orders together with Games.

----------------------------------------------------------
Customer Relationship
----------------------------------------------------------

Cafe Orders appear inside the Customer Timeline as part of the combined Business Day summary.

Business Day cards should summarize Cafe items.

Customer Timeline financial figures come from the Financial Summary Engine.

Detailed verification always happens through:

View Business Day

----------------------------------------------------------
Reporting
----------------------------------------------------------

Cafe does not own a separate Reports page.

Cafe contributes data to the central Reports module.

Cafe sales and payment totals shown in Reports come from the Financial Summary Engine.

Reports should display:

Cafe Sales

Cafe Purchases

Estimated Profit

Cash Revenue

GPay Revenue

Number of Orders

Average Cafe Bill

Top Cafe Customers

Most Frequently Purchased Items

Supported filters:

- Today
- Yesterday
- This Week
- This Month
- Custom Date Range

Estimated Profit is calculated as:

Cafe Sales

minus

Cafe Purchases

This is only an estimate.

The system does not calculate inventory cost.

----------------------------------------------------------
Design Principles
----------------------------------------------------------

1.

Keep Cafe simple.

2.

Fast billing is more important than menu management.

3.

No restaurant workflows.

4.

No inventory.

5.

Cafe Purchases are expenses.

6.

Cafe follows the same payment model as Games.

7.

CafeOrder is the only operational Cafe source of truth.

8.

Cafe never owns financial summaries.

9.

Reports belong to the Reports module.

----------------------------------------------------------
Future Features
----------------------------------------------------------

Postponed:

- Inventory
- Stock Tracking
- Supplier Management
- Recipe Management
- Kitchen Display
- Barcode Scanner

These features must not complicate the current Cafe workflow.

----------------------------------------------------------
Final Principle
----------------------------------------------------------

The Cafe module should allow the cashier to record sales in a few seconds.

The owner should always be able to answer:

- How much Cafe revenue did we generate?
- How much did we spend on Cafe purchases?
- What is the estimated Cafe profit?
- How much was received in Cash?
- How much was received in GPay?

Everything should be available through the Reports module without manual calculations.

End of Document.
