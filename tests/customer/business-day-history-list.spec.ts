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
  openFreshBusinessDay,
  type TestCustomer,
  type TestStaff,
} from "../helpers/financial-integrity";
import { getClosedBusinessDayHistoryList } from "../../src/lib/business-day/history";
import { getBusinessDate } from "../../src/lib/utils/business-date";

/**
 * Business Day History list: product columns expose existing engines only.
 * Revenue = Business Collection + Outstanding Created
 * Recovered matches detail tab; Total Outstanding = closing club balance.
 */

test.describe.configure({ mode: "serial" });

test.describe("Business Day History list financial story", () => {
  let staff: TestStaff;
  let tracked: string[] = [];

  test.beforeAll(async () => {
    await resetE2eDatabase();
    staff = await bootstrapTestWorld();
  });

  test.afterEach(async () => {
    await cleanupCustomers(tracked);
    tracked = [];
  });

  test.afterAll(async () => {
    await cleanupCustomers(tracked);
    await disconnectTestDb();
  });

  test("list row identity + Recovered matches detail tab", async () => {
    const customer = await createTestCustomer("HistList");
    tracked.push(customer.id);

    await createOpeningOutstandingForCustomer({
      customerId: customer.id,
      amount: 5000,
      createdBy: staff.username,
    });

    const day1 = await openFreshBusinessDay(staff);
    await createFrameForCustomer(staff, customer, {
      amount: 1200,
      received: 0,
    });
    const closed1 = await closeOpenBusinessDay(staff);
    expect(closed1.status).toBe("SUCCESS");

    const day2 = await openFreshBusinessDay(staff);
    await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 2000,
      paymentMethod: "CASH",
      staff,
    });
    await createFrameForCustomer(staff, customer, {
      amount: 800,
      received: 200,
      paymentMethod: "CASH",
    });
    const closed2 = await closeOpenBusinessDay(staff);
    expect(closed2.status).toBe("SUCCESS");

    const today = getBusinessDate();
    const list = await getClosedBusinessDayHistoryList({
      from: today,
      to: today,
      limit: 50,
    });

    const row1 = list.items.find((item) => item.id === day1.id);
    const row2 = list.items.find((item) => item.id === day2.id);
    expect(row1, "BD1 list row").toBeTruthy();
    expect(row2, "BD2 list row").toBeTruthy();

    // Revenue = Business Collection + Outstanding Created
    expect(row1!.todaysBill).toBe(row1!.totalReceived + row1!.outstandingCreated);
    expect(row2!.todaysBill).toBe(row2!.totalReceived + row2!.outstandingCreated);

    expect(row1!.todaysBill).toBe(1200);
    expect(row1!.totalReceived).toBe(0);
    expect(row1!.outstandingCreated).toBe(1200);
    expect(row1!.outstandingRecovered).toBe(0);
    expect(row1!.closingOutstanding).toBe(6200);

    expect(row2!.todaysBill).toBe(800);
    expect(row2!.totalReceived).toBe(200);
    expect(row2!.outstandingCreated).toBe(600);
    // Recovered still computed for range Outstanding Movement — not a list column.
    expect(row2!.outstandingRecovered).toBe(2000);
    expect(row2!.closingOutstanding).toBe(4800); // 6200 + 600 - 2000

    const detail1 = await businessDayHistory(day1.id);
    const detail2 = await businessDayHistory(day2.id);
    expect(detail1?.outstandingTrend.outstandingRecovered).toBe(
      row1!.outstandingRecovered
    );
    expect(detail2?.outstandingTrend.outstandingRecovered).toBe(
      row2!.outstandingRecovered
    );
    expect(detail1?.outstandingTrend.closingOutstanding).toBe(
      row1!.closingOutstanding
    );
    expect(detail2?.outstandingTrend.closingOutstanding).toBe(
      row2!.closingOutstanding
    );

    // Report-range Recovered = collections in calendar bounds (includes day2 window).
    expect(list.summary.outstandingRecovered).toBe(2000);

    // Club Outstanding (End of Day) stays historical per closed day.
    expect(row1!.closingOutstanding).toBe(6200);
    expect(row2!.closingOutstanding).toBe(4800);
  });

  test("report-range Recovered counts collection between Business Days", async () => {
    await resetE2eDatabase();
    staff = await bootstrapTestWorld();
    tracked = [];

    const customer = await createTestCustomer("HistGapRecover");
    tracked.push(customer.id);

    await createOpeningOutstandingForCustomer({
      customerId: customer.id,
      amount: 570,
      createdBy: staff.username,
    });

    const day3 = await openFreshBusinessDay(staff);
    const closed3 = await closeOpenBusinessDay(staff);
    expect(closed3.status).toBe("SUCCESS");

    // Collect AFTER close, BEFORE next open — gap between Business Days.
    await collectOutstandingForTestCustomer({
      customerId: customer.id,
      receivedAmount: 300,
      paymentMethod: "CASH",
      staff,
    });

    const day4 = await openFreshBusinessDay(staff);
    await createFrameForCustomer(staff, customer, {
      amount: 600,
      received: 0,
    });
    const closed4 = await closeOpenBusinessDay(staff);
    expect(closed4.status).toBe("SUCCESS");

    const today = getBusinessDate();
    const list = await getClosedBusinessDayHistoryList({
      from: today,
      to: today,
      limit: 50,
    });

    const row3 = list.items.find((item) => item.id === day3.id);
    const row4 = list.items.find((item) => item.id === day4.id);
    expect(row3, "BD3 list row").toBeTruthy();
    expect(row4, "BD4 list row").toBeTruthy();

    expect(row4!.outstandingCreated).toBe(600);
    expect(row4!.closingOutstanding).toBe(870); // 570 - 300 + 600

    // Per-day detail window still excludes the gap (unchanged by this fix).
    expect(row3!.outstandingRecovered).toBe(0);
    expect(row4!.outstandingRecovered).toBe(0);

    // Report summary Recovered uses calendar bounds — includes the ₹300 gap.
    expect(list.summary.outstandingRecovered).toBe(300);
  });
});
