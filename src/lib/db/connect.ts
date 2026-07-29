import dns from "dns";
import mongoose from "mongoose";
import { normalizeMongoUri } from "@/lib/db/mongo-uri";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
  var customerIndexesReady: Promise<void> | undefined;
  var outstandingIndexesReady: Promise<void> | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function ensureCustomerIndexes() {
  if (!global.customerIndexesReady) {
    global.customerIndexesReady = (async () => {
      try {
        const Customer = (await import("@/models/Customer")).default;
        if (Customer && typeof Customer.syncIndexes === "function") {
          await Customer.syncIndexes();
        }
      } catch (error) {
        console.warn("[corner-pockets] Customer index sync failed:", error);
      }
    })();
  }

  await global.customerIndexesReady;
}

async function ensureOutstandingIndexes() {
  if (!global.outstandingIndexesReady) {
    global.outstandingIndexesReady = (async () => {
      try {
        const Outstanding = (await import("@/models/Outstanding")).default;
        if (!Outstanding || typeof Outstanding.syncIndexes !== "function") {
          return;
        }

        // Drop legacy non-partial customerId index that conflicts with
        // outstanding_opening_customer_unique (same key, different options).
        try {
          const indexes = await Outstanding.collection.indexes();
          const legacy = indexes.find(
            (idx) =>
              idx.name === "customerId_1" &&
              !idx.partialFilterExpression &&
              JSON.stringify(idx.key) === JSON.stringify({ customerId: 1 })
          );
          if (legacy?.name) {
            await Outstanding.collection.dropIndex(legacy.name);
          }
        } catch {
          // Collection may not exist yet on first boot.
        }

        await Outstanding.syncIndexes();
      } catch (error) {
        console.warn("[corner-pockets] Outstanding index sync failed:", error);
      }
    })();
  }

  await global.outstandingIndexesReady;
}

export async function connectDB(): Promise<typeof mongoose> {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);

  if (!uri) {
    throw new Error("Please define MONGODB_URI in your environment variables");
  }

  if (
    !uri.startsWith("mongodb://") &&
    !uri.startsWith("mongodb+srv://")
  ) {
    throw new Error(
      `Invalid MONGODB_URI scheme. Expected mongodb:// or mongodb+srv://. ` +
        `Received: ${JSON.stringify(uri.slice(0, 40))}...`
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  await Promise.all([ensureCustomerIndexes(), ensureOutstandingIndexes()]);
  return cached.conn;
}
