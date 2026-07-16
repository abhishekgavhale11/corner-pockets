import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import Visit from "@/models/Visit";

export async function isBillOnActiveVisit(
  billId: string | mongoose.Types.ObjectId,
  dbSession?: ClientSession
): Promise<boolean> {
  const billObjectId =
    typeof billId === "string" ? new mongoose.Types.ObjectId(billId) : billId;

  const visit = await Visit.findOne({
    billId: billObjectId,
    status: "ACTIVE",
  }).session(dbSession ?? null);

  return Boolean(visit);
}

export async function isEntryOnActiveVisit(
  entry: {
    billId?: mongoose.Types.ObjectId | null;
    contributors?: Array<{ billId?: mongoose.Types.ObjectId | null }>;
  },
  dbSession?: ClientSession
): Promise<boolean> {
  if (entry.billId) {
    if (await isBillOnActiveVisit(entry.billId, dbSession)) {
      return true;
    }
  }

  for (const contributor of entry.contributors ?? []) {
    if (contributor.billId && (await isBillOnActiveVisit(contributor.billId, dbSession))) {
      return true;
    }
  }

  return false;
}
