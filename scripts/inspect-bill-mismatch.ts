import "./lib/load-env";
import { connectDB } from "../src/lib/db/connect";
import Bill from "../src/models/Bill";
import NotebookEntry from "../src/models/NotebookEntry";
import mongoose from "mongoose";

async function main() {
  await connectDB();
  const bills = await Bill.find({}).lean();
  for (const bill of bills) {
    const entries = await NotebookEntry.find({
      billId: bill._id,
      status: { $ne: "CANCELLED" },
    }).lean();
    let totalAmount = 0;
    let paidAmount = 0;
    for (const entry of entries) {
      totalAmount += entry.amount;
      paidAmount += entry.paidAmount ?? 0;
    }
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    if (
      bill.totalAmount !== totalAmount ||
      bill.paidAmount !== paidAmount ||
      bill.dueAmount !== dueAmount
    ) {
      console.log({
        publicId: bill.publicId,
        stored: {
          total: bill.totalAmount,
          paid: bill.paidAmount,
          due: bill.dueAmount,
          status: bill.status,
        },
        computed: { total: totalAmount, paid: paidAmount, due: dueAmount },
        linkedEntries: entries.length,
        entryIds: entries.map((e) => ({
          id: e._id.toString(),
          type: e.type,
          amount: e.amount,
          paid: e.paidAmount ?? 0,
          status: e.status,
        })),
      });
    }
  }
  await mongoose.disconnect();
}

main();
