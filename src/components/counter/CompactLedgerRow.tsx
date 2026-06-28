"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
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
import { CustomerGlanceHoverTarget } from "@/components/counter/CafeCustomerGlanceHover";

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

  if (counterPayShowsBalanceLabel(display)) {
    return (
      <span className="text-[11px] font-bold text-amber-700">
        {formatCurrency(display.balanceAmount)} Bal
      </span>
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

export function CompactLedgerRow({
  entry,
  frameEditable = false,
  onUnassignedAction,
  onEditFrame,
  onCorrect,
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
  const showEditFrame =
    frameEditable &&
    isSnookerFrameEntry(entry) &&
    Boolean(onEditFrame);
  const canCorrect = isPending && Boolean(entry.assignedAt) && onCorrect;

  const handleNameClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isPending) return;

    if (entry.isUnassigned) {
      onUnassignedAction?.(entry);
      return;
    }
    if (canCorrect) {
      onCorrect?.(entry);
    }
  };

  const customerActivityLink = (
    customerId: string,
    customerName: string,
    className: string
  ) =>
    wrapCustomerGlance(
      customerId,
      <Link href={`/customers/${customerId}`} className={className}>
        {customerName}
      </Link>
    );

  const handleEditFrameClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (showEditFrame) {
      onEditFrame?.(entry);
    }
  };

  const editFrameButton = showEditFrame ? (
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

  const nameClass =
    "block min-w-0 truncate text-left text-[14px] font-bold leading-snug hover:text-emerald-800";

  const wrapCustomerGlance = (customerId: string, node: ReactNode) => (
    <CustomerGlanceHoverTarget
      customerId={customerId}
      variant="floating"
      className="w-full"
    >
      {node}
    </CustomerGlanceHoverTarget>
  );

  const nameCell = !isPending && entry.customerId ? (
    wrapCustomerGlance(
      entry.customerId,
      <Link
        href={`/customers/${entry.customerId}`}
        className={`${nameClass} text-gray-900`}
        title={entry.customerName}
      >
        {entry.customerName}
      </Link>
    )
  ) : entry.isUnassigned ? (
    <button
      type="button"
      onClick={handleNameClick}
      className="w-full text-left text-[13px] font-semibold text-gray-400 hover:text-emerald-800"
    >
      Unassigned
    </button>
  ) : entry.customerId ? (
    wrapCustomerGlance(
      entry.customerId,
      <button
        type="button"
        onClick={handleNameClick}
        className={`w-full text-left ${nameClass} text-gray-900`}
        title={entry.customerName}
      >
        {entry.customerName}
      </button>
    )
  ) : (
    <button
      type="button"
      onClick={handleNameClick}
      className={`w-full text-left ${nameClass} text-gray-900`}
      title={entry.customerName}
    >
      {entry.customerName}
    </button>
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
          <tr
            key={contributor.customerId}
            className={splitContributorRowClass(
              entry,
              index,
              contributors.length,
              contributor
            )}
          >
            {index === 0 && (
              <>
                <td
                  rowSpan={contributors.length}
                  className="overflow-visible whitespace-nowrap py-1.5 pl-2 pr-1 align-top"
                >
                  {timeCell}
                </td>
                <td
                  rowSpan={contributors.length}
                  className="whitespace-nowrap px-1.5 py-1.5 align-top text-[14px] font-semibold text-gray-800"
                >
                  {typeCell}
                </td>
              </>
            )}
            <td className="px-2 py-1.5 align-middle">
              {customerActivityLink(
                contributor.customerId,
                contributor.customerName,
                "block min-w-0 truncate text-left text-[14px] font-bold leading-snug text-gray-900 hover:text-emerald-800"
              )}
            </td>
            <td className="whitespace-nowrap px-2 py-1.5 pr-2 align-middle text-right text-[14px] font-bold tabular-nums text-gray-900">
              {formatCurrency(contributor.amount)}
            </td>
            <td className="py-1.5 pl-1 pr-2 align-middle text-right">
              <PayColumn
                payment={
                  <ContributorPaymentLabel
                    entry={entry}
                    contributor={contributor}
                  />
                }
                editButton={index === 0 ? editFrameButton : undefined}
                correctionButton={
                  index === contributors.length - 1 ? correctionButton : undefined
                }
              />
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr className={entryRowClass(entry)}>
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
