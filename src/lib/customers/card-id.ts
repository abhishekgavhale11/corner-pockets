import Counter from "@/models/Counter";

export async function generateCardId(): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    "customerCardId",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `CP${String(counter.seq).padStart(4, "0")}`;
}
