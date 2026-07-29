import "./lib/load-env";
import mongoose from "mongoose";
import { assertDevDatabaseAllowed } from "./lib/db-safety";
import { connectDB } from "../src/lib/db/connect";
import { ensureDefaultStaff } from "../src/lib/auth/ensure-default-staff";
import Customer from "../src/models/Customer";
import Counter from "../src/models/Counter";

type SeedCustomer = {
  cardId: string;
  name: string;
  phone: string;
  isStudent: boolean;
};

const SAMPLE_CUSTOMERS: SeedCustomer[] = [
  {
    cardId: "CP0001",
    name: "Aditya Sharma",
    phone: "9876543210",
    isStudent: true,
  },
  {
    cardId: "CP0002",
    name: "Priya Nair",
    phone: "9876543211",
    isStudent: true,
  },
  {
    cardId: "CP0003",
    name: "Rohan Mehta",
    phone: "9876543212",
    isStudent: false,
  },
  {
    cardId: "CP0004",
    name: "Sneha Kapoor",
    phone: "9876543213",
    isStudent: false,
  },
  {
    cardId: "CP0005",
    name: "Vikram Singh",
    phone: "9876543214",
    isStudent: false,
  },
];

async function seed() {
  assertDevDatabaseAllowed("Sample data seed");
  const force = process.env.SEED_FORCE === "true";

  await connectDB();
  await ensureDefaultStaff();

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
    await Counter.deleteMany({});
    console.log("Cleared existing customers and counters.");
  }

  console.log("Seeding 5 sample customers (2 students, 3 club members)...");

  for (const sample of SAMPLE_CUSTOMERS) {
    await Customer.create({
      cardId: sample.cardId,
      name: sample.name,
      phone: sample.phone,
      isStudent: sample.isStudent,
      isActive: true,
    });

    console.log(
      `  ${sample.cardId} ${sample.name} (${sample.isStudent ? "Student" : "Club"})`
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
