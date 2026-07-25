import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { OutstandingPaymentMethod } from "@/lib/constants/outstanding";

export interface IOutstandingCollection extends Document {
  customerId: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: OutstandingPaymentMethod;
  remainingBalanceAfter: number;
  createdBy: string;
  walletTransactionId?: mongoose.Types.ObjectId;
  walletAmount?: number;
  createdAt: Date;
}

const outstandingCollectionSchema = new Schema<IOutstandingCollection>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY", "WALLET"],
      required: true,
    },
    remainingBalanceAfter: { type: Number, required: true, min: 0 },
    createdBy: { type: String, required: true, trim: true },
    walletTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    walletAmount: { type: Number, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

outstandingCollectionSchema.index({ customerId: 1, createdAt: -1 });

const OutstandingCollection: Model<IOutstandingCollection> =
  mongoose.models.OutstandingCollection ??
  mongoose.model<IOutstandingCollection>(
    "OutstandingCollection",
    outstandingCollectionSchema
  );

export default OutstandingCollection;
