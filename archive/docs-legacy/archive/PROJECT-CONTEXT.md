# Corner Pockets — Project Context

Handoff document for developers and AI assistants working on **Corner Pockets**, the counter/POS software for Corner Pockets Snooker Club.

---

## What this is

**Corner Pockets** is counter/POS software for a **snooker club** in India. It is built for **non-technical counter staff**, not developers.

### Design philosophy

- Think like counter staff: fast, few clicks, reliable during peak hours
- Money/ledger must read like a **bank statement** — clear charges, payments, running balance
- Manual entry is OK if it is simpler than automation
- Never ask twice; reduce searching for repeat customers
- INR (₹), whole rupees

The app evolved from a **wallet-only** system (Phase 1) into a full **notebook/counter + checkout + customer ledger** system (Notebook v2).

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js 15** (App Router) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4** (utility classes; custom `components/ui/*`, no shadcn/ui) |
| Database | **MongoDB** via **Mongoose** |
| Auth | **NextAuth v5** (staff login) |
| Validation | **Zod** |
| Server logic | **Server Actions** in `src/actions/` |

### Getting started

```bash
cp .env.example .env.local
# Set MONGODB_URI, AUTH_SECRET, AUTH_URL

npm install
npm run dev
```

- Default login: `admin` / `corner123`
- Sample data: `CONFIRM_DB_RESET=yes npm run db:reset` then `npm run seed:sample`
- See `docs/E2E-TESTING.md` and `docs/NOTEBOOK-V2-TESTING.md` for test walkthroughs
- See `docs/DEPLOYMENT.md` for Vercel + MongoDB Atlas

---

## Physical club layout (software mirrors this)

| Area | Route | Tables / sections |
|------|-------|-------------------|
| Big Snooker | `/counter/big-snooker` | `BIG_SNOOKER_1`, `BIG_SNOOKER_2`, `BIG_SNOOKER_3` |
| Pool & Mini | `/counter/pool-mini` | `MINI_SNOOKER`, `POOL_1`, `POOL_2` |
| Cafe | `/counter/cafe` | `CAFE` section + cafe items tied to tables/sessions |
| Checkout | `/checkout` | Settle all open bills |
| Outstanding | `/notebook/balances` | Customers who owe money |
| Customers | `/customers` | CRM, wallet, ledger |
| Admin | `/admin` | Staff, settings, reports |

Navigation: `src/components/layout/Sidebar.tsx`

Default home after login: `/counter/big-snooker`

---

## Core data models

Location: `src/models/`

### Customer

- Auto **Card ID**: `CP0001`, `CP0002`, …
- Fields: `name`, `phone`, `notes`, `isStudent`, `walletEnabled`, `balance`, `isActive`

### NotebookEntry (central charge record)

Every game frame, rummy game, cafe item, timed session charge, etc. is a `NotebookEntry`.

| Field | Purpose |
|-------|---------|
| `section` | Table/area (`BIG_SNOOKER_1`, `CAFE`, …) |
| `type` | `SNOOKER`, `RUMMY`, `CAFE`, `MINI`, `POOL`, etc. |
| `amount`, `status` | `PENDING` \| `PAID` \| `REVERSED` \| `CANCELLED` |
| `customerId`, `customerName` | May be **unassigned** (walk-in, assign later) |
| `contributors[]` | **Split bills** — each contributor has amount + `PENDING`/`PAID` |
| `paidAmount` | Partial payment tracking on entries |
| `paymentMethod` | `CASH` \| `GPAY` \| `WALLET` |
| `sessionId` | Links to timed table sessions (pool/mini) |
| `corrections[]` | Audit trail for entry corrections |

### TableSession (timed play — pool/mini)

- Status: `ACTIVE`, `PAUSED`, `ENDED`, etc.
- `assignedCustomers[]`, hourly billing, game + cafe charges
- Per-table session numbers (`tableSessionNumber`)

### NotebookSettlement

Checkout payment event — groups one or more entries paid together.

### CustomerBalancePayment

Partial outstanding payments when a customer pays part of what they owe (FIFO allocation across pending entries).

### Transaction

Wallet credits/debits (recharge plans, manual deduct).

---

## Entry lifecycle

```
Staff creates entry → PENDING (unassigned or assigned)
       ↓
Assign customer (optional) / Split contributors
       ↓
Checkout or Collect Payment → PAID
       ↓
Mistake? → REVERSED (with reason) or CANCELLED
```

- **Checkout-eligible statuses:** `PENDING`, `REVERSED` (`CHECKOUT_ELIGIBLE_STATUSES` in `notebook-payments.ts`)
- **Split bills:** one entry, multiple `contributors[]`; each can be paid separately

---

## Main user flows

### 1. Counter entry (day-to-day billing)

**Big Snooker** (`CounterGrid` → `CounterSectionColumn`):

- 3-column ledger (one per table)
- Quick presets: Singles, Individual, Shuffle, Rummy
- Rows: `CompactLedgerRow` inside `CounterLedgerTable`
- Columns: **Time \| Type \| Name \| Amount \| Pay**
- Unassigned rows → amber highlight → `UnassignedEntryDialog`
- Assign customer or split bill

**Pool/Mini** (`PoolMiniSessionBoard`, `MiniSessionBoard`):

- Start / pause / end table sessions
- Assign customers to session
- Cafe items attach to session
- Game charges from session timer

**Cafe** (`CafeCustomerTabs`, `CafeAddItemDialog`):

- Per-customer cafe tabs
- Quick items: cigarette, water, coffee, food

### 2. Assign customer (smart suggestions)

`UnassignedEntryDialog` + `getAssignCustomerSuggestions()` in `notebook-ledger.ts`

Priority order:

1. **Currently playing** — active session or open bill today
2. **Recent** — played today, not currently active
3. **Frequent** — top visitors (last 60 days)
4. **All customers** — search filters entire database

### 3. Checkout (`/checkout`)

`CheckoutList.tsx` — two columns:

- **Pool & Mini** (session/table tabs)
- **Customers** (per-customer open tabs)

Each tab expands to bill detail + payment:

- Payment methods: `SegmentedControl` (Cash / GPay / Wallet)
- Wallet path: `CustomerVerification` → `WalletCustomerConfirmation`
- Session bills: `SessionCheckoutPanel`

Deep links: `?session=` and `?customer=`

### 4. Customer ledger & outstanding

**Unified ledger** (`/customers/[id]/ledger`):

- Charges (at counter time), payments, wallet recharges
- Running **Outstanding** (never shows negative balance as credit)
- Cafe charges bunched (30 min windows); same-minute counter charges grouped

**Outstanding page** (`/notebook/balances`):

- One card per customer with balance due
- Collect Payment → `CollectPaymentDialog` (Cash/GPay/Wallet, partial OK)
- FIFO via `apply-balance-payment.ts` + `recordCustomerBalancePayment`

**Customer summary** (`CustomerSummaryCard`):

- Wallet Balance, Outstanding, Open Bills, Last Visit, Last Payment
- Actions: Collect Payment, View Ledger, Open Checkout, WhatsApp

---

## Wallet (Phase 1 — still active)

| Plan | Pay | Credited |
|------|-----|----------|
| Student | ₹1,000 | ₹1,100 |
| Club | ₹3,000 | ₹3,300 |
| Club | ₹5,000 | ₹5,700 |
| Club | ₹10,000 | ₹11,500 |

- Card ID or phone verification for wallet pay
- `Transaction` history per customer
- Wallet pay at checkout deducts balance

---

## Auth & permissions

Roles: `SUPER_MASTER` | `MASTER` | `STAFF`

Defined in `src/lib/auth/roles.ts`:

| Permission | Typical use |
|------------|-------------|
| `NOTEBOOK_VIEW` | Counter, checkout |
| `NOTEBOOK_ENTRY_CREATE` | Add ledger entries |
| `NOTEBOOK_SETTLE` | Checkout payments |
| `CUSTOMER_SEARCH` | Customers, outstanding |
| `WALLET_RECHARGE` / `WALLET_DEDUCT` | Wallet ops |
| `STAFF_VIEW` | Admin area |

---

## Architecture patterns

| Pattern | Location |
|---------|----------|
| Server Actions | `src/actions/*.ts` |
| DTOs | `src/types/index.ts` |
| Mappers | `src/lib/mappers/` |
| Constants | `src/lib/constants/` |
| Validators | `src/lib/validators/` (Zod) |
| Client components | Interactive counter/checkout dialogs (`"use client"`) |
| Revalidation | `router.refresh()` after mutations |

**Do not use Prisma** — this project uses Mongoose only.

---

## UI components

`src/components/ui/`:

| Component | Notes |
|-----------|-------|
| `Button` | primary = `emerald-800`, secondary, danger, ghost |
| `Card` | `rounded-lg`, `border-gray-200`, `p-4`, optional `padding="none"` |
| `Dialog`, `Input`, `Label`, `Badge`, `Pagination` | Standard form/layout |
| `SegmentedControl` | Payment method toggle (Cash/GPay/Wallet) |
| `EmptyState` | Icon + title for empty lists |

### Checkout design system

- Spacing: 8px scale (8 / 16 / 24 / 32)
- Typography: 14px body (`text-sm`), 16px sections (`text-base`), 20px page title (`text-xl`)
- Single green accent (`emerald-800`) for primary + selected states
- Shared pieces: `src/components/checkout/checkout-payment.tsx`

Brand: emerald green (`emerald-800/900/950`) for sidebar and primary actions.

---

## Key files reference

### Counter

| File | Purpose |
|------|---------|
| `src/components/counter/CounterGrid.tsx` | Multi-table layout |
| `src/components/counter/CounterSectionColumn.tsx` | Per-table ledger + dialogs |
| `src/components/counter/CompactLedgerRow.tsx` | Row UI, Pay column, split rows |
| `src/components/counter/CounterLedgerTable.tsx` | Column widths, header |
| `src/components/counter/SettlementBadge.tsx` | Paid/Pending/Unassigned badges |
| `src/components/counter/UnassignedEntryDialog.tsx` | Assign customer with smart groups |
| `src/components/counter/ContributorsSplitDialog.tsx` | Split bill between customers |
| `src/components/counter/RummyEntryDialog.tsx` | Rummy (player count pills) |
| `src/components/counter/PoolMiniSessionBoard.tsx` | Pool/mini session management |

### Checkout

| File | Purpose |
|------|---------|
| `src/components/checkout/CheckoutList.tsx` | Main checkout POS screen |
| `src/components/checkout/SessionCheckoutPanel.tsx` | Session bill detail + pay |
| `src/components/checkout/checkout-payment.tsx` | Payment selector, total, confirm panel |

### Customer / money

| File | Purpose |
|------|---------|
| `src/actions/customer-ledger.ts` | Ledger queries, outstanding list |
| `src/actions/customer-balance-payments.ts` | Partial payment recording |
| `src/components/customers/CollectPaymentDialog.tsx` | Collect from outstanding |
| `src/components/customers/OutstandingPage.tsx` | `/notebook/balances` |
| `src/components/customers/CustomerLedgerView.tsx` | Per-customer ledger page |

### Server actions

| File | Purpose |
|------|---------|
| `src/actions/notebook-entries.ts` | CRUD entries, open tabs, pending items |
| `src/actions/notebook-settlements.ts` | Checkout settlement |
| `src/actions/notebook-ledger.ts` | Customer search, assign suggestions |
| `src/actions/table-sessions.ts` | Session lifecycle, assign customers |
| `src/actions/customers.ts` | Customer CRUD |
| `src/actions/transactions.ts` | Wallet recharge/deduct |

### Important utilities

| File | Purpose |
|------|---------|
| `src/lib/utils/entry-contributors.ts` | Split bill obligations |
| `src/lib/utils/ledger-charge-bundles.ts` | Bunch cafe/counter charges in ledger |
| `src/lib/utils/checkout-tabs.ts` | Group open tabs for checkout columns |
| `src/lib/utils/customer-today-glance.ts` | Hover glance on cafe rows |
| `src/lib/wallet/apply-balance-payment.ts` | FIFO partial payment logic |
| `src/lib/constants/counter-sections.ts` | Table IDs, presets, checkout grouping |

---

## Project structure

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
├── actions/           # Server actions
├── components/
│   ├── counter/       # Ledger, sessions, assign, split
│   ├── checkout/      # POS checkout
│   ├── customers/     # CRM, ledger, outstanding
│   ├── wallet/        # Verification, recharge
│   ├── layout/        # Sidebar, shell
│   └── ui/            # Button, Card, Dialog, etc.
├── lib/
│   ├── constants/
│   ├── mappers/
│   ├── utils/
│   ├── validators/
│   └── auth/
├── models/            # Mongoose schemas
└── types/             # DTOs
```

---

## Features built (Notebook v2)

1. **Customer ledger & outstanding** — unified ledger, partial payments, FIFO, Collect Payment
2. **Outstanding page** — per-customer cards, WhatsApp, ledger links
3. **Big snooker ledger** — column layout (Time/Type/Name/Amount/Pay), alignment fixes
4. **Split bill styling** — contributor rows no longer inherit parent unassigned amber
5. **Unassigned entry popup** — search-first assign; split as secondary action
6. **Smart customer suggestions** — playing → recent → frequent → all
7. **Checkout POS redesign** — Card system, segmented payments, empty states

---

## Conventions for contributors

- **Minimize scope** — small, focused diffs; match existing patterns
- **No shadcn** unless explicitly requested
- **No commits** unless the user asks
- **Outstanding** must never display as negative customer credit
- **Split contributor rows** must not use parent `isUnassigned` for yellow styling
- **Counter UX** — labeled actions over cryptic icon-only buttons
- **Server actions** for all data mutations; Zod for input validation

---

## AI assistant prompt prefix

Paste this when starting a new session:

> **Project:** Corner Pockets snooker club counter software (Next.js 15, MongoDB, Tailwind). Built for non-technical staff. Core model is `NotebookEntry` (charges) → checkout/settlement or partial `CustomerBalancePayment`. Counter at `/counter/*`, checkout at `/checkout`, outstanding at `/notebook/balances`. Use server actions, DTOs in `src/types`, emerald-800 as primary accent. Read `docs/PROJECT-CONTEXT.md` for full context. Minimize scope; match existing code style.

---

*Last updated: June 2025 — reflects Notebook v2 counter, checkout, and ledger work.*
