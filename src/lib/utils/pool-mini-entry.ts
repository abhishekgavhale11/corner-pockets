import type { NotebookEntryDTO } from "@/types";
import {
  isPoolMiniSection,
  POOL_MINI_SECTIONS,
} from "@/lib/constants/counter-sections";

export type PoolMiniSection = (typeof POOL_MINI_SECTIONS)[number];

export function isPoolMiniEntry(
  entry: Pick<NotebookEntryDTO, "type" | "section">
): boolean {
  return (
    (entry.type === "MINI" || entry.type === "POOL") &&
    isPoolMiniSection(entry.section)
  );
}
