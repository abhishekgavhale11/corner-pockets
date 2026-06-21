# Architecture

See README.md for setup. Phase 1 wallet management for Corner Pockets Snooker Club.

## Phase 1 Scope

- Staff login (credentials)
- Customer registration (auto Card ID, optional student status)
- Customer search (name, phone, card ID)
- Customer detail with Recharge / Deduct / Transactions actions
- Predefined recharge plans (Student vs Club wallet)
- Manual deduction with confirmation
- Immutable transaction ledger

## Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Presentation | `src/app`, `src/components` | Staff UI |
| Application | `src/actions` | Server actions |
| Domain | `src/models`, `src/lib/validators`, `src/lib/constants` | Rules & data |
| Infrastructure | `src/lib/db`, `src/lib/auth` | MongoDB, auth |

## Recharge Plans

Plans are defined in `src/lib/constants/recharge-plans.ts`. Staff select a plan; the server validates plan type against customer `isStudent` and credits the bonus automatically.

## Wallet Integrity

All balance changes run inside MongoDB transactions. Deductions reject amounts exceeding balance.

## Card IDs

Sequential IDs (`CP0001`, `CP0002`, …) via atomic counter in `Counter` collection.
