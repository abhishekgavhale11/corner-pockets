import { getCafePageData } from "@/actions/notebook-ledger";
import { CafeCounter } from "@/components/counter/CafeCounter";

export default async function CafeCounterPage() {
  const { cafeEntries, gameEntries, cardIdByCustomerId, poolMiniSessions } =
    await getCafePageData();

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900">Cafe</h1>
      <CafeCounter
        cafeEntries={cafeEntries}
        gameEntries={gameEntries}
        cardIdByCustomerId={cardIdByCustomerId}
        poolMiniSessions={poolMiniSessions}
      />
    </div>
  );
}
