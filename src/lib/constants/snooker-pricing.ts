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

/** Default Rummy totals by player count. */
export const RUMMY_DEFAULT_AMOUNTS: Record<3 | 4 | 5, number> = {
  3: 300,
  4: 400,
  5: 750,
};

export const RUMMY_PLAYER_PRESETS = [3, 4, 5] as const;

export type { SnookerGame };
