import type { NotebookEntryDTO, TableSessionDTO } from "@/types";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";
import {
  isBigSnookerTableId,
  poolMiniGameType,
} from "@/lib/constants/table-sessions";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import type { CompactSessionCheckoutLineDTO } from "@/types";

function gameTimeLabel(tableId: TableSessionDTO["tableId"]): string {
  if (isBigSnookerTableId(tableId)) {
    return "Snooker Time";
  }
  return poolMiniGameType(tableId) === "POOL" ? "Pool Time" : "Mini Time";
}

function lineSortTime(line: CompactSessionCheckoutLineDTO): number {
  if (line.kind === "game") {
    return new Date(line.endAt).getTime();
  }
  return new Date(line.at).getTime();
}

export function buildCompactSessionCheckoutTimeline(
  session: TableSessionDTO,
  entries: NotebookEntryDTO[]
): CompactSessionCheckoutLineDTO[] {
  const lines: CompactSessionCheckoutLineDTO[] = [];

  const gameEntry = entries.find(
    (entry) =>
      entry.section !== CAFE_SECTION &&
      entry.type === "SNOOKER" &&
      entry.sessionId === session.id
  );

  if (gameEntry) {
    lines.push({
      kind: "game",
      startAt: session.startedAt,
      endAt: session.endedAt ?? session.startedAt,
      durationMs: session.activePlayMs,
      label: isBigSnookerTableId(session.tableId)
        ? getEntryDisplayLabel(gameEntry)
        : gameTimeLabel(session.tableId),
      amount: gameEntry.amount,
    });
  } else if (session.gameChargeAmount > 0) {
    lines.push({
      kind: "game",
      startAt: session.startedAt,
      endAt: session.endedAt ?? session.startedAt,
      durationMs: session.activePlayMs,
      label: gameTimeLabel(session.tableId),
      amount: session.gameChargeAmount,
    });
  }

  for (const entry of entries) {
    if (entry.section !== CAFE_SECTION) continue;
    lines.push({
      kind: "cafe",
      at: entry.createdAt,
      label: getEntryDisplayLabel(entry),
      amount: entry.amount,
    });
  }

  return lines.sort((a, b) => lineSortTime(a) - lineSortTime(b));
}
