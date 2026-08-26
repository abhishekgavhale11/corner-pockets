import { frameDueAmount } from "@/lib/utils/frame-payment";
import type { BusinessDayFinalSummaryPayload } from "@/lib/financial-summary/build-final-summary";
import type { BusinessDayFinalSummarySection } from "@/models/BusinessDayFinalSummary";
import {
  isFinancialCorrectionSection,
  type FinancialCorrectionPaymentMethod,
  type FinancialCorrectionSection,
  type FinancialCorrectionType,
} from "@/lib/constants/financial-corrections";

/** Minimal correction shape consumed by the overlay. */
export type FinancialCorrectionOverlayInput = {
  type: FinancialCorrectionType;
  customerId: string;
  amount: number;
  paymentMethod?: FinancialCorrectionPaymentMethod | null;
  /** Present on new corrections. Absent on legacy rows — totals still apply. */
  section?: FinancialCorrectionSection | null;
};

function clonePayload(
  original: BusinessDayFinalSummaryPayload
): BusinessDayFinalSummaryPayload {
  return {
    ...original,
    snooker: { ...original.snooker },
    bigSnooker: { ...original.bigSnooker },
    poolMini: { ...original.poolMini },
    cafe: { ...original.cafe },
    customers: original.customers.map((row) => ({ ...row })),
  };
}

function applyMissedPaymentToSection(
  section: BusinessDayFinalSummarySection,
  amount: number,
  paymentMethod?: FinancialCorrectionPaymentMethod | null
) {
  section.received += amount;
  section.outstandingCreated = Math.max(0, section.outstandingCreated - amount);
  if (paymentMethod === "CASH") {
    section.cashCollection += amount;
  } else if (paymentMethod === "GPAY") {
    section.gpayCollection += amount;
  }
}

function applyOutstandingCorrectionToSection(
  section: BusinessDayFinalSummarySection,
  amount: number
) {
  section.bill = Math.max(0, section.bill - amount);
  section.outstandingCreated = Math.max(0, section.outstandingCreated - amount);
}

function sectionRollup(
  payload: BusinessDayFinalSummaryPayload,
  section: FinancialCorrectionSection
): BusinessDayFinalSummarySection {
  if (section === "BIG_SNOOKER") return payload.bigSnooker;
  if (section === "POOL_MINI") return payload.poolMini;
  return payload.cafe;
}

function customerSectionKey(
  section: FinancialCorrectionSection
): "bigSnooker" | "poolMini" | "cafe" {
  if (section === "BIG_SNOOKER") return "bigSnooker";
  if (section === "POOL_MINI") return "poolMini";
  return "cafe";
}

function sumSnookerSections(
  bigSnooker: BusinessDayFinalSummarySection,
  poolMini: BusinessDayFinalSummarySection
): BusinessDayFinalSummarySection {
  return {
    bill: bigSnooker.bill + poolMini.bill,
    received: bigSnooker.received + poolMini.received,
    cashCollection: bigSnooker.cashCollection + poolMini.cashCollection,
    gpayCollection: bigSnooker.gpayCollection + poolMini.gpayCollection,
    outstandingCreated:
      bigSnooker.outstandingCreated + poolMini.outstandingCreated,
    gamesPlayed: bigSnooker.gamesPlayed + poolMini.gamesPlayed,
  };
}

/**
 * Corrected Business Day position.
 * Original Final Summary is never mutated.
 *
 * MISSED_PAYMENT: received +, cash/gpay +, outstandingCreated −
 * OUTSTANDING_CORRECTION: bill −, outstandingCreated −
 *
 * Section rollups are updated only when `section` is present.
 * Total Snooker is then derived from corrected Big Snooker + Pool & Mini.
 */
export function applyFinancialCorrections(
  original: BusinessDayFinalSummaryPayload,
  corrections: FinancialCorrectionOverlayInput[]
): BusinessDayFinalSummaryPayload {
  if (corrections.length === 0) return original;

  const corrected = clonePayload(original);
  let appliedSnookerSectionCorrection = false;

  for (const correction of corrections) {
    const amount = Math.max(0, Math.round(correction.amount));
    if (amount <= 0) continue;

    if (correction.type === "MISSED_PAYMENT") {
      corrected.paid += amount;
      corrected.outstandingCreated = Math.max(
        0,
        corrected.outstandingCreated - amount
      );
      if (correction.paymentMethod === "CASH") {
        corrected.cashCollection += amount;
      } else if (correction.paymentMethod === "GPAY") {
        corrected.gpayCollection += amount;
      }
    } else if (correction.type === "OUTSTANDING_CORRECTION") {
      corrected.bill = Math.max(0, corrected.bill - amount);
      corrected.outstandingCreated = Math.max(
        0,
        corrected.outstandingCreated - amount
      );
    }

    const section = isFinancialCorrectionSection(correction.section)
      ? correction.section
      : null;

    if (section) {
      const rollup = sectionRollup(corrected, section);
      if (correction.type === "MISSED_PAYMENT") {
        applyMissedPaymentToSection(rollup, amount, correction.paymentMethod);
      } else if (correction.type === "OUTSTANDING_CORRECTION") {
        applyOutstandingCorrectionToSection(rollup, amount);
      }
      appliedSnookerSectionCorrection =
        appliedSnookerSectionCorrection ||
        section === "BIG_SNOOKER" ||
        section === "POOL_MINI";
    }

    const customer = corrected.customers.find(
      (row) => row.customerId === correction.customerId
    );
    if (!customer) continue;

    if (correction.type === "MISSED_PAYMENT") {
      customer.received += amount;
      customer.due = frameDueAmount(customer.bill, customer.received);
      if (correction.paymentMethod === "CASH") {
        customer.cashCollection += amount;
      } else if (correction.paymentMethod === "GPAY") {
        customer.gpayCollection += amount;
      }
    } else if (correction.type === "OUTSTANDING_CORRECTION") {
      customer.bill = Math.max(0, customer.bill - amount);
      customer.due = frameDueAmount(customer.bill, customer.received);
      if (section) {
        const key = customerSectionKey(section);
        customer[key] = Math.max(0, customer[key] - amount);
      }
    }
  }

  if (appliedSnookerSectionCorrection) {
    corrected.snooker = sumSnookerSections(
      corrected.bigSnooker,
      corrected.poolMini
    );
  }

  corrected.closingOutstanding = Math.max(
    0,
    corrected.openingOutstanding +
      corrected.outstandingCreated -
      corrected.outstandingCollected
  );

  return corrected;
}
