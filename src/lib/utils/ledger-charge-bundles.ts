import type { NotebookSection } from "@/lib/constants/notebook-sections";
import { CAFE_SECTION } from "@/lib/constants/counter-sections";

const CAFE_BUNDLE_GAP_MS = 30 * 60 * 1000;

export type LedgerChargeCandidate = {
  entryId: string;
  section: NotebookSection;
  timestamp: Date;
  description: string;
  amount: number;
  staffUsername: string;
  /** Pay-later obligations only — not active visit checkout charges */
  isPayLaterObligation?: boolean;
};

export type BundledLedgerCharge = {
  id: string;
  timestamp: Date;
  description: string;
  amount: number;
  staffUsername: string;
  payLaterAmount: number;
};

/** Collapse repeated labels into "Singles ×2", "Coffee ×4", etc. */
export function summarizeChargeLabels(labels: string[]): string[] {
  const counts = new Map<string, number>();

  for (const label of labels) {
    const withQty = label.match(/^(.+?)\s×\s*(\d+)$/u);
    if (withQty) {
      const base = withQty[1]!.trim();
      const qty = Number.parseInt(withQty[2]!, 10);
      counts.set(base, (counts.get(base) ?? 0) + (Number.isFinite(qty) ? qty : 1));
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()].map(([base, count]) =>
    count > 1 ? `${base} ×${count}` : base
  );
}

function minuteKey(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const h = date.getHours();
  const min = date.getMinutes();
  return `${y}-${m}-${d}-${h}-${min}`;
}

function formatBundleDescription(
  section: NotebookSection,
  labels: string[]
): string {
  const parts = summarizeChargeLabels(labels);

  if (parts.length === 1) {
    return parts[0]!;
  }

  if (section === CAFE_SECTION) {
    if (parts.length <= 4) {
      return parts.join(", ");
    }
    return `${parts.slice(0, 3).join(", ")}, +${parts.length - 3} more`;
  }

  if (parts.length <= 4) {
    return parts.join(", ");
  }

  return `${parts.slice(0, 3).join(", ")}, +${parts.length - 3} more`;
}

function canMergeIntoBundle(
  bundle: LedgerChargeCandidate[],
  next: LedgerChargeCandidate
): boolean {
  if (bundle.length === 0) return false;

  const last = bundle[bundle.length - 1]!;
  if (last.staffUsername !== next.staffUsername) {
    return false;
  }

  if (next.section === CAFE_SECTION && last.section === CAFE_SECTION) {
    return (
      next.timestamp.getTime() - bundle[0]!.timestamp.getTime() <=
      CAFE_BUNDLE_GAP_MS
    );
  }

  if (next.section !== CAFE_SECTION && last.section !== CAFE_SECTION) {
    return (
      next.section === last.section &&
      minuteKey(next.timestamp) === minuteKey(last.timestamp)
    );
  }

  return false;
}

export function bundleLedgerCharges(
  charges: LedgerChargeCandidate[]
): BundledLedgerCharge[] {
  const sorted = [...charges].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const bundles: LedgerChargeCandidate[][] = [];
  let current: LedgerChargeCandidate[] = [];

  for (const charge of sorted) {
    if (current.length === 0 || canMergeIntoBundle(current, charge)) {
      current.push(charge);
      continue;
    }

    bundles.push(current);
    current = [charge];
  }

  if (current.length > 0) {
    bundles.push(current);
  }

  return bundles.map((group) => {
    const amount = group.reduce((sum, row) => sum + row.amount, 0);
    const labels = group.map((row) => row.description);
    const section = group[0]!.section;
    const first = group[0]!;
    const last = group[group.length - 1]!;

    return {
      id:
        group.length === 1
          ? `charge-${first.entryId}`
          : `charge-bundle-${first.entryId}-${last.entryId}`,
      timestamp: first.timestamp,
      description: formatBundleDescription(section, labels),
      amount,
      staffUsername: first.staffUsername,
      payLaterAmount: group
        .filter((row) => row.isPayLaterObligation)
        .reduce((sum, row) => sum + row.amount, 0),
    };
  });
}
