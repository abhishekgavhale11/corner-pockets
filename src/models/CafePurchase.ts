import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { CafePaymentMethod } from "@/lib/constants/cafe";

export interface ICafePurchase extends Document {
  date: Date;
  amount: number;
  description: string;
  vendor?: string;
  paymentMethod: CafePaymentMethod;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const cafePurchaseSchema = new Schema<ICafePurchase>(
  {
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, required: true, trim: true },
    vendor: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY"],
      required: true,
    },
    notes: { type: String, trim: true },
    createdBy: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

cafePurchaseSchema.index({ date: -1 });

const CafePurchase: Model<ICafePurchase> =
  mongoose.models.CafePurchase ??
  mongoose.model<ICafePurchase>("CafePurchase", cafePurchaseSchema);

export default CafePurchase;
