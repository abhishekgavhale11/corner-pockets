# Corner Pockets — Wallet Management

Prepaid wallet system for **Corner Pockets Snooker Club** (Phase 1).

## Tech Stack

Next.js 15 · TypeScript · Tailwind CSS · MongoDB · Mongoose · NextAuth · Zod

## Getting Started

```bash
cp .env.example .env.local
# Set MONGODB_URI, AUTH_SECRET, AUTH_URL

npm install
npm run dev
```

Default login: `admin` / `corner123` (created automatically on first startup if no staff exist)

### Sample data (development)

```bash
CONFIRM_DB_RESET=yes npm run db:reset
npm run seed:sample
```

See [archive/docs-legacy/E2E-TESTING.md](archive/docs-legacy/E2E-TESTING.md) for the full test walkthrough.

### Documentation

Financial Engine business rules: [docs/01-financial-engine.md](docs/01-financial-engine.md)

### Deployment

See [archive/docs-legacy/DEPLOYMENT.md](archive/docs-legacy/DEPLOYMENT.md) for Vercel + MongoDB Atlas.

## Phase 1 Features

- Staff login
- Register customers (auto Card ID: CP0001, CP0002, …)
- Search customers by name, phone, or card ID
- Recharge via predefined Student / Club plans (₹ INR)
- Deduct with confirmation dialog
- Transaction history (newest first)
- Dashboard: today's recharges, deductions, transaction count

## Recharge Plans

| Wallet | Pay | Credited |
|--------|-----|----------|
| Student | ₹1,000 | ₹1,100 |
| Club | ₹3,000 | ₹3,300 |
| Club | ₹5,000 | ₹5,700 |
| Club | ₹10,000 | ₹11,500 |

## Project Structure

```
src/
├── app/(auth)/login/
├── app/(dashboard)/
│   ├── dashboard/
│   └── customers/[id]/{recharge,deduct,transactions}/
├── actions/
├── components/
├── lib/constants/recharge-plans.ts
├── models/
└── types/
```
