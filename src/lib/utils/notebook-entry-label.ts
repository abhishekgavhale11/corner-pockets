import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import { entryTypeLabel } from "@/lib/constants/notebook-entry-types";
import {
  counterRateTypeSuffix,
  inferSnookerGameFromAmount,
  inferRateTypeFromStoredAmount,
  SNOOKER_GAME_LABELS,
  type CounterRateType,
  type SnookerGame,
} from "@/lib/constants/counter-rates";

const LEGACY_SNOOKER_AMOUNT_LABELS: Record<number, string> = {
  160: "Singles",
  130: "Singles",
  150: "Singles",
  180: "Ind",
  190: "Ind",
  120: "Shuffle",
  100: "Shuffle",
};

export type NotebookEntryLabelOptions = {
  playerCount?: number;
  snookerGame?: SnookerGame;
  rateType?: CounterRateType;
};

export function getNotebookEntryDisplayLabel(
  type: NotebookEntryType,
  amount: number,
  playerCountOrOptions?: number | NotebookEntryLabelOptions,
  legacyPlayerCount?: number
): string {
  const options: NotebookEntryLabelOptions =
    typeof playerCountOrOptions === "number"
      ? { playerCount: playerCountOrOptions ?? legacyPlayerCount }
      : (playerCountOrOptions ?? {});

  const { playerCount, snookerGame, rateType } = options;

  if (type === "RUMMY") {
    return playerCount ? `Rummy (${playerCount}P)` : "Rummy";
  }

  if (type === "SNOOKER") {
    const game = snookerGame ?? inferSnookerGameFromAmount(amount);

    if (game) {
      const effectiveRateType =
        rateType ??
        inferRateTypeFromStoredAmount("SNOOKER", amount, game);
      return `${SNOOKER_GAME_LABELS[game]}${counterRateTypeSuffix(effectiveRateType)}`;
    }

    return LEGACY_SNOOKER_AMOUNT_LABELS[amount] ?? entryTypeLabel(type);
  }

  if (type === "MINI" || type === "POOL") {
    const effectiveRateType =
      rateType ?? inferRateTypeFromStoredAmount(type, amount);
    return `${entryTypeLabel(type)}${counterRateTypeSuffix(effectiveRateType)}`;
  }

  return entryTypeLabel(type);
}

export function getEntryDisplayLabel(
  entry: Pick<
    import("@/types").NotebookEntryDTO,
    "type" | "amount" | "playerCount" | "snookerGame" | "rateType"
  >
): string {
  return getNotebookEntryDisplayLabel(entry.type, entry.amount, {
    playerCount: entry.playerCount,
    snookerGame: entry.snookerGame,
    rateType: entry.rateType,
  });
}

export function formatCafeItemLabel(
  entry: Pick<
    import("@/types").NotebookEntryDTO,
    "type" | "amount" | "quantity" | "itemNote"
  >
): string {
  const base = getEntryDisplayLabel(entry);
  if (entry.type === "FOOD" && entry.itemNote?.trim()) {
    return `${base} — ${entry.itemNote.trim()}`;
  }
  const qty = entry.quantity ?? 1;
  if (qty > 1) {
    return `${base} × ${qty}`;
  }
  return base;
}

export function getRummyActivityLabel(playerCount: number): string {
  return `🎴 Rummy (${playerCount} Player${playerCount === 1 ? "" : "s"})`;
}
