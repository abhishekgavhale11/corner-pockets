import type { PoolMiniTableId } from "@/lib/constants/table-sessions";
import Counter from "@/models/Counter";
import TableSession from "@/models/TableSession";

function getDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Global audit sequence — internal only. */
export async function generateTableSessionNumber(): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    "tableSessionNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return counter.seq;
}

/** Per-table daily session number for staff-facing labels. */
export async function generateTableLocalSessionNumber(
  tableId: PoolMiniTableId
): Promise<number> {
  const { start, end } = getDayBounds();
  const count = await TableSession.countDocuments({
    tableId,
    startedAt: { $gte: start, $lte: end },
  });
  return count + 1;
}
