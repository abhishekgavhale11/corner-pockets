import "../helpers/env";
import { test, expect } from "@playwright/test";
import { resetE2eDatabase, disconnectTestDb } from "../helpers/db";
import {
  bootstrapTestWorld,
  businessDayHistory,
  cleanupCustomers,
  closeOpenBusinessDay,
  collectOutstandingForTestCustomer,
  createCafeOrderForCustomer,
  createFrameForCustomer,
  createTestCustomer,
  customerOutstandingBalance,
  customerTimeline,
  getOutstandingRecordsForBusinessDay,
  getOutstandingRecordsForCustomer,
  openFreshBusinessDay,
  reopenClosedBusinessDay,
  type TestCustomer,
  type TestStaff,
} from "../helpers/financial-integrity";
import { getBusinessDayFinalSummary } from "../../src/lib/financial-summary";
import { getCustomerLifetimeStats } from "../../src/lib/customers/lifetime-stats";
import { getClosedBusinessDayHistoryList } from "../../src/lib/business-day/history";
import { buildDetailHistoryInsights } from "../../src/lib/business-day/history-insights";
import BusinessDayFinalSummary from "../../src/models/BusinessDayFinalSummary";
import BusinessDay from "../../src/models/BusinessDay";

/**
 * Business Day Final Summary — cross-screen financial integrity.
 * Proves one finalized truth after Close across History, Performance,
 * Timeline, Lifetime Paid, and the Final Summary document.
 */

test.describe.configure({ mode: "serial" });

function assertMoneyEqual(
  label: string,
  actual: number,
  expected: number
): void {
  expect(actual, label).toBe(expected);
}

async function assertScreensAgree(input: {
  businessDayId: string;
  customerId: string;
  expected: {
    bill: number;
    paid: number;
    cash: number;
    gpay: number;
    outstandingCreated: number;
    outstandingCollected: number;
    customerBill: number;
    customerPaid: number;
    customerCash: number;
    customerGpay: number;
    customerDue: number;
  };
}) {
  const finalSummary = await getBusinessDayFinalSummary(input.businessDayId);
  expect(finalSummary, "Final Summary must exist after Close").not.toBeNull();
  if (!finalSummary) return;

  const history = await businessDayHistory(input.businessDayId);
  expect(history, "History detail must load").not.toBeNull();
  if (!history) return;

  const insights = buildDetailHistoryInsights(history);
  const list = await getClosedBusinessDayHistoryList({ limit: 50 });
  const listItem = list.items.find((row) => row.id === input.businessDayId);
  expect(listItem, "History list must include closed day").toBeTruthy();

  const timeline = await customerTimeline(input.customerId);
  const dayCard = timeline.find(
    (item) =>
      item.kind === "BUSINESS_DAY_SUMMARY" &&
      item.businessDayId === input.businessDayId
  );
  expect(dayCard?.businessDaySummary, "Timeline day card required").toBeTruthy();
  const tl = dayCard!.businessDaySummary!;

  const lifetime = await getCustomerLifetimeStats(input.customerId);
  const customerRow = finalSummary.customers.find(
    (row) => row.customerId === input.customerId
  );
  expect(customerRow, "Customer settlement in Final Summary").toBeTruthy();

  // --- Day totals: Final Summary === History === Performance insights === List ---
  assertMoneyEqual("FS.bill", finalSummary.bill, input.expected.bill);
  assertMoneyEqual("History.bill", history.summary.todaysBill, input.expected.bill);
  assertMoneyEqual("Insights.revenue", insights.overall.totalRevenue, input.expected.bill);
  assertMoneyEqual("List.bill", listItem!.todaysBill, input.expected.bill);

  assertMoneyEqual("FS.paid", finalSummary.paid, input.expected.paid);
  assertMoneyEqual("History.paid", history.summary.totalReceived, input.expected.paid);
  assertMoneyEqual("Insights.received", insights.overall.totalReceived, input.expected.paid);
  assertMoneyEqual("List.paid", listItem!.totalReceived, input.expected.paid);

  assertMoneyEqual("FS.cash", finalSummary.cashCollection, input.expected.cash);
  assertMoneyEqual("History.cash", history.summary.cashCollection, input.expected.cash);
  assertMoneyEqual("Insights.cash", insights.overall.cashCollection, input.expected.cash);

  assertMoneyEqual("FS.gpay", finalSummary.gpayCollection, input.expected.gpay);
  assertMoneyEqual("History.gpay", history.summary.gpayCollection, input.expected.gpay);
  assertMoneyEqual("Insights.gpay", insights.overall.gpayCollection, input.expected.gpay);

  assertMoneyEqual(
    "FS.outstandingCreated",
    finalSummary.outstandingCreated,
    input.expected.outstandingCreated
  );
  assertMoneyEqual(
    "History.outstandingCreated",
    history.summary.outstandingCreated,
    input.expected.outstandingCreated
  );
  assertMoneyEqual(
    "Insights.outstandingCreated",
    insights.overall.outstandingCreated,
    input.expected.outstandingCreated
  );
  assertMoneyEqual(
    "List.outstandingCreated",
    listItem!.outstandingCreated,
    input.expected.outstandingCreated
  );

  assertMoneyEqual(
    "FS.outstandingCollected",
    finalSummary.outstandingCollected,
    input.expected.outstandingCollected
  );
  assertMoneyEqual(
    "History.trend.recovered",
    history.outstandingTrend.outstandingRecovered,
    input.expected.outstandingCollected
  );
  assertMoneyEqual(
    "List.outstandingRecovered",
    listItem!.outstandingRecovered,
    input.expected.outstandingCollected
  );

  // Settlements on History === Final Summary customers
  const settlement = history.settlements.find(
    (row) => row.customerId === input.customerId
  );
  expect(settlement).toBeTruthy();
  assertMoneyEqual("Settlement.bill", settlement!.bill, input.expected.customerBill);
  assertMoneyEqual("Settlement.received", settlement!.received, input.expected.customerPaid);
  assertMoneyEqual("Settlement.cash", settlement!.cashCollection, input.expected.customerCash);
  assertMoneyEqual("Settlement.gpay", settlement!.gpayCollection, input.expected.customerGpay);
  assertMoneyEqual("Settlement.due", settlement!.due, input.expected.customerDue);

  // Timeline customer-day === Final Summary customer row
  assertMoneyEqual("Timeline.bill", tl.todaysBill, input.expected.customerBill);
  assertMoneyEqual("Timeline.paid", tl.todaysPayment, input.expected.customerPaid);
  assertMoneyEqual("Timeline.cash", tl.paymentSummary.cash, input.expected.customerCash);
  assertMoneyEqual("Timeline.gpay", tl.paymentSummary.gpay, input.expected.customerGpay);
  assertMoneyEqual("Timeline.due", tl.todaysDue, input.expected.customerDue);

  // Lifetime Paid includes this day's customer received (+ any collections later)
  expect(lifetime.lifetimePaid).toBeGreaterThanOrEqual(input.expected.customerPaid);
  expect(lifetime.totalVisits).toBeGreaterThanOrEqual(1);

  return { finalSummary, history, tl, lifetime };
}

test.describe("Business Day Final Summary integrity", () => {
  let staff: TestStaff;
  let tracked: string[] = [];

  async function track(...customers: TestCustomer[]) {
    for (const c of customers) tracked.push(c.id);
  }

  test.beforeAll(async () => {
    await resetE2eDatabase();
    staff = await bootstrapTestWorld();
  });

  test.afterEach(async () => {
    const ids = [...new Set(tracked)];
    tracked = [];
    await cleanupCustomers(ids);
  });

  test.afterAll(async () => {
    await disconnectTestDb();
  });

  test("Scenario A — fully paid single Cash frame: screens agree, no Outstanding", async () => {
    await openFreshBusinessDay(staff);
    const customer = await createTestCustomer("FS_FullCash");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 160,
      received: 160,
      paymentMethod: "CASH",
    });

    const close = await closeOpenBusinessDay(staff);
    expect(close.status).toBe("SUCCESS");
    if (close.status !== "SUCCESS") return;

    const dayId = close.day.id;
    await assertScreensAgree({
      businessDayId: dayId,
      customerId: customer.id,
      expected: {
        bill: 160,
        paid: 160,
        cash: 160,
        gpay: 0,
        outstandingCreated: 0,
        outstandingCollected: 0,
        customerBill: 160,
        customerPaid: 160,
        customerCash: 160,
        customerGpay: 0,
        customerDue: 0,
      },
    });

    expect(await customerOutstandingBalance(customer.id)).toBe(0);
    expect(await getOutstandingRecordsForBusinessDay(dayId)).toHaveLength(0);
  });

  test("Scenario B — unpaid frame: Outstanding Created, screens agree", async () => {
    await openFreshBusinessDay(staff);
    const customer = await createTestCustomer("FS_Unpaid");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 180,
      received: 0,
    });

    const close = await closeOpenBusinessDay(staff);
    expect(close.status).toBe("SUCCESS");
    if (close.status !== "SUCCESS") return;

    const dayId = close.day.id;
    await assertScreensAgree({
      businessDayId: dayId,
      customerId: customer.id,
      expected: {
        bill: 180,
        paid: 0,
        cash: 0,
        gpay: 0,
        outstandingCreated: 180,
        outstandingCollected: 0,
        customerBill: 180,
        customerPaid: 0,
        customerCash: 0,
        customerGpay: 0,
        customerDue: 180,
      },
    });

    expect(await customerOutstandingBalance(customer.id)).toBe(180);
    const rows = await getOutstandingRecordsForBusinessDay(dayId);
    expect(rows).toHaveLength(1);
    expect(rows[0].originalAmount).toBe(180);
    expect(rows[0].remainingAmount).toBe(180);
  });

  test("Scenario C — split payment Cash+GPay: screens agree, paymentMethod null OK", async () => {
    const openDay = await openFreshBusinessDay(staff);
    const customer = await createTestCustomer("FS_SplitPay");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 160,
      received: 160,
      paymentAllocations: [
        { paymentMethod: "CASH", amount: 80 },
        { paymentMethod: "GPAY", amount: 80 },
      ],
    });
    await createCafeOrderForCustomer(
      staff,
      customer,
      { amount: 40, received: 40, paymentMethod: "GPAY" },
      openDay.id,
      openDay.businessDate
    );

    const close = await closeOpenBusinessDay(staff);
    expect(close.status).toBe("SUCCESS");
    if (close.status !== "SUCCESS") return;

    await assertScreensAgree({
      businessDayId: close.day.id,
      customerId: customer.id,
      expected: {
        bill: 200,
        paid: 200,
        cash: 80,
        gpay: 120,
        outstandingCreated: 0,
        outstandingCollected: 0,
        customerBill: 200,
        customerPaid: 200,
        customerCash: 80,
        customerGpay: 120,
        customerDue: 0,
      },
    });
  });

  test("Scenario D — partial pay after Close: Final Summary immutable, Remaining updates", async () => {
    await openFreshBusinessDay(staff);
    const customer = await createTestCustomer("FS_PartialLater");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 200,
      received: 0,
    });

    const close = await closeOpenBusinessDay(staff);
    expect(close.status).toBe("SUCCESS");
    if (close.status !== "SUCCESS") return;
    const dayId = close.day.id;

    const before = await getBusinessDayFinalSummary(dayId);
    expect(before?.outstandingCreated).toBe(200);
    expect(before?.bill).toBe(200);
    expect(before?.paid).toBe(0);

    const remainingAfter = await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 75,
      paymentMethod: "CASH",
      staff,
    });
    expect(remainingAfter).toBe(125);
    expect(await customerOutstandingBalance(customer.id)).toBe(125);

    const after = await getBusinessDayFinalSummary(dayId);
    expect(after).toEqual(before);

    const history = await businessDayHistory(dayId);
    expect(history?.summary.outstandingCreated).toBe(200);
    expect(history?.summary.todaysBill).toBe(200);
    expect(history?.summary.totalReceived).toBe(0);

    const lifetime = await getCustomerLifetimeStats(customer.id);
    // Day paid 0 + collection 75
    expect(lifetime.lifetimePaid).toBe(75);
  });

  test("Scenario E — full Outstanding pay days later: History Created unchanged", async () => {
    await openFreshBusinessDay(staff);
    const customer = await createTestCustomer("FS_FullLater");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 150,
      received: 50,
      paymentMethod: "GPAY",
    });

    const close = await closeOpenBusinessDay(staff);
    expect(close.status).toBe("SUCCESS");
    if (close.status !== "SUCCESS") return;
    const dayId = close.day.id;

    const snapshot = await getBusinessDayFinalSummary(dayId);
    expect(snapshot?.outstandingCreated).toBe(100);
    expect(snapshot?.paid).toBe(50);
    expect(snapshot?.gpayCollection).toBe(50);

    await openFreshBusinessDay(staff);
    await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 100,
      paymentMethod: "GPAY",
      staff,
    });
    expect(await customerOutstandingBalance(customer.id)).toBe(0);

    const still = await getBusinessDayFinalSummary(dayId);
    expect(still?.outstandingCreated).toBe(100);
    expect(still?.paid).toBe(50);
    expect(still?.gpayCollection).toBe(50);

    const history = await businessDayHistory(dayId);
    expect(history?.summary.outstandingCreated).toBe(100);
    expect(history?.summary.totalReceived).toBe(50);
  });

  test("Scenario F — multiple Outstanding across Business Days", async () => {
    const customer = await createTestCustomer("FS_MultiOS");
    await track(customer);

    await openFreshBusinessDay(staff);
    await createFrameForCustomer(staff, customer, {
      amount: 100,
      received: 0,
    });
    const close1 = await closeOpenBusinessDay(staff);
    expect(close1.status).toBe("SUCCESS");
    if (close1.status !== "SUCCESS") return;

    await openFreshBusinessDay(staff);
    await createFrameForCustomer(staff, customer, {
      amount: 80,
      received: 0,
    });
    const close2 = await closeOpenBusinessDay(staff);
    expect(close2.status).toBe("SUCCESS");
    if (close2.status !== "SUCCESS") return;

    expect(await customerOutstandingBalance(customer.id)).toBe(180);
    const all = await getOutstandingRecordsForCustomer(customer.id);
    expect(all.filter((r) => r.sourceType !== "OPENING")).toHaveLength(2);

    await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 100,
      paymentMethod: "CASH",
      staff,
    });
    expect(await customerOutstandingBalance(customer.id)).toBe(80);

    const fs1 = await getBusinessDayFinalSummary(close1.day.id);
    const fs2 = await getBusinessDayFinalSummary(close2.day.id);
    expect(fs1?.outstandingCreated).toBe(100);
    expect(fs2?.outstandingCreated).toBe(80);

    const h1 = await businessDayHistory(close1.day.id);
    const h2 = await businessDayHistory(close2.day.id);
    expect(h1?.summary.outstandingCreated).toBe(100);
    expect(h2?.summary.outstandingCreated).toBe(80);
  });

  test("Scenario G — reopen deletes Final Summary + Outstanding; re-close regenerates cleanly", async () => {
    await openFreshBusinessDay(staff);
    const customer = await createTestCustomer("FS_Reopen");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 120,
      received: 0,
    });

    const close1 = await closeOpenBusinessDay(staff);
    expect(close1.status).toBe("SUCCESS");
    if (close1.status !== "SUCCESS") return;
    const dayId = close1.day.id;

    expect(await getBusinessDayFinalSummary(dayId)).not.toBeNull();
    expect(await getOutstandingRecordsForBusinessDay(dayId)).toHaveLength(1);

    await reopenClosedBusinessDay(dayId, staff);
    const day = await BusinessDay.findById(dayId).lean();
    expect(day?.status).toBe("OPEN");
    expect(await getBusinessDayFinalSummary(dayId)).toBeNull();
    expect(await getOutstandingRecordsForBusinessDay(dayId)).toHaveLength(0);
    expect(await BusinessDayFinalSummary.countDocuments({ businessDayId: dayId })).toBe(
      0
    );

    // Editable: add another payment then close again
    await createFrameForCustomer(staff, customer, {
      amount: 40,
      received: 40,
      paymentMethod: "CASH",
    });

    const close2 = await closeOpenBusinessDay(staff);
    expect(close2.status).toBe("SUCCESS");
    if (close2.status !== "SUCCESS") return;

    expect(close2.day.id).toBe(dayId);
    const fs = await getBusinessDayFinalSummary(dayId);
    expect(fs).not.toBeNull();
    expect(fs?.bill).toBe(160);
    expect(fs?.paid).toBe(40);
    expect(fs?.outstandingCreated).toBe(120);
    expect(fs?.cashCollection).toBe(40);

    const outstanding = await getOutstandingRecordsForBusinessDay(dayId);
    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].originalAmount).toBe(120);

    // No duplicate Final Summary
    expect(
      await BusinessDayFinalSummary.countDocuments({ businessDayId: dayId })
    ).toBe(1);
  });

  test("Scenario H — engine-only: History money matches Final Summary document fields exactly", async () => {
    await openFreshBusinessDay(staff);
    const customer = await createTestCustomer("FS_EngineOnly");
    await track(customer);

    await createFrameForCustomer(staff, customer, {
      amount: 90,
      received: 90,
      paymentMethod: "GPAY",
      section: "POOL_1",
    });
    await createFrameForCustomer(staff, customer, {
      amount: 100,
      received: 40,
      paymentMethod: "CASH",
    });

    const close = await closeOpenBusinessDay(staff);
    expect(close.status).toBe("SUCCESS");
    if (close.status !== "SUCCESS") return;

    const fs = await getBusinessDayFinalSummary(close.day.id);
    const history = await businessDayHistory(close.day.id);
    expect(fs && history).toBeTruthy();
    if (!fs || !history) return;

    expect(history.summary).toMatchObject({
      todaysBill: fs.bill,
      totalReceived: fs.paid,
      cashCollection: fs.cashCollection,
      gpayCollection: fs.gpayCollection,
      outstandingCreated: fs.outstandingCreated,
      closingOutstanding: fs.closingOutstanding,
    });
    expect(history.gamesSummary).toMatchObject({
      bill: fs.snooker.bill,
      received: fs.snooker.received,
      cashCollection: fs.snooker.cashCollection,
      gpayCollection: fs.snooker.gpayCollection,
    });
    expect(history.insights.bigSnooker).toMatchObject({
      bill: fs.bigSnooker.bill,
      cashCollection: fs.bigSnooker.cashCollection,
      gpayCollection: fs.bigSnooker.gpayCollection,
    });
    expect(history.insights.poolMini).toMatchObject({
      bill: fs.poolMini.bill,
      cashCollection: fs.poolMini.cashCollection,
      gpayCollection: fs.poolMini.gpayCollection,
    });
  });
});
