"use client";

import { useState } from "react";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { SectionLedger } from "@/components/notebook/SectionLedger";
import { AddEntryDrawer } from "@/components/notebook/AddEntryDrawer";
import { cn } from "@/lib/utils/cn";

interface SectionConfig {
  section: NotebookSection;
  entries: NotebookEntryDTO[];
}

interface SectionLedgerGridProps {
  sections: SectionConfig[];
  requireCustomerFirst?: boolean;
}

export function SectionLedgerGrid({
  sections,
  requireCustomerFirst = false,
}: SectionLedgerGridProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.section);
  const [drawerSection, setDrawerSection] = useState<NotebookSection | null>(
    null
  );

  const openDrawer = (section: NotebookSection) => {
    setDrawerSection(section);
  };

  return (
    <>
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        {sections.map(({ section, entries }) => (
          <div
            key={section}
            className="flex flex-col rounded-xl border border-gray-200 bg-white"
          >
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="font-semibold text-gray-900">
                {sectionLabel(section)}
              </h2>
            </div>
            <div className="max-h-[calc(100vh-280px)] flex-1 overflow-y-auto px-4">
              <SectionLedger entries={entries} />
            </div>
            <div className="border-t border-gray-100 p-3">
              <Button
                type="button"
                fullWidth
                onClick={() => openDrawer(section)}
              >
                + Add Entry
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="lg:hidden">
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {sections.map(({ section }) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-sm font-medium",
                activeSection === section
                  ? "bg-emerald-800 text-white"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              {sectionLabel(section)}
            </button>
          ))}
        </div>

        {sections
          .filter(({ section }) => section === activeSection)
          .map(({ section, entries }) => (
            <div
              key={section}
              className="rounded-xl border border-gray-200 bg-white"
            >
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto px-4 pt-2">
                <SectionLedger entries={entries} />
              </div>
              <div className="border-t border-gray-100 p-3">
                <Button
                  type="button"
                  fullWidth
                  onClick={() => openDrawer(section)}
                >
                  + Add Entry
                </Button>
              </div>
            </div>
          ))}
      </div>

      {drawerSection && (
        <AddEntryDrawer
          section={drawerSection}
          open={!!drawerSection}
          onClose={() => setDrawerSection(null)}
          requireCustomerFirst={requireCustomerFirst}
        />
      )}
    </>
  );
}
