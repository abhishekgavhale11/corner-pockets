import "./lib/load-env";
import { connectDB } from "../src/lib/db/connect";
import NotebookEntry from "../src/models/NotebookEntry";
import Bill from "../src/models/Bill";
import Visit from "../src/models/Visit";
import Customer from "../src/models/Customer";
import mongoose from "mongoose";

async function main() {
  await connectDB();
  const vishal = await Customer.findOne({ name: /vishal/i }).lean();
  if (!vishal) {
    console.log("No vishal customer");
    return;
  }
  const entries = await NotebookEntry.find({ customerId: vishal._id })
    .sort({ createdAt: 1 })
    .lean();
  console.log("Entries:", entries.map((e) => ({
    type: e.type,
    amount: e.amount,
    paid: e.paidAmount ?? 0,
    status: e.status,
    billId: e.billId?.toString(),
    visitId: e.visitId?.toString(),
    createdAt: e.createdAt,
  })));
  const visits = await Visit.find({ customerId: vishal._id }).lean();
  const bills = await Bill.find({ customerId: vishal._id }).lean();
  console.log("Visits:", visits);
  console.log("Bills:", bills);
  await mongoose.disconnect();
}

main();
