import { z } from "zod";
import {
  normalizePassword,
  normalizeUsername,
} from "@/lib/auth/credentials";
import { USER_PRODUCT_ROLES } from "@/lib/auth/roles";

const passwordSchema = z
  .string()
  .transform((value) => normalizePassword(value))
  .pipe(
    z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password is too long")
  );

const usernameSchema = z
  .string()
  .transform((value) => normalizeUsername(value))
  .pipe(
    z
      .string()
      .min(2, "Username must be at least 2 characters")
      .max(40, "Username is too long")
      .regex(
        /^[a-z0-9._-]+$/,
        "Username may only use letters, numbers, . _ -"
      )
  );

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(USER_PRODUCT_ROLES),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? true : value === "true")),
});

export const updateUserSchema = z.object({
  userId: z.string().min(1, "User is required"),
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(USER_PRODUCT_ROLES),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

export const deleteUserSchema = z.object({
  userId: z.string().min(1, "User is required"),
});
