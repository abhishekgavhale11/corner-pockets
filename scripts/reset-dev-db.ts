import "./lib/load-env";
import mongoose from "mongoose";
import {
  assertDevDatabaseAllowed,
  assertResetConfirmed,
  getMongoUri,
} from "./lib/db-safety";
import { connectDB } from "../src/lib/db/connect";

/** Collections kept unless `--include-staff` is passed. */
const STAFF_COLLECTION_NAMES = new Set(["staffs", "staff"]);

async function reset() {
  assertDevDatabaseAllowed("Database reset");
  assertResetConfirmed();

  const includeStaff = process.argv.includes("--include-staff");
  const uri = getMongoUri();

  console.log("Resetting development database...");
  console.log(`Target: ${maskMongoUri(uri)}`);

  await connectDB();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection has no database handle");
  }

  const collections = await db.listCollections().toArray();
  const removed: { name: string; count: number }[] = [];
  let keptStaff = 0;

  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;

    const collection = db.collection(name);
    const count = await collection.countDocuments();

    if (!includeStaff && STAFF_COLLECTION_NAMES.has(name)) {
      keptStaff = count;
      continue;
    }

    if (count > 0) {
      await collection.deleteMany({});
    }
    removed.push({ name, count });
  }

  removed.sort((a, b) => a.name.localeCompare(b.name));

  console.log("\nRemoved:");
  for (const row of removed) {
    console.log(`  ${row.name.padEnd(32)} ${row.count}`);
  }
  if (includeStaff) {
    console.log("  Staff:                           wiped (--include-staff)");
  } else {
    console.log(`  Staff:                           kept (${keptStaff} account(s))`);
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
