"use client";

import { type MouseEvent, type ReactNode } from "react";
import type { NotebookEntryDTO } from "@/types";
import { formatCurrency } from "@/lib/utils/format";
import { formatTime } from "@/lib/utils/format-time";
import { getEntryDisplayLabel } from "@/lib/utils/notebook-entry-label";
import {
  entryHasCorrections,
  getAggregatedCorrections,
} from "@/lib/utils/entry-corrections";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { CorrectionChangeLine } from "@/components/counter/CorrectionChangeLine";
import { EntryCorrectionBadge } from "@/components/counter/EntryCorrectionBadge";
import {
  CounterPayLine,
  entryRowClass,
  splitContributorRowClass,
  SettlementBadge,
} from "@/components/counter/SettlementBadge";
import { resolveContributorCounterPayLineView } from "@/lib/utils/counter-visit-display";
import { isSnookerFrameEntry } from "@/lib/utils/snooker-frame";
import { EntryLockIndicator } from "@/components/counter/EntryLockIndicator";
import { getEntryLockTooltip, getContributorLockTooltip } from "@/lib/visit-bill/entry-edit-lock-constants";
import {
  isContributorAssignmentLocked,
  isContributorReassignable,
  isNotebookEntryEditLocked,
} from "@/lib/visit-bill/entry-edit-lock-utils";
import {
  CustomerPreviewNameButton,
  customerPreviewRowClass,
  useCustomerRowPreviewHandlers,
} from "@/components/counter/CustomerPreviewContext";
import { cn } from "@/lib/utils/cn";

interface CompactLedgerRowProps {
  entry: NotebookEntryDTO;
  frameEditable?: boolean;
  onUnassignedAction?: (entry: NotebookEntryDTO) => void;
  onEditFrame?: (entry: NotebookEntryDTO) => void;
  onEditSplit?: (entry: NotebookEntryDTO) => void;
  onCorrect?: (entry: NotebookEntryDTO) => void;
  onShowCorrectionHistory?: (entry: NotebookEntryDTO) => void;
}

function ContributorPaymentLabel({
  entry,
  contributor,
}: {
  entry: NotebookEntryDTO;
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number];
}) {
  const view = resolveContributorCounterPayLineView(entry, contributor);
  return <CounterPayLine view={view} />;
}

function PayColumn({
  payment,
  editButton,
  correctionButton,
}: {
  payment: ReactNode;
  editButton?: ReactNode;
  correctionButton?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end">
        <div className="min-w-[4.75rem] text-right">{payment}</div>
        <div className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center">
          {editButton}
        </div>
      </div>
      {correctionButton}
    </div>
  );
}

function FieldCell({
  correction,
  children,
}: {
  correction?: { from: string; to: string };
  children: ReactNode;
}) {
  if (correction) {
    return <CorrectionChangeLine from={correction.from} to={correction.to} />;
  }
  return <>{children}</>;
}

function CustomerNameCell({
  customerId,
  customerName,
  className,
}: {
  customerId: string;
  customerName: string;
  className?: string;
}) {
  return (
    <CustomerPreviewNameButton
      customerId={customerId}
      customerName={customerName}
      className={className}
    />
  );
}

function SplitContributorRow({
  entry,
  contributor,
  index,
  total,
  timeCell,
  typeCell,
  editFrameButton: _editFrameButton,
  editSplitButton,
  correctionButton,
  frameFinished,
}: {
  entry: NotebookEntryDTO;
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number];
  index: number;
  total: number;
  timeCell: ReactNode;
  typeCell: ReactNode;
  editFrameButton: ReactNode;
  editSplitButton: ReactNode;
  correctionButton: ReactNode;
  frameFinished: boolean;
}) {
  const contributorFinished = contributor.visitStatus === "FINISHED";
  const contributorLocked = isContributorAssignmentLocked({
    status: contributor.status,
    visitStatus: contributor.visitStatus,
    paidAmount: contributor.paidAmount,
    balanceCollectedAmount: contributor.balanceCollectedAmount,
  });
  const contributorReassignable = isContributorReassignable({
    status: contributor.status,
    visitStatus: contributor.visitStatus,
    paidAmount: contributor.paidAmount,
    balanceCollectedAmount: contributor.balanceCollectedAmount,
  });
  const contributorPreview = useCustomerRowPreviewHandlers(
    contributor.customerId
  );

  return (
    <tr
      className={cn(
        splitContributorRowClass(entry, index, total, contributor),
        !contributorFinished && customerPreviewRowClass(contributorPreview.isSelected),
        !contributorFinished && "cursor-pointer"
      )}
      onClick={contributorFinished ? undefined : contributorPreview.handleRowClick}
      onDoubleClick={
        contributorFinished ? undefined : contributorPreview.handleRowDoubleClick
      }
    >
      {index === 0 && (
        <>
          <td
            rowSpan={total}
            className="overflow-visible whitespace-nowrap py-1.5 pl-2 pr-1 align-top"
          >
            <div className="flex flex-col gap-0.5">
              {timeCell}
              {frameFinished ? (
                <span className="rounded bg-slate-200 px-1 py-px text-[9px] font-bold tracking-wide text-slate-700">
                  🔒 Finished
                </span>
              ) : null}
            </div>
          </td>
          <td
            rowSpan={total}
            className="whitespace-nowrap px-1.5 py-1.5 align-top text-[14px] font-semibold text-gray-800"
          >
            {typeCell}
          </td>
        </>
      )}
      <td className="px-2 py-1.5 align-middle">
        <CustomerNameCell
          customerId={contributor.customerId}
          customerName={contributor.customerName}
        />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 pr-2 align-middle text-right text-[14px] font-bold tabular-nums text-gray-900">
        {formatCurrency(contributor.amount)}
      </td>
      <td className="py-1.5 pl-1 pr-2 align-middle text-right">
        <PayColumn
          payment={
            <ContributorPaymentLabel entry={entry} contributor={contributor} />
          }
          editButton={
            contributorReassignable ? (
              editSplitButton
            ) : contributorLocked ? (
              <EntryLockIndicator
                className="h-5 w-5"
                title={getContributorLockTooltip({
                  visitStatus: contributor.visitStatus,
                })}
              />
            ) : null
          }
          correctionButton={
            index === total - 1 ? correctionButton : undefined
          }
        />
      </td>
    </tr>
  );
}

export function CompactLedgerRow({
  entry,
  frameEditable = false,
  onUnassignedAction,
  onEditFrame,
  onEditSplit,
  onCorrect: _onCorrect,
  onShowCorrectionHistory,
}: CompactLedgerRowProps) {
  const corrections = getAggregatedCorrections(entry);
  const hasCorrections = entryHasCorrections(entry);
  const hasContributors = entryHasContributors(entry);
  const byField = Object.fromEntries(
    corrections.map((item) => [item.field, item])
  ) as Record<string, { from: string; to: string } | undefined>;

  const typeLabel = getEntryDisplayLabel(entry);
  const qty =
    entry.quantity && entry.quantity > 1 ? `×${entry.quantity}` : "";

  const isPending = entry.status === "PENDING";
  const contributors = entry.contributors ?? [];
  const showContributorSplit = hasContributors && contributors.length > 0;
  const entryEditLocked =
    entry.isLocked ??
    isNotebookEntryEditLocked({
      status: entry.status,
      visitStatus: entry.visitStatus,
      paidAmount: entry.paidAmount,
      balanceCollectedAmount: entry.balanceCollectedAmount,
      contributors: entry.contributors,
    });
  const lockTooltip = getEntryLockTooltip({ visitStatus: entry.visitStatus });
  const frameFinished =
    contributors.length > 0
      ? contributors.every(
          (contributor) => contributor.visitStatus === "FINISHED"
        )
      : entry.visitStatus === "FINISHED";
  const showEditFrame =
    frameEditable &&
    isSnookerFrameEntry(entry) &&
    Boolean(onEditFrame) &&
    !entryEditLocked;
  const rowPreview = useCustomerRowPreviewHandlers(entry.customerId);

  const handleUnassignedClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isPending || !entry.isUnassigned || entryEditLocked) return;
    onUnassignedAction?.(entry);
  };

  const handleEditFrameClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (showEditFrame) {
      onEditFrame?.(entry);
    }
  };

  const handleEditSplitClick = (e: MouseEvent) => {
    e.stopPropagation();
    onEditSplit?.(entry);
  };

  const editSplitButton = onEditSplit ? (
    <button
      type="button"
      onClick={handleEditSplitClick}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
      aria-label="Edit split"
      title="Edit split"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
        />
      </svg>
    </button>
  ) : null;

  const editFrameButton = entryEditLocked ? (
    <EntryLockIndicator className="h-5 w-5" title={lockTooltip} />
  ) : showEditFrame ? (
    <button
      type="button"
      onClick={handleEditFrameClick}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
      aria-label="Edit frame"
      title="Edit frame"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
        />
      </svg>
    </button>
  ) : null;

  const correctionButton =
    hasCorrections && onShowCorrectionHistory ? (
      <button
        type="button"
        onClick={() => onShowCorrectionHistory(entry)}
        className="cursor-pointer"
      >
        <EntryCorrectionBadge />
      </button>
    ) : null;

  const timeCell = (
    <span className="font-mono text-[13px] font-medium tabular-nums text-gray-600">
      {formatTime(entry.createdAt)}
    </span>
  );

  const payCell = (
    <PayColumn
      payment={<SettlementBadge entry={entry} />}
      editButton={editFrameButton}
      correctionButton={correctionButton}
    />
  );

  const nameClass = "w-full";

  const nameCell = entry.isUnassigned ? (
    <button
      type="button"
      onClick={handleUnassignedClick}
      className="w-full text-left text-[13px] font-semibold text-gray-400 hover:text-emerald-800"
    >
      Unassigned
    </button>
  ) : entry.customerId ? (
    <CustomerNameCell
      customerId={entry.customerId}
      customerName={entry.customerName ?? "Customer"}
      className={nameClass}
    />
  ) : (
    <span className="block min-w-0 truncate text-left text-[14px] font-bold leading-snug text-gray-900">
      {entry.customerName}
    </span>
  );

  const showPlayerCorrection =
    byField.playerCount && entry.type === "RUMMY" && !byField.entryType;

  const typeCell = (
    <>
      <FieldCell correction={byField.entryType}>
        <span className="block whitespace-nowrap">
          {typeLabel}
          {qty && <span className="font-normal text-gray-500"> {qty}</span>}
        </span>
      </FieldCell>
      {showPlayerCorrection && byField.playerCount && (
        <CorrectionChangeLine
          from={byField.playerCount.from}
          to={byField.playerCount.to}
          className="mt-0.5"
        />
      )}
    </>
  );

  if (showContributorSplit) {
    return (
      <>
        {contributors.map((contributor, index) => (
          <SplitContributorRow
            key={contributor.customerId}
            entry={entry}
            contributor={contributor}
            index={index}
            total={contributors.length}
            timeCell={timeCell}
            typeCell={typeCell}
            editFrameButton={editFrameButton}
            editSplitButton={editSplitButton}
            correctionButton={correctionButton}
            frameFinished={frameFinished}
          />
        ))}
      </>
    );
  }

  return (
    <tr
      className={cn(
        entryRowClass(entry),
        frameFinished && "bg-slate-50/90",
        entry.customerId && customerPreviewRowClass(rowPreview.isSelected),
        entry.customerId && !frameFinished && "cursor-pointer"
      )}
      onClick={frameFinished ? undefined : rowPreview.handleRowClick}
      onDoubleClick={frameFinished ? undefined : rowPreview.handleRowDoubleClick}
    >
      <td className="py-1.5 pl-2 pr-1 align-top">
        <div className="flex flex-col gap-0.5">
          {timeCell}
          {frameFinished ? (
            <span className="rounded bg-slate-200 px-1 py-px text-[9px] font-bold tracking-wide text-slate-700">
              🔒 Finished
            </span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-1.5 py-1.5 align-top text-[14px] font-semibold text-gray-800">
        {typeCell}
      </td>
      <td className="px-2 py-1.5 align-top">
        <FieldCell correction={byField.customer}>{nameCell}</FieldCell>
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 pr-2 align-top text-right text-[14px] font-bold tabular-nums text-gray-900">
        <FieldCell correction={byField.amount}>
          {formatCurrency(entry.amount)}
        </FieldCell>
      </td>
      <td className="py-1.5 pl-1 pr-2 align-top text-right">
        {payCell}
      </td>
    </tr>
  );
}
