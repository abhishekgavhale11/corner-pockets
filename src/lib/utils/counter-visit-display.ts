import type { VisitStatus } from "@/lib/constants/visit-bill";
import { formatCurrency } from "@/lib/utils/format";
import type { NotebookEntryContributorDTO, NotebookEntryDTO } from "@/types";
import {
  getContributorCounterPayDisplay,
  getCounterPayDisplay,
  type CounterPayDisplay,
} from "@/lib/utils/counter-pay-display";

/** Remaining balance label on Counter — FR-VIS-016 / FR-CTR-001 */
export type CounterRemainingKind = "due" | "outstanding";

export type CounterPayLineView =
  | { kind: "dash" }
  | { kind: "fully_paid_active"; paidAmount: number }
  | { kind: "fully_paid_finished" }
  | {
      kind: "partial";
      paidAmount: number;
      remainingAmount: number;
      remainingKind: CounterRemainingKind;
    }
  | {
      kind: "remaining_only";
      remainingAmount: number;
      remainingKind: CounterRemainingKind;
    };

export type VisitGlanceSummaryMetric = {
  label: string;
  value: string;
  tone: "default" | "paid" | "due" | "outstanding" | "finished";
};

export function counterRemainingKind(
  visitStatus?: VisitStatus
): CounterRemainingKind {
  return visitStatus === "FINISHED" ? "outstanding" : "due";
}

export function resolveCounterPayLineView(
  display: CounterPayDisplay | null,
  visitStatus?: VisitStatus
): CounterPayLineView {
  if (!display) {
    return { kind: "dash" };
  }

  const { paidAmount, balanceAmount } = display;
  const remainingKind = counterRemainingKind(visitStatus);

  if (paidAmount > 0 && balanceAmount <= 0) {
    if (visitStatus === "FINISHED") {
      return { kind: "fully_paid_finished" };
    }
    return { kind: "fully_paid_active", paidAmount };
  }

  if (paidAmount > 0 && balanceAmount > 0) {
    return {
      kind: "partial",
      paidAmount,
      remainingAmount: balanceAmount,
      remainingKind,
    };
  }

  if (balanceAmount > 0) {
    return {
      kind: "remaining_only",
      remainingAmount: balanceAmount,
      remainingKind,
    };
  }

  return { kind: "dash" };
}

export function resolveCounterPayLineViewForEntry(
  entry: NotebookEntryDTO
): CounterPayLineView {
  return resolveCounterPayLineView(
    getCounterPayDisplay(entry),
    entry.visitStatus
  );
}

export function resolveContributorCounterPayLineView(
  entry: NotebookEntryDTO,
  contributor: NotebookEntryContributorDTO
): CounterPayLineView {
  return resolveCounterPayLineView(
    getContributorCounterPayDisplay(entry, contributor),
    contributor.visitStatus ?? entry.visitStatus
  );
}

export function counterRowHasRemainingBalance(
  display: CounterPayDisplay | null
): boolean {
  return (display?.balanceAmount ?? 0) > 0;
}

export function formatCounterRemainingText(
  amount: number,
  kind: CounterRemainingKind
): string {
  if (kind === "outstanding") {
    return `${formatCurrency(amount)} Outstanding`;
  }
  return `${formatCurrency(amount)} due`;
}

/** Visit-level Counter summary for customer glance — FR-VIS-016 / FR-CTR-001 */
export function buildVisitGlanceSummaryMetrics(input: {
  visitStatus?: VisitStatus;
  billTotal: number;
  paidAmount: number;
  dueAmount: number;
}): VisitGlanceSummaryMetric[] {
  const visitFinished = input.visitStatus === "FINISHED";

  if (visitFinished && input.dueAmount <= 0) {
    return [
      { label: "Bill", value: formatCurrency(input.billTotal), tone: "default" },
      { label: "Paid", value: "✓ Paid", tone: "paid" },
      { label: "Status", value: "🔒 Finished", tone: "finished" },
    ];
  }

  if (visitFinished) {
    return [
      { label: "Bill", value: formatCurrency(input.billTotal), tone: "default" },
      {
        label: "Paid",
        value: formatCurrency(input.paidAmount),
        tone: "paid",
      },
      {
        label: "Outstanding",
        value: formatCurrency(input.dueAmount),
        tone: "outstanding",
      },
    ];
  }

  return [
    { label: "Bill", value: formatCurrency(input.billTotal), tone: "default" },
    { label: "Paid", value: formatCurrency(input.paidAmount), tone: "paid" },
    { label: "Due", value: formatCurrency(input.dueAmount), tone: "due" },
  ];
}
