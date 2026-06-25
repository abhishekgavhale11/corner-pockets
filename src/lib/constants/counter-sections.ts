import type { SnookerGame } from "@/lib/constants/counter-rates";

export const CAFE_SECTION = "CAFE" as const;

export const CAFE_TABLE_IDS = [
  "BIG_SNOOKER_1",
  "BIG_SNOOKER_2",
  "BIG_SNOOKER_3",
  "MINI_SNOOKER",
  "POOL_1",
  "POOL_2",
] as const;

export type CafeTableId = (typeof CAFE_TABLE_IDS)[number];

export const SNOOKER_TABLE_SECTIONS = [
  "BIG_SNOOKER_1",
  "BIG_SNOOKER_2",
  "BIG_SNOOKER_3",
] as const;

export const POOL_MINI_SECTIONS = [
  "MINI_SNOOKER",
  "POOL_1",
  "POOL_2",
] as const;

export type SnookerQuickPreset =
  | {
      key: string;
      label: string;
      type: "SNOOKER";
      snookerGame: SnookerGame;
    }
  | {
      key: "rummy";
      label: "Rummy";
      type: "RUMMY";
      isRummy: true;
    };

export const SNOOKER_FRAME_TYPES = [
  "SINGLES",
  "INDIVIDUAL",
  "SHUFFLE",
  "RUMMY",
] as const;

export type SnookerFrameType = (typeof SNOOKER_FRAME_TYPES)[number];

export const SNOOKER_FRAME_TYPE_LABELS: Record<SnookerFrameType, string> = {
  SINGLES: "Singles",
  INDIVIDUAL: "Individual",
  SHUFFLE: "Shuffle",
  RUMMY: "Rummy",
};

export const SNOOKER_QUICK_PRESETS: SnookerQuickPreset[] = [
  {
    key: "singles",
    label: "Singles",
    type: "SNOOKER",
    snookerGame: "SINGLES",
  },
  {
    key: "individual",
    label: "Individual",
    type: "SNOOKER",
    snookerGame: "INDIVIDUAL",
  },
  {
    key: "shuffle",
    label: "Shuffle",
    type: "SNOOKER",
    snookerGame: "SHUFFLE",
  },
  { key: "rummy", label: "Rummy", type: "RUMMY", isRummy: true },
];

export const CAFE_QUICK_ITEMS = [
  { key: "cigarette", label: "Cigarette", type: "CIGARETTE" as const, unitPrice: 20 },
  { key: "water", label: "Water", type: "WATER" as const, unitPrice: 10 },
  { key: "coffee", label: "Coffee", type: "COFFEE" as const, unitPrice: 25 },
  { key: "food", label: "Food", type: "FOOD" as const },
] as const;

export function isCafeSection(section: string): boolean {
  return section === CAFE_SECTION;
}

export function isBigSnookerSection(section: string): boolean {
  return (SNOOKER_TABLE_SECTIONS as readonly string[]).includes(section);
}

export function checkoutEntryGroup(
  section: string
): "snooker" | "poolMini" | "cafe" {
  if (section === CAFE_SECTION) return "cafe";
  if (
    section === "MINI_SNOOKER" ||
    section === "POOL_1" ||
    section === "POOL_2"
  ) {
    return "poolMini";
  }
  return "snooker";
}
