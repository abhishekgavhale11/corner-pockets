import "../helpers/env";
import { test, expect } from "@playwright/test";
import { resetE2eDatabase, disconnectTestDb } from "../helpers/db";
import {
  bootstrapTestWorld,
  businessDayHistory,
  cleanupCustomers,
  closeOpenBusinessDay,
  collectOutstandingForTestCustomer,
  createFrameForCustomer,
  createOpeningOutstandingForCustomer,
  createTestCustomer,
  customerOutstandingBalance,
  customerTimeline,
  openFreshBusinessDay,
  type TestCustomer,
  type TestStaff,
} from "../helpers/financial-integrity";
import Outstanding from "../../src/models/Outstanding";
import { verifyOutstandingIntegrity } from "../../src/lib/integrity/verify-outstanding";
import { connectTestDb } from "../helpers/db";

/**
 * Opening Outstanding — pre-CPOS migration baseline.
 * Must never create fake Business Days / Frames / Cafe / Payments.
 */

test.describe.configure({ mode: "serial" });

test.describe("Opening Outstanding", () => {
  let staff: TestStaff;
  let trackedCustomerIds: string[] = [];

  async function track(...customers: TestCustomer[]): Promise<void> {
    for (const customer of customers) {
      trackedCustomerIds.push(customer.id);
    }
  }

  test.beforeAll(async () => {
    await resetE2eDatabase();
    staff = await bootstrapTestWorld();
  });

  test.afterEach(async () => {
    await cleanupCustomers(trackedCustomerIds);
    trackedCustomerIds = [];
  });

  test.afterAll(async () => {
    await cleanupCustomers(trackedCustomerIds);
    await disconnectTestDb();
  });

  test("1. Opening Outstanding only increases Current Outstanding", async () => {
    const customer = await createTestCustomer("OpeningOnly");
    await track(customer);

    await createOpeningOutstandingForCustomer({
      customerId: customer.id,
      amount: 5000,
      createdBy: staff.username,
      reason: "Notebook balance before go-live",
    });

    expect(await customerOutstandingBalance(customer.id)).toBe(5000);

    const timeline = await customerTimeline(customer.id);
    const opening = timeline.find((item) => item.kind === "OPENING_OUTSTANDING");
    expect(opening).toBeTruthy();
    expect(opening!.openingOutstanding?.amount).toBe(5000);
    expect(opening!.previousOutstanding).toBe(0);
    expect(opening!.outstandingBalance).toBe(5000);
    expect(opening!.openingOutstanding?.reason).toContain("Notebook");

    const rows = await Outstanding.find({
      customerId: customer.id,
      sourceType: "OPENING",
    }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].businessDayId).toBeUndefined();
    expect(rows[0].sourceRecordId).toBeUndefined();
  });

  test("2. Rejects Opening Outstanding when customer is no longer brand-new", async () => {
    const customer = await createTestCustomer("OpeningDup");
    await track(customer);

    await createOpeningOutstandingForCustomer({
      customerId: customer.id,
      amount: 1000,
      createdBy: staff.username,
    });

    await expect(
      createOpeningOutstandingForCustomer({
        customerId: customer.id,
        amount: 2000,
        createdBy: staff.username,
      })
    ).rejects.toThrow(/brand-new customers with no timeline or financial activity/i);
  });

  test("3. BD Created + Opening + partial/full collection identity", async () => {
    const customer = await createTestCustomer("OpeningFlow");
    await track(customer);

    await createOpeningOutstandingForCustomer({
      customerId: customer.id,
      amount: 5000,
      createdBy: staff.username,
    });
    expect(await customerOutstandingBalance(customer.id)).toBe(5000);

    const day1 = await openFreshBusinessDay(staff);
    await createFrameForCustomer(staff, customer, {
      amount: 1200,
      received: 0,
    });
    const closed1 = await closeOpenBusinessDay(staff);
    expect(closed1.status).toBe("SUCCESS");

    expect(await customerOutstandingBalance(customer.id)).toBe(6200);

    const history1 = await businessDayHistory(day1.id);
    expect(history1).toBeTruthy();
    expect(history1!.summary.outstandingCreated).toBe(1200);
    expect(history1!.outstandingTrend?.newOutstandingCreated).toBe(1200);
    expect(history1!.outstandingTrend?.openingOutstanding).toBe(5000);
    expect(history1!.outstandingTrend?.closingOutstanding).toBe(6200);
    expect(
      history1!.outstandingTrend?.created.some((row) => row.amount === 5000)
    ).toBe(false);

    const day2 = await openFreshBusinessDay(staff);
    const remainingAfterPay = await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 2000,
      paymentMethod: "CASH",
      staff,
    });
    expect(remainingAfterPay).toBe(4200);
    expect(await customerOutstandingBalance(customer.id)).toBe(4200);

    await createFrameForCustomer(staff, customer, {
      amount: 800,
      received: 0,
    });
    const closed2 = await closeOpenBusinessDay(staff);
    expect(closed2.status).toBe("SUCCESS");
    expect(await customerOutstandingBalance(customer.id)).toBe(5000);

    const history2 = await businessDayHistory(day2.id);
    expect(history2!.summary.outstandingCreated).toBe(800);
    expect(history2!.outstandingTrend?.newOutstandingCreated).toBe(800);
    expect(history2!.outstandingTrend?.openingOutstanding).toBe(6200);
    expect(history2!.outstandingTrend?.outstandingRecovered).toBe(2000);
    expect(history2!.outstandingTrend?.closingOutstanding).toBe(5000);

    await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 3000,
      paymentMethod: "GPAY",
      staff,
    });
    expect(await customerOutstandingBalance(customer.id)).toBe(2000);

    // Lifetime identity:
    // Opening 5000 + BD Created (1200+800) − Recovered (2000+3000) = 2000
    const opening = 5000;
    const created = 1200 + 800;
    const recovered = 2000 + 3000;
    expect(opening + created - recovered).toBe(
      await customerOutstandingBalance(customer.id)
    );

    const timeline = await customerTimeline(customer.id);
    expect(timeline.some((i) => i.kind === "OPENING_OUTSTANDING")).toBe(true);
    expect(
      timeline.filter((i) => i.kind === "BUSINESS_DAY_SUMMARY").length
    ).toBeGreaterThanOrEqual(2);
    expect(
      timeline.filter(
        (i) =>
          i.kind === "OUTSTANDING_COLLECTED" ||
          i.kind === "OUTSTANDING_PARTIALLY_COLLECTED"
      ).length
    ).toBe(2);

    await connectTestDb();
    const integrity = await verifyOutstandingIntegrity();
    const row = integrity.customers.find((c) => c.customerId === customer.id);
    expect(row?.status).toBe("PASS");
  });

  test("4. Fully clearing Opening Outstanding via FIFO", async () => {
    const customer = await createTestCustomer("OpeningClear");
    await track(customer);

    await createOpeningOutstandingForCustomer({
      customerId: customer.id,
      amount: 1500,
      createdBy: staff.username,
    });

    await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 1500,
      paymentMethod: "CASH",
      staff,
    });

    expect(await customerOutstandingBalance(customer.id)).toBe(0);

    const opening = await Outstanding.findOne({
      customerId: customer.id,
      sourceType: "OPENING",
    }).lean();
    expect(opening?.status).toBe("COLLECTED");
    expect(opening?.remainingAmount).toBe(0);
  });
});
