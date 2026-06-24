import { getSectionLedger } from "@/actions/notebook-ledger";
import { SnookerView } from "@/components/notebook/SnookerView";

export default async function SnookerPage() {
  const [big1, big2, big3] = await Promise.all([
    getSectionLedger("BIG_SNOOKER_1"),
    getSectionLedger("BIG_SNOOKER_2"),
    getSectionLedger("BIG_SNOOKER_3"),
  ]);

  return (
    <SnookerView
      ledgers={[
        { section: "BIG_SNOOKER_1", entries: big1 },
        { section: "BIG_SNOOKER_2", entries: big2 },
        { section: "BIG_SNOOKER_3", entries: big3 },
      ]}
    />
  );
}
