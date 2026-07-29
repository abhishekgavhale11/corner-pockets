import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { StaffRole } from "@/lib/auth/roles";

export interface IStaff extends Document {
  username: string;
  /** Plain password for this internal club app — shown in Admin Users. */
  password: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<IStaff>(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["SUPER_MASTER", "MASTER", "STAFF"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Drop cached model so schema changes (passwordHash → password) apply after HMR/restart.
if (mongoose.models.Staff) {
  delete mongoose.models.Staff;
}

const Staff: Model<IStaff> = mongoose.model<IStaff>("Staff", staffSchema);

export default Staff;
