import "./lib/load-env";
import { connectDB } from "../src/lib/db/connect";
import NotebookEntry from "../src/models/NotebookEntry";
import mongoose from "mongoose";

async function main() {
  await connectDB();
  const total = await NotebookEntry.countDocuments({ status: { $ne: "CANCELLED" } });
  const withBill = await NotebookEntry.countDocuments({
    status: { $ne: "CANCELLED" },
    billId: { $exists: true, $ne: null },
  });
  const withCustomer = await NotebookEntry.countDocuments({
    customerId: { $exists: true, $ne: null },
    status: { $ne: "CANCELLED" },
  });
  console.log({ total, withBill, withCustomer, withoutBill: withCustomer - withBill });
  await mongoose.disconnect();
}

main();
