import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { VisitStatus } from "@/lib/constants/visit-bill";

export interface IVisit extends Document {
  publicId: string;
  customerId: mongoose.Types.ObjectId;
  billId: mongoose.Types.ObjectId;
  businessDate: string;
  status: VisitStatus;
  startedAt: Date;
  closedAt?: Date;
  notes?: string;
  createdBy: string;
  createdByStaffId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const visitSchema = new Schema<IVisit>(
  {
    publicId: { type: String, required: true, unique: true, trim: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    billId: {
      type: Schema.Types.ObjectId,
      ref: "Bill",
      required: true,
      index: true,
    },
    businessDate: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ["ACTIVE", "CLOSED"],
      default: "ACTIVE",
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    closedAt: { type: Date },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, required: true, trim: true },
    createdByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
  },
  { timestamps: true }
);

visitSchema.index(
  { customerId: 1, businessDate: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } }
);

const Visit: Model<IVisit> =
  mongoose.models.Visit ?? mongoose.model<IVisit>("Visit", visitSchema);

export default Visit;
