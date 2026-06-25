import type { SnookerFrameType } from "@/lib/constants/counter-sections";
import { inferSnookerGameFromAmount } from "@/lib/constants/counter-rates";
import type { NotebookEntryDTO } from "@/types";

export function entryToSnookerFrameType(
  entry: NotebookEntryDTO
): SnookerFrameType | null {
  if (entry.type === "RUMMY") return "RUMMY";
  if (entry.type !== "SNOOKER") return null;
  if (entry.snookerGame) return entry.snookerGame;
  return inferSnookerGameFromAmount(entry.amount) ?? null;
}

export function isSnookerFrameEntry(entry: NotebookEntryDTO): boolean {
  return entry.type === "SNOOKER" || entry.type === "RUMMY";
}
