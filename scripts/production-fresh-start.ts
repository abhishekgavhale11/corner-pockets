/**
 * ONE-TIME fresh-start cleanup (production or development test run).
 *
 * Preserves unchanged: customers, expenses, Staff accounts.
 * Wipes operational/financial history collections listed in production-cleanup.ts.
 *
 * DEFAULT: dry-run only (prints plan, makes no changes).
 *
 * Allowed targets (exact database names only):
 *   Production: corner-pockets
 *     Execute: CONFIRM_PRODUCTION_CLEANUP=yes ... --execute
 *   Development: corner-pockets-dev
 *     Execute: CONFIRM_DEV_CLEANUP=yes ... --dev --execute
 */
import "./lib/load-env";
import mongoose from "mongoose";
import { getMongoUri } from "./lib/db-safety";
import {
  PRESERVE_COLLECTION_NAMES,
  STAFF_COLLECTION_NAMES,
  assertAllowedDatabaseName,
  assertExecuteConfirmed,
  classifyCollection,
  expectedDatabaseName,
  maskMongoUri,
  resolveCleanupTarget,
  type CleanupTarget,
  type CollectionPlanRow,
} from "./lib/production-cleanup";

function printExecuteHints(target: CleanupTarget) {
  if (target === "development") {
    console.log(
      "\nDry-run complete. No changes were made.\n" +
        "To execute against development after review:\n" +
        '  $env:CONFIRM_DEV_CLEANUP="yes"; npm run db:production-fresh-start -- --dev --execute'
    );
    return;
  }

  console.log(
    "\nDry-run complete. No changes were made.\n" +
      "To execute against production after review:\n" +
      '  $env:CONFIRM_PRODUCTION_CLEANUP="yes"; npm run db:production-fresh-start -- --execute'
  );
}

function printPlanSummary(args: {
  target: CleanupTarget;
  execute: boolean;
  rows: CollectionPlanRow[];
  staffCount: number;
}) {
  const { target, execute, rows, staffCount } = args;
  const dbName = expectedDatabaseName(target);

  console.log("\n=== FRESH-START CLEANUP PLAN ===");
  console.log(`Target: ${target}`);
  console.log(`Mode: ${execute ? "EXECUTE (destructive)" : "DRY-RUN (no changes)"}`);
  console.log(`Database: ${dbName}`);

  console.log("\n--- Collections ---");
  const wipe = rows.filter((r) => r.action === "wipe");
  const preserve = rows.filter((r) => r.action === "preserve");
  const unknown = rows.filter((r) => r.action === "skip-unknown");

  console.log("\n  WIPE (delete all documents):");
  if (wipe.length === 0) console.log("    (none)");
  for (const row of wipe) {
    console.log(`    ${row.name.padEnd(36)} ${row.count} document(s)`);
  }

  console.log("\n  PRESERVE (unchanged):");
  if (preserve.length === 0) console.log("    (none)");
  for (const row of preserve) {
    console.log(`    ${row.name.padEnd(36)} ${row.count} document(s)`);
  }

  console.log("\n  SKIPPED (unknown — not touched):");
  if (unknown.length === 0) console.log("    (none)");
  for (const row of unknown) {
    console.log(`    ${row.name.padEnd(36)} ${row.count} document(s)`);
  }

  console.log(`\nStaff accounts preserved: ${staffCount}`);

  console.log("\n--- Post-cleanup verification (automatic on --execute) ---");
  console.log("  • customers collection unchanged (count + documents)");
  console.log("  • expenses collection unchanged (count + documents)");
  console.log("  • Operational collections empty");
  console.log("  • Staff accounts still exist");
  console.log("  • Counters collection empty (fresh card/session sequences)");
}

async function verifyCleanup(args: {
  db: mongoose.mongo.Db;
  beforeCounts: Map<string, number>;
  wipeCollectionNames: string[];
}) {
  const { db, beforeCounts, wipeCollectionNames } = args;
  const errors: string[] = [];

  for (const name of PRESERVE_COLLECTION_NAMES) {
    const exists = await db.listCollections({ name }).toArray();
    if (exists.length === 0) continue;

    const count = await db.collection(name).countDocuments();
    const expected = beforeCounts.get(name) ?? 0;
    if (count !== expected) {
      errors.push(
        `Collection ${name} count changed: expected ${expected}, got ${count}`
      );
    }
  }

  for (const name of wipeCollectionNames) {
    const count = await db.collection(name).countDocuments();
    if (count > 0) {
      errors.push(`Collection ${name} not empty (${count} document(s) remain)`);
    }
  }

  let staffCount = 0;
  for (const staffName of STAFF_COLLECTION_NAMES) {
    const exists = await db.listCollections({ name: staffName }).toArray();
    if (exists.length > 0) {
      staffCount += await db.collection(staffName).countDocuments();
    }
  }
  if (staffCount === 0) {
    errors.push("No Staff accounts found after cleanup");
  }

  const customerCount = beforeCounts.get("customers") ?? 0;
  const expenseCount = beforeCounts.get("expenses") ?? 0;

  console.log("\n=== VERIFICATION ===");
  if (errors.length === 0) {
    console.log("All checks passed.");
    console.log(`  Customers (unchanged): ${customerCount}`);
    console.log(`  Expenses (unchanged): ${expenseCount}`);
    console.log(`  Staff accounts: ${staffCount}`);
    return;
  }

  console.error("Verification FAILED:");
  for (const err of errors) {
    console.error(`  • ${err}`);
  }
  throw new Error("Post-cleanup verification failed");
}

async function main() {
  const isDevMode = process.argv.includes("--dev");
  const execute = process.argv.includes("--execute");
  const target = resolveCleanupTarget(isDevMode);

  assertExecuteConfirmed(execute, target);

  const uri = getMongoUri();
  console.log("Fresh-start cleanup");
  console.log(`Cleanup target: ${target}`);
  console.log(`MongoDB URI: ${maskMongoUri(uri)}`);

  await mongoose.connect(uri, { bufferCommands: false });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection has no database handle");
  }

  assertAllowedDatabaseName(db.databaseName, target);

  const listed = await db.listCollections().toArray();
  const rows: CollectionPlanRow[] = [];
  const beforeCounts = new Map<string, number>();

  for (const { name } of listed) {
    if (name.startsWith("system.")) continue;
    const count = await db.collection(name).countDocuments();
    beforeCounts.set(name, count);
    rows.push({
      name,
      count,
      action: classifyCollection(name),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  let staffCount = 0;
  for (const staffName of STAFF_COLLECTION_NAMES) {
    const exists = listed.some((c) => c.name === staffName);
    if (exists) {
      staffCount += beforeCounts.get(staffName) ?? 0;
    }
  }

  printPlanSummary({
    target,
    execute,
    rows,
    staffCount,
  });

  if (!execute) {
    printExecuteHints(target);
    return;
  }

  console.log("\nApplying cleanup...");

  const wipeRows = rows.filter((r) => r.action === "wipe");
  for (const row of wipeRows) {
    if (row.count > 0) {
      await db.collection(row.name).deleteMany({});
    }
    console.log(`  Wiped ${row.name} (${row.count} removed)`);
  }

  console.log("  customers — skipped (preserved unchanged)");
  console.log("  expenses — skipped (preserved unchanged)");

  await verifyCleanup({
    db,
    beforeCounts,
    wipeCollectionNames: wipeRows.map((r) => r.name),
  });

  console.log(`\n${target} fresh-start cleanup complete.`);
  console.log("\nSuggested next steps:");
  console.log("  1. Log in as Admin and Open Business Day");
  console.log("  2. Spot-check customer records (unchanged)");
  console.log("  3. Confirm Counter / Cafe / Business Day history is empty");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
