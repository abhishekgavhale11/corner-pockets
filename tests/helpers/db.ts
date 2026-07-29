import mongoose from "mongoose";
import { ensureTestEnv } from "./env";

let connected = false;

export async function connectTestDb(): Promise<typeof mongoose> {
  ensureTestEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set for tests.");
  }

  if (connected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri, { bufferCommands: false });
  connected = true;
  return mongoose;
}

export async function disconnectTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connected = false;
}

/** Drop the e2e database so each suite starts from a known empty state. */
export async function resetE2eDatabase(): Promise<void> {
  await connectTestDb();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Mongo connection has no db handle after connect.");
  }
  const name = db.databaseName;
  if (!name.includes("e2e")) {
    throw new Error(
      `Refusing to drop database "${name}" — e2e tests must use an *e2e* database name.`
    );
  }
  await db.dropDatabase();
  connected = false;
  await mongoose.disconnect();
  await connectTestDb();
}
