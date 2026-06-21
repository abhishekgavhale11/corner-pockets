# Phase 1 End-to-End Testing Guide

Use this guide to verify Corner Pockets Phase 1 with the included sample data. No application code changes are required.

## Prerequisites

- Node.js 20+
- MongoDB running locally (or Atlas dev cluster with `ALLOW_DB_RESET=true`)
- Project dependencies installed: `npm install`

## 1. Prepare the environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
MONGODB_URI=mongodb://localhost:27017/corner-pockets
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
```

## 2. Reset and seed sample data

```bash
CONFIRM_DB_RESET=yes npm run db:reset
npm run seed:sample
```

Expected seed output:

- 5 customers: **CP0001–CP0005**
- 2 students: Aditya Sharma, Priya Nair
- 3 club members: Rohan Mehta, Sneha Kapoor, Vikram Singh
- Realistic recharge and deduction history
- Next Card ID after seed: **CP0006**

### Expected balances after seed

| Card ID | Name           | Type    | Balance |
|---------|----------------|---------|---------|
| CP0001  | Aditya Sharma  | Student | ₹500    |
| CP0002  | Priya Nair     | Student | ₹550    |
| CP0003  | Rohan Mehta    | Club    | ₹2,050  |
| CP0004  | Sneha Kapoor   | Club    | ₹7,200  |
| CP0005  | Vikram Singh   | Club    | ₹7,500  |

## 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Login: `admin` / `corner123` (auto-created on first app startup if no staff exist)

---

## 4. Test checklist

### A. Staff login

1. Visit `/` — should redirect to login or dashboard.
2. Sign out if already logged in.
3. Enter wrong password — expect error message.
4. Sign in with `admin` / `corner123` — expect dashboard.

### B. Dashboard (today's activity)

Sample data includes transactions dated **today**. Verify:

| Metric | Expected (approx.) |
|--------|-------------------|
| Today's Wallet Recharges | ₹3,300 (Sneha Kapoor — club ₹3,000 plan) |
| Today's Deductions | ₹1,650 (Priya ₹550 + Sneha ₹600 + Vikram ₹500) |
| Today's Transactions | 4 |

> Totals depend on server local date/time when seed runs. Re-run seed the same day for consistent dashboard numbers.

### C. Customer search

1. Go to **Customers**.
2. Search `Aditya` — CP0001 appears.
3. Search `9876543213` — Sneha Kapoor appears.
4. Search `CP0005` — Vikram Singh appears.
5. Open a customer — detail shows Name, Card ID, Phone, Student Status, Balance.

### D. Student recharge rules

1. Open **Aditya Sharma** (CP0001, Student).
2. Tap **Recharge**.
3. Confirm only the **₹1,000 → ₹1,100** student plan is shown.
4. Plan displays Paid, Bonus, and Credited amounts.
5. Cancel — do not recharge (keeps seed data intact), or recharge and verify balance increases by ₹1,100.

### E. Club recharge rules

1. Open **Rohan Mehta** (CP0003, Club).
2. Tap **Recharge**.
3. Confirm three club plans: ₹3,000 / ₹5,000 / ₹10,000.
4. Each plan shows Paid, Bonus, Credited — no manual bonus entry.

### F. Transaction history

1. Open **Sneha Kapoor** (CP0004) → **Transactions**.
2. Newest entries appear first.
3. Recharge entries show:
   - **Recharge** badge
   - Paid / Bonus / Credited (e.g. ₹3,000 / ₹300 / ₹3,300)
   - Staff username (`admin`)
   - Balance after transaction
4. Debit entries show description, amount, staff, balance after.

### G. Deduction flow

1. Open **Priya Nair** (CP0002, balance ₹550).
2. Tap **Deduct**.
3. Enter amount `600` — submit should be blocked or server rejects (insufficient balance).
4. Enter amount `200`, description `Table test charge`.
5. Confirm in the dialog.
6. Success message shows updated balance (₹350).
7. Check **Transactions** — new debit at top.

### H. Customer registration

1. Go to **Register**.
2. Create a new club member (name + phone only).
3. Confirm Card ID **CP0006** is assigned.
4. Balance is ₹0.
5. Register a student (check Student Status) — confirm student badge on detail page.

### I. Sign out

1. Sign out from header.
2. Confirm protected pages redirect to login.

---

## 5. Re-run from clean state

```bash
CONFIRM_DB_RESET=yes npm run db:reset
npm run dev
npm run seed:sample
```

To replace sample data without a full reset:

```bash
SEED_FORCE=true npm run seed:sample
```

---

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| `MONGODB_URI is not set` | Create `.env.local` from `.env.example` |
| Reset blocked | Use local MongoDB or set `ALLOW_DB_RESET=true` |
| Seed skipped | Run `db:reset` first, or `SEED_FORCE=true npm run seed:sample` |
| Dashboard totals are 0 | Seed includes "today" transactions relative to server clock — re-seed same day |
| Cannot log in | Start `npm run dev` once (creates default admin). Check MongoDB connection. |

---

## 7. Production build check (optional)

```bash
npm run build
npm start
```

Repeat login and one customer lookup to confirm production build works.
