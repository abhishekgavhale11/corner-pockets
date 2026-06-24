import type { NotebookCorrectionField } from "@/lib/constants/notebook-corrections";
import type {
  CounterRateType,
  SnookerGame,
} from "@/lib/constants/counter-rates";
import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import type {
  NotebookEntryStatus,
  NotebookPaymentMethod,
} from "@/lib/constants/notebook-payments";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import type { CafeTableId } from "@/lib/constants/counter-sections";

export interface INotebookEntryCorrectionChange {
  field: NotebookCorrectionField;
  fromLabel: string;
  toLabel: string;
}

export interface INotebookEntryCorrection {
  changes: INotebookEntryCorrectionChange[];
  correctedBy: string;
  correctedByStaffId: mongoose.Types.ObjectId;
  correctedAt: Date;
  correctionReason: string;
}

export interface INotebookEntryContributor {
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  amount: number;
  status: "PENDING" | "PAID";
  paymentMethod?: NotebookPaymentMethod;
  settlementId?: mongoose.Types.ObjectId;
  paidAt?: Date;
}

export interface INotebookEntry extends Document {
  section: NotebookSection;
  type: NotebookEntryType;
  amount: number;
  customerId?: mongoose.Types.ObjectId;
  tableId?: CafeTableId;
  sessionId?: mongoose.Types.ObjectId;
  customerName: string;
  phoneNumber: string;
  status: NotebookEntryStatus;
  paymentMethod?: NotebookPaymentMethod;
  settlementId?: mongoose.Types.ObjectId;
  paidByName?: string;
  paidByCustomerId?: mongoose.Types.ObjectId;
  walletTransactionId?: mongoose.Types.ObjectId;
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  quantity?: number;
  unitPrice?: number;
  itemNote?: string;
  playerCount?: number;
  snookerGame?: SnookerGame;
  rateType?: CounterRateType;
  corrections: INotebookEntryCorrection[];
  assignedAt?: Date;
  assignedBy?: string;
  contributors: INotebookEntryContributor[];
  createdBy: string;
  createdByStaffId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notebookEntryCorrectionChangeSchema =
  new Schema<INotebookEntryCorrectionChange>(
    {
      field: {
        type: String,
        enum: ["customer", "entryType", "amount", "playerCount"],
        required: true,
      },
      fromLabel: { type: String, required: true, trim: true },
      toLabel: { type: String, required: true, trim: true },
    },
    { _id: false }
  );

const notebookEntryCorrectionSchema = new Schema<INotebookEntryCorrection>(
  {
    changes: { type: [notebookEntryCorrectionChangeSchema], required: true },
    correctedBy: { type: String, required: true, trim: true },
    correctedByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    correctedAt: { type: Date, required: true, default: Date.now },
    correctionReason: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const notebookEntryContributorSchema = new Schema<INotebookEntryContributor>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY", "WALLET"],
    },
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookSettlement",
    },
    paidAt: { type: Date },
  },
  { _id: false }
);

const notebookEntrySchema = new Schema<INotebookEntry>(
  {
    section: {
      type: String,
      enum: [
        "BIG_SNOOKER_1",
        "BIG_SNOOKER_2",
        "BIG_SNOOKER_3",
        "MINI_SNOOKER",
        "POOL_1",
        "POOL_2",
        "CAFE",
      ],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "SNOOKER",
        "RUMMY",
        "MINI",
        "POOL",
        "CIGARETTE",
        "SANDWICH",
        "TEA",
        "COFFEE",
        "WATER",
        "COLD_DRINK",
        "TEA_COFFEE",
        "FOOD",
        "OTHER",
      ],
      required: true,
    },
    amount: { type: Number, required: true, min: 1 },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    tableId: {
      type: String,
      enum: [
        "BIG_SNOOKER_1",
        "BIG_SNOOKER_2",
        "BIG_SNOOKER_3",
        "MINI_SNOOKER",
        "POOL_1",
        "POOL_2",
      ],
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "TableSession",
      index: true,
    },
    customerName: { type: String, default: "", trim: true },
    phoneNumber: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "REVERSED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY", "WALLET"],
    },
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookSettlement",
      index: true,
    },
    paidByName: { type: String, trim: true },
    paidByCustomerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    walletTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    reversedAt: { type: Date },
    reversedBy: { type: String, trim: true },
    reversalReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, min: 1 },
    itemNote: { type: String, default: "", trim: true },
    playerCount: { type: Number, min: 2, max: 20 },
    snookerGame: {
      type: String,
      enum: ["SINGLES", "INDIVIDUAL", "SHUFFLE"],
    },
    rateType: {
      type: String,
      enum: ["REGULAR", "HAPPY_HOUR"],
    },
    corrections: { type: [notebookEntryCorrectionSchema], default: [] },
    assignedAt: { type: Date },
    assignedBy: { type: String, trim: true },
    contributors: { type: [notebookEntryContributorSchema], default: [] },
    createdBy: { type: String, required: true, trim: true },
    createdByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
  },
  { timestamps: true }
);

notebookEntrySchema.index({ status: 1, createdAt: -1 });
notebookEntrySchema.index({ customerId: 1, status: 1 });
notebookEntrySchema.index({ section: 1, status: 1, createdAt: -1 });

const NotebookEntry: Model<INotebookEntry> =
  mongoose.models.NotebookEntry ??
  mongoose.model<INotebookEntry>("NotebookEntry", notebookEntrySchema);

export default NotebookEntry;
