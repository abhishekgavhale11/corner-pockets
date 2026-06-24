import { getSectionLedger } from "@/actions/notebook-ledger";
import { CounterGrid } from "@/components/counter/CounterGrid";
import { SNOOKER_TABLE_SECTIONS } from "@/lib/constants/counter-sections";

export default async function BigSnookerCounterPage() {
  const sections = [...SNOOKER_TABLE_SECTIONS];
  const ledgersList = await Promise.all(
    sections.map((section) => getSectionLedger(section))
  );
  const ledgers = Object.fromEntries(
    sections.map((section, i) => [section, ledgersList[i]])
  );

  return (
    <div>
      <CounterGrid sections={sections} ledgers={ledgers} snookerQuick />
    </div>
  );
}
