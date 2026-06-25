import type { CounterRateType } from "@/lib/constants/counter-rates";
import type {
  SessionBillingMethod,
  TableSessionAuditAction,
  TableSessionStatus,
  TableSessionTableId,
} from "@/lib/constants/table-sessions";
import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ITableSessionAuditEntry {
  action: TableSessionAuditAction;
  at: Date;
  by: string;
  byStaffId: mongoose.Types.ObjectId;
}

export interface ITableSessionAssignedCustomer {
  customerId: mongoose.Types.ObjectId;
  customerName: string;
}

export interface ITableSession extends Document {
  sessionNumber: number;
  tableSessionNumber: number;
  tableId: TableSessionTableId;
  status: TableSessionStatus;
  rateType?: CounterRateType;
  billingMethod?: SessionBillingMethod;
  startedAt: Date;
  pausedAt?: Date;
  endedAt?: Date;
  totalPausedMs: number;
  activePlayMs: number;
  hourlyRate: number;
  gameChargeAmount: number;
  gameEntryId?: mongoose.Types.ObjectId;
  assignedCustomers: ITableSessionAssignedCustomer[];
  auditLog: ITableSessionAuditEntry[];
  createdBy: string;
  createdByStaffId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tableSessionAuditSchema = new Schema<ITableSessionAuditEntry>(
  {
    action: {
      type: String,
      enum: ["STARTED", "PAUSED", "RESUMED", "STOPPED", "ENDED"],
      required: true,
    },
    at: { type: Date, required: true },
    by: { type: String, required: true, trim: true },
    byStaffId: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
  },
  { _id: false }
);

const tableSessionAssignedCustomerSchema =
  new Schema<ITableSessionAssignedCustomer>(
    {
      customerId: {
        type: Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
      },
      customerName: { type: String, required: true, trim: true },
    },
    { _id: false }
  );

const tableSessionSchema = new Schema<ITableSession>(
  {
    sessionNumber: { type: Number, required: true },
    tableSessionNumber: { type: Number, min: 1 },
    tableId: {
      type: String,
      enum: [
        "MINI_SNOOKER",
        "POOL_1",
        "POOL_2",
        "BIG_SNOOKER_1",
        "BIG_SNOOKER_2",
        "BIG_SNOOKER_3",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "PAUSED",
        "STOPPED",
        "ENDED",
        "CHECKOUT_PENDING",
        "PAID",
        "CLOSED",
      ],
      required: true,
    },
    rateType: {
      type: String,
      enum: ["REGULAR", "HAPPY_HOUR"],
    },
    billingMethod: {
      type: String,
      enum: ["FRAME", "TIME"],
    },
    startedAt: { type: Date, required: true },
    pausedAt: { type: Date },
    endedAt: { type: Date },
    totalPausedMs: { type: Number, default: 0, min: 0 },
    activePlayMs: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, default: 0, min: 0 },
    gameChargeAmount: { type: Number, default: 0, min: 0 },
    gameEntryId: { type: Schema.Types.ObjectId, ref: "NotebookEntry" },
    assignedCustomers: {
      type: [tableSessionAssignedCustomerSchema],
      default: [],
    },
    auditLog: { type: [tableSessionAuditSchema], default: [] },
    createdBy: { type: String, required: true, trim: true },
    createdByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
  },
  { timestamps: true }
);

tableSessionSchema.index({ tableId: 1, startedAt: -1 });
tableSessionSchema.index({ tableId: 1, status: 1 });
tableSessionSchema.index({ status: 1, startedAt: -1 });
tableSessionSchema.index({ sessionNumber: 1 }, { unique: true });

const TableSession: Model<ITableSession> =
  mongoose.models.TableSession ??
  mongoose.model<ITableSession>("TableSession", tableSessionSchema);

export default TableSession;
