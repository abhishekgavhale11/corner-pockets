import { z } from "zod";
import { OUTSTANDING_PAYMENT_METHODS } from "@/lib/constants/outstanding";

export const collectCustomerOutstandingSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  receivedAmount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Received amount must be greater than zero"),
  paymentMethod: z.enum(OUTSTANDING_PAYMENT_METHODS, {
    message: "Select Cash or GPay",
  }),
});

export const createOpeningOutstandingSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero"),
  reason: z
    .string()
    .trim()
    .max(500, "Reason must be 500 characters or fewer")
    .optional()
    .or(z.literal("")),
  /** YYYY-MM-DD or empty */
  effectiveDate: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) =>
        !value ||
        value === "" ||
        /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Effective Date must be YYYY-MM-DD"
    ),
});

/** @deprecated Per-record collection — use collectCustomerOutstandingSchema */
export const collectOutstandingSchema = z.object({
  outstandingId: z.string().min(1, "Outstanding record is required"),
  receivedAmount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Received amount must be greater than zero"),
  paymentMethod: z.enum(OUTSTANDING_PAYMENT_METHODS, {
    message: "Select Cash or GPay",
  }),
});
