import { getSectionLedger } from "@/actions/notebook-ledger";
import { SnookerSubNav } from "@/components/notebook/SnookerSubNav";
import { SectionLedgerGrid } from "@/components/notebook/SectionLedgerGrid";

export default async function PoolMiniPage() {
  const [mini, pool1, pool2] = await Promise.all([
    getSectionLedger("MINI_SNOOKER"),
    getSectionLedger("POOL_1"),
    getSectionLedger("POOL_2"),
  ]);

  return (
    <div className="space-y-4">
      <SnookerSubNav />
      <SectionLedgerGrid
        sections={[
          { section: "MINI_SNOOKER", entries: mini },
          { section: "POOL_1", entries: pool1 },
          { section: "POOL_2", entries: pool2 },
        ]}
      />
    </div>
  );
}
