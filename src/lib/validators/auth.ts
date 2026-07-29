import { z } from "zod";
import {
  normalizePassword,
  normalizeUsername,
} from "@/lib/auth/credentials";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .transform((value) => normalizeUsername(value)),
  password: z
    .string()
    .min(1, "Password is required")
    .transform((value) => normalizePassword(value)),
});

export type LoginInput = z.infer<typeof loginSchema>;
