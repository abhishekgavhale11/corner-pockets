"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import {
  canChangeRole,
  canResetPassword,
  canSetActiveStatus,
  canViewStaffAccount,
  type StaffRole,
} from "@/lib/auth/roles";
import { authorizePermission, requirePermission } from "@/lib/auth/session";
import {
  resetStaffPasswordSchema,
  setStaffActiveSchema,
  updateStaffRoleSchema,
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

export async function getManageableStaff(): Promise<StaffAccountDTO[]> {
  const session = await requirePermission("STAFF_VIEW");
  await connectDB();

  const actorRole = session.user.role as StaffRole;
  const staffAccounts = await Staff.find().sort({ role: 1, name: 1 }).lean();

  return staffAccounts
    .filter((staff) => canViewStaffAccount(actorRole, staff.role))
    .map((staff) => toStaffAccountDTO(staff));
}

async function getTargetStaff(
  staffId: string,
  actorId: string,
  actorRole: StaffRole
): Promise<
  | { target: InstanceType<typeof Staff> }
  | { error: string }
> {
  if (staffId === actorId) {
    return { error: "You cannot modify your own account" as const };
  }

  const target = await Staff.findById(staffId);
  if (!target) {
    return { error: "Staff member not found" as const };
  }

  if (!canViewStaffAccount(actorRole, target.role)) {
    return {
      error: "You do not have permission to manage this account" as const,
    };
  }

  return { target };
}

export async function resetStaffPassword(
  formData: FormData
): Promise<ActionResult<void>> {
  const authResult = await authorizePermission("STAFF_RESET_PASSWORD");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = resetStaffPasswordSchema.safeParse({
    staffId: formData.get("staffId"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const actorRole = authResult.session.user.role as StaffRole;
  const targetResult = await getTargetStaff(
    parsed.data.staffId,
    authResult.session.user.id,
    actorRole
  );

  if ("error" in targetResult) {
    return failure(targetResult.error);
  }

  const { target } = targetResult;

  if (!canResetPassword(actorRole, target.role)) {
    return failure("You do not have permission to reset this account password");
  }

  target.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await target.save();

  revalidatePath("/staff");

  return success(undefined);
}

export async function setStaffActiveStatus(
  formData: FormData
): Promise<ActionResult<StaffAccountDTO>> {
  const authResult = await authorizePermission("STAFF_SET_ACTIVE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = setStaffActiveSchema.safeParse({
    staffId: formData.get("staffId"),
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const actorRole = authResult.session.user.role as StaffRole;
  const targetResult = await getTargetStaff(
    parsed.data.staffId,
    authResult.session.user.id,
    actorRole
  );

  if ("error" in targetResult) {
    return failure(targetResult.error);
  }

  const { target } = targetResult;

  if (!canSetActiveStatus(actorRole, target.role)) {
    return failure("You do not have permission to change this account status");
  }

  if (target.isActive === parsed.data.isActive) {
    return failure(
      parsed.data.isActive
        ? "This account is already active"
        : "This account is already inactive"
    );
  }

  target.isActive = parsed.data.isActive;
  await target.save();

  revalidatePath("/staff");

  return success(toStaffAccountDTO(target));
}

export async function updateStaffRole(
  formData: FormData
): Promise<ActionResult<StaffAccountDTO>> {
  const authResult = await authorizePermission("STAFF_CHANGE_ROLE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = updateStaffRoleSchema.safeParse({
    staffId: formData.get("staffId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const actorRole = authResult.session.user.role as StaffRole;

  if (!canChangeRole(actorRole)) {
    return failure("You do not have permission to change roles");
  }

  const targetResult = await getTargetStaff(
    parsed.data.staffId,
    authResult.session.user.id,
    actorRole
  );

  if ("error" in targetResult) {
    return failure(targetResult.error);
  }

  const { target } = targetResult;

  if (target.role === parsed.data.role) {
    return failure("This account already has the selected role");
  }

  target.role = parsed.data.role;
  await target.save();

  revalidatePath("/staff");

  return success(toStaffAccountDTO(target));
}
