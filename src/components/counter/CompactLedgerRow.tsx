"use client";

import { type MouseEvent, type ReactNode, type SyntheticEvent } from "react";
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
  entryRowClass,
  splitContributorRowClass,
} from "@/components/counter/EntryPayStatus";
import {
  ledgerCellActionsClass,
  ledgerCellAmountClass,
  ledgerCellCustomerClass,
  ledgerCellDueClass,
  ledgerCellTimeClass,
  ledgerCellTypeClass,
} from "@/components/counter/CounterLedgerTable";
import { frameDueFromParts } from "@/lib/utils/frame-payment";
import { isSnookerFrameEntry } from "@/lib/utils/snooker-frame";
import { isPoolMiniEntry } from "@/lib/utils/pool-mini-entry";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import {
  CustomerPreviewNameButton,
  customerPreviewRowClass,
  useCustomerRowPreviewHandlers,
} from "@/components/counter/CustomerPreviewContext";
import { cn } from "@/lib/utils/cn";

function MobileFrameLine({
  name,
  amount,
  due,
  meta,
  editFrameButton,
  deleteFrameButton,
  correctionButton,
  selected,
  hasDue,
  onClick,
  onDoubleClick,
}: {
  name: ReactNode;
  amount: ReactNode;
  due: ReactNode;
  meta?: ReactNode;
  editFrameButton?: ReactNode;
  deleteFrameButton?: ReactNode;
  correctionButton?: ReactNode;
  selected?: boolean;
  hasDue?: boolean;
  onClick?: (event: SyntheticEvent<HTMLElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick(event);
              }
            }
          : undefined
      }
      className={cn(
        "bg-[#fbfdfc] px-3 py-2.5",
        hasDue && "border-b border-red-200 bg-red-50",
        selected && "bg-emerald-50",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <div className="min-w-0 flex-1 basis-40">
          <div className="min-w-0">{name}</div>
          {meta}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 pt-px">
          <div className="shrink-0">{amount}</div>
          <div className="shrink-0">{due}</div>
          {editFrameButton}
          {deleteFrameButton}
        </div>
      </div>
      {correctionButton ? (
        <div className="mt-1 flex justify-end">{correctionButton}</div>
      ) : null}
    </div>
  );
}

function MobileSplitContributorLine({
  entry,
  contributor,
  meta,
  editFrameButton,
  deleteFrameButton,
  correctionButton,
}: {
  entry: NotebookEntryDTO;
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number];
  meta?: ReactNode;
  editFrameButton?: ReactNode;
  deleteFrameButton?: ReactNode;
  correctionButton?: ReactNode;
}) {
  const preview = useCustomerRowPreviewHandlers(
    contributor.customerId,
    contributor.customerName
  );

  return (
    <MobileFrameLine
      name={
        <CustomerNameCell
          customerId={contributor.customerId}
          customerName={contributor.customerName}
          className="block min-w-0 overflow-clip text-ellipsis whitespace-nowrap text-[15px] font-bold"
        />
      }
      amount={
        <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-gray-900">
          {formatCurrency(contributor.amount)}
        </span>
      }
      due={
        <DueStatusCell
          amount={contributor.amount}
          paidAmount={contributor.paidAmount}
          balanceCollectedAmount={contributor.balanceCollectedAmount}
          paymentMethod={contributor.paymentMethod ?? entry.paymentMethod}
          status={entry.status}
        />
      }
      meta={meta}
      editFrameButton={editFrameButton}
      deleteFrameButton={deleteFrameButton}
      correctionButton={correctionButton}
      selected={preview.isSelected}
      hasDue={
        frameDueFromParts(
          contributor.amount,
          contributor.paidAmount,
          contributor.balanceCollectedAmount
        ) > 0 &&
        entry.status !== "CANCELLED" &&
        entry.status !== "REVERSED"
      }
      onClick={preview.handleRowClick}
      onDoubleClick={preview.handleRowDoubleClick}
    />
  );
}

interface CompactLedgerRowProps {
  entry: NotebookEntryDTO;
  frameEditable?: boolean;
  /** When false, Split affordances are hidden (Pool & Mini). Default true. */
  allowSplit?: boolean;
  /** Big Snooker keeps Type; Pool & Mini hides it (card header identifies the table). */
  showTypeColumn?: boolean;
  /** Desktop table row vs compact stacked mobile row. */
  presentation?: "table" | "mobile";
  onUnassignedAction?: (entry: NotebookEntryDTO) => void;
  onEditFrame?: (entry: NotebookEntryDTO) => void;
  onDeleteFrame?: (entry: NotebookEntryDTO) => void;
  onEditSplit?: (entry: NotebookEntryDTO) => void;
  onCorrect?: (entry: NotebookEntryDTO) => void;
  onShowCorrectionHistory?: (entry: NotebookEntryDTO) => void;
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

function EditIconButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white transition-colors hover:bg-teal-700"
      aria-label={label}
      title={title}
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
  );
}

function DeleteIconButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
      aria-label={label}
      title={title}
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
          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0V4.25a1.125 1.125 0 00-1.125-1.125h-4.5A1.125 1.125 0 009 4.25v.546"
        />
      </svg>
    </button>
  );
}

/**
 * Due column: payment mode when fully paid, remaining amount when money is still due.
 * Never shows ₹0 for a fully paid frame.
 */
function DueStatusCell({
  amount,
  paidAmount,
  balanceCollectedAmount,
  paymentMethod,
  status,
}: {
  amount: number;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  paymentMethod?: NotebookEntryDTO["paymentMethod"];
  status: NotebookEntryDTO["status"];
}) {
  if (status === "CANCELLED") {
    return (
      <span className="text-[11px] font-bold text-red-500">Cancelled</span>
    );
  }
  if (status === "REVERSED") {
    return (
      <span className="text-[11px] font-bold text-amber-600">Reversed</span>
    );
  }

  const due = frameDueFromParts(amount, paidAmount, balanceCollectedAmount);

  if (due <= 0) {
    if (paymentMethod === "CASH") {
      return (
        <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900">
          {paymentMethodLabel("CASH")}
        </span>
      );
    }
    if (paymentMethod === "GPAY") {
      return (
        <span className="inline-flex items-center rounded-md border border-blue-300 bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-900">
          {paymentMethodLabel("GPAY")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-400 bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-950">
        Paid
      </span>
    );
  }

  return (
    <span className="text-[13px] font-bold tabular-nums text-red-700">
      {formatCurrency(due)}
    </span>
  );
}

function SplitContributorRow({
  entry,
  contributor,
  index,
  total,
  timeCell,
  typeCell,
  showTypeColumn,
  editFrameButton,
  deleteFrameButton,
  correctionButton,
}: {
  entry: NotebookEntryDTO;
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number];
  index: number;
  total: number;
  timeCell: ReactNode;
  typeCell: ReactNode;
  showTypeColumn: boolean;
  editFrameButton: ReactNode;
  deleteFrameButton: ReactNode;
  correctionButton: ReactNode;
}) {
  const contributorPreview = useCustomerRowPreviewHandlers(
    contributor.customerId,
    contributor.customerName
  );

  return (
    <tr
      className={cn(
        splitContributorRowClass(entry, index, total, contributor),
        customerPreviewRowClass(contributorPreview.isSelected),
        "cursor-pointer"
      )}
      onClick={contributorPreview.handleRowClick}
      onDoubleClick={contributorPreview.handleRowDoubleClick}
    >
      <td className={ledgerCellTimeClass}>
        {index === 0 ? timeCell : null}
      </td>
      {showTypeColumn ? (
        <td
          className={cn(
            ledgerCellTypeClass,
            "text-[12px] font-medium text-gray-600"
          )}
        >
          {index === 0 ? typeCell : null}
        </td>
      ) : null}
      <td className={ledgerCellCustomerClass}>
        <CustomerNameCell
          customerId={contributor.customerId}
          customerName={contributor.customerName}
          className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold"
        />
      </td>
      <td
        className={cn(
          ledgerCellAmountClass,
          "text-[13px] font-bold tabular-nums text-gray-900"
        )}
      >
        {formatCurrency(contributor.amount)}
      </td>
      <td className={ledgerCellDueClass}>
        <DueStatusCell
          amount={contributor.amount}
          paidAmount={contributor.paidAmount}
          balanceCollectedAmount={contributor.balanceCollectedAmount}
          paymentMethod={contributor.paymentMethod ?? entry.paymentMethod}
          status={entry.status}
        />
      </td>
      <td className={ledgerCellActionsClass}>
        <div className="flex flex-col items-end gap-1">
          {index === 0 ? (
            <div className="flex flex-nowrap items-center justify-end gap-0.5">
              {editFrameButton}
              {deleteFrameButton}
            </div>
          ) : null}
          {index === total - 1 ? correctionButton : null}
        </div>
      </td>
    </tr>
  );
}

export function CompactLedgerRow({
  entry,
  frameEditable = false,
  allowSplit = true,
  showTypeColumn = true,
  presentation = "table",
  onUnassignedAction,
  onEditFrame,
  onDeleteFrame,
  onShowCorrectionHistory,
}: CompactLedgerRowProps) {
  const corrections = getAggregatedCorrections(entry);
  const hasCorrections = entryHasCorrections(entry);
  const hasContributors = allowSplit && entryHasContributors(entry);
  const byField = Object.fromEntries(
    corrections.map((item) => [item.field, item])
  ) as Record<string, { from: string; to: string } | undefined>;

  const typeLabel = getEntryDisplayLabel(entry);
  const qty =
    entry.quantity && entry.quantity > 1 ? `×${entry.quantity}` : "";

  const isPendingOrPaid =
    entry.status === "PENDING" || entry.status === "PAID";
  const canMutateFrame =
    frameEditable &&
    (isSnookerFrameEntry(entry) || isPoolMiniEntry(entry)) &&
    isPendingOrPaid;
  const showEditFrame = canMutateFrame && Boolean(onEditFrame);
  const showDeleteFrame = canMutateFrame && Boolean(onDeleteFrame);
  const rowPreview = useCustomerRowPreviewHandlers(
    entry.customerId,
    entry.customerName
  );

  const handleUnassignedClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (entry.status === "CANCELLED" || entry.status === "REVERSED") return;
    if (!entry.isUnassigned) return;
    onUnassignedAction?.(entry);
  };

  const handleEditFrameClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (showEditFrame) {
      onEditFrame?.(entry);
    }
  };

  const handleDeleteFrameClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (showDeleteFrame) {
      onDeleteFrame?.(entry);
    }
  };

  const editFrameButton = showEditFrame ? (
    <EditIconButton
      label="Edit frame"
      title="Edit frame"
      onClick={handleEditFrameClick}
    />
  ) : null;

  const deleteFrameButton = showDeleteFrame ? (
    <DeleteIconButton
      label="Delete frame"
      title="Delete frame"
      onClick={handleDeleteFrameClick}
    />
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

  const timeText = formatTime(entry.playStartedAt ?? entry.createdAt);
  const typeText = `${typeLabel}${qty ? ` ${qty}` : ""}`;

  const timeCell = (
    <span
      className="block min-w-0 truncate text-[12px] tabular-nums text-gray-500"
      title={timeText}
    >
      {timeText}
    </span>
  );

  const nameCell = entry.isUnassigned ? (
    <button
      type="button"
      onClick={handleUnassignedClick}
      className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px] font-semibold text-gray-500 hover:text-emerald-800"
    >
      Unassigned
    </button>
  ) : entry.customerId ? (
    <CustomerNameCell
      customerId={entry.customerId}
      customerName={entry.customerName ?? "Customer"}
      className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold"
    />
  ) : (
    <span className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px] font-bold leading-snug text-gray-900">
      {entry.customerName}
    </span>
  );

  const showPlayerCorrection =
    byField.playerCount && entry.type === "RUMMY" && !byField.entryType;

  const typeCell = (
    <>
      <FieldCell correction={byField.entryType}>
        <span
          className="block w-full min-w-0 truncate"
          title={typeText}
        >
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

  const mobileMeta = (
    <div className="mt-0.5 min-w-0">
      <p className="min-w-0 truncate text-[11px] leading-snug text-gray-500">
        {showTypeColumn ? `${typeText} · ${timeText}` : timeText}
      </p>
      {showPlayerCorrection && byField.playerCount ? (
        <CorrectionChangeLine
          from={byField.playerCount.from}
          to={byField.playerCount.to}
          className="mt-0.5"
        />
      ) : null}
    </div>
  );

  const mobileName = entry.isUnassigned ? (
    <button
      type="button"
      onClick={handleUnassignedClick}
      className="block w-full min-w-0 overflow-clip text-ellipsis whitespace-nowrap text-left text-[15px] font-semibold text-gray-500 hover:text-emerald-800"
    >
      Unassigned
    </button>
  ) : entry.customerId ? (
    <CustomerNameCell
      customerId={entry.customerId}
      customerName={entry.customerName ?? "Customer"}
      className="block w-full min-w-0 overflow-clip text-ellipsis whitespace-nowrap text-[15px] font-bold"
    />
  ) : (
    <span className="block min-w-0 overflow-clip text-ellipsis whitespace-nowrap text-left text-[15px] font-bold leading-snug text-gray-900">
      {entry.customerName}
    </span>
  );

  if (presentation === "mobile") {
    if (hasContributors && (entry.contributors?.length ?? 0) > 0) {
      const contributors = entry.contributors ?? [];
      return (
        <div className="divide-y divide-black/[0.04]">
          {contributors.map((contributor, index) => (
            <MobileSplitContributorLine
              key={`${entry.id}-${contributor.customerId}`}
              entry={entry}
              contributor={contributor}
              meta={index === 0 ? mobileMeta : undefined}
              editFrameButton={index === 0 ? editFrameButton : undefined}
              deleteFrameButton={index === 0 ? deleteFrameButton : undefined}
              correctionButton={
                index === contributors.length - 1 ? correctionButton : undefined
              }
            />
          ))}
        </div>
      );
    }

    return (
      <MobileFrameLine
        name={<FieldCell correction={byField.customer}>{mobileName}</FieldCell>}
        amount={
          <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-gray-900">
            <FieldCell correction={byField.amount}>
              {formatCurrency(entry.amount)}
            </FieldCell>
          </span>
        }
        due={
          <DueStatusCell
            amount={entry.amount}
            paidAmount={entry.paidAmount}
            balanceCollectedAmount={entry.balanceCollectedAmount}
            paymentMethod={entry.paymentMethod}
            status={entry.status}
          />
        }
        meta={mobileMeta}
        editFrameButton={editFrameButton}
        deleteFrameButton={deleteFrameButton}
        correctionButton={correctionButton}
        selected={Boolean(entry.customerId && rowPreview.isSelected)}
        hasDue={
          frameDueFromParts(
            entry.amount,
            entry.paidAmount,
            entry.balanceCollectedAmount
          ) > 0 &&
          entry.status !== "CANCELLED" &&
          entry.status !== "REVERSED"
        }
        onClick={entry.customerId ? rowPreview.handleRowClick : undefined}
        onDoubleClick={
          entry.customerId ? rowPreview.handleRowDoubleClick : undefined
        }
      />
    );
  }

  if (hasContributors && (entry.contributors?.length ?? 0) > 0) {
    const contributors = entry.contributors ?? [];
    return (
      <>
        {contributors.map((contributor, index) => (
          <SplitContributorRow
            key={`${entry.id}-${contributor.customerId}`}
            entry={entry}
            contributor={contributor}
            index={index}
            total={contributors.length}
            timeCell={timeCell}
            typeCell={typeCell}
            showTypeColumn={showTypeColumn}
            editFrameButton={editFrameButton}
            deleteFrameButton={deleteFrameButton}
            correctionButton={correctionButton}
          />
        ))}
      </>
    );
  }

  return (
    <tr
      className={cn(
        entryRowClass(entry),
        entry.customerId && customerPreviewRowClass(rowPreview.isSelected),
        entry.customerId && "cursor-pointer"
      )}
      onClick={rowPreview.handleRowClick}
      onDoubleClick={rowPreview.handleRowDoubleClick}
    >
      <td className={ledgerCellTimeClass}>{timeCell}</td>
      {showTypeColumn ? (
        <td
          className={cn(
            ledgerCellTypeClass,
            "text-[12px] font-medium text-gray-600"
          )}
        >
          {typeCell}
        </td>
      ) : null}
      <td className={ledgerCellCustomerClass}>
        <FieldCell correction={byField.customer}>{nameCell}</FieldCell>
      </td>
      <td
        className={cn(
          ledgerCellAmountClass,
          "text-[13px] font-bold tabular-nums text-gray-900"
        )}
      >
        <FieldCell correction={byField.amount}>
          {formatCurrency(entry.amount)}
        </FieldCell>
      </td>
      <td className={ledgerCellDueClass}>
        <DueStatusCell
          amount={entry.amount}
          paidAmount={entry.paidAmount}
          balanceCollectedAmount={entry.balanceCollectedAmount}
          paymentMethod={entry.paymentMethod}
          status={entry.status}
        />
      </td>
      <td className={ledgerCellActionsClass}>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-nowrap items-center justify-end gap-0.5">
            {editFrameButton}
            {deleteFrameButton}
          </div>
          {correctionButton}
        </div>
      </td>
    </tr>
  );
}
