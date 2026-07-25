import { z } from "zod";

const namePartSchema = z
  .string()
  .min(1, "Required")
  .max(50, "Too long")
  .transform((val) => val.trim())
  .refine((val) => val.length >= 1, "Required");

export const createCustomerSchema = z.object({
  firstName: namePartSchema,
  lastName: namePartSchema,
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number is too long")
    .regex(/^[+\d\s()-]+$/, "Invalid phone number format"),
  isStudent: z.preprocess(
    (val) => (val === null || val === undefined ? undefined : val),
    z
      .enum(["true", "false", "on", ""])
      .optional()
      .transform((val) => val === "true" || val === "on")
  ),
});

export const quickCustomerSchema = z.object({
  firstName: namePartSchema,
  lastName: namePartSchema,
  phone: z
    .string()
    .optional()
    .transform((val) => val?.trim() ?? "")
    .pipe(
      z.union([
        z.literal(""),
        z
          .string()
          .min(10, "Phone number must be at least 10 digits")
          .max(15, "Phone number is too long")
          .regex(/^[+\d\s()-]+$/, "Invalid phone number format"),
      ])
    ),
});

export const customerSearchSchema = z.object({
  query: z.string().max(100).optional(),
  filter: z.enum(["all", "outstanding"]).optional().default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const customerActivityFilterSchema = z.object({
  customerId: z.string().min(1),
  filter: z
    .enum([
      "all",
      "counter",
      "cafe",
      "payments",
      "wallet",
      "transactions",
      "reversals",
    ])
    .optional()
    .default("all")
    .transform((value) => (value === "wallet" ? "transactions" : value)),
});

export const updateStudentStatusSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  isStudent: z
    .enum(["true", "false"])
    .transform((val) => val === "true"),
});

export const updateCustomerDetailsSchema = createCustomerSchema
  .pick({ firstName: true, lastName: true, phone: true })
  .extend({
    customerId: z.string().min(1, "Customer is required"),
    cardId: z
      .string()
      .max(20, "Card ID is too long")
      .optional()
      .transform((value) => value?.trim() ?? ""),
  });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
export type UpdateStudentStatusInput = z.infer<typeof updateStudentStatusSchema>;
export type UpdateCustomerDetailsInput = z.infer<
  typeof updateCustomerDetailsSchema
>;

export const enableWalletMembershipSchema = z
  .object({
    customerId: z.string().min(1, "Customer is required"),
    phone: z.string().optional(),
    isStudent: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : val),
      z
        .enum(["true", "false", "on", ""])
        .optional()
        .transform((val) => val === "true" || val === "on")
    ),
  })
  .superRefine((data, ctx) => {
    const phone = data.phone?.trim();
    if (phone && phone.length > 0) {
      if (phone.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone number must be at least 10 digits",
          path: ["phone"],
        });
      }
    }
  });
