import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";

export interface ICustomerBalancePaymentAllocation {
  entryId: mongoose.Types.ObjectId;
  amount: number;
}

export interface ICustomerBalancePayment extends Document {
  customerId: mongoose.Types.ObjectId;
  amount: number;
  appliedAmount: number;
  paymentMethod: NotebookPaymentMethod;
  walletTransactionId?: mongoose.Types.ObjectId;
  allocations: ICustomerBalancePaymentAllocation[];
  createdBy: string;
  createdByStaffId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const customerBalancePaymentAllocationSchema =
  new Schema<ICustomerBalancePaymentAllocation>(
    {
      entryId: {
        type: Schema.Types.ObjectId,
        ref: "NotebookEntry",
        required: true,
      },
      amount: { type: Number, required: true, min: 1 },
    },
    { _id: false }
  );

const customerBalancePaymentSchema = new Schema<ICustomerBalancePayment>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    appliedAmount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY", "WALLET"],
      required: true,
    },
    walletTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    allocations: {
      type: [customerBalancePaymentAllocationSchema],
      default: [],
    },
    createdBy: { type: String, required: true, trim: true },
    createdByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

customerBalancePaymentSchema.index({ customerId: 1, createdAt: -1 });

const CustomerBalancePayment: Model<ICustomerBalancePayment> =
  mongoose.models.CustomerBalancePayment ??
  mongoose.model<ICustomerBalancePayment>(
    "CustomerBalancePayment",
    customerBalancePaymentSchema
  );

export default CustomerBalancePayment;
