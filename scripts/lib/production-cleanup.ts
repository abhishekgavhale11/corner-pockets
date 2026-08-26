/**
 * Fresh-start cleanup — collection plan derived from src/models/*.
 *
 * Allowed targets (exact database names only):
 *   • corner-pockets      — production (CONFIRM_PRODUCTION_CLEANUP=yes)
 *   • corner-pockets-dev  — development test run (--dev, CONFIRM_DEV_CLEANUP=yes)
 */

/** Operational/financial collections wiped on fresh start. */
export const OPERATIONAL_COLLECTIONS = [
  "outstandings",
  "outstandingcollections",
  "notebookentries",
  "cafeorders",
  "customerbalancepayments",
  "transactions",
  "businessdays",
  "businessdayfinalsummaries",
  "tablesessions",
  "cafepurchases",
  "counters",
  "bills",
  "notebooksettlementreversals",
  "notebooksettlements",
  "visits",
  "financialcorrections",
] as const;

/** Authentication — preserved unchanged. */
export const STAFF_COLLECTION_NAMES = new Set(["staffs", "staff"]);

/** Preserved unchanged — never read, written, or deleted. */
export const PRESERVE_COLLECTION_NAMES = new Set(["customers", "expenses"]);

export const PRODUCTION_DATABASE_NAME = "corner-pockets";
export const DEVELOPMENT_DATABASE_NAME = "corner-pockets-dev";

export const ALLOWED_DATABASE_NAMES = new Set([
  PRODUCTION_DATABASE_NAME,
  DEVELOPMENT_DATABASE_NAME,
]);

export type CleanupTarget = "production" | "development";

export function resolveCleanupTarget(isDevMode: boolean): CleanupTarget {
  return isDevMode ? "development" : "production";
}

export function expectedDatabaseName(target: CleanupTarget): string {
  return target === "development"
    ? DEVELOPMENT_DATABASE_NAME
    : PRODUCTION_DATABASE_NAME;
}

export function assertAllowedDatabaseName(
  dbName: string,
  target: CleanupTarget
): void {
  console.log(`\nMongoDB database name: ${dbName}`);
  console.log(`Cleanup target: ${target}`);

  const expected = expectedDatabaseName(target);

  if (dbName !== expected) {
    throw new Error(
      `Refusing to run: ${target} cleanup requires database "${expected}".\n` +
        `Connected to "${dbName}" instead.\n` +
        (target === "development"
          ? `Use MONGODB_URI pointing at ${DEVELOPMENT_DATABASE_NAME} and pass --dev.`
          : `Use MONGODB_URI pointing at ${PRODUCTION_DATABASE_NAME} without --dev.`)
    );
  }

  if (!ALLOWED_DATABASE_NAMES.has(dbName)) {
    throw new Error(
      `Refusing to run: database "${dbName}" is not an allowed cleanup target.\n` +
        `Only "${PRODUCTION_DATABASE_NAME}" and "${DEVELOPMENT_DATABASE_NAME}" are permitted.`
    );
  }
}

export function assertExecuteConfirmed(
  execute: boolean,
  target: CleanupTarget
): void {
  if (!execute) return;

  if (target === "production") {
    if (process.env.CONFIRM_PRODUCTION_CLEANUP !== "yes") {
      throw new Error(
        "Production cleanup requires confirmation.\n" +
          "Set CONFIRM_PRODUCTION_CLEANUP=yes in your environment, then run with --execute (no --dev).\n" +
          "Example (PowerShell):\n" +
          '  $env:CONFIRM_PRODUCTION_CLEANUP="yes"; npm run db:production-fresh-start -- --execute'
      );
    }
    return;
  }

  if (process.env.CONFIRM_DEV_CLEANUP !== "yes") {
    throw new Error(
      "Development cleanup requires confirmation.\n" +
        "Set CONFIRM_DEV_CLEANUP=yes in your environment, then run with --dev --execute.\n" +
        "Example (PowerShell):\n" +
        '  $env:CONFIRM_DEV_CLEANUP="yes"; npm run db:production-fresh-start -- --dev --execute'
    );
  }
}

export type CollectionPlanRow = {
  name: string;
  count: number;
  action: "wipe" | "preserve" | "skip-unknown";
};

export function maskMongoUri(uri: string): string {
  return uri.replace(/:([^:@/]+)@/, ":****@");
}

export function classifyCollection(name: string): CollectionPlanRow["action"] {
  if (name.startsWith("system.")) return "skip-unknown";
  if (STAFF_COLLECTION_NAMES.has(name)) return "preserve";
  if (PRESERVE_COLLECTION_NAMES.has(name)) return "preserve";
  if ((OPERATIONAL_COLLECTIONS as readonly string[]).includes(name)) {
    return "wipe";
  }
  return "skip-unknown";
}
