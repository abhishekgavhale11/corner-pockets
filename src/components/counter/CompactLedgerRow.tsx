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
import { CorrectionChangeLine } from "@/components/counter/CorrectionChangeLine";
import { EntryCorrectionBadge } from "@/components/counter/EntryCorrectionBadge";
import {
  entryRowClass,
  splitContributorRowClass,
  SettlementBadge,
} from "@/components/counter/SettlementBadge";

interface CompactLedgerRowProps {
  entry: NotebookEntryDTO;
  onUnassignedAction?: (entry: NotebookEntryDTO) => void;
  onCorrect?: (entry: NotebookEntryDTO) => void;
  onShowCorrectionHistory?: (entry: NotebookEntryDTO) => void;
  onManageSplit?: (entry: NotebookEntryDTO) => void;
}

function paymentMethodLabel(method: string): string {
  return method === "CASH" ? "Cash" : method === "GPAY" ? "GPay" : "Wallet";
}

function ContributorPaymentLabel({ method }: { method?: string }) {
  if (!method) {
    return <span className="text-[14px] text-gray-400">—</span>;
  }
  return (
    <span className="text-[14px] font-bold text-emerald-700">
      {paymentMethodLabel(method)}
    </span>
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
  onUnassignedAction,
  onCorrect,
  onShowCorrectionHistory,
  onManageSplit,
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
  const canCorrect = isPending && Boolean(entry.assignedAt) && onCorrect;

  const contributors = entry.contributors ?? [];
  const showContributorSplit = hasContributors && contributors.length > 0;

  const handleNameClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isPending) return;

    if (showContributorSplit) {
      onManageSplit?.(entry);
      return;
    }
    if (entry.isUnassigned) {
      onUnassignedAction?.(entry);
      return;
    }
    if (canCorrect) {
      onCorrect?.(entry);
    }
  };

  const handleSplitClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (isPending && showContributorSplit) {
      onManageSplit?.(entry);
    }
  };

  const nameClass =
    "block truncate text-right text-[14px] font-bold hover:text-emerald-800";

  const nameCell = !isPending && entry.customerId ? (
    <Link
      href={`/customers/${entry.customerId}`}
      className={`${nameClass} text-gray-900`}
    >
      {entry.customerName}
    </Link>
  ) : entry.isUnassigned ? (
    <button
      type="button"
      onClick={handleNameClick}
      className="w-full text-right text-[13px] font-semibold text-gray-400 hover:text-emerald-800"
    >
      Unassigned
    </button>
  ) : (
    <button
      type="button"
      onClick={handleNameClick}
      className={`w-full text-right ${nameClass} text-gray-900`}
    >
      {entry.customerName}
    </button>
  );

  const showPlayerCorrection =
    byField.playerCount && entry.type === "RUMMY" && !byField.entryType;

  const typeCell = (
    <>
      <FieldCell correction={byField.entryType}>
        <span className="block truncate">
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
              contributors.length
            )}
          >
            {index === 0 && (
              <>
                <td
                  rowSpan={contributors.length}
                  className="px-2 py-1.5 align-top font-mono text-[13px] font-medium tabular-nums text-gray-600"
                >
                  {formatTime(entry.createdAt)}
                </td>
                <td
                  rowSpan={contributors.length}
                  className="px-2 py-1.5 align-top text-[14px] font-semibold text-gray-800"
                >
                  {typeCell}
                </td>
              </>
            )}
            <td className="px-2 py-1.5 align-middle text-[14px] font-bold tabular-nums text-gray-900">
              {formatCurrency(contributor.amount)}
            </td>
            <td className="px-2 py-1.5 align-middle text-right">
              {isPending ? (
                <button
                  type="button"
                  onClick={handleSplitClick}
                  className="text-right text-[14px] font-bold text-gray-900 hover:text-emerald-800"
                >
                  {contributor.customerName}
                </button>
              ) : (
                <Link
                  href={`/customers/${contributor.customerId}`}
                  className="text-[14px] font-bold text-gray-900 hover:text-emerald-800"
                >
                  {contributor.customerName}
                </Link>
              )}
            </td>
            <td className="px-2 py-1.5 align-middle text-right">
              <div className="flex flex-col items-end gap-1">
                <ContributorPaymentLabel
                  method={
                    contributor.status === "PAID"
                      ? contributor.paymentMethod
                      : undefined
                  }
                />
                {hasCorrections && index === contributors.length - 1 && (
                  <button
                    type="button"
                    onClick={() => onShowCorrectionHistory?.(entry)}
                    className="cursor-pointer"
                  >
                    <EntryCorrectionBadge />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <>
      <tr className={entryRowClass(entry)}>
        <td className="px-2 py-1.5 align-top font-mono text-[13px] font-medium tabular-nums text-gray-600">
          {formatTime(entry.createdAt)}
        </td>
        <td className="px-2 py-1.5 align-top text-[14px] font-semibold text-gray-800">
          {typeCell}
        </td>
        <td className="px-2 py-1.5 align-top text-[14px] font-bold tabular-nums text-gray-900">
          <FieldCell correction={byField.amount}>
            {formatCurrency(entry.amount)}
          </FieldCell>
        </td>
        <td className="px-2 py-1.5 align-top text-right">
          <FieldCell correction={byField.customer}>{nameCell}</FieldCell>
        </td>
        <td className="px-2 py-1.5 align-top text-right">
          <div className="flex flex-col items-end gap-1">
            <SettlementBadge entry={entry} />
            {hasCorrections && (
              <button
                type="button"
                onClick={() => onShowCorrectionHistory?.(entry)}
                className="cursor-pointer"
              >
                <EntryCorrectionBadge />
              </button>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}
