import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  OutstandingPaymentMethod,
  OutstandingSourceType,
  OutstandingStatus,
} from "@/lib/constants/outstanding";

export interface IOutstanding extends Document {
  outstandingNumber: number;
  customerId: mongoose.Types.ObjectId;
  /** Required for FRAME/CAFE. Absent for OPENING (no fake Business Day). */
  businessDayId?: mongoose.Types.ObjectId;
  /** Business Date for BD-created rows; for OPENING, effective/migration date basis. */
  businessDate?: Date;
  sourceType: OutstandingSourceType;
  /** Required for FRAME/CAFE provenance. Absent for OPENING. */
  sourceRecordId?: mongoose.Types.ObjectId;
  originalAmount: number;
  remainingAmount: number;
  status: OutstandingStatus;
  collectedAt?: Date;
  paymentMethod?: OutstandingPaymentMethod;
  /** OPENING audit: optional cashier/admin note. */
  reason?: string;
  /** OPENING audit: optional migration/effective date (display). */
  effectiveDate?: Date;
  /** OPENING audit: admin username who created the row. */
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const outstandingSchema = new Schema<IOutstanding>(
  {
    outstandingNumber: { type: Number, required: true, unique: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    businessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      required: false,
      index: true,
    },
    businessDate: { type: Date, required: false },
    sourceType: {
      type: String,
      enum: ["FRAME", "CAFE", "OPENING"],
      required: true,
    },
    sourceRecordId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookEntry",
      required: false,
    },
    originalAmount: { type: Number, required: true, min: 1 },
    remainingAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "COLLECTED"],
      required: true,
      default: "PENDING",
    },
    collectedAt: { type: Date },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY"],
    },
    reason: { type: String, maxlength: 500 },
    effectiveDate: { type: Date },
    createdBy: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

// BD-created rows only — OPENING has no businessDayId / sourceRecordId.
outstandingSchema.index(
  {
    businessDayId: 1,
    sourceRecordId: 1,
    customerId: 1,
    sourceType: 1,
  },
  {
    unique: true,
    name: "outstanding_bd_source_unique",
    partialFilterExpression: {
      sourceType: { $in: ["FRAME", "CAFE"] },
      businessDayId: { $exists: true },
      sourceRecordId: { $exists: true },
    },
  }
);

// At most one Opening Outstanding per customer.
outstandingSchema.index(
  { customerId: 1 },
  {
    unique: true,
    name: "outstanding_opening_customer_unique",
    partialFilterExpression: { sourceType: "OPENING" },
  }
);

outstandingSchema.index({ customerId: 1, status: 1, createdAt: -1 });
outstandingSchema.index({ sourceType: 1, createdAt: 1 });

const Outstanding: Model<IOutstanding> =
  mongoose.models.Outstanding ??
  mongoose.model<IOutstanding>("Outstanding", outstandingSchema);

export default Outstanding;
