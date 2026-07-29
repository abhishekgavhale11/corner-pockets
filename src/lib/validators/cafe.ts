import { z } from "zod";
import { CAFE_ITEM_TYPES, CAFE_PAYMENT_METHODS } from "@/lib/constants/cafe";

const qtyItemSchema = z.object({
  type: z.enum(["CIGARETTE", "WATER"]),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().int().min(0).optional(),
});

const manualItemSchema = z.object({
  type: z.enum(["COLD_DRINK", "FOOD"]),
  quantity: z.coerce.number().int().min(0).optional(),
  unitPrice: z.coerce.number().int().min(0).optional(),
  description: z.string().trim().min(1, "Description is required"),
  amount: z.coerce.number().int().min(1, "Amount must be at least ₹1"),
});

export const cafeOrderItemInputSchema = z.union([
  qtyItemSchema,
  manualItemSchema,
]);

export const cafeOrderItemsSchema = z
  .array(cafeOrderItemInputSchema)
  .min(1, "Add at least one cafe item");

function paymentRefine(
  data: { received: number; paymentMethod?: string },
  ctx: z.RefinementCtx
) {
  if (data.received > 0 && !data.paymentMethod) {
    ctx.addIssue({
      code: "custom",
      message: "Payment Mode is required when Received > 0",
      path: ["paymentMethod"],
    });
  }
}

export const createCafeOrderSchema = z
  .object({
    customerId: z.string().optional(),
    items: cafeOrderItemsSchema,
    received: z.coerce.number().int().min(0).default(0),
    paymentMethod: z.enum(CAFE_PAYMENT_METHODS).optional(),
  })
  .superRefine(paymentRefine);

export const updateCafeOrderSchema = z
  .object({
    orderId: z.string().min(1),
    items: cafeOrderItemsSchema,
    received: z.coerce.number().int().min(0),
    paymentMethod: z.enum(CAFE_PAYMENT_METHODS).optional(),
  })
  .superRefine(paymentRefine);

export const assignCafeOrderCustomerSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
});

export const deleteCafeOrderSchema = z.object({
  orderId: z.string().min(1),
});

/** @deprecated Use deleteCafeOrderSchema */
export const deleteUnassignedCafeOrderSchema = deleteCafeOrderSchema;

export const createCafePurchaseSchema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().int().min(1),
  description: z.string().trim().min(1),
  vendor: z.string().trim().optional(),
  paymentMethod: z.enum(CAFE_PAYMENT_METHODS),
  notes: z.string().trim().optional(),
});

export type CafeOrderItemInput = z.infer<typeof cafeOrderItemInputSchema>;
