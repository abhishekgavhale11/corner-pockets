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
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
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
  return cached.conn;
}
