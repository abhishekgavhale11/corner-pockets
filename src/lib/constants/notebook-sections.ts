export const NOTEBOOK_SECTIONS = [
  "BIG_SNOOKER_1",
  "BIG_SNOOKER_2",
  "BIG_SNOOKER_3",
  "MINI_SNOOKER",
  "POOL_1",
  "POOL_2",
  "CAFE",
] as const;

export type NotebookSection = (typeof NOTEBOOK_SECTIONS)[number];

export const NOTEBOOK_SECTION_META: Record<
  NotebookSection,
  { label: string; emoji: string; slug: string }
> = {
  BIG_SNOOKER_1: { label: "Table 1", emoji: "🎱", slug: "big-snooker-1" },
  BIG_SNOOKER_2: { label: "Table 2", emoji: "🎱", slug: "big-snooker-2" },
  BIG_SNOOKER_3: { label: "Table 3", emoji: "🎱", slug: "big-snooker-3" },
  MINI_SNOOKER: { label: "Mini Snooker", emoji: "🎱", slug: "mini-snooker" },
  POOL_1: { label: "Pool 1", emoji: "🎱", slug: "pool-1" },
  POOL_2: { label: "Pool 2", emoji: "🎱", slug: "pool-2" },
  CAFE: { label: "Cafe", emoji: "☕", slug: "cafe" },
};

export function getSectionBySlug(slug: string): NotebookSection | null {
  const entry = Object.entries(NOTEBOOK_SECTION_META).find(
    ([, meta]) => meta.slug === slug
  );
  return entry ? (entry[0] as NotebookSection) : null;
}

export function sectionLabel(section: NotebookSection): string {
  return NOTEBOOK_SECTION_META[section].label;
}
