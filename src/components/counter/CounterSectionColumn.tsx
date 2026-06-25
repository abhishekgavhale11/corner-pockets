"use client";

import { useState } from "react";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { sectionLabel } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import {
  getPresetsForSection,
  type NotebookPreset,
} from "@/lib/constants/notebook-presets";
import type { SnookerQuickPreset } from "@/lib/constants/counter-sections";
import { CompactLedgerRow } from "@/components/counter/CompactLedgerRow";
import { CounterLedgerTable } from "@/components/counter/CounterLedgerTable";
import { SnookerFrameAddRow } from "@/components/counter/SnookerFrameAddRow";
import { SnookerFrameEditDialog } from "@/components/counter/SnookerFrameEditDialog";
import { AssignCustomerDrawer } from "@/components/counter/AssignCustomerDrawer";
import { RummyEntryDialog } from "@/components/counter/RummyEntryDialog";
import { EntryCorrectionDialog } from "@/components/counter/EntryCorrectionDialog";
import { CorrectionHistoryDialog } from "@/components/counter/CorrectionHistoryDialog";
import { ContributorsSplitDialog } from "@/components/counter/ContributorsSplitDialog";
import { UnassignedEntryDialog } from "@/components/counter/UnassignedEntryDialog";
import {
  RateTypeEntryDialog,
  type RatedEntryPreset,
} from "@/components/counter/RateTypeEntryDialog";
import { cn } from "@/lib/utils/cn";

interface CounterSectionColumnProps {
  section: NotebookSection;
  entries: NotebookEntryDTO[];
  snookerQuick?: boolean;
  activeMobile?: boolean;
}

export function CounterSectionColumn({
  section,
  entries,
  snookerQuick = false,
  activeMobile = true,
}: CounterSectionColumnProps) {
  const [assignEntry, setAssignEntry] = useState<NotebookEntryDTO | null>(null);
  const [unassignedEntry, setUnassignedEntry] = useState<NotebookEntryDTO | null>(null);
  const [rummySection, setRummySection] = useState<NotebookSection | null>(null);
  const [correctEntry, setCorrectEntry] = useState<NotebookEntryDTO | null>(null);
  const [historyEntry, setHistoryEntry] = useState<NotebookEntryDTO | null>(null);
  const [splitEntry, setSplitEntry] = useState<NotebookEntryDTO | null>(null);
  const [ratePreset, setRatePreset] = useState<RatedEntryPreset | null>(null);
  const [editFrameEntry, setEditFrameEntry] = useState<NotebookEntryDTO | null>(
    null
  );

  const quickButtons = snookerQuick ? [] : getPresetsForSection(section);

  const toRatedPreset = (
    btn: SnookerQuickPreset | NotebookPreset
  ): RatedEntryPreset | null => {
    if ("isRummy" in btn && btn.isRummy) return null;
    if (btn.type === "SNOOKER" && "snookerGame" in btn && btn.snookerGame) {
      return {
        key: btn.key,
        label: btn.label,
        type: "SNOOKER",
        snookerGame: btn.snookerGame,
      };
    }
    if (btn.type === "MINI" || btn.type === "POOL") {
      return {
        key: btn.key,
        label: btn.label,
        type: btn.type,
      };
    }
    return null;
  };

  const handleQuickClick = (btn: SnookerQuickPreset | NotebookPreset) => {
    if ("isRummy" in btn && btn.isRummy) {
      setRummySection(section);
      return;
    }

    const ratedPreset = toRatedPreset(btn);
    if (ratedPreset) {
      setRatePreset(ratedPreset);
    }
  };

  const column = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-2 py-2">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900">
          {sectionLabel(section)}
        </h3>
      </div>
      {quickButtons.length > 0 && (
        <div className="flex gap-1 border-b border-gray-100 p-1.5">
          {quickButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => handleQuickClick(btn)}
              className="flex-1 rounded-md bg-emerald-800 px-2 py-2 text-[12px] font-bold text-white hover:bg-emerald-900"
            >
              + {btn.label}
            </button>
          ))}
        </div>
      )}
      <CounterLedgerTable
        toolbar={
          snookerQuick ? <SnookerFrameAddRow section={section} /> : undefined
        }
      >
        {entries.map((entry) => (
          <CompactLedgerRow
            key={entry.id}
            entry={entry}
            frameEditable={snookerQuick}
            onEditFrame={setEditFrameEntry}
            onUnassignedAction={setUnassignedEntry}
            onCorrect={setCorrectEntry}
            onShowCorrectionHistory={setHistoryEntry}
          />
        ))}
      </CounterLedgerTable>
    </div>
  );

  return (
    <>
      <div className={cn("min-w-0", activeMobile ? "block" : "hidden lg:block")}>
        {column}
      </div>
      <AssignCustomerDrawer
        entry={assignEntry}
        onClose={() => setAssignEntry(null)}
      />
      <UnassignedEntryDialog
        entry={unassignedEntry}
        onClose={() => setUnassignedEntry(null)}
        onAssign={(entry) => setAssignEntry(entry)}
        onSplit={(entry) => setSplitEntry(entry)}
      />
      <SnookerFrameEditDialog
        entry={editFrameEntry}
        onClose={() => setEditFrameEntry(null)}
      />
      <RummyEntryDialog
        createSection={rummySection}
        onClose={() => setRummySection(null)}
      />
      <RateTypeEntryDialog
        preset={ratePreset}
        section={ratePreset ? section : null}
        onClose={() => setRatePreset(null)}
      />
      <EntryCorrectionDialog
        entry={correctEntry}
        onClose={() => setCorrectEntry(null)}
      />
      <CorrectionHistoryDialog
        corrections={historyEntry?.corrections}
        onClose={() => setHistoryEntry(null)}
      />
      <ContributorsSplitDialog
        entry={splitEntry}
        onClose={() => setSplitEntry(null)}
      />
    </>
  );
}
