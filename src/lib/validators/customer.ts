import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
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

export const customerSearchSchema = z.object({
  query: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateStudentStatusSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  isStudent: z
    .enum(["true", "false"])
    .transform((val) => val === "true"),
});

export const updateCustomerDetailsSchema = createCustomerSchema
  .pick({ name: true, phone: true })
  .extend({
    customerId: z.string().min(1, "Customer is required"),
  });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
export type UpdateStudentStatusInput = z.infer<typeof updateStudentStatusSchema>;
export type UpdateCustomerDetailsInput = z.infer<
  typeof updateCustomerDetailsSchema
>;
