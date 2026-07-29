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
  /** Staff who recorded this payment. */
  receivedByStaffId?: mongoose.Types.ObjectId;
  receivedByUsername?: string;
  receivedAt?: Date;
  isReversal: boolean;
  reversesTransactionId?: mongoose.Types.ObjectId;
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  reversalTransactionId?: mongoose.Types.ObjectId;
  verificationMethod?: "CARD" | "PHONE";
  /** How the customer paid for the recharge (Cash / GPay). */
  paymentMethod?: "CASH" | "GPAY";
  /** Cash or GPay remainder when a bill was split across methods. */
  remainingPaymentMethod?: "CASH" | "GPAY";
  /** Legacy operational payment metadata (historical records only). */
  paymentContext?: {
    purpose: "FRAME_PAYMENT" | "CAFE_PAYMENT" | "OUTSTANDING_COLLECTION" | "OTHER";
    billAmount: number;
    remainderAmount: number;
    remainderMethod?: "CASH" | "GPAY";
    totalPaid: number;
    lines?: { label: string; quantity?: number }[];
    businessDayId?: string;
  };
  /** Business Day tied to this legacy transaction. */
  businessDayId?: mongoose.Types.ObjectId;
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
    receivedByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
    },
    receivedByUsername: { type: String, trim: true },
    receivedAt: { type: Date },
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
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY"],
    },
    remainingPaymentMethod: {
      type: String,
      enum: ["CASH", "GPAY"],
    },
    paymentContext: {
      purpose: {
        type: String,
        enum: [
          "FRAME_PAYMENT",
          "CAFE_PAYMENT",
          "OUTSTANDING_COLLECTION",
          "OTHER",
        ],
      },
      billAmount: { type: Number, min: 0 },
      remainderAmount: { type: Number, min: 0 },
      remainderMethod: { type: String, enum: ["CASH", "GPAY"] },
      totalPaid: { type: Number, min: 0 },
      lines: [
        {
          label: { type: String, trim: true },
          quantity: { type: Number, min: 0 },
        },
      ],
      businessDayId: { type: String, trim: true },
    },
    businessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      index: true,
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
