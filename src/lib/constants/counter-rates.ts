import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";

export const COUNTER_RATE_TYPES = ["REGULAR", "HAPPY_HOUR"] as const;
export type CounterRateType = (typeof COUNTER_RATE_TYPES)[number];

export const SNOOKER_GAMES = ["SINGLES", "INDIVIDUAL", "SHUFFLE"] as const;
export type SnookerGame = (typeof SNOOKER_GAMES)[number];

export const SNOOKER_GAME_LABELS: Record<SnookerGame, string> = {
  SINGLES: "Singles",
  INDIVIDUAL: "Individual",
  SHUFFLE: "Shuffle",
};

/**
 * Happy Hour windows (Asia/Kolkata). Cashier selects Regular vs Happy Hour —
 * CPOS never auto-switches rates from the clock.
 */
export const HAPPY_HOUR_SCHEDULE = {
  weekday: { days: "Mon–Fri", start: "10:00", end: "16:00" },
  weekend: { days: "Sat–Sun", start: "10:00", end: "14:00" },
} as const;

type RatedEntryType = "SNOOKER" | "MINI" | "POOL" | "BIG_SNOOKER_TIME";

/**
 * Finalized club rate card (₹).
 * Flat base rates only — never auto-add Extra Player; staff enter that manually when needed.
 * Amounts are resolved at entry/session create time and stored on the record (historical bills stay fixed).
 */
const RATE_TABLE: Record<
  RatedEntryType,
  Record<CounterRateType, number | Record<SnookerGame, number>>
> = {
  SNOOKER: {
    REGULAR: { SINGLES: 160, INDIVIDUAL: 190, SHUFFLE: 120 },
    HAPPY_HOUR: { SINGLES: 130, INDIVIDUAL: 160, SHUFFLE: 100 },
  },
  MINI: {
    REGULAR: 260,
    HAPPY_HOUR: 220,
  },
  POOL: {
    REGULAR: 240,
    HAPPY_HOUR: 200,
  },
  BIG_SNOOKER_TIME: {
    REGULAR: 320,
    HAPPY_HOUR: 260,
  },
};

/**
 * Legacy amounts for entries created before rate type / current card was stored.
 * Includes retired prices so old rows still infer game labels.
 */
export const LEGACY_AMOUNT_SNOOKER_LABELS: Record<number, SnookerGame> = {
  160: "SINGLES",
  130: "SINGLES",
  150: "SINGLES",
  180: "INDIVIDUAL",
  190: "INDIVIDUAL",
  120: "SHUFFLE",
  100: "SHUFFLE",
};

export function isRatedCounterEntryType(
  type: NotebookEntryType
): type is Exclude<RatedEntryType, "BIG_SNOOKER_TIME"> {
  return type === "SNOOKER" || type === "MINI" || type === "POOL";
}

export function resolveBigSnookerHourlyRate(
  rateType: CounterRateType
): number {
  return resolveCounterRateAmount({ type: "BIG_SNOOKER_TIME", rateType }) ?? 0;
}

export function defaultSnookerFrameAmount(snookerGame: SnookerGame): number {
  return (
    resolveCounterRateAmount({
      type: "SNOOKER",
      rateType: "REGULAR",
      snookerGame,
    }) ?? 0
  );
}

export function resolveCounterRateAmount(input: {
  type: RatedEntryType;
  rateType: CounterRateType;
  snookerGame?: SnookerGame;
}): number | null {
  const rates = RATE_TABLE[input.type][input.rateType];

  if (input.type === "SNOOKER") {
    if (!input.snookerGame) return null;
    return (rates as Record<SnookerGame, number>)[input.snookerGame] ?? null;
  }

  if (input.type === "BIG_SNOOKER_TIME") {
    return typeof rates === "number" ? rates : null;
  }

  return typeof rates === "number" ? rates : null;
}

export function getSnookerFrameAmountPresets(
  snookerGame: SnookerGame
): { amount: number; label: string }[] {
  return getRateOptionsForPreset({ type: "SNOOKER", snookerGame }).map(
    ({ rateType, amount }) => ({
      amount,
      label:
        rateType === "REGULAR"
          ? `${amount} (Regular)`
          : `${amount} (Happy Hour)`,
    })
  );
}

export function getRateOptionsForPreset(input: {
  type: RatedEntryType;
  snookerGame?: SnookerGame;
}): { rateType: CounterRateType; amount: number }[] {
  if (input.type === "BIG_SNOOKER_TIME") {
    return COUNTER_RATE_TYPES.map((rateType) => ({
      rateType,
      amount: resolveBigSnookerHourlyRate(rateType),
    }));
  }

  return COUNTER_RATE_TYPES.map((rateType) => ({
    rateType,
    amount:
      resolveCounterRateAmount({
        type: input.type,
        rateType,
        snookerGame: input.snookerGame,
      }) ?? 0,
  }));
}

export function inferSnookerGameFromAmount(amount: number): SnookerGame | undefined {
  return LEGACY_AMOUNT_SNOOKER_LABELS[amount];
}

export function counterRateTypeSuffix(rateType?: CounterRateType): string {
  return rateType === "HAPPY_HOUR" ? " (HH)" : "";
}

export function inferRateTypeFromStoredAmount(
  type: RatedEntryType,
  amount: number,
  snookerGame?: SnookerGame
): CounterRateType | undefined {
  const happyHourAmount = resolveCounterRateAmount({
    type,
    rateType: "HAPPY_HOUR",
    snookerGame,
  });
  if (happyHourAmount !== null && amount === happyHourAmount) {
    return "HAPPY_HOUR";
  }
  const regularAmount = resolveCounterRateAmount({
    type,
    rateType: "REGULAR",
    snookerGame,
  });
  if (regularAmount !== null && amount === regularAmount) {
    return "REGULAR";
  }
  return undefined;
}
