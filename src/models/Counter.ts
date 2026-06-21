import mongoose, { Schema, type Model } from "mongoose";

export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter: Model<ICounter> =
  mongoose.models.Counter ?? mongoose.model<ICounter>("Counter", counterSchema);

export default Counter;
