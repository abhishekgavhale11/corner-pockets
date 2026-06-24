import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICustomerDetailFieldChange {
  field: "name" | "phone";
  from: string;
  to: string;
}

export interface ICustomerDetailChange {
  changedAt: Date;
  changedBy: string;
  changes: ICustomerDetailFieldChange[];
}

export interface ICustomer extends Document {
  cardId: string;
  name: string;
  phone: string;
  notes?: string;
  isStudent: boolean;
  studentStatusChangedAt?: Date;
  studentStatusChangedBy?: string;
  detailChanges: ICustomerDetailChange[];
  balance: number;
  walletEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerDetailFieldChangeSchema = new Schema<ICustomerDetailFieldChange>(
  {
    field: { type: String, enum: ["name", "phone"], required: true },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const customerDetailChangeSchema = new Schema<ICustomerDetailChange>(
  {
    changedAt: { type: Date, required: true },
    changedBy: { type: String, required: true, trim: true },
    changes: { type: [customerDetailFieldChangeSchema], required: true },
  },
  { _id: false }
);

const customerSchema = new Schema<ICustomer>(
  {
    cardId: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    notes: { type: String, trim: true, maxlength: 500 },
    isStudent: { type: Boolean, default: false },
    studentStatusChangedAt: { type: Date },
    studentStatusChangedBy: { type: String, trim: true },
    detailChanges: { type: [customerDetailChangeSchema], default: [] },
    balance: { type: Number, required: true, default: 0, min: 0 },
    walletEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", phone: "text", cardId: "text" });
customerSchema.index({ isActive: 1, name: 1 });
customerSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $gt: "" } },
  }
);
customerSchema.index(
  { cardId: 1 },
  {
    unique: true,
    partialFilterExpression: { cardId: { $gt: "" } },
  }
);

const Customer: Model<ICustomer> =
  mongoose.models.Customer ??
  mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;
