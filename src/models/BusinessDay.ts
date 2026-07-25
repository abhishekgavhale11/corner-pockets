import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { BusinessDayStatus } from "@/lib/constants/business-day";

export interface IBusinessDay extends Document {
  businessDayNumber: number;
  /** Operational calendar date chosen by cashier (not system clock). */
  businessDate: Date;
  status: BusinessDayStatus;
  openedAt: Date;
  openedBy: string;
  closedAt?: Date;
  closedBy?: string;
  openingCash: number;
  reopenedAt?: Date;
  reopenedBy?: string;
  reopenReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const businessDaySchema = new Schema<IBusinessDay>(
  {
    businessDayNumber: { type: Number, required: true, unique: true },
    businessDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      required: true,
    },
    openedAt: { type: Date, required: true },
    openedBy: { type: String, required: true, trim: true },
    closedAt: { type: Date },
    closedBy: { type: String, trim: true },
    openingCash: { type: Number, required: true, min: 0 },
    reopenedAt: { type: Date },
    reopenedBy: { type: String, trim: true },
    reopenReason: { type: String, trim: true },
  },
  { timestamps: true }
);

businessDaySchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: "OPEN" } }
);

const BusinessDay: Model<IBusinessDay> =
  mongoose.models.BusinessDay ??
  mongoose.model<IBusinessDay>("BusinessDay", businessDaySchema);

export default BusinessDay;
