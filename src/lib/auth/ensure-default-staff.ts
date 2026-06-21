import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import type { StaffRole } from "@/lib/auth/roles";
import Staff from "@/models/Staff";

const DEFAULT_PASSWORD = "corner123";

const REQUIRED_ACCOUNTS: {
  username: string;
  name: string;
  role: StaffRole;
}[] = [
  { username: "abhishek", name: "Abhishek", role: "SUPER_MASTER" },
  { username: "wani", name: "Vani", role: "MASTER" },
  { username: "rahul", name: "Rahul", role: "STAFF" },
  { username: "kartik", name: "Kartik", role: "STAFF" },
  { username: "mahendra", name: "Mahendra", role: "STAFF" },
  { username: "shubham", name: "Shubham", role: "STAFF" },
];

/** Legacy password from the removed seed:staff script. */
const LEGACY_SEED_PASSWORD = "changeme";

async function migrateLegacyAdminPassword(): Promise<void> {
  const existingAdmin = await Staff.findOne({ username: "admin" });

  if (!existingAdmin) {
    return;
  }

  const usesLegacyPassword = await bcrypt.compare(
    LEGACY_SEED_PASSWORD,
    existingAdmin.passwordHash
  );

  if (usesLegacyPassword) {
    existingAdmin.passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    await existingAdmin.save();
    console.log(
      "[corner-pockets] Updated legacy admin password to corner123"
    );
  }
}

export async function ensureDefaultStaff(): Promise<void> {
  await connectDB();
  await migrateLegacyAdminPassword();

  await Staff.updateMany(
    { $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: "STAFF" } }
  );

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const account of REQUIRED_ACCOUNTS) {
    const existing = await Staff.findOne({ username: account.username });

    if (existing) {
      let changed = false;

      if (existing.name !== account.name) {
        existing.name = account.name;
        changed = true;
      }

      if (existing.role !== account.role) {
        existing.role = account.role;
        changed = true;
      }

      if (changed) {
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
        passwordHash,
        name: account.name,
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
