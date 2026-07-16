import type { ClientSession } from "mongoose";
import type { BillStatus } from "@/lib/constants/visit-bill";
import type { IBill } from "@/models/Bill";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { getCustomerBillSlice } from "@/lib/visit-bill/customer-bill-slice";
import NotebookEntry from "@/models/NotebookEntry";
import Bill from "@/models/Bill";

function deriveBillStatus(
  bill: Pick<IBill, "status" | "totalAmount" | "paidAmount" | "dueAmount">
): BillStatus {
  return bill.status === "FINISHED" ? "FINISHED" : "WORKING";
}

export async function syncBillTotals(
  billId: import("mongoose").Types.ObjectId,
  dbSession?: ClientSession
): Promise<IBill | null> {
  const bill = await Bill.findById(billId).session(dbSession ?? null);
  if (!bill) {
    return null;
  }

  const customerId = bill.customerId.toString();

  const entries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    $or: [
      {
        billId: bill._id,
        customerId: bill.customerId,
        $or: [
          { contributors: { $exists: false } },
          { contributors: { $size: 0 } },
        ],
      },
      {
        contributors: {
          $elemMatch: {
            customerId: bill.customerId,
            billId: bill._id,
          },
        },
      },
    ],
  }).session(dbSession ?? null);

  let totalAmount = 0;
  let paidAmount = 0;
  let dueAmount = 0;

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    const slice = getCustomerBillSlice(dto, customerId);
    if (!slice) {
      continue;
    }
    totalAmount += slice.lineTotal;
    paidAmount += slice.paid;
    dueAmount += slice.due;
  }

  bill.totalAmount = totalAmount;
  bill.paidAmount = paidAmount;
  bill.dueAmount = dueAmount;

  bill.status = deriveBillStatus(bill);

  await bill.save({ session: dbSession });
  return bill;
}
