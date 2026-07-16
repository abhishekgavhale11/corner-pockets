# Corner Pockets — Technical Architecture

Implementation reference. Financial Engine business rules live in `01-financial-engine.md`.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Auth | NextAuth v5 |
| Validation | Zod |
| Styling | Tailwind CSS v4 |
| Mutations | Server Actions (`src/actions/`) |

**No Prisma.** Mongoose only.

---

## Folder structure

```
src/
├── app/
│   ├── (auth)/login/
│   └── (dashboard)/
│       ├── counter/{big-snooker,pool-mini,cafe}/
│       ├── checkout/
│       ├── customers/[id]/{ledger,recharge,transactions}/
│       ├── notebook/{balances,closing,...}/
│       ├── admin/
│       └── dashboard/
├── actions/              # Server actions (all mutations)
├── components/
│   ├── counter/          # Ledger, sessions, dialogs
│   ├── checkout/         # Checkout POS
│   ├── customers/        # CRM, ledger, outstanding
│   ├── wallet/           # Verification UI
│   ├── layout/           # Sidebar, shell
│   └── ui/               # Button, Card, Dialog, SegmentedControl
├── lib/
│   ├── constants/        # Sections, payments, plans
│   ├── mappers/          # Model → DTO
│   ├── utils/            # Pure helpers
│   ├── validators/       # Zod schemas
│   ├── visit-bill/       # Bill sync, edit locks, visit due
│   └── wallet/           # FIFO, deduct, reconcile
├── models/               # Mongoose schemas
└── types/index.ts        # DTOs
```

---

## Data models

### Customer (`src/models/Customer.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `cardId` | string | Auto `CP0001` |
| `name`, `phone` | string | Search fields |
| `balance` | number | Wallet balance |
| `walletEnabled` | boolean | Gates wallet UI |
| `isStudent` | boolean | Recharge plan type |
| `isActive` | boolean | Soft disable |

### Visit (`src/models/Visit.ts`)

| Field | Notes |
|-------|-------|
| `publicId` | Human-readable visit ID |
| `customerId` | Owner |
| `billId` | One bill per visit |
| `businessDate` | `YYYY-MM-DD` club day |
| `status` | `ACTIVE` \| `CLOSED` |

Unique: one `ACTIVE` visit per customer per business date.

### Bill (`src/models/Bill.ts`)

| Field | Notes |
|-------|-------|
| `publicId` | Bill number |
| `visitId` | Parent visit |
| `totalAmount`, `paidAmount`, `dueAmount` | Synced by `syncBillTotals` |
| `status` | `ACTIVE` \| `DUE` \| `PAID` \| `OUTSTANDING` \| `SETTLED` |
| `lastPaymentAt` | Display watermark — **not used for edit locks** |

### NotebookEntry (`src/models/NotebookEntry.ts`)

Central charge record.

| Field | Notes |
|-------|-------|
| `section` | Table ID (`BIG_SNOOKER_1`, `CAFE`, …) |
| `type` | `SNOOKER`, `RUMMY`, `CAFE`, `POOL`, … |
| `amount` | Line total |
| `paidAmount` | Checkout allocations |
| `balanceCollectedAmount` | Outstanding collections |
| `status` | `PENDING` \| `PAID` \| `REVERSED` \| `CANCELLED` |
| `customerId` | Optional (unassigned) |
| `contributors[]` | Split bill slices |
| `sessionId` | Pool/mini session link |
| `visitId`, `billId` | Visit bill link |
| `checkoutDismissedAt` | Pay-later commit |
| `settlementId` | Last checkout settlement |
| `corrections[]` | Audit trail |
| `counterPaidAmount`, `counterBalanceAmount` | Frozen counter display snapshot |

### NotebookEntryContributor (embedded)

| Field | Notes |
|-------|-------|
| `customerId`, `amount` | Share |
| `paidAmount`, `balanceCollectedAmount` | Per-contributor payment |
| `status` | `PENDING` \| `PAID` |
| `billId`, `visitId` | Per-contributor bill link |

### TableSession (`src/models/TableSession.ts`)

Timed play for pool/mini.

| Field | Notes |
|-------|-------|
| `tableId` | `MINI_SNOOKER`, `POOL_1`, … |
| `status` | `ACTIVE`, `STOPPED`, `CHECKOUT_PENDING`, `ENDED` |
| `gameEntryId` | Linked game charge entry |
| `assignedCustomers[]` | Session customers |
| `gameChargeAmount` | Computed game fee |

### NotebookSettlement (`src/models/NotebookSettlement.ts`)

| Field | Notes |
|-------|-------|
| `entryIds[]` | Paid entries |
| `totalAmount` | Payment total |
| `paymentMethod` | `CASH` \| `GPAY` \| `WALLET` |
| `contributorPayments[]` | Per-customer allocation detail |
| `paidByCustomerId` | Third-party payer |
| `idempotencyKey` | Duplicate prevention |
| `status` | `COMPLETED` |

### NotebookSettlementReversal

Links to settlement; stores reason and staff.

### CustomerBalancePayment (`src/models/CustomerBalancePayment.ts`)

| Field | Notes |
|-------|-------|
| `amount` | Payment received |
| `appliedAmount` | FIFO applied total |
| `allocations[]` | `{ entryId, amount }` |
| `paymentMethod` | Cash/GPay/Wallet |

### Transaction (`src/models/Transaction.ts`)

Wallet credits/debits with reversal linkage.

### Staff (`src/models/Staff.ts`)

Username, password hash, role, permissions.

---

## Model relationships

```
Customer
  ├── Visit (1 active per business day)
  │     └── Bill (1:1)
  │           └── NotebookEntry[] (via billId)
  ├── Transaction[] (wallet)
  ├── CustomerBalancePayment[] (outstanding)
  └── NotebookEntry[] (via customerId or contributors)

TableSession
  └── NotebookEntry[] (game + cafe, via sessionId)

NotebookSettlement
  ├── NotebookEntry[] (entryIds)
  └── Transaction? (wallet deduct)

NotebookEntry
  ├── NotebookSettlement? (settlementId)
  └── Visit / Bill (visitId, billId)
```

---

## Payment flows

### Checkout payment

```
CheckoutList / SessionCheckoutPanel
  → settleNotebookEntries (FormData)
    → Validate CHECKOUT_ELIGIBLE_STATUSES
    → Apply allocations to entry.paidAmount / contributor.paidAmount
    → Wallet? executeWalletDeduct
    → syncBillTotals for affected bills
    → advanceBillPaymentWatermarks (display only)
    → closeTableSessionAfterSettlement (if session)
  → revalidateCounterPaths
```

**File:** `src/actions/notebook-settlements.ts`

### Outstanding collection

```
CollectPaymentDialog
  → recordCustomerBalancePayment
    → Block if getCustomerPagePaymentBlockDue > 0
    → applyBalancePaymentFifo (checkoutDismissedAt entries only)
    → Writes balanceCollectedAmount
    → CustomerBalancePayment document
    → syncBillTotals
  → revalidateCustomerPaths
```

**Files:** `src/actions/customer-balance-payments.ts`, `src/lib/wallet/apply-balance-payment.ts`

### Wallet recharge

```
RechargeForm → rechargeWallet → Customer.balance += credited → Transaction credit
```

**File:** `src/actions/transactions.ts`

---

## Visit flow

```
Customer assigned / first charge
  → ensureVisitBill (src/lib/visit-bill/ensure-visit-bill.ts)
  → Visit ACTIVE + Bill ACTIVE
  → linkEntriesToActiveVisitBill

Charges added on counter
  → NotebookEntry PENDING
  → syncBillTotals updates Bill totals

Checkout pay or pay-later
  → isEntryLedgerCommitted = true
  → Ledger charges appear

Visit close
  → Visit CLOSED (when implemented in flow)
```

**Files:** `src/lib/visit-bill/`, `src/actions/visit-bill.ts`

---

## Ledger flow

```
getCustomerFinancials / getCustomerLedger
  → Load entries, settlements, balance payments, transactions
  → buildCheckoutFinalizationBatches (per customer bill)
    → Only finalized checkouts produce visit charges/payments
  → Build RawLedgerEvent[]
    → Checkout batch: per-line charges, aggregated visit payment, Moved to Outstanding
    → Customer balance payments (outstanding)
    → Wallet events
  → applyRunningBalances
  → CustomerLedgerLineDTO[]
```

**Files:** `src/actions/customer-ledger.ts`, `src/lib/ledger/checkout-finalization.ts`

**Helpers:**

- `src/lib/utils/entry-contributors.ts` — obligations, ledger committed
- `src/lib/utils/ledger-charge-bundles.ts` — charge bundling, payLaterAmount
- `src/lib/utils/customer-ledger-display.ts` — display labels

---

## Important services / modules

| Module | Path | Role |
|--------|------|------|
| Checkout finalization | `checkout-finalization.ts` | Bill-level ledger batch when checkout completes |
| Entry obligations | `entry-contributors.ts` | Due amounts, checkout vs ledger queue |
| Bill sync | `sync-bill-totals.ts` | Recompute bill totals from entries |
| Edit locks | `entry-edit-lock-utils.ts` | Per-row lock rules |
| Active visit block | `active-visit-checkout-due.ts` | Customer page payment guard |
| Checkout tabs | `checkout-tabs.ts` | Group open checkout items |
| Counter pay display | `counter-pay-display.ts` | Paid/due badges on counter |
| Freeze snapshot | `freeze-counter-pay-snapshot.ts` | Counter display after dismiss |
| Reconcile payments | `reconcile-entry-payments.ts` | paidAmount vs balanceCollectedAmount |
| Mappers | `src/lib/mappers/notebook.ts` | Entry → DTO |
| Validators | `src/lib/validators/notebook.ts` | Settlement, dismiss schemas |

---

## Server actions (API surface)

All mutations are Server Actions — no separate REST API.

| Action file | Key exports |
|-------------|-------------|
| `notebook-entries.ts` | Create/update/cancel entries, assign, split, dismiss checkout |
| `notebook-settlements.ts` | `settleNotebookEntries`, `reverseNotebookSettlement` |
| `notebook-ledger.ts` | Counter data, assign suggestions, `enrichEntriesWithEditLock` |
| `customer-ledger.ts` | Ledger, outstanding list, financial summary |
| `customer-balance-payments.ts` | `recordCustomerBalancePayment` |
| `table-sessions.ts` | Session lifecycle, cafe items, session save |
| `visit-bill.ts` | Visit bill queries |
| `customers.ts` | CRUD |
| `transactions.ts` | Wallet recharge/deduct |
| `notebook-closing.ts` | Daily closing aggregates |

---

## Auth & permissions

Roles: `SUPER_MASTER`, `MASTER`, `STAFF`

Defined in `src/lib/auth/roles.ts`:

| Permission | Use |
|------------|-----|
| `NOTEBOOK_VIEW` | Counter, checkout |
| `NOTEBOOK_ENTRY_CREATE` | Add entries |
| `NOTEBOOK_SETTLE` | Checkout payments |
| `NOTEBOOK_CLOSING_VIEW` | Closing screen |
| `CUSTOMER_SEARCH` | Customers, outstanding |
| `WALLET_RECHARGE` / `WALLET_DEDUCT` | Wallet ops |

`authorizePermission()` in server actions.

---

## Data lifecycle

### NotebookEntry

```
CREATE (counter) → PENDING
  → assign customer / split
  → edit (if unlocked)
  → checkout pay → PAID (or partial PENDING)
  → OR dismiss → checkoutDismissedAt, PENDING on outstanding
  → outstanding collect → PAID
  → mistake → REVERSED or CANCELLED
```

### Payment immutability

- Settlements are reversed, not deleted
- Ledger events are derived, not stored as rows (computed from source documents)
- Corrections append to `corrections[]`

### DTO layer

`src/types/index.ts` — all client/server data crossing uses DTOs, not raw Mongoose docs.

---

## UI architecture

| Pattern | Detail |
|---------|--------|
| Server Components | Pages fetch data |
| Client Components | Dialogs, counter interactions (`"use client"`) |
| Revalidation | `revalidatePath` + `router.refresh()` |
| Design system | Emerald-800 primary; `src/components/ui/*` (no shadcn) |

### Key UI files

| File | Role |
|------|------|
| `CheckoutList.tsx` | Main checkout |
| `CompactLedgerRow.tsx` | Counter row |
| `CollectPaymentDialog.tsx` | Outstanding collection |
| `CustomerLedgerView.tsx` | Ledger page |
| `SnookerFrameEditDialog.tsx` | Frame edit with lock guard |

---

## Environment

```bash
MONGODB_URI=
AUTH_SECRET=
AUTH_URL=http://localhost:3000
```

```bash
npm install
npm run dev
CONFIRM_DB_RESET=yes npm run db:reset && npm run seed:sample
```

See `docs/DEPLOYMENT.md` for Vercel + Atlas (legacy deploy doc).

---

## Typecheck

```bash
npx tsc --noEmit
npm run build
```
