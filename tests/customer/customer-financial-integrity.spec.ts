import "../helpers/env";
import { test, expect } from "@playwright/test";
import { loginAsStaff, currencyText } from "../helpers/auth";
import { resetE2eDatabase, disconnectTestDb } from "../helpers/db";
import {
  bootstrapTestWorld,
  businessDayHistory,
  cleanupCustomers,
  closeOpenBusinessDay,
  createCafeOrderForCustomer,
  createFrameForCustomer,
  createSplitFrame,
  createTestCustomer,
  customerOutstandingBalance,
  customerTimeline,
  ensureOpenBusinessDay,
  getOutstandingRecordsForBusinessDay,
  getOutstandingRecordsForCustomer,
  openFreshBusinessDay,
  sumOutstandingOriginal,
  type TestCustomer,
  type TestStaff,
} from "../helpers/financial-integrity";

/**
 * Customer Financial Integrity — highest-priority CPOS QA module.
 *
 * Source of truth: docs/00-business-rules.md + docs/02-customer.md
 * Outstanding is created only on Business Day close; Due = Amount − Received.
 */

test.describe.configure({ mode: "serial" });

test.describe("Customer Financial Integrity", () => {
  let staff: TestStaff;
  let trackedCustomerIds: string[] = [];

  async function track(...customers: TestCustomer[]): Promise<void> {
    for (const customer of customers) {
      trackedCustomerIds.push(customer.id);
    }
  }

  async function prepareOpenDay() {
    return openFreshBusinessDay(staff);
  }

  test.beforeAll(async () => {
    await resetE2eDatabase();
    staff = await bootstrapTestWorld();
    await ensureOpenBusinessDay(staff);
  });

  test.afterEach(async () => {
    const ids = [...new Set(trackedCustomerIds)];
    trackedCustomerIds = [];
    await cleanupCustomers(ids);
  });

  test.afterAll(async () => {
    await disconnectTestDb();
  });

  test("1. Fully paid Business Day should NOT create Outstanding", async () => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("FullPay");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 160,
      received: 160,
      paymentMethod: "CASH",
    });

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    const balance = await customerOutstandingBalance(customer.id);
    expect(
      balance,
      `Fully paid customer must have ₹0 Outstanding after close (got ₹${balance})`
    ).toBe(0);

    const records = await getOutstandingRecordsForCustomer(customer.id);
    expect(
      records.length,
      "Fully paid Business Day must not insert Outstanding documents"
    ).toBe(0);

    const history = await businessDayHistory(day.id);
    expect(history, "Business Day History must exist after close").toBeTruthy();
    expect(
      history!.summary.outstandingCreated,
      "History Outstanding Created must be ₹0 when everything is paid"
    ).toBe(0);

    const timeline = await customerTimeline(customer.id);
    const dayCard = timeline.find(
      (item) =>
        item.kind === "BUSINESS_DAY_SUMMARY" && item.businessDayId === day.id
    );
    expect(dayCard, "Timeline must show the closed Business Day visit").toBeTruthy();
    expect(
      dayCard!.businessDaySummary?.todaysDue,
      "Timeline Today's Due must be ₹0 for a fully paid day"
    ).toBe(0);
  });

  test("2. Partial payment should create correct Outstanding", async () => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("Partial");
    await track(customer);

    const amount = 160;
    const received = 60;
    const expectedDue = amount - received;

    await createFrameForCustomer(staff, customer, {
      amount,
      received,
      paymentMethod: "GPAY",
    });

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    const balance = await customerOutstandingBalance(customer.id);
    expect(
      balance,
      `Outstanding must equal Due (Amount ${amount} − Received ${received} = ${expectedDue}), got ${balance}`
    ).toBe(expectedDue);

    const created = await sumOutstandingOriginal(customer.id, day.id);
    expect(
      created,
      `Outstanding originalAmount total must equal Due ${expectedDue}`
    ).toBe(expectedDue);

    const history = await businessDayHistory(day.id);
    expect(history!.summary.outstandingCreated).toBe(expectedDue);
  });

  test("3. No payment should create full Outstanding", async () => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("NoPay");
    await track(customer);

    const amount = 180;
    await createFrameForCustomer(staff, customer, {
      amount,
      received: 0,
    });

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    const balance = await customerOutstandingBalance(customer.id);
    expect(
      balance,
      `No payment → Outstanding must equal full Amount ${amount}, got ${balance}`
    ).toBe(amount);

    const history = await businessDayHistory(day.id);
    expect(
      history!.summary.outstandingCreated,
      "History Outstanding Created must equal unpaid Amount"
    ).toBe(amount);
  });

  test("4. Multiple customers should receive independent Outstanding", async () => {
    const day = await prepareOpenDay();
    const alice = await createTestCustomer("Alice");
    const bob = await createTestCustomer("Bob");
    await track(alice, bob);

    await createFrameForCustomer(staff, alice, {
      amount: 160,
      received: 40,
      paymentMethod: "CASH",
    });
    await createFrameForCustomer(staff, bob, {
      amount: 240,
      received: 0,
    });

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    const aliceDue = 160 - 40;
    const bobDue = 240;

    expect(await customerOutstandingBalance(alice.id)).toBe(aliceDue);
    expect(await customerOutstandingBalance(bob.id)).toBe(bobDue);

    const aliceRecords = await getOutstandingRecordsForCustomer(alice.id);
    const bobRecords = await getOutstandingRecordsForCustomer(bob.id);

    for (const record of aliceRecords) {
      expect(
        record.customerId.toString(),
        "Alice Outstanding must never be assigned to another customer"
      ).toBe(alice.id);
      expect(record.businessDayId?.toString()).toBe(day.id);
    }
    for (const record of bobRecords) {
      expect(
        record.customerId.toString(),
        "Bob Outstanding must never be assigned to another customer"
      ).toBe(bob.id);
    }

    const dayRecords = await getOutstandingRecordsForBusinessDay(day.id);
    const customerIds = new Set(dayRecords.map((r) => r.customerId.toString()));
    expect(
      customerIds.has(alice.id) && customerIds.has(bob.id),
      "Both customers must appear in Outstanding for this Business Day"
    ).toBe(true);
    expect(
      dayRecords.reduce((sum, r) => sum + r.originalAmount, 0),
      "Day Outstanding total must equal Alice Due + Bob Due"
    ).toBe(aliceDue + bobDue);
  });

  test("5. Cafe + Frames should calculate Outstanding correctly", async () => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("CafeFrame");
    await track(customer);

    const frameAmount = 160;
    const frameReceived = 100;
    const cafeAmount = 80;
    const cafeReceived = 20;
    const expectedDue =
      frameAmount - frameReceived + (cafeAmount - cafeReceived);

    await createFrameForCustomer(staff, customer, {
      amount: frameAmount,
      received: frameReceived,
      paymentMethod: "CASH",
    });
    await createCafeOrderForCustomer(
      staff,
      customer,
      {
        amount: cafeAmount,
        received: cafeReceived,
        paymentMethod: "GPAY",
      },
      day.id,
      day.businessDate
    );

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    expect(
      await customerOutstandingBalance(customer.id),
      `Cafe+Frame Outstanding must be ${expectedDue}`
    ).toBe(expectedDue);

    const history = await businessDayHistory(day.id);
    expect(history!.summary.outstandingCreated).toBe(expectedDue);
    expect(
      history!.summary.todaysBill,
      "History Bill must include Frame + Cafe"
    ).toBe(frameAmount + cafeAmount);
    expect(history!.summary.totalReceived).toBe(frameReceived + cafeReceived);

    const timeline = await customerTimeline(customer.id);
    const dayCard = timeline.find(
      (item) =>
        item.kind === "BUSINESS_DAY_SUMMARY" && item.businessDayId === day.id
    );
    expect(dayCard?.businessDaySummary?.todaysDue).toBe(expectedDue);
    expect(dayCard?.businessDaySummary?.todaysBill).toBe(frameAmount + cafeAmount);
  });

  test("6. Split Frames should create Outstanding only for unpaid contributors", async () => {
    const day = await prepareOpenDay();
    const payer = await createTestCustomer("SplitPaid");
    const debtor = await createTestCustomer("SplitDue");
    await track(payer, debtor);

    await createSplitFrame(staff, [
      {
        customerId: payer.id,
        customerName: payer.name,
        amount: 80,
        received: 80,
        paymentMethod: "CASH",
      },
      {
        customerId: debtor.id,
        customerName: debtor.name,
        amount: 80,
        received: 0,
      },
    ]);

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    expect(
      await customerOutstandingBalance(payer.id),
      "Fully paid split contributor must have ₹0 Outstanding"
    ).toBe(0);
    expect(
      await customerOutstandingBalance(debtor.id),
      "Unpaid split contributor must owe their share only (₹80)"
    ).toBe(80);

    const payerRecords = await getOutstandingRecordsForCustomer(payer.id);
    expect(
      payerRecords.length,
      "Paid contributor must not receive Outstanding documents"
    ).toBe(0);

    const debtorRecords = await getOutstandingRecordsForCustomer(debtor.id);
    expect(
      debtorRecords.reduce((sum, r) => sum + r.originalAmount, 0)
    ).toBe(80);

    const history = await businessDayHistory(day.id);
    expect(history!.summary.outstandingCreated).toBe(80);
  });

  test("7. Multiple Frames + Cafe should aggregate correctly", async () => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("MultiAgg");
    await track(customer);

    // Frame 1: 160 paid 50 → due 110
    await createFrameForCustomer(staff, customer, {
      amount: 160,
      received: 50,
      paymentMethod: "CASH",
      section: "BIG_SNOOKER_1",
    });
    // Frame 2: 130 paid 0 → due 130
    await createFrameForCustomer(staff, customer, {
      amount: 130,
      received: 0,
      snookerGame: "SHUFFLE",
      section: "BIG_SNOOKER_2",
    });
    // Cafe: 40 paid 10 → due 30
    await createCafeOrderForCustomer(
      staff,
      customer,
      { amount: 40, received: 10, paymentMethod: "GPAY" },
      day.id,
      day.businessDate
    );

    const expectedBill = 160 + 130 + 40;
    const expectedReceived = 50 + 0 + 10;
    const expectedDue = expectedBill - expectedReceived;

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    expect(await customerOutstandingBalance(customer.id)).toBe(expectedDue);
    expect(await sumOutstandingOriginal(customer.id, day.id)).toBe(expectedDue);

    const history = await businessDayHistory(day.id);
    expect(history!.summary.todaysBill).toBe(expectedBill);
    expect(history!.summary.totalReceived).toBe(expectedReceived);
    expect(history!.summary.outstandingCreated).toBe(expectedDue);

    const timeline = await customerTimeline(customer.id);
    const dayCard = timeline.find(
      (item) =>
        item.kind === "BUSINESS_DAY_SUMMARY" && item.businessDayId === day.id
    );
    expect(dayCard?.businessDaySummary?.todaysBill).toBe(expectedBill);
    expect(dayCard?.businessDaySummary?.todaysPayment).toBe(expectedReceived);
    expect(dayCard?.businessDaySummary?.todaysDue).toBe(expectedDue);
  });

  test("8. Closing Business Day must create only one Outstanding record per customer", async () => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("OneRec");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 160,
      received: 0,
    });
    await createCafeOrderForCustomer(
      staff,
      customer,
      { amount: 50, received: 0 },
      day.id,
      day.businessDate
    );

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    const records = await getOutstandingRecordsForCustomer(customer.id);
    const forDay = records.filter(
      (r) => r.businessDayId?.toString() === day.id
    );

    // Cashier-facing rule: one Outstanding debt event per customer per Business Day.
    // Internal source lines may exist, but customer+day must collapse to one balance movement.
    const timeline = await customerTimeline(customer.id);
    const dayCards = timeline.filter(
      (item) =>
        item.kind === "BUSINESS_DAY_SUMMARY" && item.businessDayId === day.id
    );
    expect(
      dayCards.length,
      "Customer Timeline must show exactly one Business Day Closed card per day"
    ).toBe(1);
    expect(dayCards[0].businessDaySummary?.todaysDue).toBe(210);
    expect(dayCards[0].outstandingBalance ?? dayCards[0].businessDaySummary?.currentOutstanding).toBe(
      210
    );

    const distinctCustomers = new Set(
      (await getOutstandingRecordsForBusinessDay(day.id)).map((r) =>
        r.customerId.toString()
      )
    );
    expect(
      distinctCustomers.size,
      "Exactly one customer should receive Outstanding for this isolated day"
    ).toBe(1);
    expect(distinctCustomers.has(customer.id)).toBe(true);

    // Strict record rule: one Outstanding document per customer per Business Day.
    expect(
      forDay.length,
      `Expected exactly 1 Outstanding document for customer+day (got ${forDay.length}). ` +
        `Multiple source-linked rows leak implementation detail forbidden by Business Day History rules.`
    ).toBe(1);
    expect(forDay[0].originalAmount).toBe(210);
    expect(forDay[0].remainingAmount).toBe(210);
  });

  test("9. Closing the same Business Day must never create duplicate Outstanding", async () => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("NoDup");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 160,
      received: 40,
      paymentMethod: "CASH",
    });

    const first = await closeOpenBusinessDay(staff);
    expect(first.status, `First close should succeed: ${JSON.stringify(first)}`).toBe(
      "SUCCESS"
    );

    const afterFirst = await getOutstandingRecordsForBusinessDay(day.id);
    const firstCount = afterFirst.length;
    const firstTotal = afterFirst.reduce((sum, r) => sum + r.originalAmount, 0);
    expect(firstTotal).toBe(120);

    const second = await closeOpenBusinessDay(staff);
    expect(
      second.status,
      `Second close must be ALREADY_CLOSED, got ${JSON.stringify(second)}`
    ).toBe("ALREADY_CLOSED");

    const afterSecond = await getOutstandingRecordsForBusinessDay(day.id);
    expect(
      afterSecond.length,
      "Re-closing a CLOSED Business Day must not insert more Outstanding rows"
    ).toBe(firstCount);
    expect(
      afterSecond.reduce((sum, r) => sum + r.originalAmount, 0),
      "Outstanding totals must be unchanged after duplicate close attempt"
    ).toBe(firstTotal);

    expect(await customerOutstandingBalance(customer.id)).toBe(120);
  });

  test("10. Customer Timeline, Outstanding, Balance History and Business Day History must remain financially consistent", async ({
    page,
  }) => {
    const day = await prepareOpenDay();
    const customer = await createTestCustomer("Consistent");
    await track(customer);

    const frameAmount = 160;
    const frameReceived = 60;
    const cafeAmount = 40;
    const cafeReceived = 0;
    const expectedDue =
      frameAmount - frameReceived + (cafeAmount - cafeReceived);
    const expectedBill = frameAmount + cafeAmount;
    const expectedReceived = frameReceived + cafeReceived;

    await createFrameForCustomer(staff, customer, {
      amount: frameAmount,
      received: frameReceived,
      paymentMethod: "CASH",
    });
    await createCafeOrderForCustomer(
      staff,
      customer,
      { amount: cafeAmount, received: cafeReceived },
      day.id,
      day.businessDate
    );

    const result = await closeOpenBusinessDay(staff);
    expect(result.status, `Close should succeed: ${JSON.stringify(result)}`).toBe(
      "SUCCESS"
    );

    const outstandingBalance = await customerOutstandingBalance(customer.id);
    const timeline = await customerTimeline(customer.id);
    const history = await businessDayHistory(day.id);

    expect(outstandingBalance, "Outstanding balance API").toBe(expectedDue);
    expect(history!.summary.outstandingCreated, "History Outstanding Created").toBe(
      expectedDue
    );
    expect(history!.summary.todaysBill, "History Bill").toBe(expectedBill);
    expect(history!.summary.totalReceived, "History Received").toBe(expectedReceived);

    const dayCard = timeline.find(
      (item) =>
        item.kind === "BUSINESS_DAY_SUMMARY" && item.businessDayId === day.id
    );
    expect(dayCard, "Timeline Business Day card missing").toBeTruthy();
    expect(dayCard!.businessDaySummary?.todaysBill).toBe(expectedBill);
    expect(dayCard!.businessDaySummary?.todaysPayment).toBe(expectedReceived);
    expect(dayCard!.businessDaySummary?.todaysDue).toBe(expectedDue);

    const balanceHistoryEvents = timeline.filter((item) => {
      if (item.kind === "BUSINESS_DAY_SUMMARY") {
        return (item.businessDaySummary?.todaysDue ?? 0) > 0;
      }
      return (
        item.kind === "OUTSTANDING_COLLECTED" ||
        item.kind === "OUTSTANDING_PARTIALLY_COLLECTED"
      );
    });
    expect(
      balanceHistoryEvents.some((item) => item.businessDayId === day.id),
      "Balance History filter must include this unpaid Business Day"
    ).toBe(true);

    // UI consistency — same figures on Customer page + Business Day History.
    await loginAsStaff(page);
    await page.goto(`/customers/${customer.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: /Customer Timeline/i })
    ).toBeVisible({ timeout: 30_000 });

    const outstandingRow = page.locator("dt", { hasText: "Outstanding" }).locator("..");
    await expect(
      outstandingRow.getByText(currencyText(expectedDue), { exact: true }),
      `Customer summary Outstanding should show ${currencyText(expectedDue)}`
    ).toBeVisible();

    await page.getByRole("tab", { name: /Balance History/i }).click();
    await expect(
      page.getByText(currencyText(expectedDue)).first(),
      "Balance History should surface Today's Due / Outstanding movement"
    ).toBeVisible();

    await page.goto(`/business-day/history/${day.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText(/Outstanding Created/i).first()
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(currencyText(expectedDue)).first(),
      `Business Day History Outstanding Created should be ${currencyText(expectedDue)}`
    ).toBeVisible();
  });
});
