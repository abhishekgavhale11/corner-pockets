"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import { CounterSectionColumn } from "@/components/counter/CounterSectionColumn";
import { CustomerPreviewProvider } from "@/components/counter/CustomerPreviewContext";
import { CafeNewTabDialog } from "@/components/counter/CafeNewTabDialog";
import { CounterWorkspaceTabs } from "@/components/counter/CounterWorkspaceTabs";
import { NewCustomerButton } from "@/components/counter/NewCustomerButton";
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
  const headerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bodyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hostsReady, setHostsReady] = useState(false);

  useLayoutEffect(() => {
    setHostsReady(true);
  }, []);

  return (
    <CustomerPreviewProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <CounterWorkspaceTabs
          trailing={
            showNewCustomer ? (
              <NewCustomerButton onClick={() => setNewCustomerOpen(true)} />
            ) : undefined
          }
        />

        <div className="mb-2 flex shrink-0 gap-1.5 overflow-x-auto overflow-y-clip lg:hidden">
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

        <div className="relative z-20 grid shrink-0 grid-cols-1 gap-3 overflow-y-auto [scrollbar-gutter:stable] lg:grid-cols-3">
          {sections.map((section) => (
            <div
              key={`header-${section}`}
              ref={(el) => {
                headerRefs.current[section] = el;
              }}
              className={cn(
                "min-w-0 rounded-t-xl border border-b-0 border-gray-200/90 bg-[#f6faf8] shadow-sm shadow-gray-900/5",
                section === mobileSection ? "block" : "hidden lg:block"
              )}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
          <div className="grid min-h-full grid-cols-1 items-start gap-3 lg:grid-cols-3">
            {sections.map((section) => (
              <div
                key={`body-${section}`}
                ref={(el) => {
                  bodyRefs.current[section] = el;
                }}
                className={cn(
                  "min-h-full min-w-0 rounded-b-xl border border-t-0 border-gray-200/90 bg-[#f6faf8] shadow-sm shadow-gray-900/5",
                  section === mobileSection ? "block" : "hidden lg:block"
                )}
              />
            ))}
          </div>
        </div>

        {sections.map((section) => (
          <CounterSectionColumn
            key={section}
            section={section}
            entries={ledgers[section] ?? []}
            snookerQuick={snookerQuick}
            poolMiniQuick={poolMiniQuick}
            headerHost={hostsReady ? headerRefs.current[section] ?? null : null}
            bodyHost={hostsReady ? bodyRefs.current[section] ?? null : null}
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
