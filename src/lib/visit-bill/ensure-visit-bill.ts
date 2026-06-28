import mongoose, { type ClientSession } from "mongoose";
import { getBusinessDate } from "@/lib/utils/business-date";
import Bill from "@/models/Bill";
import Visit from "@/models/Visit";
import type { IBill } from "@/models/Bill";
import type { IVisit } from "@/models/Visit";
import { nextPublicId } from "@/lib/visit-bill/public-id";

export type VisitBillStaff = {
  username: string;
  staffId: string;
};

export type ActiveVisitBill = {
  visit: IVisit;
  bill: IBill;
};

function toObjectId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

/** One active visit + bill per customer per business day. */
export async function ensureActiveVisitBill(
  customerId: string | mongoose.Types.ObjectId,
  staff: VisitBillStaff,
  options?: { businessDate?: string; dbSession?: ClientSession }
): Promise<ActiveVisitBill> {
  const customerObjectId = toObjectId(customerId);
  const businessDate = options?.businessDate ?? getBusinessDate();
  const dbSession = options?.dbSession;
  const staffObjectId = new mongoose.Types.ObjectId(staff.staffId);

  const existingVisit = await Visit.findOne({
    customerId: customerObjectId,
    businessDate,
    status: "ACTIVE",
  }).session(dbSession ?? null);

  if (existingVisit) {
    const bill = await Bill.findById(existingVisit.billId).session(
      dbSession ?? null
    );
    if (!bill) {
      throw new Error("Active visit is missing its bill");
    }
    return { visit: existingVisit, bill };
  }

  const billPublicId = await nextPublicId("B", businessDate, dbSession);
  const [bill] = await Bill.create(
    [
      {
        publicId: billPublicId,
        customerId: customerObjectId,
        businessDate,
        status: "ACTIVE",
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        createdBy: staff.username,
        createdByStaffId: staffObjectId,
      },
    ],
    { session: dbSession }
  );

  const visitPublicId = await nextPublicId("V", businessDate, dbSession);
  const [visit] = await Visit.create(
    [
      {
        publicId: visitPublicId,
        customerId: customerObjectId,
        billId: bill._id,
        businessDate,
        status: "ACTIVE",
        startedAt: new Date(),
        createdBy: staff.username,
        createdByStaffId: staffObjectId,
      },
    ],
    { session: dbSession }
  );

  bill.visitId = visit._id;
  await bill.save({ session: dbSession });

  return { visit, bill };
}
