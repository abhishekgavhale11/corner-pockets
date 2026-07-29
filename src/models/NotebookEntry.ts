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

export interface INotebookEntryPaymentAllocation {
  paymentMethod: NotebookPaymentMethod;
  amount: number;
}

export interface INotebookEntryContributor {
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  counterPaidAmount?: number;
  counterBalanceAmount?: number;
  status: "PENDING" | "PAID";
  paymentMethod?: NotebookPaymentMethod;
  settlementId?: mongoose.Types.ObjectId;
  paidAt?: Date;
  /** Staff who last saved this contributor's Cash/GPay payment. */
  receivedByStaffId?: mongoose.Types.ObjectId;
  receivedByUsername?: string;
  receivedAt?: Date;
  visitId?: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId;
}

export interface INotebookEntry extends Document {
  section: NotebookSection;
  type: NotebookEntryType;
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  customerId?: mongoose.Types.ObjectId;
  tableId?: CafeTableId;
  sessionId?: mongoose.Types.ObjectId;
  customerName: string;
  phoneNumber: string;
  status: NotebookEntryStatus;
  paymentMethod?: NotebookPaymentMethod;
  /** When present, Received is split across Cash and GPay (single-customer frames only). */
  paymentAllocations?: INotebookEntryPaymentAllocation[];
  settlementId?: mongoose.Types.ObjectId;
  paidByName?: string;
  paidByCustomerId?: mongoose.Types.ObjectId;
  reversedAt?: Date;
  reversedBy?: string;
  reversalReason?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  quantity?: number;
  unitPrice?: number;
  itemNote?: string;
  /** Pool & Mini: play window (manual; not timer-driven). */
  playStartedAt?: Date;
  playEndedAt?: Date;
  notes?: string;
  playerCount?: number;
  snookerGame?: SnookerGame;
  rateType?: CounterRateType;
  corrections: INotebookEntryCorrection[];
  assignedAt?: Date;
  assignedBy?: string;
  checkoutDismissedAt?: Date;
  checkoutDismissedBy?: string;
  counterPaidAmount?: number;
  counterBalanceAmount?: number;
  visitId?: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId;
  businessDayId?: mongoose.Types.ObjectId;
  businessDate?: Date;
  contributors: INotebookEntryContributor[];
  /** Staff who last saved this entry's Cash/GPay payment (non-split). */
  receivedByStaffId?: mongoose.Types.ObjectId;
  receivedByUsername?: string;
  receivedAt?: Date;
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

const notebookEntryPaymentAllocationSchema =
  new Schema<INotebookEntryPaymentAllocation>(
    {
      paymentMethod: {
        type: String,
        enum: ["CASH", "GPAY"],
        required: true,
      },
      amount: { type: Number, required: true, min: 1 },
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
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceCollectedAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY"],
    },
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookSettlement",
    },
    paidAt: { type: Date },
    receivedByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
    },
    receivedByUsername: { type: String, trim: true },
    receivedAt: { type: Date },
    counterPaidAmount: { type: Number, min: 0 },
    counterBalanceAmount: { type: Number, min: 0 },
    visitId: {
      type: Schema.Types.ObjectId,
      ref: "Visit",
      index: true,
    },
    billId: {
      type: Schema.Types.ObjectId,
      ref: "Bill",
      index: true,
    },
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
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceCollectedAmount: { type: Number, default: 0, min: 0 },
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
      enum: ["CASH", "GPAY"],
    },
    paymentAllocations: {
      type: [notebookEntryPaymentAllocationSchema],
      default: undefined,
    },
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookSettlement",
      index: true,
    },
    paidByName: { type: String, trim: true },
    paidByCustomerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    reversedAt: { type: Date },
    reversedBy: { type: String, trim: true },
    reversalReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, min: 1 },
    itemNote: { type: String, default: "", trim: true },
    playStartedAt: { type: Date },
    playEndedAt: { type: Date },
    notes: { type: String, default: "", trim: true },
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
    checkoutDismissedAt: { type: Date },
    checkoutDismissedBy: { type: String, trim: true },
    counterPaidAmount: { type: Number, min: 0 },
    counterBalanceAmount: { type: Number, min: 0 },
    visitId: {
      type: Schema.Types.ObjectId,
      ref: "Visit",
      index: true,
    },
    billId: {
      type: Schema.Types.ObjectId,
      ref: "Bill",
      index: true,
    },
    businessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      index: true,
    },
    businessDate: {
      type: Date,
      index: true,
    },
    contributors: { type: [notebookEntryContributorSchema], default: [] },
    receivedByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
    },
    receivedByUsername: { type: String, trim: true },
    receivedAt: { type: Date },
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
notebookEntrySchema.index({ businessDayId: 1, status: 1 });

notebookEntrySchema.pre("validate", async function () {
  if (!this.isNew) {
    return;
  }
  if (this.businessDayId && this.businessDate) {
    return;
  }
  const { requireOpenBusinessDayContext } = await import(
    "@/lib/business-day/require-open-business-day"
  );
  const ctx = await requireOpenBusinessDayContext();
  if (!this.businessDayId) {
    this.businessDayId = ctx.businessDayId;
  }
  if (!this.businessDate) {
    this.businessDate = ctx.businessDate;
  }
});

const NotebookEntry: Model<INotebookEntry> =
  mongoose.models.NotebookEntry ??
  mongoose.model<INotebookEntry>("NotebookEntry", notebookEntrySchema);

export default NotebookEntry;
