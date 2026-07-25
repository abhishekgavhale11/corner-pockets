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
