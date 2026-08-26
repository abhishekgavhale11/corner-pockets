import { z } from "zod";
import {
  FINANCIAL_CORRECTION_PAYMENT_METHODS,
  FINANCIAL_CORRECTION_SECTIONS,
} from "@/lib/constants/financial-corrections";

const correctionAmount = z.coerce
  .number()
  .int("Amount must be a whole number")
  .positive("Amount must be greater than zero");

const correctionReason = z
  .string()
  .trim()
  .min(3, "Please provide a reason")
  .max(500, "Reason must be 500 characters or fewer");

export const recordMissedPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  affectedBusinessDayId: z.string().min(1, "Affected Business Day is required"),
  amount: correctionAmount,
  paymentMethod: z.enum(FINANCIAL_CORRECTION_PAYMENT_METHODS, {
    message: "Select Cash or GPay",
  }),
  section: z.enum(FINANCIAL_CORRECTION_SECTIONS, {
    message: "Select a section",
  }),
  reason: correctionReason,
});

export const recordOutstandingCorrectionSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  affectedBusinessDayId: z.string().min(1, "Affected Business Day is required"),
  amount: correctionAmount,
  section: z.enum(FINANCIAL_CORRECTION_SECTIONS, {
    message: "Select a section",
  }),
  reason: correctionReason,
});
