"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import {
  canViewStaffAccount,
  fromProductRole,
  isAdminRole,
  toProductRole,
  type StaffRole,
} from "@/lib/auth/roles";
import { authorizePermission, requirePermission } from "@/lib/auth/session";
import {
  createUserSchema,
  deleteUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@/lib/validators/staff";
import Staff from "@/models/Staff";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import type { StaffAccountDTO } from "@/types";

type LeanStaff = {
  _id: { toString(): string };
  username: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: Date;
};

function toStaffAccountDTO(staff: LeanStaff): StaffAccountDTO {
  return {
    id: staff._id.toString(),
    username: staff.username,
    name: staff.name,
    role: staff.role,
    isActive: staff.isActive,
    createdAt: staff.createdAt.toISOString(),
  };
}

function revalidateUsersPaths() {
  revalidatePath("/admin/settings/users");
  revalidatePath("/admin/settings");
  revalidatePath("/staff");
  revalidatePath("/admin");
}

/** Resolve product Admin/Staff to stored role; keep existing Admin tier if still Admin. */
function resolveStoredRole(
  currentRole: StaffRole,
  productRole: ReturnType<typeof toProductRole>
): StaffRole {
  if (productRole === "STAFF") {
    return "STAFF";
  }
  // Keep legacy SUPER_MASTER as Admin; new Admins are stored as MASTER.
  return currentRole === "SUPER_MASTER" ? "SUPER_MASTER" : "MASTER";
}

async function countActiveAdminsAfterChange(
  targetId: string,
  nextRole: StaffRole,
  nextIsActive: boolean
): Promise<number> {
  const activeAdmins = await Staff.find({
    role: { $in: ["SUPER_MASTER", "MASTER"] },
    isActive: true,
  })
    .select("_id")
    .lean();

  let count = 0;
  for (const admin of activeAdmins) {
    if (admin._id.toString() === targetId) {
      if (isAdminRole(nextRole) && nextIsActive) {
        count += 1;
      }
      continue;
    }
    count += 1;
  }

  // Target was not an active admin but becomes one.
  const wasActiveAdmin = activeAdmins.some(
    (admin) => admin._id.toString() === targetId
  );
  if (!wasActiveAdmin && isAdminRole(nextRole) && nextIsActive) {
    count += 1;
  }

  return count;
}

export async function getManageableStaff(): Promise<StaffAccountDTO[]> {
  const session = await requirePermission("STAFF_VIEW");
  await connectDB();

  const actorRole = session.user.role as StaffRole;
  if (!canViewStaffAccount(actorRole)) {
    return [];
  }

  const staffAccounts = await Staff.find().sort({ name: 1 }).lean();
  return staffAccounts.map((staff) => toStaffAccountDTO(staff));
}

async function getTargetStaff(
  staffId: string,
  actorId: string,
  actorRole: StaffRole
): Promise<{ target: InstanceType<typeof Staff> } | { error: string }> {
  if (staffId === actorId) {
    return { error: "You cannot modify your own account" };
  }

  if (!canViewStaffAccount(actorRole)) {
    return { error: "You do not have permission to manage users" };
  }

  const target = await Staff.findById(staffId);
  if (!target) {
    return { error: "User not found" };
  }

  return { target };
}

export async function createUserAction(
  formData: FormData
): Promise<ActionResult<StaffAccountDTO>> {
  const authResult = await authorizePermission("STAFF_MANAGE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    isActive: formData.get("isActive") || "true",
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const existing = await Staff.findOne({ username: parsed.data.username });
  if (existing) {
    return failure("Username is already taken");
  }

  const role = fromProductRole(parsed.data.role);
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const created = await Staff.create({
    name: parsed.data.name,
    username: parsed.data.username,
    passwordHash,
    role,
    isActive: parsed.data.isActive,
  });

  revalidateUsersPaths();
  return success(toStaffAccountDTO(created));
}

export async function updateUserAction(
  formData: FormData
): Promise<ActionResult<StaffAccountDTO>> {
  const authResult = await authorizePermission("STAFF_MANAGE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    username: formData.get("username"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const actorRole = authResult.session.user.role as StaffRole;
  const targetResult = await getTargetStaff(
    parsed.data.userId,
    authResult.session.user.id,
    actorRole
  );

  if ("error" in targetResult) {
    return failure(targetResult.error);
  }

  const { target } = targetResult;
  const resolvedRole = resolveStoredRole(
    target.role,
    parsed.data.role
  );

  const activeAdminCount = await countActiveAdminsAfterChange(
    target._id.toString(),
    resolvedRole,
    parsed.data.isActive
  );

  if (activeAdminCount < 1) {
    return failure("There must always be at least one Active Admin");
  }

  if (parsed.data.username !== target.username) {
    const clash = await Staff.findOne({
      username: parsed.data.username,
      _id: { $ne: target._id },
    });
    if (clash) {
      return failure("Username is already taken");
    }
    target.username = parsed.data.username;
  }

  target.name = parsed.data.name;
  target.role = resolvedRole;
  target.isActive = parsed.data.isActive;
  await target.save();

  revalidateUsersPaths();
  return success(toStaffAccountDTO(target));
}

export async function resetUserPasswordAction(
  formData: FormData
): Promise<ActionResult<void>> {
  const authResult = await authorizePermission("STAFF_RESET_PASSWORD");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = resetUserPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const actorRole = authResult.session.user.role as StaffRole;
  const targetResult = await getTargetStaff(
    parsed.data.userId,
    authResult.session.user.id,
    actorRole
  );

  if ("error" in targetResult) {
    return failure(targetResult.error);
  }

  const { target } = targetResult;
  target.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await target.save();

  revalidateUsersPaths();
  return success(undefined);
}

export async function deleteUserAction(
  formData: FormData
): Promise<ActionResult<void>> {
  const authResult = await authorizePermission("STAFF_MANAGE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const actorRole = authResult.session.user.role as StaffRole;
  const targetResult = await getTargetStaff(
    parsed.data.userId,
    authResult.session.user.id,
    actorRole
  );

  if ("error" in targetResult) {
    return failure(
      targetResult.error === "You cannot modify your own account"
        ? "You cannot delete your own account"
        : targetResult.error
    );
  }

  const { target } = targetResult;

  // Deleting an Active Admin must leave at least one Active Admin.
  const activeAdminCount = await countActiveAdminsAfterChange(
    target._id.toString(),
    "STAFF",
    false
  );

  if (activeAdminCount < 1) {
    return failure("There must always be at least one Active Admin");
  }

  await Staff.deleteOne({ _id: target._id });

  revalidateUsersPaths();
  return success(undefined);
}
