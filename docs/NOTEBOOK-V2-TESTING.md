# Corner Pockets — Density & Counter UX Testing

**Login:** `rahul` / `corner123`

## Density targets

- [ ] Counter: 25–30 ledger rows visible on laptop without scrolling
- [ ] Checkout: 15–20 pending customers visible
- [ ] Customers: 15–20 rows visible
- [ ] Customer timeline: 20+ events visible (single-line statement rows)

## Sidebar

- [ ] 14px font, clear icons, premium feel
- [ ] STAFF: Counter, Checkout, Customers
- [ ] MASTER+: Admin

## Counter

- [ ] Pill tabs: Big Snooker, Pool & Mini, Cafe
- [ ] Single-line rows: `time  name  type  ₹amount  badge`
- [ ] Quick + Singles / + Individual / + Shuffle (instant, no popup)
- [ ] + Rummy opens form: 3/4/5/Custom players + editable amount
- [ ] Tap pending Rummy row (type or amount) to edit players / price
- [ ] Click unassigned → assign customer (timestamp preserved)
- [ ] ✕ cancel → `✖ CANCELLED` (entry preserved)

## Checkout

- [ ] Compact rows: `▶ Name  ₹amount  count`
- [ ] Click expands inline (no drawer)
- [ ] Grouped items + Cash/GPay/Wallet
- [ ] Confirm step: Customer, Method, Amount
- [ ] Collapses after settlement

## Reversals

- [ ] Settlement reversal → `↺ REVERSED` on Counter
- [ ] Timeline shows: `✓ Paid` → `↺ Reversed` → `✓ Paid` again
- [ ] Reversal rows highlighted amber

## Customer detail

- [ ] 30% left panel: identity, wallet, notes, actions
- [ ] 70% right: activity timeline dominates
- [ ] Timeline = bank statement style (not cards)

## Cafe

- [ ] Quantity controls per item
- [ ] Merged pending entries (no duplicates)

## Build

```bash
npm run build
```
