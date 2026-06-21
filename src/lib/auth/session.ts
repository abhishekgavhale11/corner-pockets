import type { Session } from "next-auth";
import { auth } from "@/lib/auth/config";
import {
  hasPermission,
  type Permission,
  type StaffRole,
} from "@/lib/auth/roles";
import { failure, type ActionResult } from "@/lib/utils/action-result";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireStaff(): Promise<Session> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requirePermission(
  permission: Permission
): Promise<Session> {
  const session = await requireStaff();

  if (!hasPermission(session.user.role as StaffRole, permission)) {
    throw new ForbiddenError();
  }

  return session;
}

export async function getSessionRole(): Promise<StaffRole | null> {
  const session = await auth();
  return (session?.user?.role as StaffRole | undefined) ?? null;
}

export async function authorizePermission(
  permission: Permission
): Promise<{ session: Session } | ActionResult<never>> {
  try {
    const session = await requirePermission(permission);
    return { session };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return failure("You do not have permission to perform this action");
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return failure("You must be signed in");
    }

    throw error;
  }
}
