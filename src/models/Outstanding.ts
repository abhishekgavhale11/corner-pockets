import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  OutstandingPaymentMethod,
  OutstandingSourceType,
  OutstandingStatus,
} from "@/lib/constants/outstanding";

export interface IOutstanding extends Document {
  outstandingNumber: number;
  customerId: mongoose.Types.ObjectId;
  businessDayId: mongoose.Types.ObjectId;
  businessDate: Date;
  sourceType: OutstandingSourceType;
  sourceRecordId: mongoose.Types.ObjectId;
  originalAmount: number;
  remainingAmount: number;
  status: OutstandingStatus;
  collectedAt?: Date;
  paymentMethod?: OutstandingPaymentMethod;
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
      index: true,
    },
    businessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      required: true,
      index: true,
    },
    businessDate: { type: Date, required: true },
    sourceType: {
      type: String,
      enum: ["FRAME", "CAFE"],
      required: true,
    },
    sourceRecordId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookEntry",
      required: true,
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
      enum: ["CASH", "GPAY", "WALLET"],
    },
  },
  { timestamps: true }
);

outstandingSchema.index(
  {
    businessDayId: 1,
    sourceRecordId: 1,
    customerId: 1,
    sourceType: 1,
  },
  { unique: true }
);

outstandingSchema.index({ customerId: 1, status: 1, createdAt: -1 });

const Outstanding: Model<IOutstanding> =
  mongoose.models.Outstanding ??
  mongoose.model<IOutstanding>("Outstanding", outstandingSchema);

export default Outstanding;
