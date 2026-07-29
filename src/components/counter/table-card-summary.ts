import type { NotebookEntryDTO } from "@/types";
import { frameDueFromParts } from "@/lib/utils/frame-payment";

/** Display-only card totals from already-loaded ledger rows. */
export function summarizeTableLedger(entries: NotebookEntryDTO[]) {
  let totalAmount = 0;
  let totalDue = 0;
  let activeFrames = 0;

  for (const entry of entries) {
    if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
      continue;
    }

    activeFrames += 1;
    totalAmount += entry.amount;

    if (entry.contributors && entry.contributors.length > 0) {
      for (const contributor of entry.contributors) {
        totalDue += frameDueFromParts(
          contributor.amount,
          contributor.paidAmount,
          contributor.balanceCollectedAmount
        );
      }
    } else {
      totalDue += frameDueFromParts(
        entry.amount,
        entry.paidAmount,
        entry.balanceCollectedAmount
      );
    }
  }

  return {
    totalAmount,
    totalDue,
    activeFrames,
    isActive: activeFrames > 0,
    hasOpenDue: totalDue > 0,
  };
}
