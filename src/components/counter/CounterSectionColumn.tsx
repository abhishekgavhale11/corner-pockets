"use client";

import { useEffect, useState } from "react";
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
import { PoolMiniAddRow } from "@/components/counter/PoolMiniAddRow";
import { RummyEntryDialog } from "@/components/counter/RummyEntryDialog";
import { EntryCorrectionDialog } from "@/components/counter/EntryCorrectionDialog";
import { CorrectionHistoryDialog } from "@/components/counter/CorrectionHistoryDialog";
import { ContributorsSplitDialog } from "@/components/counter/ContributorsSplitDialog";
import { DeleteFrameDialog } from "@/components/counter/DeleteFrameDialog";
import { UnassignedEntryDialog } from "@/components/counter/UnassignedEntryDialog";
import {
  RateTypeEntryDialog,
  type RatedEntryPreset,
} from "@/components/counter/RateTypeEntryDialog";
import { TableCardOverflowMenu } from "@/components/counter/TableCardOverflowMenu";
import { summarizeTableLedger } from "@/components/counter/table-card-summary";
import { isPoolMiniEntry } from "@/lib/utils/pool-mini-entry";
import { cn } from "@/lib/utils/cn";

interface CounterSectionColumnProps {
  section: NotebookSection;
  entries: NotebookEntryDTO[];
  snookerQuick?: boolean;
  poolMiniQuick?: boolean;
  activeMobile?: boolean;
}

export function CounterSectionColumn({
  section,
  entries,
  snookerQuick = false,
  poolMiniQuick = false,
  activeMobile = true,
}: CounterSectionColumnProps) {
  const [unassignedEntry, setUnassignedEntry] = useState<NotebookEntryDTO | null>(null);
  const [rummySection, setRummySection] = useState<NotebookSection | null>(null);
  const [correctEntry, setCorrectEntry] = useState<NotebookEntryDTO | null>(null);
  const [historyEntry, setHistoryEntry] = useState<NotebookEntryDTO | null>(null);
  const [splitEntry, setSplitEntry] = useState<NotebookEntryDTO | null>(null);
  const [ratePreset, setRatePreset] = useState<RatedEntryPreset | null>(null);
  const [editFrameEntry, setEditFrameEntry] = useState<NotebookEntryDTO | null>(
    null
  );
  const [savedEntryById, setSavedEntryById] = useState<
    Record<string, NotebookEntryDTO>
  >({});
  const [deleteFrameEntry, setDeleteFrameEntry] =
    useState<NotebookEntryDTO | null>(null);

  useEffect(() => {
    setSavedEntryById({});
  }, [entries]);

  const ledgerEditable = snookerQuick || poolMiniQuick;
  const quickButtons =
    snookerQuick || poolMiniQuick ? [] : getPresetsForSection(section);
  const tableName = sectionLabel(section);
  const summary = summarizeTableLedger(entries);

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

  const handleEditEntry = (entry: NotebookEntryDTO) => {
    setEditFrameEntry(savedEntryById[entry.id] ?? entry);
  };

  const stickyChrome = (
    <>
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-gray-900">
          {tableName}
        </h3>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            summary.isActive
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
              : "bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200"
          )}
        >
          {summary.isActive ? "Active" : "Idle"}
        </span>
        <TableCardOverflowMenu tableName={tableName} />
      </div>

      {quickButtons.length > 0 && (
        <div className="flex gap-1.5 border-b border-gray-100 px-2.5 py-2">
          {quickButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => handleQuickClick(btn)}
              className="flex-1 rounded-[10px] bg-emerald-800 px-2 py-2 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-900"
            >
              + {btn.label}
            </button>
          ))}
        </div>
      )}

      {snookerQuick ? (
        <SnookerFrameAddRow section={section} />
      ) : poolMiniQuick ? (
        <PoolMiniAddRow section={section} />
      ) : null}
    </>
  );

  const column = (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-900/5">
      <CounterLedgerTable stickyChrome={stickyChrome}>
        {entries.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="px-3 py-8 text-center text-[13px] font-medium text-gray-400"
            >
              No frames yet
            </td>
          </tr>
        ) : (
          entries.map((entry) => (
            <CompactLedgerRow
              key={entry.id}
              entry={entry}
              frameEditable={ledgerEditable}
              allowSplit={!poolMiniQuick}
              onEditFrame={handleEditEntry}
              onDeleteFrame={setDeleteFrameEntry}
              onEditSplit={(row) => setSplitEntry(row)}
              onUnassignedAction={setUnassignedEntry}
              onCorrect={setCorrectEntry}
              onShowCorrectionHistory={setHistoryEntry}
            />
          ))
        )}
      </CounterLedgerTable>
    </div>
  );

  return (
    <>
      <div className={cn("min-w-0", activeMobile ? "block" : "hidden lg:block")}>
        {column}
      </div>
      <UnassignedEntryDialog
        entry={unassignedEntry}
        onClose={() => setUnassignedEntry(null)}
        onSplit={(row) => setSplitEntry(row)}
        allowSplit={
          !poolMiniQuick &&
          !(unassignedEntry ? isPoolMiniEntry(unassignedEntry) : false)
        }
      />
      <SnookerFrameEditDialog
        entry={editFrameEntry}
        onClose={() => setEditFrameEntry(null)}
        onSaved={(updated) =>
          setSavedEntryById((prev) => ({ ...prev, [updated.id]: updated }))
        }
        allowSplit={!poolMiniQuick}
      />
      <DeleteFrameDialog
        entry={deleteFrameEntry}
        onClose={() => setDeleteFrameEntry(null)}
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
