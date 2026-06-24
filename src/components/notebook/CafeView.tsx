"use client";

import { useState } from "react";
import type { NotebookEntryDTO } from "@/types";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import { Button } from "@/components/ui/Button";
import { SectionLedger } from "@/components/notebook/SectionLedger";
import { AddEntryDrawer } from "@/components/notebook/AddEntryDrawer";

interface CafeViewProps {
  entries: NotebookEntryDTO[];
}

export function CafeView({ entries }: CafeViewProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-semibold text-gray-900">
            {sectionLabel("CAFE")}
          </h2>
        </div>
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto px-4">
          <SectionLedger entries={entries} />
        </div>
        <div className="border-t border-gray-100 p-3">
          <Button type="button" fullWidth onClick={() => setDrawerOpen(true)}>
            + Add Entry
          </Button>
        </div>
      </div>

      <AddEntryDrawer
        section="CAFE"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        requireCustomerFirst
      />
    </div>
  );
}
