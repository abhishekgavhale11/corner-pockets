import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  NotebookPaymentMethod,
  NotebookSettlementStatus,
} from "@/lib/constants/notebook-payments";

export interface INotebookSettlementContributorPayment {
  entryId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  amount: number;
}

export interface INotebookSettlement extends Document {
  entryIds: mongoose.Types.ObjectId[];
  totalAmount: number;
  paymentMethod: NotebookPaymentMethod;
  paidByName: string;
  paidByCustomerId?: mongoose.Types.ObjectId;
  walletTransactionId?: mongoose.Types.ObjectId;
  contributorPayments: INotebookSettlementContributorPayment[];
  idempotencyKey: string;
  status: NotebookSettlementStatus;
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  reversalSettlementId?: mongoose.Types.ObjectId;
  createdBy: string;
  createdByStaffId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const notebookSettlementContributorPaymentSchema =
  new Schema<INotebookSettlementContributorPayment>(
    {
      entryId: {
        type: Schema.Types.ObjectId,
        ref: "NotebookEntry",
        required: true,
      },
      customerId: {
        type: Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
      },
      customerName: { type: String, required: true, trim: true },
      amount: { type: Number, required: true, min: 1 },
    },
    { _id: false }
  );

const notebookSettlementSchema = new Schema<INotebookSettlement>(
  {
    entryIds: [{ type: Schema.Types.ObjectId, ref: "NotebookEntry" }],
    totalAmount: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY", "WALLET"],
      required: true,
    },
    paidByName: { type: String, required: true, trim: true },
    paidByCustomerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    walletTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    contributorPayments: {
      type: [notebookSettlementContributorPaymentSchema],
      default: [],
    },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ["COMPLETED", "REVERSED"],
      default: "COMPLETED",
      index: true,
    },
    reversedAt: { type: Date },
    reversedBy: { type: String, trim: true },
    reversalReason: { type: String, trim: true },
    reversalSettlementId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookSettlementReversal",
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

notebookSettlementSchema.index({ status: 1, createdAt: -1 });
notebookSettlementSchema.index({ paymentMethod: 1, createdAt: -1 });

const NotebookSettlement: Model<INotebookSettlement> =
  mongoose.models.NotebookSettlement ??
  mongoose.model<INotebookSettlement>(
    "NotebookSettlement",
    notebookSettlementSchema
  );

export default NotebookSettlement;
