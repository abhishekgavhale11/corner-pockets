import { z } from "zod";
import { NOTEBOOK_ENTRY_TYPES } from "@/lib/constants/notebook-entry-types";
import {
  NOTEBOOK_PAYMENT_METHODS,
  NOTEBOOK_REVERSAL_REASON_KEYS,
} from "@/lib/constants/notebook-payments";
import { NOTEBOOK_SECTIONS } from "@/lib/constants/notebook-sections";
import { SNOOKER_TABLE_SECTIONS } from "@/lib/constants/counter-sections";
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
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
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
    z.object({
      customerId: z.string().min(1),
      amount: z.coerce.number().int().positive().max(100000),
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

export const correctCafeEntrySchema = z.object({
  entryId: z.string().min(1, "Entry is required"),
  correctionReason: z
    .string()
    .min(3, "Please provide a correction reason")
    .max(500, "Reason is too long"),
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
});

export const addCafeItemsSchema = z
  .object({
    customerId: z.string().optional(),
    tableId: z.enum(CAFE_TABLE_IDS).optional(),
    sessionId: z.string().optional(),
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
  });

export const dailyClosingSchema = z.object({
  date: z.string().optional(),
});
