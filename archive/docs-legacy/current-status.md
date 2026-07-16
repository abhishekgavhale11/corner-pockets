# Corner Pockets — Current Status

**Last updated:** 2026-07-08

This file tracks live project state. Update it whenever a major feature ships or an architecture decision changes.

---

## Project summary

Corner Pockets is a Next.js 15 + MongoDB POS for a snooker club in India. It replaces the physical notebook with counter billing, checkout, visit bills, customer ledger, wallet, and outstanding collection.

**Stack:** Next.js 15, TypeScript, Tailwind v4, Mongoose, NextAuth v5, Zod, Server Actions.

**Default login:** `admin` / `corner123`

---

## Current project status

| Area | Status |
|------|--------|
| Counter (Big Snooker, Pool/Mini, Cafe) | ✅ Production-ready |
| Checkout (customer + session tabs) | ✅ Working |
| Visit / Bill engine | ✅ Implemented (`ACTIVE/FINISHED`, `WORKING/FINISHED`) |
| Customer ledger | ✅ Working (finished-visit gated) |
| Outstanding collection (Customer Page) | ✅ Working (finished visits only) |
| Wallet recharge / deduct | ✅ Working |
| Settlement reversal | ✅ Working |
| Entry corrections | ✅ Working |
| Daily closing UI | ⚠️ Partial — reporting exists; full Due→Outstanding flow verify in QA |
| Automated tests | ❌ None — manual checklist only |
| Documentation-first workflow | 🟡 Starting — this `/docs` folder |

---

## Completed modules

- **Notebook v2** — `NotebookEntry` as central charge model
- **Checkout POS** — Cash/GPay/Wallet, partial pay, pay-later dismiss
- **Visit + Bill** — one bill per visit, `syncBillTotals`
- **Customer ledger** — charges, payments, wallet, outstanding status events
- **FIFO outstanding payments** — `CustomerBalancePayment` + allocations
- **Split bills** — multi-contributor entries
- **Smart assign suggestions** — playing / recent / frequent / all
- **Active visit payment block** — Customer Page cannot collect when visit due
- **Per-row edit locks** — by `paidAmount`, not visit watermark
- **Ledger visit vs outstanding separation** — checkout does not emit Outstanding Paid
- **Wallet disabled state** — UI respects `walletEnabled === false`
- **Frame edit locks** — customer reassignment blocked after payment

---

## Current bugs

*None confirmed open after 2026-07-03 fixes. See `known-bugs.md` for history.*

---

## Known issues

| Issue | Severity | Notes |
|-------|----------|-------|
| No automated test suite | Medium | All QA is manual via `testing-checklist.md` |
| Checkout table tabs | Low | `groupCheckoutTabs` built; UI may only show Pool & Mini + Customers columns — verify `CheckoutList.tsx` |
| Legacy docs in `/docs` | Low | Archived in `docs/archive/`; Financial Engine rules live in `01-financial-engine.md` only |
| Git remote sync | Low | Verify `main` branch is pushed if deploying elsewhere |

---

## Current task

**Visit-owned financial lifecycle refactor** — finished visits are now the financial commit boundary for ledger and outstanding.

---

## Next task

1. Run full regression from `testing-checklist.md` (especially REG-005, REG-008)
2. Wire an explicit `Finish Visit` checkout action so full-pay no longer auto-finishes implicitly
3. Add automated tests for critical paths (FIFO, ledger, edit lock) when prioritized

---

## Pending improvements

- [ ] Automated integration tests for payment FIFO and ledger events
- [ ] Replace temporary full-pay auto-finish with explicit `Finish Visit` UI/action wiring
- [ ] Checkout UI: render all checkout tab groups (table/session/customer)
- [ ] Ledger filters (games, cafe, payments, date range) — types exist, UI partial
- [x] Consolidate Financial Engine docs into `01-financial-engine.md` (legacy archived)
- [ ] CI pipeline (lint + typecheck + tests)

---

## Important implementation notes

### Payment field split

| Field | Set by |
|-------|--------|
| `paidAmount` | Checkout (`settleNotebookEntries`) |
| `balanceCollectedAmount` | Customer Page (`recordCustomerBalancePayment`) |

### Ledger charge timing

Ledger visit events are emitted only when a checkout batch is **finalized** (`buildCheckoutFinalizationBatches`). Active visit rows and partial payments before completion do not appear.

### Edit lock

`isNotebookEntryEditLocked` in `entry-edit-lock-utils.ts` — never use `bill.lastPaymentAt` for locks.

### Customer page block

`getCustomerPagePaymentBlockDue` = `max(activeVisitDue, checkoutQueueDue)`.

### Revalidation

Mutations call `revalidateCounterPaths` / `revalidateCustomerPaths` + `router.refresh()` on client.

### Key file map

| Domain | Path |
|--------|------|
| Business rules (code) | `src/lib/visit-bill/`, `src/lib/utils/entry-contributors.ts` |
| Ledger engine | `src/actions/customer-ledger.ts` |
| Checkout finalization | `src/lib/ledger/checkout-finalization.ts` |
| Checkout settle | `src/actions/notebook-settlements.ts` |
| Outstanding pay | `src/actions/customer-balance-payments.ts` |
| Entry CRUD | `src/actions/notebook-entries.ts` |
| Edit locks | `src/lib/visit-bill/entry-edit-lock-utils.ts` |

---

## For new Cursor sessions

Read in order:

1. `docs/01-financial-engine.md` — Financial Engine business rules (sole source of truth)
2. `docs/current-status.md` (this file)
3. `docs/known-bugs.md`
4. `docs/testing-checklist.md`
5. `docs/technical-architecture.md` — implementation reference only

Do not rely on prior chat history.
