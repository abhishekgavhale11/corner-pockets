"use client";

import { useState } from "react";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import { CounterSectionColumn } from "@/components/counter/CounterSectionColumn";
import { cn } from "@/lib/utils/cn";

interface CounterGridProps {
  sections: NotebookSection[];
  ledgers: Record<string, NotebookEntryDTO[]>;
  snookerQuick?: boolean;
}

export function CounterGrid({
  sections,
  ledgers,
  snookerQuick = false,
}: CounterGridProps) {
  const [mobileSection, setMobileSection] = useState(sections[0]);

  return (
    <>
      <div className="mb-2 flex gap-1 overflow-x-auto lg:hidden">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setMobileSection(section)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-bold",
              mobileSection === section
                ? "bg-emerald-800 text-white"
                : "bg-gray-100 text-gray-700"
            )}
          >
            {sectionLabel(section)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {sections.map((section) => (
          <CounterSectionColumn
            key={section}
            section={section}
            entries={ledgers[section] ?? []}
            snookerQuick={snookerQuick}
            activeMobile={section === mobileSection}
          />
        ))}
      </div>
    </>
  );
}
