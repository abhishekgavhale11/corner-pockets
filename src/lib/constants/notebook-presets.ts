import type { NotebookSection } from "@/lib/constants/notebook-sections";
import type { NotebookEntryType } from "@/lib/constants/notebook-entry-types";
import type { SnookerGame } from "@/lib/constants/counter-rates";

export type NotebookPreset = {
  key: string;
  label: string;
  section: NotebookSection;
  type: NotebookEntryType;
  snookerGame?: SnookerGame;
};

export const NOTEBOOK_SECTION_PRESETS: Record<NotebookSection, NotebookPreset[]> =
  {
    BIG_SNOOKER_1: [
      {
        key: "bs1-singles",
        label: "Singles",
        section: "BIG_SNOOKER_1",
        type: "SNOOKER",
        snookerGame: "SINGLES",
      },
      {
        key: "bs1-individual",
        label: "Individual",
        section: "BIG_SNOOKER_1",
        type: "SNOOKER",
        snookerGame: "INDIVIDUAL",
      },
      {
        key: "bs1-shuffle",
        label: "Shuffle",
        section: "BIG_SNOOKER_1",
        type: "SNOOKER",
        snookerGame: "SHUFFLE",
      },
    ],
    BIG_SNOOKER_2: [
      {
        key: "bs2-singles",
        label: "Singles",
        section: "BIG_SNOOKER_2",
        type: "SNOOKER",
        snookerGame: "SINGLES",
      },
      {
        key: "bs2-individual",
        label: "Individual",
        section: "BIG_SNOOKER_2",
        type: "SNOOKER",
        snookerGame: "INDIVIDUAL",
      },
      {
        key: "bs2-shuffle",
        label: "Shuffle",
        section: "BIG_SNOOKER_2",
        type: "SNOOKER",
        snookerGame: "SHUFFLE",
      },
    ],
    BIG_SNOOKER_3: [
      {
        key: "bs3-singles",
        label: "Singles",
        section: "BIG_SNOOKER_3",
        type: "SNOOKER",
        snookerGame: "SINGLES",
      },
      {
        key: "bs3-individual",
        label: "Individual",
        section: "BIG_SNOOKER_3",
        type: "SNOOKER",
        snookerGame: "INDIVIDUAL",
      },
      {
        key: "bs3-shuffle",
        label: "Shuffle",
        section: "BIG_SNOOKER_3",
        type: "SNOOKER",
        snookerGame: "SHUFFLE",
      },
    ],
    MINI_SNOOKER: [
      {
        key: "mini",
        label: "Mini Snooker",
        section: "MINI_SNOOKER",
        type: "MINI",
      },
    ],
    POOL_1: [
      {
        key: "pool1",
        label: "Pool",
        section: "POOL_1",
        type: "POOL",
      },
    ],
    POOL_2: [
      {
        key: "pool2",
        label: "Pool",
        section: "POOL_2",
        type: "POOL",
      },
    ],
    CAFE: [
      {
        key: "cafe-cigarette",
        label: "Cigarette",
        section: "CAFE",
        type: "CIGARETTE",
      },
      {
        key: "cafe-water",
        label: "Water",
        section: "CAFE",
        type: "WATER",
      },
      {
        key: "cafe-coffee",
        label: "Coffee",
        section: "CAFE",
        type: "COFFEE",
      },
      {
        key: "cafe-food",
        label: "Food & Beverages",
        section: "CAFE",
        type: "FOOD",
      },
    ],
  };

export function getPresetsForSection(section: NotebookSection): NotebookPreset[] {
  return NOTEBOOK_SECTION_PRESETS[section];
}
