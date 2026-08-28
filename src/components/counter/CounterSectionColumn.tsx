"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { NotebookSection } from "@/lib/constants/notebook-sections";
import type { NotebookEntryDTO } from "@/types";
import {
  getPresetsForSection,
  type NotebookPreset,
} from "@/lib/constants/notebook-presets";
import type { SnookerQuickPreset } from "@/lib/constants/counter-sections";
import { CompactLedgerRow } from "@/components/counter/CompactLedgerRow";
import {
  CounterLedgerHeader,
  CounterLedgerTable,
  counterLedgerColSpan,
  ledgerRowClass,
} from "@/components/counter/CounterLedgerTable";
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
import { isPoolMiniEntry } from "@/lib/utils/pool-mini-entry";

interface CounterSectionColumnProps {
  section: NotebookSection;
  entries: NotebookEntryDTO[];
  snookerQuick?: boolean;
  poolMiniQuick?: boolean;
  /** Frozen table chrome host (Type / Amount / Add Frame, column headers). */
  headerHost?: HTMLElement | null;
  /** Shared frames-list host for this table. */
  bodyHost?: HTMLElement | null;
}

export function CounterSectionColumn({
  section,
  entries,
  snookerQuick = false,
  poolMiniQuick = false,
  headerHost = null,
  bodyHost = null,
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
  /** Pool & Mini: Type is redundant — the card header already names the table. */
  const showTypeColumn = !poolMiniQuick;
  const quickButtons =
    snookerQuick || poolMiniQuick ? [] : getPresetsForSection(section);

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

  const tableChrome = (
    <>
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

      <div className="hidden lg:block">
        <CounterLedgerHeader showTypeColumn={showTypeColumn} />
      </div>
    </>
  );

  const rowProps = {
    frameEditable: ledgerEditable,
    allowSplit: !poolMiniQuick,
    showTypeColumn,
    onEditFrame: handleEditEntry,
    onDeleteFrame: setDeleteFrameEntry,
    onEditSplit: (row: NotebookEntryDTO) => setSplitEntry(row),
    onUnassignedAction: setUnassignedEntry,
    onCorrect: setCorrectEntry,
    onShowCorrectionHistory: setHistoryEntry,
  };

  const framesBody = (
    <>
        <div className="divide-y divide-black/[0.05] lg:hidden">
        {entries.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] font-medium text-gray-400">
            No frames yet
          </p>
        ) : (
          entries.map((entry) => (
            <CompactLedgerRow
              key={entry.id}
              entry={entry}
              presentation="mobile"
              {...rowProps}
            />
          ))
        )}
      </div>

      <div className="hidden lg:block">
        <CounterLedgerTable showTypeColumn={showTypeColumn} showHeader={false}>
          {entries.length === 0 ? (
            <tr className={ledgerRowClass(showTypeColumn)}>
              <td
                colSpan={counterLedgerColSpan(showTypeColumn)}
                className="counter-ledger-empty-cell px-3 py-8 text-center text-[13px] font-medium text-gray-400"
              >
                No frames yet
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <CompactLedgerRow
                key={entry.id}
                entry={entry}
                presentation="table"
                {...rowProps}
              />
            ))
          )}
        </CounterLedgerTable>
      </div>
    </>
  );

  return (
    <>
      {headerHost ? createPortal(tableChrome, headerHost) : null}
      {bodyHost ? createPortal(framesBody, bodyHost) : null}
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
