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
      `For a local dev database, use mongodb://localhost:27017/corner-pockets\n` +
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
