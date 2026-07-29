import { describe, expect, it } from "vitest";
import {
  accumulateAttributedPayment,
  emptyAttributedPaymentSummary,
} from "@/lib/financial-summary/accumulate-payment";
import { rollupAttributedChargeLines } from "@/lib/financial-summary/charge-line-rollup";
import { attributePaymentCollections } from "@/lib/business-day/payment-collections";
import {
  frameDueAmount,
  frameReceivedAmount,
} from "@/lib/utils/frame-payment";

describe("Payment calculation", () => {
  it("full payment: Received equals Amount and Due is 0", () => {
    const amount = 200;
    const received = frameReceivedAmount(200, 0);
    expect(received).toBe(200);
    expect(frameDueAmount(amount, received)).toBe(0);
  });

  it("partial payment: Due is Amount − Received", () => {
    expect(frameDueAmount(200, frameReceivedAmount(80, 0))).toBe(120);
  });

  it("multiple payments accumulate Cash and GPay", () => {
    const summary = emptyAttributedPaymentSummary();
    accumulateAttributedPayment(summary, {
      paidAmount: 100,
      paymentMethod: "CASH",
    });
    accumulateAttributedPayment(summary, {
      paidAmount: 50,
      paymentMethod: "GPAY",
    });
    expect(summary.totalPaid).toBe(150);
    expect(summary.cash).toBe(100);
    expect(summary.gpay).toBe(50);
  });

  it("Cash + GPay allocations attribute Received by method", () => {
    expect(
      attributePaymentCollections({
        paidAmount: 300,
        paymentAllocations: [
          { paymentMethod: "CASH", amount: 100 },
          { paymentMethod: "GPAY", amount: 200 },
        ],
      })
    ).toEqual({ cash: 100, gpay: 200 });
  });

  it("rollup Received is the sum of paid amounts", () => {
    const summary = rollupAttributedChargeLines([
      { amount: 200, paidAmount: 200, paymentMethod: "CASH" },
      { amount: 80, paidAmount: 40, paymentMethod: "GPAY" },
    ]);
    expect(summary.received).toBe(240);
  });
});
