import { z } from "zod";
import { parseBusinessDateInput } from "@/lib/utils/business-date";

export const openBusinessDaySchema = z.object({
  businessDate: z
    .string()
    .trim()
    .min(1, "Business Date is required")
    .transform((value, ctx) => {
      try {
        return parseBusinessDateInput(value);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Business Date must be a valid date",
        });
        return z.NEVER;
      }
    }),
  openingCash: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (value == null || value === "") return 0;
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Opening Cash must be a number",
        });
        return z.NEVER;
      }
      if (amount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Opening Cash cannot be negative",
        });
        return z.NEVER;
      }
      return amount;
    }),
});

export const reopenBusinessDaySchema = z.object({
  businessDayId: z.string().min(1, "Business Day is required"),
  reason: z.string().trim().min(1, "Reason is required"),
});
