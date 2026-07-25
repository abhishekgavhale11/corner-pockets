import { z } from "zod";
import { USER_PRODUCT_ROLES } from "@/lib/auth/roles";

const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password is too long");

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username is too long")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only use letters, numbers, . _ -"
    )
    .transform((value) => value.toLowerCase()),
  password: passwordSchema,
  role: z.enum(USER_PRODUCT_ROLES),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? true : value === "true")),
});

export const updateUserSchema = z.object({
  userId: z.string().min(1, "User is required"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username is too long")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only use letters, numbers, . _ -"
    )
    .transform((value) => value.toLowerCase()),
  role: z.enum(USER_PRODUCT_ROLES),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

export const resetUserPasswordSchema = z.object({
  userId: z.string().min(1, "User is required"),
  password: passwordSchema,
});

export const deleteUserSchema = z.object({
  userId: z.string().min(1, "User is required"),
});
