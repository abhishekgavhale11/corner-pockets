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
import { getContributorCounterPayDisplay, counterPayShowsBalanceLabel, counterPayShowsPartialAtCheckout } from "@/lib/utils/counter-pay-display";
import { CorrectionChangeLine } from "@/components/counter/CorrectionChangeLine";
import { EntryCorrectionBadge } from "@/components/counter/EntryCorrectionBadge";
import {
  entryRowClass,
  PartialPaymentLabel,
  splitContributorRowClass,
  SettlementBadge,
} from "@/components/counter/SettlementBadge";
import { isSnookerFrameEntry } from "@/lib/utils/snooker-frame";
import { EntryLockIndicator } from "@/components/counter/EntryLockIndicator";
import { ENTRY_LOCKED_TOOLTIP } from "@/lib/visit-bill/entry-edit-lock-constants";
import { isNotebookEntryEditLocked } from "@/lib/visit-bill/entry-edit-lock-utils";
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
  onCorrect?: (entry: NotebookEntryDTO) => void;
  onShowCorrectionHistory?: (entry: NotebookEntryDTO) => void;
}

function paymentMethodLabel(method: string): string {
  return method === "CASH" ? "Cash" : method === "GPAY" ? "GPay" : "Wallet";
}

function ContributorPaymentLabel({
  entry,
  contributor,
}: {
  entry: NotebookEntryDTO;
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number];
}) {
  const display = getContributorCounterPayDisplay(entry, contributor);

  if (display.frozen) {
    if (display.paidAmount > 0 && display.balanceAmount > 0) {
      return (
        <PartialPaymentLabel
          paidAmount={display.paidAmount}
          remaining={display.balanceAmount}
          onBalance
        />
      );
    }
    if (counterPayShowsBalanceLabel(display)) {
      return (
        <span className="text-[11px] font-bold text-amber-700">
          {formatCurrency(display.balanceAmount)} Bal
        </span>
      );
    }
    if (display.paidAmount > 0 && contributor.paymentMethod) {
      return (
        <span className="text-[11px] font-bold text-emerald-700">
          {paymentMethodLabel(contributor.paymentMethod)}
        </span>
      );
    }
    return <span className="text-[11px] text-gray-400">—</span>;
  }

  if (contributor.status === "PAID" && contributor.paymentMethod) {
    return (
      <span className="text-[11px] font-bold text-emerald-700">
        {paymentMethodLabel(contributor.paymentMethod)}
      </span>
    );
  }

  if (counterPayShowsPartialAtCheckout(display)) {
    return (
      <PartialPaymentLabel
        paidAmount={display.paidAmount}
        remaining={display.balanceAmount}
        onBalance={false}
      />
    );
  }

  return <span className="text-[11px] text-gray-400">—</span>;
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
  editFrameButton,
  correctionButton,
}: {
  entry: NotebookEntryDTO;
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number];
  index: number;
  total: number;
  timeCell: ReactNode;
  typeCell: ReactNode;
  editFrameButton: ReactNode;
  correctionButton: ReactNode;
}) {
  const contributorPreview = useCustomerRowPreviewHandlers(
    contributor.customerId
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
      {index === 0 && (
        <>
          <td
            rowSpan={total}
            className="overflow-visible whitespace-nowrap py-1.5 pl-2 pr-1 align-top"
          >
            {timeCell}
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
          editButton={index === 0 ? editFrameButton : undefined}
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
  const entryEditLocked = isNotebookEntryEditLocked(entry);
  const showEditFrame =
    frameEditable &&
    isSnookerFrameEntry(entry) &&
    Boolean(onEditFrame) &&
    !entryEditLocked;
  const rowPreview = useCustomerRowPreviewHandlers(entry.customerId);

  const handleUnassignedClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isPending || !entry.isUnassigned) return;
    onUnassignedAction?.(entry);
  };

  const handleEditFrameClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (showEditFrame) {
      onEditFrame?.(entry);
    }
  };

  const editFrameButton = entryEditLocked ? (
    <EntryLockIndicator
      className="h-5 w-5"
      title={ENTRY_LOCKED_TOOLTIP}
    />
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
      <td className="py-1.5 pl-2 pr-1 align-top">{timeCell}</td>
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
