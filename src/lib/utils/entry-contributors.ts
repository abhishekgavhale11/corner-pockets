import type { NotebookEntryDTO } from "@/types";

export type ContributorObligation = {
  customerId: string;
  customerName: string;
  amount: number;
  status: "PENDING" | "PAID";
  paymentMethod?: string;
};

export function entryHasContributors(
  entry: { contributors?: unknown[] | null }
): boolean {
  return Boolean(entry.contributors && entry.contributors.length > 0);
}

export function getEntryCheckoutObligations(
  entry: NotebookEntryDTO
): ContributorObligation[] {
  if (entryHasContributors(entry)) {
    return entry.contributors!.map((contributor) => ({
      customerId: contributor.customerId,
      customerName: contributor.customerName,
      amount: contributor.amount,
      status: contributor.status,
      paymentMethod: contributor.paymentMethod,
    }));
  }

  if (
    entry.customerId &&
    (entry.status === "PENDING" || entry.status === "REVERSED")
  ) {
    return [
      {
        customerId: entry.customerId,
        customerName: entry.customerName,
        amount: entry.amount,
        status: "PENDING",
      },
    ];
  }

  return [];
}

export function getPendingObligations(
  entry: NotebookEntryDTO
): ContributorObligation[] {
  return getEntryCheckoutObligations(entry).filter(
    (obligation) => obligation.status === "PENDING"
  );
}

export function isEntryCheckoutEligible(entry: NotebookEntryDTO): boolean {
  if (entry.status === "CANCELLED") return false;
  if (entryHasContributors(entry)) {
    return getPendingObligations(entry).length > 0;
  }
  return entry.status === "PENDING" || entry.status === "REVERSED";
}

export function contributorSummaryLabel(
  entry: Pick<NotebookEntryDTO, "contributors">
): string {
  const count = entry.contributors?.length ?? 0;
  if (count === 0) return "";
  if (count === 1) {
    const contributor = entry.contributors![0];
    return `${contributor.customerName} ${formatInr(contributor.amount)}`;
  }
  return `[${count} Contributors]`;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
