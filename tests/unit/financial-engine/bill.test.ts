import { describe, expect, it } from "vitest";
import { rollupAttributedChargeLines } from "@/lib/financial-summary/charge-line-rollup";

/**
 * Bill = Σ charge line amounts (Financial Summary Engine rollup).
 */
describe("Bill calculation (rollupAttributedChargeLines)", () => {
  it("sums a single frame charge", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 200, paidAmount: 0 },
    ]);
    expect(summary.bill).toBe(200);
  });

  it("sums a single cafe charge", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 80, paidAmount: 0 },
    ]);
    expect(summary.bill).toBe(80);
  });

  it("sums frame + cafe charges", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 200, paidAmount: 0 },
      { amount: 80, paidAmount: 0 },
    ]);
    expect(summary.bill).toBe(280);
  });

  it("sums multiple frames", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 150, paidAmount: 0 },
      { amount: 200, paidAmount: 0 },
      { amount: 100, paidAmount: 0 },
    ]);
    expect(summary.bill).toBe(450);
  });

  it("sums multiple cafe items", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 40, paidAmount: 0 },
      { amount: 60, paidAmount: 0 },
      { amount: 25, paidAmount: 0 },
    ]);
    expect(summary.bill).toBe(125);
  });
});
