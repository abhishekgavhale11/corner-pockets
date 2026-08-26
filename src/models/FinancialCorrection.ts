import mongoose, { Schema, type Document, type Model } from "mongoose";
import {
  FINANCIAL_CORRECTION_SECTIONS,
  type FinancialCorrectionPaymentMethod,
  type FinancialCorrectionSection,
  type FinancialCorrectionType,
} from "@/lib/constants/financial-corrections";

/**
 * Append-only restatement of a CLOSED Business Day.
 * Never updates BusinessDayFinalSummary or operational records.
 */
export interface IFinancialCorrection extends Document {
  type: FinancialCorrectionType;
  customerId: mongoose.Types.ObjectId;
  affectedBusinessDayId: mongoose.Types.ObjectId;
  /** OPEN Business Day when entered, if one exists. Audit only. */
  recordedOnBusinessDayId?: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod?: FinancialCorrectionPaymentMethod;
  /** Reporting section. Absent on corrections recorded before section attribution. */
  section?: FinancialCorrectionSection;
  reason: string;
  createdBy: string;
  createdAt: Date;
}

const financialCorrectionSchema = new Schema<IFinancialCorrection>(
  {
    type: {
      type: String,
      enum: ["MISSED_PAYMENT", "OUTSTANDING_CORRECTION"],
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    affectedBusinessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      required: true,
      index: true,
    },
    recordedOnBusinessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      required: false,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY"],
    },
    section: {
      type: String,
      enum: [...FINANCIAL_CORRECTION_SECTIONS],
      required: false,
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    createdBy: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

financialCorrectionSchema.index({ customerId: 1, affectedBusinessDayId: 1 });
financialCorrectionSchema.index({ affectedBusinessDayId: 1, createdAt: 1 });

const FinancialCorrection: Model<IFinancialCorrection> =
  mongoose.models.FinancialCorrection ??
  mongoose.model<IFinancialCorrection>(
    "FinancialCorrection",
    financialCorrectionSchema
  );

FinancialCorrection.schema.path("recordedOnBusinessDayId")?.required(false);

if (!FinancialCorrection.schema.path("section")) {
  FinancialCorrection.schema.add({
    section: {
      type: String,
      enum: [...FINANCIAL_CORRECTION_SECTIONS],
      required: false,
      index: true,
    },
  });
}

export default FinancialCorrection;
