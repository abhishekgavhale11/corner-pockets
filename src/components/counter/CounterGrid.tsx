"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import { CounterSectionColumn } from "@/components/counter/CounterSectionColumn";
import { CustomerPreviewProvider } from "@/components/counter/CustomerPreviewContext";
import { CafeNewTabDialog } from "@/components/counter/CafeNewTabDialog";
import { CounterWorkspaceTabs } from "@/components/counter/CounterWorkspaceTabs";
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
  const showNewCustomer = snookerQuick || poolMiniQuick;

  return (
    <CustomerPreviewProvider>
      <CounterWorkspaceTabs
        trailing={
          showNewCustomer ? (
            <button
              type="button"
              onClick={() => setNewCustomerOpen(true)}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] bg-emerald-800 px-4 text-[13px] font-semibold text-white shadow-sm shadow-emerald-900/20 transition-colors hover:bg-emerald-900"
            >
              <span className="text-[16px] font-bold leading-none" aria-hidden>
                +
              </span>
              New Customer
            </button>
          ) : undefined
        }
      />

      <div className="mb-2 flex gap-1.5 overflow-x-auto lg:hidden">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setMobileSection(section)}
            className={cn(
              "shrink-0 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-colors",
              mobileSection === section
                ? "bg-emerald-800 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"
            )}
          >
            {sectionLabel(section)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
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

      {showNewCustomer && (
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
