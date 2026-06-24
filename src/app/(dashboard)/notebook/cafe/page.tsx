import { getSectionLedger } from "@/actions/notebook-ledger";
import { CafeView } from "@/components/notebook/CafeView";

export default async function CafePage() {
  const entries = await getSectionLedger("CAFE");

  return <CafeView entries={entries} />;
}
