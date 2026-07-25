import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  ExpenseCategory,
  ExpensePaymentMethod,
} from "@/lib/constants/expenses";

/**
 * Club expense register — independent of Business Day / Counter / Customers.
 * Used later by Reports for expense totals and estimated profit.
 */
export interface IExpense extends Document {
  category: ExpenseCategory;
  amount: number;
  /** Calendar date of the expense (noon local), not a Business Day link. */
  expenseDate: Date;
  description: string;
  paidTo: string;
  paymentMethod: ExpensePaymentMethod;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    category: {
      type: String,
      enum: ["CAFE", "SNOOKER_OTHER"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    expenseDate: { type: Date, required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    paidTo: { type: String, default: "", trim: true, maxlength: 100 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "GPAY"],
      required: true,
    },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

expenseSchema.index({ expenseDate: -1, createdAt: -1 });
expenseSchema.index({ category: 1, expenseDate: -1 });

const Expense: Model<IExpense> =
  mongoose.models.Expense ?? mongoose.model<IExpense>("Expense", expenseSchema);

export default Expense;
