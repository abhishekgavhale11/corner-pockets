export const STAFF_ROLES = ["SUPER_MASTER", "MASTER", "STAFF"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = {
  CUSTOMER_SEARCH: ["SUPER_MASTER", "MASTER", "STAFF"],
  CUSTOMER_REGISTER: ["SUPER_MASTER", "MASTER", "STAFF"],
  WALLET_RECHARGE: ["SUPER_MASTER", "MASTER", "STAFF"],
  WALLET_DEDUCT: ["SUPER_MASTER", "MASTER", "STAFF"],
  TRANSACTION_VIEW: ["SUPER_MASTER", "MASTER", "STAFF"],
  TRANSACTION_REVERSE: ["SUPER_MASTER", "MASTER", "STAFF"],
  DASHBOARD_VIEW: ["SUPER_MASTER", "MASTER"],
  CUSTOMER_EDIT_DETAILS: ["SUPER_MASTER", "MASTER"],
  CUSTOMER_STUDENT_STATUS: ["SUPER_MASTER", "MASTER"],
  STAFF_VIEW: ["SUPER_MASTER", "MASTER"],
  STAFF_RESET_PASSWORD: ["SUPER_MASTER", "MASTER"],
  STAFF_SET_ACTIVE: ["SUPER_MASTER", "MASTER"],
  STAFF_CHANGE_ROLE: ["SUPER_MASTER"],
} as const satisfies Record<string, StaffRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly StaffRole[]).includes(role);
}

export function roleLabel(role: StaffRole): string {
  switch (role) {
    case "SUPER_MASTER":
      return "Super Master";
    case "MASTER":
      return "Master";
    case "STAFF":
      return "Staff";
  }
}

export function canResetPassword(
  actorRole: StaffRole,
  targetRole: StaffRole
): boolean {
  if (actorRole === "SUPER_MASTER") {
    return true;
  }

  return actorRole === "MASTER" && targetRole === "STAFF";
}

export function canSetActiveStatus(
  actorRole: StaffRole,
  targetRole: StaffRole
): boolean {
  if (actorRole === "SUPER_MASTER") {
    return true;
  }

  return actorRole === "MASTER" && targetRole === "STAFF";
}

export function canChangeRole(actorRole: StaffRole): boolean {
  return actorRole === "SUPER_MASTER";
}

export function canViewStaffAccount(
  actorRole: StaffRole,
  targetRole: StaffRole
): boolean {
  if (actorRole === "SUPER_MASTER") {
    return true;
  }

  return actorRole === "MASTER" && targetRole === "STAFF";
}

export function getDefaultHomePath(role: StaffRole): string {
  return role === "STAFF" ? "/customers" : "/dashboard";
}
