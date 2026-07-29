import mongoose, { Schema, type Document, type Model } from "mongoose";
import {
  CAFE_PAYMENT_METHODS,
  type CafeItemType,
  type CafeOrderStatus,
  type CafePaymentMethod,
} from "@/lib/constants/cafe";

export interface ICafeOrderItem {
  type: CafeItemType;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  amount: number;
}

export interface ICafeOrder extends Document {
  businessDayId: mongoose.Types.ObjectId;
  businessDate: Date;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  status: CafeOrderStatus;
  items: ICafeOrderItem[];
  amount: number;
  received: number;
  paymentMethod?: CafePaymentMethod;
  /** Staff who last saved this order's Cash/GPay payment. */
  receivedByStaffId?: mongoose.Types.ObjectId;
  receivedByUsername?: string;
  receivedAt?: Date;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cafeOrderItemSchema = new Schema<ICafeOrderItem>(
  {
    type: {
      type: String,
      enum: ["CIGARETTE", "WATER", "COLD_DRINK", "FOOD"],
      required: true,
    },
    quantity: { type: Number, min: 0 },
    unitPrice: { type: Number, min: 0 },
    description: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const cafeOrderSchema = new Schema<ICafeOrder>(
  {
    businessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      required: true,
      index: true,
    },
    businessDate: { type: Date, required: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["OPEN", "CANCELLED"],
      required: true,
      default: "OPEN",
    },
    items: { type: [cafeOrderItemSchema], default: [] },
    amount: { type: Number, required: true, min: 0, default: 0 },
    received: { type: Number, required: true, min: 0, default: 0 },
    paymentMethod: {
      type: String,
      enum: [...CAFE_PAYMENT_METHODS],
    },
    receivedByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
    },
    receivedByUsername: { type: String, trim: true },
    receivedAt: { type: Date },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

cafeOrderSchema.index({ businessDayId: 1, status: 1, createdAt: -1 });
cafeOrderSchema.index({ customerId: 1, businessDayId: 1 });

/**
 * Next.js can keep a stale compiled Mongoose model across hot reloads.
 * If a payment method is missing from the cached enum,
 * drop and re-register so validation matches the source schema.
 */
function getCafeOrderModel(): Model<ICafeOrder> {
  const cached = mongoose.models.CafeOrder as Model<ICafeOrder> | undefined;
  if (cached) {
    const path = cached.schema.path("paymentMethod") as
      | { enumValues?: string[] }
      | undefined;
    const values = path?.enumValues ?? [];
    const missing = CAFE_PAYMENT_METHODS.some((method) => !values.includes(method));
    if (!missing) {
      return cached;
    }
    delete mongoose.models.CafeOrder;
    // Drop connection-cached copy when present (Next.js hot reload).
    const connectionModels = mongoose.connection.models as Record<
      string,
      Model<unknown> | undefined
    >;
    delete connectionModels.CafeOrder;
  }

  return mongoose.model<ICafeOrder>("CafeOrder", cafeOrderSchema);
}

const CafeOrder = getCafeOrderModel();

export default CafeOrder;
