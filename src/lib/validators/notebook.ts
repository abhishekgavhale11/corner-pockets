import { z } from "zod";
import { NOTEBOOK_ENTRY_TYPES } from "@/lib/constants/notebook-entry-types";
import {
  NOTEBOOK_PAYMENT_METHODS,
  NOTEBOOK_REVERSAL_REASON_KEYS,
} from "@/lib/constants/notebook-payments";
import { NOTEBOOK_SECTIONS } from "@/lib/constants/notebook-sections";
import { SNOOKER_TABLE_SECTIONS, POOL_MINI_SECTIONS } from "@/lib/constants/counter-sections";
import { CAFE_TABLE_IDS } from "@/lib/constants/counter-sections";
import {
  COUNTER_RATE_TYPES,
  SNOOKER_GAMES,
} from "@/lib/constants/counter-rates";
import { VERIFICATION_METHODS } from "@/lib/constants/verification";

const optionalPhoneSchema = z
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
  );

export const createQuickNotebookCustomerSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long")
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1, "First name is required"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long")
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1, "Last name is required"),
  phone: optionalPhoneSchema,
});

export const createQuickCustomerSchema = createQuickNotebookCustomerSchema;

export const createNotebookCustomerSchema = createQuickCustomerSchema;

export const createNotebookEntrySchema = z
  .object({
    section: z.enum(NOTEBOOK_SECTIONS),
    type: z.enum(NOTEBOOK_ENTRY_TYPES),
    amount: z.coerce
      .number()
      .int("Amount must be a whole number")
      .positive("Amount must be greater than zero")
      .max(100000, "Amount is too large"),
    customerId: z.string().min(1, "Customer is required"),
    rateType: z.enum(COUNTER_RATE_TYPES).optional(),
    snookerGame: z.enum(SNOOKER_GAMES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "SNOOKER" && !data.snookerGame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snooker game is required",
        path: ["snookerGame"],
      });
    }
    if (
      (data.type === "SNOOKER" || data.type === "MINI" || data.type === "POOL") &&
      !data.rateType
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rate type is required",
        path: ["rateType"],
      });
    }
  });

export const createQuickCounterEntrySchema = z
  .object({
    section: z.enum(NOTEBOOK_SECTIONS),
    type: z.enum(["SNOOKER", "MINI", "POOL"]),
    rateType: z.enum(COUNTER_RATE_TYPES),
    snookerGame: z.enum(SNOOKER_GAMES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "SNOOKER" && !data.snookerGame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snooker game is required",
        path: ["snookerGame"],
      });
    }
    if (data.type !== "SNOOKER" && data.snookerGame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snooker game is only valid for Snooker entries",
        path: ["snookerGame"],
      });
    }
  });

export const createRummyCounterEntrySchema = z.object({
  section: z.enum(SNOOKER_TABLE_SECTIONS),
  playerCount: z.coerce
    .number()
    .int("Players must be a whole number")
    .min(2, "At least 2 players")
    .max(20, "Too many players"),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero")
    .max(100000, "Amount is too large"),
});

export const createSnookerFrameEntrySchema = z
  .object({
    section: z.enum(SNOOKER_TABLE_SECTIONS),
    frameType: z.enum(["SINGLES", "INDIVIDUAL", "SHUFFLE", "RUMMY"]),
    amount: z.coerce
      .number()
      .int("Amount must be a whole number")
      .positive("Amount must be greater than zero")
      .max(100000, "Amount is too large"),
    playerCount: z.coerce
      .number()
      .int("Players must be a whole number")
      .min(2, "At least 2 players")
      .max(20, "Too many players")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.frameType === "RUMMY" && data.playerCount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Player count is required for Rummy",
        path: ["playerCount"],
      });
    }
    if (data.frameType !== "RUMMY" && data.playerCount !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Player count is only valid for Rummy",
        path: ["playerCount"],
      });
    }
  });

export const updateSnookerFrameEntrySchema = z
  .object({
    entryId: z.string().min(1, "Entry is required"),
    frameType: z.enum(["SINGLES", "INDIVIDUAL", "SHUFFLE", "RUMMY"]),
    amount: z.coerce
      .number()
      .int("Amount must be a whole number")
      .positive("Amount must be greater than zero")
      .max(100000, "Amount is too large"),
    paidAmount: z.coerce
      .number()
      .int("Received amount must be a whole number")
      .min(0, "Received amount cannot be negative")
      .max(100000, "Received amount is too large")
      .default(0),
    paymentMethod: z.enum(["CASH", "GPAY", "WALLET"]).optional(),
    useWallet: z.boolean().optional().default(false),
    walletAmount: z.coerce
      .number()
      .int("Wallet amount must be a whole number")
      .min(0, "Wallet amount cannot be negative")
      .max(100000, "Wallet amount is too large")
      .optional(),
    playerCount: z.coerce
      .number()
      .int("Players must be a whole number")
      .min(2, "At least 2 players")
      .max(20, "Too many players")
      .optional(),
    entryTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Enter a valid time"),
    customerId: z.string().min(1).optional(),
    /** Split frames store payment per contributor — skip entry-level payment rules. */
    splitBilling: z.literal("true").optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.splitBilling) {
      if (data.paidAmount > data.amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Received amount cannot exceed frame amount",
          path: ["paidAmount"],
        });
      }
      if (data.paidAmount > 0 && !data.paymentMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select Cash, GPay, or Wallet when received amount is greater than zero",
          path: ["paymentMethod"],
        });
      }
      if (
        data.walletAmount !== undefined &&
        data.walletAmount > data.paidAmount
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Wallet amount cannot exceed received amount",
          path: ["walletAmount"],
        });
      }
    }
    if (data.frameType === "RUMMY" && data.playerCount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Player count is required for Rummy",
        path: ["playerCount"],
      });
    }
    if (data.frameType !== "RUMMY" && data.playerCount !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Player count is only valid for Rummy",
        path: ["playerCount"],
      });
    }
  });

export const createPoolMiniEntrySchema = z.object({
  section: z.enum(POOL_MINI_SECTIONS),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero")
    .max(100000, "Amount is too large"),
  rateType: z.enum(COUNTER_RATE_TYPES).default("REGULAR"),
});

export const updatePoolMiniEntrySchema = z
  .object({
    entryId: z.string().min(1, "Entry is required"),
    amount: z.coerce
      .number()
      .int("Amount must be a whole number")
      .positive("Amount must be greater than zero")
      .max(100000, "Amount is too large"),
    paidAmount: z.coerce
      .number()
      .int("Received amount must be a whole number")
      .min(0, "Received amount cannot be negative")
      .max(100000, "Received amount is too large")
      .default(0),
    paymentMethod: z.enum(["CASH", "GPAY", "WALLET"]).optional(),
    useWallet: z.boolean().optional().default(false),
    walletAmount: z.coerce
      .number()
      .int("Wallet amount must be a whole number")
      .min(0, "Wallet amount cannot be negative")
      .max(100000, "Wallet amount is too large")
      .optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid start time"),
    endTime: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined))
      .pipe(
        z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Enter a valid end time")
          .optional()
      ),
    notes: z
      .string()
      .max(500, "Notes are too long")
      .optional()
      .transform((value) => value?.trim() ?? ""),
    customerId: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paidAmount > data.amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Received amount cannot exceed amount",
        path: ["paidAmount"],
      });
    }
    if (data.paidAmount > 0 && !data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select Cash, GPay, or Wallet when received amount is greater than zero",
        path: ["paymentMethod"],
      });
    }
    if (
      data.walletAmount !== undefined &&
      data.walletAmount > data.paidAmount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wallet amount cannot exceed received amount",
        path: ["walletAmount"],
      });
    }
    if (data.endTime) {
      const [sh, sm] = data.startTime.split(":").map(Number);
      const [eh, em] = data.endTime.split(":").map(Number);
      if (eh * 60 + em < sh * 60 + sm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time cannot be before start time",
          path: ["endTime"],
        });
      }
    }
  });

export const correctCounterEntrySchema = z.object({
  entryId: z.string().min(1, "Entry is required"),
  correctionReason: z
    .string()
    .min(3, "Please provide a correction reason")
    .max(500, "Reason is too long"),
  customerId: z.string().optional(),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero")
    .max(100000, "Amount is too large")
    .optional(),
  playerCount: z.coerce
    .number()
    .int("Players must be a whole number")
    .min(2, "At least 2 players")
    .max(20, "Too many players")
    .optional(),
});

export const setEntryContributorsSchema = z.object({
  entryId: z.string().min(1, "Entry is required"),
  contributors: z.array(
    z
      .object({
        customerId: z.string().min(1),
        amount: z.coerce.number().int().positive().max(100000),
        paidAmount: z.coerce
          .number()
          .int()
          .min(0)
          .max(100000)
          .optional()
          .default(0),
        paymentMethod: z.enum(["CASH", "GPAY", "WALLET"]).optional(),
        useWallet: z.boolean().optional().default(false),
        walletAmount: z.coerce
          .number()
          .int()
          .min(0)
          .max(100000)
          .optional(),
      })
      .superRefine((row, ctx) => {
        if ((row.paidAmount ?? 0) > row.amount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Received amount cannot exceed contributor amount",
            path: ["paidAmount"],
          });
        }
        if ((row.paidAmount ?? 0) > 0 && !row.paymentMethod) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select Cash or GPay.",
            path: ["paymentMethod"],
          });
        }
        if (
          row.walletAmount !== undefined &&
          row.walletAmount > (row.paidAmount ?? 0)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Wallet amount cannot exceed received amount",
            path: ["walletAmount"],
          });
        }
      })
  ),
});

export const assignCounterEntryCustomerSchema = z.object({
  entryId: z.string().min(1, "Entry is required"),
  customerId: z.string().min(1, "Customer is required"),
});

export const notebookCustomerSearchSchema = z.object({
  query: z.string().max(100).optional(),
});

export const updateCustomerNotesSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  notes: z.string().max(500, "Notes are too long"),
});

export const sectionLedgerSchema = z.object({
  section: z.enum(NOTEBOOK_SECTIONS),
  date: z.string().optional(),
});

export const reverseNotebookEntrySchema = z
  .object({
    entryId: z.string().min(1, "Entry is required"),
    reversalReason: z.enum(NOTEBOOK_REVERSAL_REASON_KEYS),
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

export const settleNotebookEntriesSchema = z
  .object({
    entryIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one entry"),
    allocations: z
      .array(
        z.object({
          entryId: z.string().min(1),
          amount: z.coerce.number().int().positive(),
        })
      )
      .optional(),
    paymentMethod: z.enum(NOTEBOOK_PAYMENT_METHODS),
    paidByName: z.string().min(2, "Payer name is required").max(100),
    paidByCustomerId: z.string().optional(),
    idempotencyKey: z.string().uuid("Invalid settlement request"),
    verificationMethod: z.enum(VERIFICATION_METHODS).optional(),
    customerConfirmed: z.literal("true").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "WALLET") {
      if (!data.paidByCustomerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Wallet payer is required",
          path: ["paidByCustomerId"],
        });
      }
      if (!data.verificationMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Verification method is required",
          path: ["verificationMethod"],
        });
      }
      if (data.customerConfirmed !== "true") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Customer confirmation is required",
          path: ["customerConfirmed"],
        });
      }
    }
  });

export const reverseNotebookSettlementSchema = z
  .object({
    settlementId: z.string().min(1, "Settlement is required"),
    reversalReason: z.enum(NOTEBOOK_REVERSAL_REASON_KEYS),
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

export const openTabSearchSchema = z.object({
  query: z.string().max(100).optional(),
});

export const cancelCounterEntrySchema = z
  .object({
    entryId: z.string().min(1, "Entry is required"),
    cancellationReason: z.enum(NOTEBOOK_REVERSAL_REASON_KEYS),
    cancellationReasonOther: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cancellationReason === "OTHER") {
      const other = data.cancellationReasonOther?.trim();
      if (!other || other.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide details for Other",
          path: ["cancellationReasonOther"],
        });
      }
    }
  });

/** Soft-delete a frame while the Business Day is still OPEN. */
export const deleteFrameSchema = z.object({
  entryId: z.string().min(1, "Entry is required"),
});

export const correctCafeEntrySchema = z
  .object({
    entryId: z.string().min(1, "Entry is required"),
    correctionReason: z
      .string()
      .max(500, "Reason is too long")
      .optional()
      .transform((value) => value?.trim() ?? ""),
    quantity: z.coerce
      .number()
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1")
      .max(99, "Quantity is too large")
      .optional(),
    amount: z.coerce
      .number()
      .int("Amount must be a whole number")
      .positive("Amount must be greater than zero")
      .max(100000, "Amount is too large")
      .optional(),
    itemNote: z.string().max(200, "Note is too long").optional(),
    paidAmount: z.coerce
      .number()
      .int("Received amount must be a whole number")
      .min(0, "Received amount cannot be negative")
      .max(100000, "Received amount is too large")
      .optional(),
    paymentMethod: z.enum(["CASH", "GPAY", "WALLET"]).optional(),
    useWallet: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.paidAmount !== undefined && data.amount !== undefined) {
      if (data.paidAmount > data.amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Received amount cannot exceed item amount",
          path: ["paidAmount"],
        });
      }
    }
    if (
      data.paidAmount !== undefined &&
      data.paidAmount > 0 &&
      !data.paymentMethod
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select Cash, GPay, or Wallet when received amount is greater than zero",
        path: ["paymentMethod"],
      });
    }
  });

export const addCafeItemsSchema = z
  .object({
    customerId: z.string().optional(),
    tableId: z.enum(CAFE_TABLE_IDS).optional(),
    sessionId: z.string().optional(),
    paidAmount: z.coerce
      .number()
      .int("Received amount must be a whole number")
      .min(0, "Received amount cannot be negative")
      .max(100000, "Received amount is too large")
      .default(0),
    paymentMethod: z.enum(["CASH", "GPAY", "WALLET"]).optional(),
    useWallet: z.boolean().optional().default(false),
    items: z
      .array(
        z.object({
          type: z.enum(NOTEBOOK_ENTRY_TYPES),
          quantity: z.coerce.number().int().min(1).max(99),
          unitPrice: z.coerce.number().int().positive().max(100000),
          note: z.string().max(200).optional(),
        })
      )
      .min(1, "Select at least one item"),
  })
  .superRefine((data, ctx) => {
    const hasCustomer = Boolean(data.customerId?.trim());
    const hasTable = Boolean(data.tableId);
    if (hasCustomer === hasTable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Assign to either a customer or a table",
        path: ["customerId"],
      });
    }

    const orderAmount = data.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    if (data.paidAmount > orderAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Received amount cannot exceed item amount",
        path: ["paidAmount"],
      });
    }

    if (data.paidAmount > 0 && !data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select Cash, GPay, or Wallet when received amount is greater than zero",
        path: ["paymentMethod"],
      });
    }

    if (data.paidAmount > 0 && !hasCustomer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Assign a customer before recording payment",
        path: ["customerId"],
      });
    }
  });

export const recordCustomerBalancePaymentSchema = z
  .object({
    customerId: z.string().min(1, "Customer is required"),
    amount: z.coerce.number().int().positive("Enter a valid amount"),
    paymentMethod: z.enum(NOTEBOOK_PAYMENT_METHODS),
    verificationMethod: z.enum(VERIFICATION_METHODS).optional(),
    entryIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "WALLET" && !data.verificationMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wallet verification is required",
        path: ["verificationMethod"],
      });
    }
  });

export const dailyClosingSchema = z.object({
  date: z.string().optional(),
});
