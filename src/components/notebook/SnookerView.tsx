import type { NotebookSection } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import { SnookerSubNav } from "@/components/notebook/SnookerSubNav";
import { SectionLedgerGrid } from "@/components/notebook/SectionLedgerGrid";

interface SnookerViewProps {
  ledgers: {
    section: NotebookSection;
    entries: NotebookEntryDTO[];
  }[];
}

export function SnookerView({ ledgers }: SnookerViewProps) {
  return (
    <div className="space-y-4">
      <SnookerSubNav />
      <SectionLedgerGrid sections={ledgers} />
    </div>
  );
}
