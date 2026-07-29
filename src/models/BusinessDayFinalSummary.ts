import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/** Immutable per-customer settlement frozen at Business Day Close. */
export type BusinessDayFinalSummaryCustomer = {
  customerId: string;
  customerName: string;
  bigSnooker: number;
  poolMini: number;
  cafe: number;
  bill: number;
  received: number;
  cashCollection: number;
  gpayCollection: number;
  due: number;
};

/** Immutable section rollup frozen at Business Day Close. */
export type BusinessDayFinalSummarySection = {
  bill: number;
  received: number;
  cashCollection: number;
  gpayCollection: number;
  outstandingCreated: number;
  gamesPlayed: number;
};

/**
 * Business Day Final Summary — immutable financial truth at Close.
 * Never updated when Outstanding Remaining changes after close.
 */
export interface IBusinessDayFinalSummary extends Document {
  businessDayId: Types.ObjectId;
  businessDayNumber: number;
  businessDate: Date;
  closedAt: Date;
  /** Revenue / Bill for the Business Day. */
  bill: number;
  /** Paid / Received against today's Business Day. */
  paid: number;
  /** Outstanding Created = Bill − Paid (assigned settlement grain). */
  outstandingCreated: number;
  cashCollection: number;
  gpayCollection: number;
  /** Outstanding collections that occurred during this Business Day window. */
  outstandingCollected: number;
  /** Club Outstanding (End of Day) as of closedAt. */
  closingOutstanding: number;
  /** Club Outstanding opening baseline used for this day's trend. */
  openingOutstanding: number;
  unassignedFrames: number;
  unassignedCafeItems: number;
  snooker: BusinessDayFinalSummarySection;
  bigSnooker: BusinessDayFinalSummarySection;
  poolMini: BusinessDayFinalSummarySection;
  cafe: BusinessDayFinalSummarySection;
  customers: BusinessDayFinalSummaryCustomer[];
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<BusinessDayFinalSummarySection>(
  {
    bill: { type: Number, required: true, min: 0 },
    received: { type: Number, required: true, min: 0 },
    cashCollection: { type: Number, required: true, min: 0 },
    gpayCollection: { type: Number, required: true, min: 0 },
    outstandingCreated: { type: Number, required: true, min: 0 },
    gamesPlayed: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const customerSchema = new Schema<BusinessDayFinalSummaryCustomer>(
  {
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    bigSnooker: { type: Number, required: true, min: 0 },
    poolMini: { type: Number, required: true, min: 0 },
    cafe: { type: Number, required: true, min: 0 },
    bill: { type: Number, required: true, min: 0 },
    received: { type: Number, required: true, min: 0 },
    cashCollection: { type: Number, required: true, min: 0 },
    gpayCollection: { type: Number, required: true, min: 0 },
    due: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const businessDayFinalSummarySchema = new Schema<IBusinessDayFinalSummary>(
  {
    businessDayId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessDay",
      required: true,
      unique: true,
      index: true,
    },
    businessDayNumber: { type: Number, required: true, index: true },
    businessDate: { type: Date, required: true },
    closedAt: { type: Date, required: true },
    bill: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, min: 0 },
    outstandingCreated: { type: Number, required: true, min: 0 },
    cashCollection: { type: Number, required: true, min: 0 },
    gpayCollection: { type: Number, required: true, min: 0 },
    outstandingCollected: { type: Number, required: true, min: 0 },
    closingOutstanding: { type: Number, required: true, min: 0 },
    openingOutstanding: { type: Number, required: true, min: 0 },
    unassignedFrames: { type: Number, required: true, min: 0 },
    unassignedCafeItems: { type: Number, required: true, min: 0 },
    snooker: { type: sectionSchema, required: true },
    bigSnooker: { type: sectionSchema, required: true },
    poolMini: { type: sectionSchema, required: true },
    cafe: { type: sectionSchema, required: true },
    customers: { type: [customerSchema], required: true, default: [] },
  },
  { timestamps: true }
);

businessDayFinalSummarySchema.index({ "customers.customerId": 1 });

const BusinessDayFinalSummary: Model<IBusinessDayFinalSummary> =
  mongoose.models.BusinessDayFinalSummary ??
  mongoose.model<IBusinessDayFinalSummary>(
    "BusinessDayFinalSummary",
    businessDayFinalSummarySchema
  );

export default BusinessDayFinalSummary;
