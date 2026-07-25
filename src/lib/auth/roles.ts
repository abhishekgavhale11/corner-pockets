export const STAFF_ROLES = ["SUPER_MASTER", "MASTER", "STAFF"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/** Product-facing roles shown in Users UI (maps to MASTER / STAFF). */
export const USER_PRODUCT_ROLES = ["ADMIN", "STAFF"] as const;
export type UserProductRole = (typeof USER_PRODUCT_ROLES)[number];

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
  STAFF_MANAGE: ["SUPER_MASTER", "MASTER"],
  STAFF_RESET_PASSWORD: ["SUPER_MASTER", "MASTER"],
  STAFF_SET_ACTIVE: ["SUPER_MASTER", "MASTER"],
  STAFF_CHANGE_ROLE: ["SUPER_MASTER", "MASTER"],
  NOTEBOOK_VIEW: ["SUPER_MASTER", "MASTER", "STAFF"],
  NOTEBOOK_ENTRY_CREATE: ["SUPER_MASTER", "MASTER", "STAFF"],
  NOTEBOOK_ENTRY_REVERSE: ["SUPER_MASTER", "MASTER", "STAFF"],
  NOTEBOOK_SETTLE: ["SUPER_MASTER", "MASTER", "STAFF"],
  NOTEBOOK_SETTLEMENT_REVERSE: ["SUPER_MASTER", "MASTER", "STAFF"],
  NOTEBOOK_CLOSING_VIEW: ["SUPER_MASTER", "MASTER", "STAFF"],
  BUSINESS_DAY_MANAGE: ["SUPER_MASTER", "MASTER", "STAFF"],
  EXPENSE_VIEW: ["SUPER_MASTER", "MASTER", "STAFF"],
  EXPENSE_CREATE: ["SUPER_MASTER", "MASTER", "STAFF"],
  EXPENSE_MANAGE: ["SUPER_MASTER", "MASTER"],
} as const satisfies Record<string, StaffRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly StaffRole[]).includes(role);
}

export function isAdminRole(role: StaffRole): boolean {
  return role === "MASTER" || role === "SUPER_MASTER";
}

/** Display label for login accounts (Admin / Staff only). */
export function roleLabel(role: StaffRole): string {
  switch (role) {
    case "SUPER_MASTER":
    case "MASTER":
      return "Admin";
    case "STAFF":
      return "Staff";
  }
}

export function toProductRole(role: StaffRole): UserProductRole {
  return role === "STAFF" ? "STAFF" : "ADMIN";
}

export function fromProductRole(role: UserProductRole): StaffRole {
  return role === "ADMIN" ? "MASTER" : "STAFF";
}

/** Any Admin can manage any login account (except self, enforced in actions). */
export function canManageUsers(actorRole: StaffRole): boolean {
  return isAdminRole(actorRole);
}

export function canResetPassword(actorRole: StaffRole): boolean {
  return isAdminRole(actorRole);
}

export function canSetActiveStatus(actorRole: StaffRole): boolean {
  return isAdminRole(actorRole);
}

export function canChangeRole(actorRole: StaffRole): boolean {
  return isAdminRole(actorRole);
}

export function canViewStaffAccount(actorRole: StaffRole): boolean {
  return isAdminRole(actorRole);
}

export function getDefaultHomePath(role?: StaffRole): string {
  void role;
  return "/counter/big-snooker";
}
