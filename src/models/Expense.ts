import mongoose, { Schema, type Document, type Model } from "mongoose";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SUBCATEGORIES,
  type ExpenseCategory,
  type ExpensePaymentMethod,
  type ExpenseSubcategory,
} from "@/lib/constants/expenses";

/**
 * Club expense register — independent of Business Day / Counter / Customers.
 * Used later by Reports for expense totals and estimated profit.
 */
export interface IExpense extends Document {
  category: ExpenseCategory;
  /** Optional so existing expenses keep working without a data rewrite. */
  subcategory?: ExpenseSubcategory;
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
      enum: [...EXPENSE_CATEGORIES],
      required: true,
      index: true,
    },
    subcategory: {
      type: String,
      enum: [...EXPENSE_SUBCATEGORIES],
      required: false,
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

const existingExpenseModel = mongoose.models.Expense as Model<IExpense> | undefined;
if (existingExpenseModel && !existingExpenseModel.schema.path("subcategory")) {
  delete mongoose.models.Expense;
}

const Expense: Model<IExpense> =
  mongoose.models.Expense ?? mongoose.model<IExpense>("Expense", expenseSchema);

export default Expense;
