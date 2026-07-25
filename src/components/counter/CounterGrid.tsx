"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import { CounterSectionColumn } from "@/components/counter/CounterSectionColumn";
import { CustomerPreviewProvider } from "@/components/counter/CustomerPreviewContext";
import { CafeNewTabDialog } from "@/components/counter/CafeNewTabDialog";
import { cn } from "@/lib/utils/cn";

interface CounterGridProps {
  sections: NotebookSection[];
  ledgers: Record<string, NotebookEntryDTO[]>;
  snookerQuick?: boolean;
  poolMiniQuick?: boolean;
}

export function CounterGrid({
  sections,
  ledgers,
  snookerQuick = false,
  poolMiniQuick = false,
}: CounterGridProps) {
  const router = useRouter();
  const [mobileSection, setMobileSection] = useState(sections[0]);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  return (
    <CustomerPreviewProvider>
      {(snookerQuick || poolMiniQuick) && (
        <div className="mb-3 flex flex-wrap justify-start gap-2">
          <button
            type="button"
            onClick={() => setNewCustomerOpen(true)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[13px] font-bold text-emerald-900 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50"
          >
            + New Customer
          </button>
        </div>
      )}

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
            poolMiniQuick={poolMiniQuick}
            activeMobile={section === mobileSection}
          />
        ))}
      </div>

      {(snookerQuick || poolMiniQuick) && (
        <CafeNewTabDialog
          open={newCustomerOpen}
          onClose={() => setNewCustomerOpen(false)}
          submitLabel="Create Customer"
          onCreated={() => {
            router.refresh();
          }}
        />
      )}
    </CustomerPreviewProvider>
  );
}
