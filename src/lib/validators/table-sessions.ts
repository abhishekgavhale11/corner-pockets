import { z } from "zod";
import { COUNTER_RATE_TYPES, SNOOKER_GAMES } from "@/lib/constants/counter-rates";
import {
  BIG_SNOOKER_TABLE_IDS,
  POOL_MINI_TABLE_IDS,
} from "@/lib/constants/table-sessions";

export const tableSessionActionSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
});

export const startTableSessionSchema = z.object({
  tableId: z.enum(POOL_MINI_TABLE_IDS),
  rateType: z.enum(COUNTER_RATE_TYPES),
});

export const startBigSnookerSessionSchema = z.object({
  tableId: z.enum(BIG_SNOOKER_TABLE_IDS),
});

export const setBigSnookerSessionGameSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  snookerGame: z.enum(SNOOKER_GAMES),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero"),
});

export const assignTableSessionCustomersSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  customerIds: z.array(z.string().min(1)).min(1, "Select at least one customer"),
});

export const updateSessionGameAmountSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  amount: z.coerce.number().min(0, "Amount must be zero or greater"),
});

export const updateSessionBillAmountsSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  gameAmount: z.coerce.number().min(0, "Game amount must be zero or greater"),
  cafeItems: z
    .array(
      z.object({
        entryId: z.string().min(1),
        amount: z.coerce.number().min(0),
      })
    )
    .default([]),
});
