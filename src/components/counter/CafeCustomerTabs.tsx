"use client";

import {
  formatCafeLineExpanded,
  formatCafeTabSummary,
  type CafeOpenTab,
} from "@/lib/utils/cafe-tabs";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { CustomerPreviewNameButton } from "@/components/counter/CustomerPreviewContext";
import { EntryLockIndicator } from "@/components/counter/EntryLockIndicator";
import { getEntryLockTooltip } from "@/lib/visit-bill/entry-edit-lock-constants";
import { isNotebookEntryEditLocked } from "@/lib/visit-bill/entry-edit-lock-utils";

interface CafeCustomerTabsProps {
  tabs: CafeOpenTab[];
  expandedId: string | null;
  onToggleExpand: (tabKey: string | null) => void;
  onAddItem: (tab: CafeOpenTab) => void;
  onEdit: (tab: CafeOpenTab) => void;
}

function tabTitle(tab: CafeOpenTab): string {
  return tab.kind === "customer" ? tab.customerName : tab.tableName;
}

function tabAmount(tab: CafeOpenTab): number {
  return tab.kind === "table" ? tab.cafeTotal : tab.total;
}

export function CafeCustomerTabs({
  tabs,
  expandedId,
  onToggleExpand,
  onAddItem,
  onEdit,
}: CafeCustomerTabsProps) {
  if (tabs.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-gray-500">
        No open tabs. Use + Existing Customer, + New Customer, or + Table Tab.
      </p>
    );
  }

  return (
    <ul className="grid gap-0.5 md:grid-cols-2">
      {tabs.map((tab) => {
        const expanded = expandedId === tab.tabKey;
        const visitFinished =
          tab.kind === "customer" &&
          tab.entries.some((entry) => entry.visitStatus === "FINISHED");
        const hasEditableEntries = tab.entries.some(
          (entry) => !isNotebookEntryEditLocked(entry)
        );

        return (
          <li
            key={tab.tabKey}
            className={cn(
              "border bg-white",
              expanded ? "border-emerald-500" : "border-gray-200",
              visitFinished && !expanded && "border-slate-300 bg-slate-50/60",
              tab.kind === "table" && !expanded && "border-l-2 border-l-amber-400"
            )}
          >
            {tab.kind === "customer" ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onToggleExpand(expanded ? null : tab.tabKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggleExpand(expanded ? null : tab.tabKey);
                  }
                }}
                className={cn(
                  "w-full px-1.5 py-1 text-left leading-tight",
                  expanded ? "bg-emerald-50/80" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className="min-w-0 flex-1"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <CustomerPreviewNameButton
                      customerId={tab.customerId}
                      customerName={tabTitle(tab)}
                      className="w-full truncate text-[15px]"
                    />
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {visitFinished ? (
                      <span className="rounded bg-slate-200 px-1 py-px text-[9px] font-bold tracking-wide text-slate-700">
                        🔒 Finished
                      </span>
                    ) : null}
                    <span className="text-[14px] font-bold tabular-nums text-gray-900">
                      {formatCurrency(tabAmount(tab))}
                    </span>
                  </div>
                </div>
                <p className="truncate text-[11px] text-gray-600">
                  {tab.lines.length > 0
                    ? formatCafeTabSummary(tab.lines)
                    : "No items yet"}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onToggleExpand(expanded ? null : tab.tabKey)}
                className={cn(
                  "w-full px-1.5 py-1 text-left leading-tight",
                  expanded ? "bg-emerald-50/80" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[15px] font-bold text-gray-900">
                    {tabTitle(tab)}
                  </span>
                  <span className="shrink-0 text-[14px] font-bold tabular-nums text-gray-900">
                    {formatCurrency(tabAmount(tab))}
                  </span>
                </div>
                <p className="truncate text-[11px] text-gray-600">
                  {tab.lines.length > 0
                    ? formatCafeTabSummary(tab.lines)
                    : "No cafe items yet"}
                </p>
              </button>
            )}

            {expanded && (
              <div className="border-t border-gray-200 px-1.5 py-1">
                <div className="mb-1 flex items-baseline justify-between gap-1">
                  <span className="truncate text-sm font-bold text-gray-900">
                    {tabTitle(tab)}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {formatCurrency(tabAmount(tab))}
                  </span>
                </div>

                {tab.kind === "table" && (
                  <div className="mb-1 space-y-0 text-[11px] text-gray-700">
                    <div className="flex justify-between gap-2">
                      <span>Game</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(tab.gameTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Cafe</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(tab.cafeTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-gray-100 pt-0.5 font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatCurrency(tab.grandTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {tab.lines.length > 0 && (
                  <ul className="space-y-0">
                    {tab.lines.map((line) => {
                      const lineLocked = line.entries.every((entry) =>
                        isNotebookEntryEditLocked(entry)
                      );
                      const lineTooltip = line.entries[0]
                        ? getEntryLockTooltip({
                            visitStatus: line.entries[0].visitStatus,
                          })
                        : undefined;

                      return (
                      <li
                        key={line.lineKey}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[12px] leading-snug"
                      >
                        <span
                          className={cn(
                            "flex min-w-0 items-center gap-1 truncate",
                            lineLocked ? "text-gray-500" : "text-gray-800"
                          )}
                          title={lineLocked ? lineTooltip : undefined}
                        >
                          {lineLocked ? (
                            <EntryLockIndicator className="shrink-0" />
                          ) : null}
                          <span className="truncate">
                            {formatCafeLineExpanded(line)}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                          {formatCurrency(line.amount)}
                        </span>
                      </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-1.5 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 flex-1 px-2 text-[11px] font-semibold"
                    disabled={visitFinished}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddItem(tab);
                    }}
                  >
                    Add Item
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 flex-1 px-2 text-[11px] font-semibold"
                    disabled={
                      visitFinished ||
                      tab.entries.length === 0 ||
                      !hasEditableEntries
                    }
                    title={
                      visitFinished
                        ? getEntryLockTooltip({ visitStatus: "FINISHED" })
                        : tab.entries.length > 0 && !hasEditableEntries
                          ? getEntryLockTooltip({ visitStatus: tab.entries[0]?.visitStatus })
                          : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(tab);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
