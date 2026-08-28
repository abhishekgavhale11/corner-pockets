import { getSectionLedger } from "@/actions/notebook-ledger";
import { CounterGrid } from "@/components/counter/CounterGrid";
import { POOL_MINI_SECTIONS } from "@/lib/constants/counter-sections";

export const dynamic = "force-dynamic";

export default async function PoolMiniCounterPage() {
  const sections = [...POOL_MINI_SECTIONS];
  const ledgersList = await Promise.all(
    sections.map((section) => getSectionLedger(section))
  );
  const ledgers = Object.fromEntries(
    sections.map((section, i) => [section, ledgersList[i]])
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CounterGrid sections={sections} ledgers={ledgers} poolMiniQuick />
    </div>
  );
}
