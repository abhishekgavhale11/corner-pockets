import "./lib/load-env";
import { connectDB } from "../src/lib/db/connect";
import Counter from "../src/models/Counter";
import Visit from "../src/models/Visit";
import Bill from "../src/models/Bill";
import mongoose from "mongoose";

async function main() {
  await connectDB();
  const counters = await Counter.find({}).lean();
  console.log("Counters:", counters);
  const visits = await Visit.find({}).select("publicId businessDate").lean();
  const bills = await Bill.find({}).select("publicId businessDate").lean();
  console.log("Visits:", visits);
  console.log("Bills:", bills);
  await mongoose.disconnect();
}

main();
