# Corner Pockets — Current Status

**Last updated:** 2026-07-03

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
| Visit / Bill engine | ✅ Implemented |
| Customer ledger | ✅ Working (recent bug fixes applied) |
| Outstanding collection (Customer Page) | ✅ Working |
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
| Legacy docs in `/docs` | Low | `business-architecture-v1.0.md`, `PROJECT-CONTEXT.md`, etc. superseded by this folder's canonical files |
| Git remote sync | Low | Verify `main` branch is pushed if deploying elsewhere |

---

## Current task

**Documentation-first workflow setup** — creating and maintaining `/docs` as single source of truth.

---

## Next task

1. Run full regression from `testing-checklist.md` after recent ledger + edit-lock fixes
2. Resolve checkout table tabs rendering if still missing
3. Add automated tests for critical paths (FIFO, ledger, edit lock) when prioritized

---

## Pending improvements

- [ ] Automated integration tests for payment FIFO and ledger events
- [ ] Checkout UI: render all checkout tab groups (table/session/customer)
- [ ] Ledger filters (games, cafe, payments, date range) — types exist, UI partial
- [ ] Consolidate or archive legacy doc files (`*-v1.0.md`, `PROJECT-CONTEXT.md`)
- [ ] CI pipeline (lint + typecheck + tests)

---

## Important implementation notes

### Payment field split

| Field | Set by |
|-------|--------|
| `paidAmount` | Checkout (`settleNotebookEntries`) |
| `balanceCollectedAmount` | Customer Page (`recordCustomerBalancePayment`) |

### Ledger charge timing

Charges use `isEntryLedgerCommitted` — not counter `createdAt`. Commit = paid at checkout OR `checkoutDismissedAt`.

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
| Checkout settle | `src/actions/notebook-settlements.ts` |
| Outstanding pay | `src/actions/customer-balance-payments.ts` |
| Entry CRUD | `src/actions/notebook-entries.ts` |
| Edit locks | `src/lib/visit-bill/entry-edit-lock-utils.ts` |

---

## For new Cursor sessions

Read in order:

1. `docs/business-architecture.md`
2. `docs/current-status.md` (this file)
3. `docs/known-bugs.md`
4. `docs/technical-architecture.md`
5. `docs/testing-checklist.md`

Do not rely on prior chat history.
