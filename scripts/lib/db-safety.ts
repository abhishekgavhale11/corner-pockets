import { normalizeMongoUri } from "../../src/lib/db/mongo-uri";

const LOCAL_HOST_PATTERNS = [
  "mongodb://localhost",
  "mongodb://127.0.0.1",
  "mongodb://0.0.0.0",
];

export function getMongoUri(): string {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local");
  }
  return uri;
}

export function isLocalDatabase(uri: string): boolean {
  return LOCAL_HOST_PATTERNS.some((pattern) => uri.startsWith(pattern));
}

export function assertDevDatabaseAllowed(action: string) {
  const uri = getMongoUri();
  assertProductionDatabaseBlocked(action, getMongoDatabaseName(uri));

  const allowReset = process.env.ALLOW_DB_RESET === "true";

  if (isLocalDatabase(uri)) {
    return uri;
  }

  if (allowReset) {
    console.warn(
      `Warning: ${action} on non-local database. ALLOW_DB_RESET=true is set.`
    );
    return uri;
  }

  throw new Error(
    `${action} is blocked for non-local databases.\n` +
      `Current MONGODB_URI does not point to localhost.\n` +
      `For a local dev database, use mongodb://localhost:27017/corner-pockets-dev\n` +
      `To override intentionally, set ALLOW_DB_RESET=true in .env.local`
  );
}

export function assertResetConfirmed() {
  if (process.env.CONFIRM_DB_RESET !== "yes") {
    throw new Error(
      "Database reset requires confirmation.\n" +
        "Set CONFIRM_DB_RESET=yes in your environment, then run again.\n" +
        "Example: CONFIRM_DB_RESET=yes npm run db:reset"
    );
  }
}

export const PRODUCTION_DATABASE_NAME = "corner-pockets";
export const TEST10_ALLOWED_DATABASE_NAME = "corner-pockets-dev";

export function maskMongoUri(uri: string): string {
  return uri.replace(/:([^:@/]+)@/, ":****@");
}

/**
 * Database name from a MongoDB URI path, if present.
 * Uses the last path segment so replica-set host lists still resolve.
 */
export function getMongoDatabaseName(uri: string): string | null {
  const withoutQuery = uri.split("?")[0] ?? uri;
  const slash = withoutQuery.lastIndexOf("/");
  if (slash < 0) return null;
  const name = decodeURIComponent(withoutQuery.slice(slash + 1).trim());
  if (!name || name.includes("@") || name.includes(":")) {
    return null;
  }
  return name;
}

export function assertProductionDatabaseBlocked(
  action: string,
  dbName: string | null
) {
  if (dbName === PRODUCTION_DATABASE_NAME) {
    throw new Error(
      `${action} is blocked: database "${PRODUCTION_DATABASE_NAME}" is production/live.\n` +
        `This protection cannot be overridden by ALLOW_DB_RESET or any other environment variable.`
    );
  }
}

function describeResolvedDatabase(dbName: string | null): string {
  return dbName ?? "(none in MONGODB_URI path)";
}

/**
 * TEST10 seed/reset gate.
 * Allows only database `corner-pockets-dev` (Atlas or otherwise).
 * Permanently blocks production `corner-pockets` and every other database name.
 * Does NOT honor ALLOW_DB_RESET.
 */
export function assertTest10DatabaseAllowed(action: string): string {
  const uri = getMongoUri();
  const dbName = getMongoDatabaseName(uri);

  assertProductionDatabaseBlocked(action, dbName);

  if (dbName !== TEST10_ALLOWED_DATABASE_NAME) {
    throw new Error(
      `${action} is blocked: only database "${TEST10_ALLOWED_DATABASE_NAME}" is allowed.\n` +
        `Resolved database: ${describeResolvedDatabase(dbName)}.\n` +
        `Production "${PRODUCTION_DATABASE_NAME}" is permanently blocked.\n` +
        `ALLOW_DB_RESET cannot override this restriction.`
    );
  }

  return uri;
}

export function reportTest10Target(dbName: string | null, mode: string) {
  console.log(`Database: ${describeResolvedDatabase(dbName)}`);
  console.log(`Mode: ${mode}`);
}

export function assertTest10ResetConfirmed() {
  if (process.env.CONFIRM_TEST10_RESET !== "yes") {
    throw new Error(
      "TEST10 test-data reset requires confirmation.\n" +
        "This removes ONLY records created by the 10-day seed (TEST10_ marker).\n" +
        "PowerShell:\n" +
        '  $env:CONFIRM_TEST10_RESET="yes"; npm run seed:test-10-days:reset\n' +
        "bash:\n" +
        "  CONFIRM_TEST10_RESET=yes npm run seed:test-10-days:reset"
    );
  }
}
