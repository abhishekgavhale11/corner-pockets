import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { StaffRole } from "@/lib/auth/roles";

export interface IStaff extends Document {
  username: string;
  passwordHash: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<IStaff>(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["SUPER_MASTER", "MASTER", "STAFF"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Staff: Model<IStaff> =
  mongoose.models.Staff ?? mongoose.model<IStaff>("Staff", staffSchema);

export default Staff;
