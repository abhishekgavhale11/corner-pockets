import { describe, expect, it } from "vitest";
import { rollupAttributedChargeLines } from "@/lib/financial-summary/charge-line-rollup";
import {
  frameDueAmount,
  frameDueFromParts,
  frameReceivedAmount,
} from "@/lib/utils/frame-payment";

/**
 * Outstanding Created (day grain) = Due = Amount − Received.
 * Club Remaining Outstanding after collection is computed only inside
 * buildBusinessDayFinalSummaryPayload / getClosingOutstandingAtClose (DB-bound).
 */
describe("Outstanding calculation", () => {
  it("no outstanding when fully paid", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 200, paidAmount: 200, paymentMethod: "CASH" },
    ]);
    expect(summary.outstandingCreated).toBe(0);
  });

  it("partial outstanding is Bill − Received", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 200, paidAmount: 50, paymentMethod: "CASH" },
      { amount: 100, paidAmount: 100, paymentMethod: "GPAY" },
    ]);
    expect(summary.outstandingCreated).toBe(150);
  });

  it("full outstanding when Received is 0", () => {
    expect(frameDueAmount(250, 0)).toBe(250);
  });

  it("balance collection applied to open charges reduces Due", () => {
    // Received = paidAmount + balanceCollectedAmount (frameReceivedAmount).
    const amount = 200;
    expect(frameReceivedAmount(0, 80)).toBe(80);
    expect(frameDueFromParts(amount, 0, 80)).toBe(120);
  });
});
