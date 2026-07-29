import { describe, expect, it } from "vitest";
import { rollupAttributedChargeLines } from "@/lib/financial-summary/charge-line-rollup";

/**
 * Business Summary money fields owned by Financial Summary Engine rollup.
 * Close Preview maps section.bill → revenue (see close-summary.toCategory).
 */
describe("Business Summary (rollupAttributedChargeLines)", () => {
  const summary = rollupAttributedChargeLines([
    {
      amount: 200,
      paidAmount: 150,
      paymentAllocations: [
        { paymentMethod: "CASH", amount: 100 },
        { paymentMethod: "GPAY", amount: 50 },
      ],
    },
    {
      amount: 80,
      paidAmount: 80,
      paymentMethod: "GPAY",
    },
    {
      amount: 120,
      paidAmount: 0,
    },
  ]);

  it("Revenue (Bill) is the sum of charge amounts", () => {
    expect(summary.bill).toBe(400);
  });

  it("Cash is attributed Cash collection only", () => {
    expect(summary.cashCollection).toBe(100);
  });

  it("GPay is attributed GPay collection only", () => {
    expect(summary.gpayCollection).toBe(130);
  });

  it("Outstanding Created is Bill − Received", () => {
    expect(summary.received).toBe(230);
    expect(summary.outstandingCreated).toBe(170);
  });

  it("unpaid lines contribute 0 to Cash and GPay", () => {
    const unpaid = rollupAttributedChargeLines([
      { amount: 100, paidAmount: 0 },
    ]);
    expect(unpaid.cashCollection).toBe(0);
    expect(unpaid.gpayCollection).toBe(0);
    expect(unpaid.outstandingCreated).toBe(100);
  });
});
