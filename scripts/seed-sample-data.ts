import "./lib/load-env";
import mongoose from "mongoose";
import { assertDevDatabaseAllowed } from "./lib/db-safety";
import { connectDB } from "../src/lib/db/connect";
import { ensureDefaultStaff } from "../src/lib/auth/ensure-default-staff";
import {
  buildRechargeDescription,
  getRechargeAmounts,
  getPlanByKey,
} from "../src/lib/constants/recharge-plans";
import Customer from "../src/models/Customer";
import Transaction from "../src/models/Transaction";
import Counter from "../src/models/Counter";
import Staff from "../src/models/Staff";

type SeedCustomer = {
  cardId: string;
  name: string;
  phone: string;
  isStudent: boolean;
};

type SeedCredit = {
  planKey: string;
  daysAgo: number;
  hoursAgo?: number;
};

type SeedDebit = {
  amount: number;
  description: string;
  daysAgo: number;
  hoursAgo?: number;
};

type CustomerSeed = SeedCustomer & {
  credits: SeedCredit[];
  debits: SeedDebit[];
};

const SAMPLE_CUSTOMERS: CustomerSeed[] = [
  {
    cardId: "CP0001",
    name: "Aditya Sharma",
    phone: "9876543210",
    isStudent: true,
    credits: [{ planKey: "student-1000", daysAgo: 5 }],
    debits: [
      { amount: 400, description: "Table 1 — 1 hour", daysAgo: 3 },
      { amount: 200, description: "Cues and chalk", daysAgo: 1 },
    ],
  },
  {
    cardId: "CP0002",
    name: "Priya Nair",
    phone: "9876543211",
    isStudent: true,
    credits: [{ planKey: "student-1000", daysAgo: 3 }],
    debits: [
      { amount: 550, description: "Table 3 — 1.5 hours", daysAgo: 0, hoursAgo: 2 },
    ],
  },
  {
    cardId: "CP0003",
    name: "Rohan Mehta",
    phone: "9876543212",
    isStudent: false,
    credits: [{ planKey: "club-3000", daysAgo: 7 }],
    debits: [
      { amount: 800, description: "Table 2 — 2 hours", daysAgo: 4 },
      { amount: 450, description: "Snacks and drinks", daysAgo: 2 },
    ],
  },
  {
    cardId: "CP0004",
    name: "Sneha Kapoor",
    phone: "9876543213",
    isStudent: false,
    credits: [
      { planKey: "club-5000", daysAgo: 6 },
      { planKey: "club-3000", daysAgo: 0, hoursAgo: 4 },
    ],
    debits: [
      { amount: 1200, description: "Table 4 — 3 hours", daysAgo: 3 },
      { amount: 600, description: "Table 5 — 1 hour", daysAgo: 0, hoursAgo: 1 },
    ],
  },
  {
    cardId: "CP0005",
    name: "Vikram Singh",
    phone: "9876543214",
    isStudent: false,
    credits: [{ planKey: "club-10000", daysAgo: 10 }],
    debits: [
      { amount: 2000, description: "Private table booking", daysAgo: 5 },
      { amount: 1500, description: "Tournament entry fee", daysAgo: 2 },
      { amount: 500, description: "Table 1 — 1 hour", daysAgo: 0, hoursAgo: 3 },
    ],
  },
];

function transactionDate(daysAgo: number, hoursAgo = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo, 30, 0, 0);
  return date;
}

async function seed() {
  assertDevDatabaseAllowed("Sample data seed");
  const force = process.env.SEED_FORCE === "true";

  await connectDB();
  await ensureDefaultStaff();

  const staff =
    (await Staff.findOne({ username: "abhishek" })) ??
    (await Staff.findOne({ role: "SUPER_MASTER" }));
  if (!staff) {
    throw new Error("No staff account available for sample transactions");
  }

  const existingCustomers = await Customer.countDocuments();
  if (existingCustomers > 0 && !force) {
    console.log(
      `Database already has ${existingCustomers} customer(s). Skipping seed.`
    );
    console.log("Run with SEED_FORCE=true to replace sample data after reset.");
    process.exit(0);
  }

  if (existingCustomers > 0 && force) {
    await Customer.deleteMany({});
    await Transaction.deleteMany({});
    await Counter.deleteMany({});
    console.log("Cleared existing customers, transactions, and counters.");
  }

  console.log("Seeding 5 sample customers (2 students, 3 club members)...");

  for (const sample of SAMPLE_CUSTOMERS) {
    const events: Array<
      | { kind: "credit"; planKey: string; at: Date }
      | { kind: "debit"; amount: number; description: string; at: Date }
    > = [
      ...sample.credits.map((credit) => ({
        kind: "credit" as const,
        planKey: credit.planKey,
        at: transactionDate(credit.daysAgo, credit.hoursAgo ?? 0),
      })),
      ...sample.debits.map((debit) => ({
        kind: "debit" as const,
        amount: debit.amount,
        description: debit.description,
        at: transactionDate(debit.daysAgo, debit.hoursAgo ?? 0),
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    const customer = await Customer.create({
      cardId: sample.cardId,
      name: sample.name,
      phone: sample.phone,
      isStudent: sample.isStudent,
      balance: 0,
      isActive: true,
      createdAt: events[0]?.at ?? new Date(),
    });

    let balance = 0;

    for (const event of events) {
      if (event.kind === "credit") {
        const plan = getPlanByKey(event.planKey);
        if (!plan) {
          throw new Error(`Unknown plan: ${event.planKey}`);
        }

        const { paidAmount, bonusAmount, creditedAmount } =
          getRechargeAmounts(plan);
        balance += creditedAmount;

        await Transaction.create({
          customerId: customer._id,
          type: "credit",
          paidAmount,
          bonusAmount,
          creditedAmount,
          balanceAfter: balance,
          description: buildRechargeDescription(plan),
          staffId: staff._id,
          staffUsername: staff.username,
          createdAt: event.at,
        });
      } else {
        balance -= event.amount;

        await Transaction.create({
          customerId: customer._id,
          type: "debit",
          amount: event.amount,
          balanceAfter: balance,
          description: event.description,
          staffId: staff._id,
          staffUsername: staff.username,
          createdAt: event.at,
        });
      }
    }

    customer.balance = balance;
    await customer.save();

    console.log(
      `  ${sample.cardId} ${sample.name} (${sample.isStudent ? "Student" : "Club"}) — balance ₹${balance.toLocaleString("en-IN")}`
    );
  }

  await Counter.findByIdAndUpdate(
    "customerCardId",
    { seq: SAMPLE_CUSTOMERS.length },
    { upsert: true }
  );

  console.log("\nSample data seeded successfully.");
  console.log("Next customer Card ID will be: CP0006");
  console.log("\nLogin: admin / corner123");
  console.log("Run: npm run dev");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
