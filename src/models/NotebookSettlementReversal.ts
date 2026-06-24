import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface INotebookSettlementReversal extends Document {
  originalSettlementId: mongoose.Types.ObjectId;
  affectedEntryIds: mongoose.Types.ObjectId[];
  reversalReason: string;
  reversedBy: string;
  reversedAt: Date;
  createdAt: Date;
}

const notebookSettlementReversalSchema = new Schema<INotebookSettlementReversal>(
  {
    originalSettlementId: {
      type: Schema.Types.ObjectId,
      ref: "NotebookSettlement",
      required: true,
      index: true,
    },
    affectedEntryIds: [
      { type: Schema.Types.ObjectId, ref: "NotebookEntry", required: true },
    ],
    reversalReason: { type: String, required: true, trim: true },
    reversedBy: { type: String, required: true, trim: true },
    reversedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const NotebookSettlementReversal: Model<INotebookSettlementReversal> =
  mongoose.models.NotebookSettlementReversal ??
  mongoose.model<INotebookSettlementReversal>(
    "NotebookSettlementReversal",
    notebookSettlementReversalSchema
  );

export default NotebookSettlementReversal;
