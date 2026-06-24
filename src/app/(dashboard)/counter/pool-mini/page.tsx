import { getPoolMiniSessionBoardData } from "@/actions/table-sessions";
import { MiniSessionBoard } from "@/components/counter/MiniSessionBoard";

export default async function PoolMiniCounterPage() {
  const board = await getPoolMiniSessionBoardData();
  const mini = board.tables.find((table) => table.tableId === "MINI_SNOOKER");

  if (!mini) {
    return <p className="text-sm text-gray-500">Mini table data unavailable.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <MiniSessionBoard
        session={mini.session}
        pendingCheckouts={mini.pendingCheckouts}
        summary={mini.summary}
        history={mini.history}
        canStartNewSession={mini.canStartNewSession}
      />
    </div>
  );
}
