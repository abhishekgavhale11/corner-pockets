import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ITransaction extends Document {
  customerId: mongoose.Types.ObjectId;
  type: "credit" | "debit";
  paidAmount?: number;
  bonusAmount?: number;
  creditedAmount?: number;
  amount?: number;
  balanceAfter: number;
  description: string;
  staffId: mongoose.Types.ObjectId;
  staffUsername: string;
  isReversal: boolean;
  reversesTransactionId?: mongoose.Types.ObjectId;
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  reversalTransactionId?: mongoose.Types.ObjectId;
  verificationMethod?: "CARD" | "PHONE";
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["credit", "debit"], required: true },
    paidAmount: { type: Number, min: 0 },
    bonusAmount: { type: Number, min: 0 },
    creditedAmount: { type: Number, min: 0.01 },
    amount: { type: Number, min: 0.01 },
    balanceAfter: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    staffUsername: { type: String, required: true },
    isReversal: { type: Boolean, default: false },
    reversesTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    reversedAt: { type: Date },
    reversedBy: { type: String, trim: true },
    reversalReason: { type: String, trim: true },
    reversalTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    verificationMethod: {
      type: String,
      enum: ["CARD", "PHONE"],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

transactionSchema.index({ customerId: 1, createdAt: -1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ??
  mongoose.model<ITransaction>("Transaction", transactionSchema);

export default Transaction;
