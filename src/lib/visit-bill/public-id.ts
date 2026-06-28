import type { ClientSession } from "mongoose";
import Counter from "@/models/Counter";
import Bill from "@/models/Bill";
import Visit from "@/models/Visit";

function parsePublicIdSequence(
  prefix: "V" | "B",
  businessDate: string,
  publicId: string
): number | null {
  const compactDate = businessDate.replace(/-/g, "");
  const match = publicId.match(
    new RegExp(`^${prefix}-${compactDate}-(\\d+)$`)
  );
  if (!match) {
    return null;
  }
  const sequence = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(sequence) ? sequence : null;
}

/** Keep counter in sync when visits/bills exist from backfill or legacy data. */
async function ensureCounterFloor(
  prefix: "V" | "B",
  businessDate: string,
  dbSession?: ClientSession
): Promise<void> {
  const compactDate = businessDate.replace(/-/g, "");
  const idPattern = { $regex: `^${prefix}-${compactDate}-` };
  const latest =
    prefix === "V"
      ? await Visit.findOne({ publicId: idPattern })
          .sort({ publicId: -1 })
          .select("publicId")
          .session(dbSession ?? null)
          .lean()
      : await Bill.findOne({ publicId: idPattern })
          .sort({ publicId: -1 })
          .select("publicId")
          .session(dbSession ?? null)
          .lean();

  const maxSeq = latest?.publicId
    ? parsePublicIdSequence(prefix, businessDate, latest.publicId) ?? 0
    : 0;

  if (maxSeq <= 0) {
    return;
  }

  const counterKey = `${prefix}:${businessDate}`;
  await Counter.findByIdAndUpdate(
    counterKey,
    { $max: { seq: maxSeq } },
    { upsert: true, session: dbSession }
  );
}

export async function nextPublicId(
  prefix: "V" | "B",
  businessDate: string,
  dbSession?: ClientSession
): Promise<string> {
  await ensureCounterFloor(prefix, businessDate, dbSession);

  const counterKey = `${prefix}:${businessDate}`;
  const counter = await Counter.findByIdAndUpdate(
    counterKey,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session: dbSession }
  );

  const sequence = String(counter?.seq ?? 1).padStart(4, "0");
  const compactDate = businessDate.replace(/-/g, "");
  return `${prefix}-${compactDate}-${sequence}`;
}
