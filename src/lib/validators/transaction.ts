import { z } from "zod";
import { RECHARGE_PLANS } from "@/lib/constants/recharge-plans";
import { REVERSAL_REASON_KEYS } from "@/lib/constants/reversal-reasons";
import { VERIFICATION_METHODS } from "@/lib/constants/verification";

const validPlanKeys = RECHARGE_PLANS.map((plan) => plan.key);

const walletVerificationFields = {
  verificationMethod: z.enum(VERIFICATION_METHODS, {
    message: "Verification method is required",
  }),
  customerConfirmed: z.literal("true", {
    message: "Customer confirmation is required",
  }),
};

export const rechargeSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  planKey: z.enum(validPlanKeys as [string, ...string[]], {
    message: "Please select a valid recharge plan",
  }),
  ...walletVerificationFields,
});

/** Customer-page recharge: amount presets / custom + Cash/GPay. */
export const customerRechargeSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  paidAmount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero")
    .max(100000, "Amount cannot exceed ₹1,00,000"),
  paymentMethod: z.enum(["CASH", "GPAY"], {
    message: "Payment method is required",
  }),
});

export const rechargeAmountsSchema = z
  .object({
    paidAmount: z.number().positive("Paid amount must be greater than zero"),
    bonusAmount: z.number().min(0, "Bonus amount cannot be negative"),
    creditedAmount: z
      .number()
      .positive("Credited amount must be greater than zero"),
  })
  .refine(
    (data) => data.paidAmount + data.bonusAmount === data.creditedAmount,
    { message: "Credited amount must equal paid amount plus bonus" }
  );

export const deductSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero")
    .max(100000, "Amount cannot exceed ₹1,00,000"),
  description: z
    .string()
    .min(2, "Please add a short description")
    .max(200, "Description is too long"),
  ...walletVerificationFields,
});

export type RechargeInput = z.infer<typeof rechargeSchema>;
export type CustomerRechargeInput = z.infer<typeof customerRechargeSchema>;
export type RechargeAmountsInput = z.infer<typeof rechargeAmountsSchema>;
export type DeductInput = z.infer<typeof deductSchema>;

export const reverseTransactionSchema = z
  .object({
    customerId: z.string().min(1, "Customer is required"),
    transactionId: z.string().min(1, "Transaction is required"),
    reversalReason: z.enum(REVERSAL_REASON_KEYS, {
      message: "Please select a reversal reason",
    }),
    reversalReasonOther: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reversalReason === "OTHER") {
      const other = data.reversalReasonOther?.trim();
      if (!other || other.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide details for Other",
          path: ["reversalReasonOther"],
        });
      }
    }
  });

export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;

export const cardIdVerificationSchema = z.object({
  cardId: z
    .string()
    .min(1, "Card ID is required")
    .max(20, "Card ID is too long"),
});

export const phoneVerificationSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number is too long")
    .regex(/^[+\d\s()-]+$/, "Invalid phone number format"),
});
