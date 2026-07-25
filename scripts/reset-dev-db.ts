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
import NotebookEntry from "../src/models/NotebookEntry";
import TableSession from "../src/models/TableSession";
import BusinessDay from "../src/models/BusinessDay";
import Outstanding from "../src/models/Outstanding";
import OutstandingCollection from "../src/models/OutstandingCollection";
import CustomerBalancePayment from "../src/models/CustomerBalancePayment";
import CafeOrder from "../src/models/CafeOrder";
import CafePurchase from "../src/models/CafePurchase";

async function reset() {
  assertDevDatabaseAllowed("Database reset");
  assertResetConfirmed();

  const includeStaff = process.argv.includes("--include-staff");
  const uri = getMongoUri();

  console.log("Resetting development database...");
  console.log(`Target: ${maskMongoUri(uri)}`);

  await connectDB();

  const [
    customerCount,
    transactionCount,
    counterCount,
    staffCount,
    entryCount,
    sessionCount,
    businessDayCount,
    outstandingCount,
    outstandingCollectionCount,
    balancePaymentCount,
    cafeOrderCount,
    cafePurchaseCount,
  ] = await Promise.all([
    Customer.countDocuments(),
    Transaction.countDocuments(),
    Counter.countDocuments(),
    Staff.countDocuments(),
    NotebookEntry.countDocuments(),
    TableSession.countDocuments(),
    BusinessDay.countDocuments(),
    Outstanding.countDocuments(),
    OutstandingCollection.countDocuments(),
    CustomerBalancePayment.countDocuments(),
    CafeOrder.countDocuments(),
    CafePurchase.countDocuments(),
  ]);

  await Promise.all([
    Customer.deleteMany({}),
    Transaction.deleteMany({}),
    Counter.deleteMany({}),
    NotebookEntry.deleteMany({}),
    TableSession.deleteMany({}),
    BusinessDay.deleteMany({}),
    Outstanding.deleteMany({}),
    OutstandingCollection.deleteMany({}),
    CustomerBalancePayment.deleteMany({}),
    CafeOrder.deleteMany({}),
    CafePurchase.deleteMany({}),
  ]);

  let removedStaff = 0;
  if (includeStaff) {
    const result = await Staff.deleteMany({});
    removedStaff = result.deletedCount ?? 0;
  }

  console.log("\nRemoved:");
  console.log(`  Customers:                 ${customerCount}`);
  console.log(`  Transactions:              ${transactionCount}`);
  console.log(`  Counters:                  ${counterCount}`);
  console.log(`  Notebook entries:          ${entryCount}`);
  console.log(`  Table sessions:            ${sessionCount}`);
  console.log(`  Business Days:             ${businessDayCount}`);
  console.log(`  Outstanding records:       ${outstandingCount}`);
  console.log(`  Outstanding collections:   ${outstandingCollectionCount}`);
  console.log(`  Balance payments:          ${balancePaymentCount}`);
  console.log(`  Cafe orders:               ${cafeOrderCount}`);
  console.log(`  Cafe purchases:            ${cafePurchaseCount}`);
  if (includeStaff) {
    console.log(`  Staff:                     ${removedStaff}`);
  } else {
    console.log(`  Staff:                     kept (${staffCount} account(s))`);
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
