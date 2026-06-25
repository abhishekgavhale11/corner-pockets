"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import { CounterSectionColumn } from "@/components/counter/CounterSectionColumn";
import { CafeNewTabDialog } from "@/components/counter/CafeNewTabDialog";
import { CafeExistingCustomerDialog } from "@/components/counter/CafeExistingCustomerDialog";
import { CafeAddItemDialog } from "@/components/counter/CafeAddItemDialog";
import { useCafeAddItem } from "@/components/counter/useCafeAddItem";
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
  const router = useRouter();
  const [mobileSection, setMobileSection] = useState(sections[0]);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [pickCustomerForCafe, setPickCustomerForCafe] = useState(false);
  const { cafeTarget, closeCafe, openCafeForCustomer } = useCafeAddItem();

  return (
    <>
      {snookerQuick && (
        <div className="mb-3 flex flex-wrap justify-start gap-2">
          <button
            type="button"
            onClick={() => setNewCustomerOpen(true)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[13px] font-bold text-emerald-900 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50"
          >
            + New Customer
          </button>
          <button
            type="button"
            onClick={() => setPickCustomerForCafe(true)}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-950 shadow-sm"
          >
            + Add Cafe
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
            activeMobile={section === mobileSection}
          />
        ))}
      </div>

      {snookerQuick && (
        <>
          <CafeNewTabDialog
            open={newCustomerOpen}
            onClose={() => setNewCustomerOpen(false)}
            submitLabel="Create Customer"
            onCreated={() => {
              router.refresh();
            }}
          />
          <CafeExistingCustomerDialog
            open={pickCustomerForCafe}
            onClose={() => setPickCustomerForCafe(false)}
            onSelect={(customer) => {
              openCafeForCustomer(customer.id, customer.name);
            }}
          />
          <CafeAddItemDialog target={cafeTarget} onClose={closeCafe} />
        </>
      )}
    </>
  );
}
