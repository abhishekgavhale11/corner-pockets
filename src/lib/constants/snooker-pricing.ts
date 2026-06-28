import {
  resolveCounterRateAmount,
  type SnookerGame,
} from "@/lib/constants/counter-rates";

/** Default regular Big Snooker prices (₹). */
export const SNOOKER_SINGLES_AMOUNT =
  resolveCounterRateAmount({
    type: "SNOOKER",
    rateType: "REGULAR",
    snookerGame: "SINGLES",
  }) ?? 160;
export const SNOOKER_INDIVIDUAL_AMOUNT =
  resolveCounterRateAmount({
    type: "SNOOKER",
    rateType: "REGULAR",
    snookerGame: "INDIVIDUAL",
  }) ?? 180;
export const SNOOKER_SHUFFLE_AMOUNT =
  resolveCounterRateAmount({
    type: "SNOOKER",
    rateType: "REGULAR",
    snookerGame: "SHUFFLE",
  }) ?? 130;

/** Legacy amounts — display labels only; stored amount unchanged on old entries. */
export const LEGACY_SNOOKER_SINGLES_AMOUNT = 150;
export const LEGACY_SNOOKER_INDIVIDUAL_AMOUNT = 180;

export const MINI_SNOOKER_REGULAR_AMOUNT =
  resolveCounterRateAmount({ type: "MINI", rateType: "REGULAR" }) ?? 260;
export const POOL_REGULAR_AMOUNT =
  resolveCounterRateAmount({ type: "POOL", rateType: "REGULAR" }) ?? 240;

/** Default Rummy totals by player count (3P base, +₹120 per extra player). */
export const RUMMY_BASE_AMOUNT_3P = 360;
export const RUMMY_AMOUNT_PER_EXTRA_PLAYER = 120;

export const RUMMY_PLAYER_PRESETS = [3, 4, 5, 6] as const;

export type RummyPlayerPreset = (typeof RUMMY_PLAYER_PRESETS)[number];

function rummyAmountForPlayers(count: RummyPlayerPreset): number {
  return RUMMY_BASE_AMOUNT_3P + RUMMY_AMOUNT_PER_EXTRA_PLAYER * (count - 3);
}

export const RUMMY_DEFAULT_AMOUNTS: Record<RummyPlayerPreset, number> = {
  3: rummyAmountForPlayers(3),
  4: rummyAmountForPlayers(4),
  5: rummyAmountForPlayers(5),
  6: rummyAmountForPlayers(6),
};

export function getRummyDefaultAmount(
  playerCount: number
): number | undefined {
  if (!RUMMY_PLAYER_PRESETS.includes(playerCount as RummyPlayerPreset)) {
    return undefined;
  }
  return rummyAmountForPlayers(playerCount as RummyPlayerPreset);
}

export type { SnookerGame };
