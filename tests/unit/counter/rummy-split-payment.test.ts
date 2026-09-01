import { describe, expect, it } from "vitest";
import NotebookEntry from "@/models/NotebookEntry";
import { setEntryContributorsSchema } from "@/lib/validators/notebook";
import {
  RECEIVED_PAYMENT_MODE_REQUIRED_MESSAGE,
  contributorPersistedPayment,
  contributorReceivedPaymentModeError,
  explicitPaymentMethod,
} from "@/lib/utils/contributor-payment";
import { frameDueAmount } from "@/lib/utils/frame-payment";

const ENTRY_ID = "507f1f77bcf86cd799439011";
const CUSTOMER_A = "507f1f77bcf86cd799439012";
const CUSTOMER_B = "507f1f77bcf86cd799439013";

function splitPayload(row: {
  customerId: string;
  amount: number;
  paidAmount: number;
  paymentMethod?: string | "";
}) {
  const paymentMethod = explicitPaymentMethod(
    row.paidAmount,
    row.paymentMethod
  );
  return {
    customerId: row.customerId,
    amount: row.amount,
    paidAmount: row.paidAmount,
    ...(paymentMethod ? { paymentMethod } : {}),
  };
}

function parseContributors(
  contributors: ReturnType<typeof splitPayload>[]
) {
  return setEntryContributorsSchema.safeParse({
    entryId: ENTRY_ID,
    contributors,
  });
}

describe("Rummy split contributor payment", () => {
  it("A: Received ₹0 with no payment mode saves as Outstanding, mode omitted", () => {
    const payload = splitPayload({
      customerId: CUSTOMER_A,
      amount: 240,
      paidAmount: 0,
      paymentMethod: "",
    });
    expect(payload).toEqual({
      customerId: CUSTOMER_A,
      amount: 240,
      paidAmount: 0,
    });
    expect("paymentMethod" in payload).toBe(false);

    const parsed = parseContributors([payload]);
    expect(parsed.success).toBe(true);

    const saved = contributorPersistedPayment({
      amount: 240,
      paidAmount: 0,
      paymentMethod: "",
    });
    expect(saved).toEqual({
      ok: true,
      paidAmount: 0,
      status: "PENDING",
    });
    expect(saved.ok && "paymentMethod" in saved).toBe(false);
    expect(frameDueAmount(240, 0)).toBe(240);
    expect(contributorReceivedPaymentModeError(0, "")).toBeNull();
  });

  it("B: Received ₹240 with no payment mode blocks save and does not invent Cash", () => {
    const payload = splitPayload({
      customerId: CUSTOMER_A,
      amount: 240,
      paidAmount: 240,
      paymentMethod: "",
    });
    expect("paymentMethod" in payload).toBe(false);

    const parsed = parseContributors([payload]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        RECEIVED_PAYMENT_MODE_REQUIRED_MESSAGE
      );
    }

    const saved = contributorPersistedPayment({
      amount: 240,
      paidAmount: 240,
      paymentMethod: undefined,
    });
    expect(saved).toEqual({
      ok: false,
      error: RECEIVED_PAYMENT_MODE_REQUIRED_MESSAGE,
    });
    expect(explicitPaymentMethod(240, undefined)).toBeUndefined();
    expect(explicitPaymentMethod(240, "")).toBeUndefined();
  });

  it("C: Received ₹240 with Cash selected saves as Cash, Due ₹0", () => {
    const payload = splitPayload({
      customerId: CUSTOMER_A,
      amount: 240,
      paidAmount: 240,
      paymentMethod: "CASH",
    });
    expect(payload.paymentMethod).toBe("CASH");

    const parsed = parseContributors([payload]);
    expect(parsed.success).toBe(true);

    const saved = contributorPersistedPayment({
      amount: 240,
      paidAmount: 240,
      paymentMethod: "CASH",
    });
    expect(saved).toEqual({
      ok: true,
      paidAmount: 240,
      status: "PAID",
      paymentMethod: "CASH",
    });
    expect(frameDueAmount(240, 240)).toBe(0);
  });

  it("D: Received ₹240 with GPay selected saves as GPay, Due ₹0", () => {
    const payload = splitPayload({
      customerId: CUSTOMER_A,
      amount: 240,
      paidAmount: 240,
      paymentMethod: "GPAY",
    });
    expect(payload.paymentMethod).toBe("GPAY");

    const parsed = parseContributors([payload]);
    expect(parsed.success).toBe(true);

    const saved = contributorPersistedPayment({
      amount: 240,
      paidAmount: 240,
      paymentMethod: "GPAY",
    });
    expect(saved).toEqual({
      ok: true,
      paidAmount: 240,
      status: "PAID",
      paymentMethod: "GPAY",
    });
    expect(frameDueAmount(240, 240)).toBe(0);
  });

  it("E: validates each contributor independently and never assigns Cash automatically", () => {
    const outstanding = splitPayload({
      customerId: CUSTOMER_A,
      amount: 240,
      paidAmount: 0,
      paymentMethod: "",
    });
    const paid = splitPayload({
      customerId: CUSTOMER_B,
      amount: 240,
      paidAmount: 240,
      paymentMethod: "GPAY",
    });

    const parsed = parseContributors([outstanding, paid]);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contributors[0]?.paymentMethod).toBeUndefined();
      expect(parsed.data.contributors[1]?.paymentMethod).toBe("GPAY");
    }

    const savedOutstanding = contributorPersistedPayment({
      amount: 240,
      paidAmount: 0,
    });
    const savedPaid = contributorPersistedPayment({
      amount: 240,
      paidAmount: 240,
      paymentMethod: "GPAY",
    });
    expect(savedOutstanding).toMatchObject({
      ok: true,
      status: "PENDING",
      paidAmount: 0,
    });
    expect(savedOutstanding.ok && savedOutstanding.paymentMethod).toBeUndefined();
    expect(savedPaid).toMatchObject({
      ok: true,
      status: "PAID",
      paymentMethod: "GPAY",
    });

    const mixedInvalid = parseContributors([
      outstanding,
      splitPayload({
        customerId: CUSTOMER_B,
        amount: 240,
        paidAmount: 240,
        paymentMethod: "",
      }),
    ]);
    expect(mixedInvalid.success).toBe(false);
    if (!mixedInvalid.success) {
      expect(mixedInvalid.error.issues[0]?.message).toBe(
        RECEIVED_PAYMENT_MODE_REQUIRED_MESSAGE
      );
    }
  });

  it("does not keep Cash when Received is 0 even if Cash was sent in the payload", () => {
    const saved = contributorPersistedPayment({
      amount: 240,
      paidAmount: 0,
      paymentMethod: "CASH",
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.paymentMethod).toBeUndefined();
      expect("paymentMethod" in saved).toBe(false);
    }
  });

  it("contributor paymentMethod schema has no Cash default", () => {
    const contributorsPath = NotebookEntry.schema.path("contributors") as {
      schema: { path: (name: string) => { options?: { default?: unknown } } };
    };
    const paymentMethod = contributorsPath.schema.path("paymentMethod");
    expect(paymentMethod.options?.default).toBeUndefined();
  });
});
