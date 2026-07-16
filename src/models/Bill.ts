import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { BillStatus } from "@/lib/constants/visit-bill";

export interface IBill extends Document {
  publicId: string;
  visitId?: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  businessDate: string;
  status: BillStatus;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  lastPaymentAt?: Date;
  convertedToOutstandingAt?: Date;
  convertedToOutstandingBy?: string;
  createdBy: string;
  createdByStaffId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const billSchema = new Schema<IBill>(
  {
    publicId: { type: String, required: true, unique: true, trim: true },
    visitId: {
      type: Schema.Types.ObjectId,
      ref: "Visit",
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    businessDate: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ["WORKING", "FINISHED"],
      default: "WORKING",
      index: true,
    },
    totalAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    lastPaymentAt: { type: Date },
    convertedToOutstandingAt: { type: Date },
    convertedToOutstandingBy: { type: String, trim: true },
    createdBy: { type: String, required: true, trim: true },
    createdByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
  },
  { timestamps: true }
);

billSchema.index({ customerId: 1, businessDate: 1, status: 1 });

const Bill: Model<IBill> =
  mongoose.models.Bill ?? mongoose.model<IBill>("Bill", billSchema);

export default Bill;
