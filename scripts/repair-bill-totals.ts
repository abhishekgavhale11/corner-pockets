import "./lib/load-env";
import { connectDB } from "../src/lib/db/connect";
import { syncBillTotals } from "../src/lib/visit-bill/sync-bill-totals";
import Bill from "../src/models/Bill";
import mongoose from "mongoose";

async function main() {
  await connectDB();
  const bills = await Bill.find({}).lean();
  for (const bill of bills) {
    await syncBillTotals(bill._id);
    console.log(`Synced ${bill.publicId}`);
  }
  await mongoose.disconnect();
}

main();
