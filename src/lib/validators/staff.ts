import { z } from "zod";
import { STAFF_ROLES } from "@/lib/auth/roles";

export const resetStaffPasswordSchema = z.object({
  staffId: z.string().min(1, "Staff member is required"),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),
});

export const setStaffActiveSchema = z.object({
  staffId: z.string().min(1, "Staff member is required"),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

export const updateStaffRoleSchema = z.object({
  staffId: z.string().min(1, "Staff member is required"),
  role: z.enum(STAFF_ROLES),
});
