import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import { normalizePassword } from "@/lib/auth/credentials";
import type { StaffRole } from "@/lib/auth/roles";
import Staff from "@/models/Staff";

const DEFAULT_PASSWORD = normalizePassword("corner123");

const REQUIRED_ACCOUNTS: {
  username: string;
  role: StaffRole;
}[] = [
  { username: "abhishek", role: "SUPER_MASTER" },
  { username: "wani", role: "MASTER" },
  { username: "rahul", role: "STAFF" },
  { username: "kartik", role: "STAFF" },
  { username: "mahendra", role: "STAFF" },
  { username: "shubham", role: "STAFF" },
];

type LegacyStaffDoc = {
  _id: { toString(): string };
  username?: string;
  password?: string;
  passwordHash?: string;
  name?: string;
  role?: StaffRole;
  isActive?: boolean;
};

/**
 * Migrate old bcrypt passwordHash documents → plain `password` field
 * so Admin Users can show the password and login works.
 */
export async function migrateLegacyPasswordStorage(): Promise<void> {
  const docs = (await Staff.collection
    .find({})
    .toArray()) as unknown as LegacyStaffDoc[];

  for (const doc of docs) {
    const updates: Record<string, unknown> = {};
    const unsets: Record<string, 1> = {};

    const hasPlain =
      typeof doc.password === "string" && doc.password.trim().length > 0;

    if (hasPlain) {
      const normalized = normalizePassword(doc.password!);
      if (normalized !== doc.password) {
        updates.password = normalized;
      }
    } else if (typeof doc.passwordHash === "string") {
      let recovered: string | null = null;
      for (const candidate of [DEFAULT_PASSWORD, "changeme", "corner123"]) {
        try {
          const ok = await bcrypt.compare(candidate, doc.passwordHash);
          if (ok) {
            recovered = normalizePassword(candidate);
            break;
          }
        } catch {
          /* ignore bad hash */
        }
      }
      // Recoverable default for club accounts; admin can change anytime in Users.
      updates.password = recovered ?? DEFAULT_PASSWORD;
    } else {
      updates.password = DEFAULT_PASSWORD;
    }

    if (doc.passwordHash !== undefined) {
      unsets.passwordHash = 1;
    }
    if (doc.name !== undefined) {
      unsets.name = 1;
    }

    const updateDoc: Record<string, unknown> = {};
    if (Object.keys(updates).length > 0) {
      updateDoc.$set = updates;
    }
    if (Object.keys(unsets).length > 0) {
      updateDoc.$unset = unsets;
    }

    if (Object.keys(updateDoc).length > 0) {
      await Staff.collection.updateOne({ _id: doc._id }, updateDoc);
    }
  }
}

export async function ensureDefaultStaff(): Promise<void> {
  await connectDB();
  await migrateLegacyPasswordStorage();

  await Staff.updateMany(
    { $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: "STAFF" } }
  );

  for (const account of REQUIRED_ACCOUNTS) {
    const existing = await Staff.findOne({ username: account.username });

    if (existing) {
      if (existing.role !== account.role) {
        existing.role = account.role;
        await existing.save();
        console.log(
          `[corner-pockets] Updated staff account ${account.username}`
        );
      }
      continue;
    }

    try {
      await Staff.create({
        username: account.username,
        password: DEFAULT_PASSWORD,
        role: account.role,
        isActive: true,
      });

      console.log(
        `[corner-pockets] Created staff account ${account.username} (${account.role})`
      );
    } catch (error) {
      const mongoError = error as { code?: number };
      if (mongoError.code !== 11000) {
        throw error;
      }
    }
  }
}
