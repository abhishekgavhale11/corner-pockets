import "./lib/load-env";
import mongoose from "mongoose";
import {
  assertDevDatabaseAllowed,
  assertResetConfirmed,
  getMongoUri,
} from "./lib/db-safety";
import { connectDB } from "../src/lib/db/connect";
import Customer from "../src/models/Customer";
import Transaction from "../src/models/Transaction";
import Counter from "../src/models/Counter";
import Staff from "../src/models/Staff";

async function reset() {
  assertDevDatabaseAllowed("Database reset");
  assertResetConfirmed();

  const includeStaff = process.argv.includes("--include-staff");
  const uri = getMongoUri();

  console.log("Resetting development database...");
  console.log(`Target: ${maskMongoUri(uri)}`);

  await connectDB();

  const [customerCount, transactionCount, counterCount, staffCount] =
    await Promise.all([
      Customer.countDocuments(),
      Transaction.countDocuments(),
      Counter.countDocuments(),
      Staff.countDocuments(),
    ]);

  await Customer.deleteMany({});
  await Transaction.deleteMany({});
  await Counter.deleteMany({});

  let removedStaff = 0;
  if (includeStaff) {
    const result = await Staff.deleteMany({});
    removedStaff = result.deletedCount ?? 0;
  }

  console.log("\nRemoved:");
  console.log(`  Customers:    ${customerCount}`);
  console.log(`  Transactions: ${transactionCount}`);
  console.log(`  Counters:     ${counterCount}`);
  if (includeStaff) {
    console.log(`  Staff:        ${removedStaff}`);
  } else {
    console.log(`  Staff:        kept (${staffCount} account(s))`);
  }

  console.log("\nDatabase reset complete.");
  console.log("\nSuggested next steps:");
  console.log("  npm run dev                 # creates default admin if staff removed");
  console.log("  npm run seed:sample         # load sample customers");
}

function maskMongoUri(uri: string): string {
  return uri.replace(/:([^:@/]+)@/, ":****@");
}

reset()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
