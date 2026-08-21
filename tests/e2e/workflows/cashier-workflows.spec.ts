import "../../helpers/env";
import { test, expect } from "@playwright/test";
import { resetE2eDatabase, disconnectTestDb } from "../../helpers/db";
import {
  bootstrapTestWorld,
  businessDayHistory,
  customerOutstandingBalance,
  customerTimeline,
} from "../../helpers/financial-integrity";
import {
  customerIdFromUrl,
  uniqueCustomerName,
  uiAddCafeOrderWithWater,
  uiAddSinglesFrameOnTable1,
  uiAssignUnassignedFrameToCustomer,
  uiCancelClosePreview,
  uiCloseBusinessDay,
  uiCollectOutstanding,
  uiCreateCustomerFromCounter,
  uiCurrency,
  uiEditCafeOrderBill,
  uiEditFrameAmount,
  uiExpectBusinessDayOpen,
  uiExpectClosePreviewTotals,
  uiExpectCustomerInList,
  uiExpectCustomerSearchableOnCounter,
  uiExpectHistoryOutstandingCreated,
  uiExpectOutstanding,
  uiExpectTimelineDue,
  uiGoToBigSnooker,
  uiLogin,
  uiOpenBusinessDayHistoryFromTimeline,
  uiOpenClosePreview,
  uiOpenCustomerBySearch,
  uiSetFrameCashGpaySplit,
  uiSetFramePayment,
  uiStartBusinessDayIfNeeded,
} from "../../helpers/ui-cashier";
import { openBusinessDay } from "../../../src/lib/business-day/open-business-day";
import {
  getBusinessDate,
  parseBusinessDateInput,
} from "../../../src/lib/utils/business-date";
import Customer from "../../../src/models/Customer";

/**
 * CPOS cashier E2E workflows — UI → persistence → Financial Summary.
 * Each scenario resets the e2e DB and is independently runnable via -g.
 *
 * Run suite:
 *   npm run test:e2e:workflows
 *   npx playwright test tests/e2e/workflows --grep "Scenario 3"
 */

test.describe.configure({ mode: "serial" });

test.describe("CPOS cashier workflows", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await resetE2eDatabase();
    await bootstrapTestWorld();
    await uiLogin(page);
  });

  test.afterAll(async () => {
    await disconnectTestDb().catch(() => undefined);
  });

  test("Scenario 1 – Open Business Day is ACTIVE and Start is blocked", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    await expect(
      page.getByRole("button", { name: "+ Add Frame" }).first()
    ).toBeVisible();

    await uiExpectBusinessDayOpen(page);

    // Counter stays open — another Start Business Day control must not appear.
    await page.goto("/counter/big-snooker", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Business Day has not been started." })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start Business Day" })
    ).toHaveCount(0);

    // Engine-level guard: opening a second Business Day must be rejected
    // while one is already OPEN (single active Business Day invariant).
    await expect(
      openBusinessDay({
        businessDate: parseBusinessDateInput(getBusinessDate()),
        openingCash: 0,
        openedBy: "abhishek",
      })
    ).rejects.toThrow(/already OPEN/i);
  });

  test("Scenario 2 – Customer Registration appears in List and Counter", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("Reg");

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );

    await uiExpectCustomerInList(page, customer.fullName);
    await uiExpectCustomerSearchableOnCounter(page, customer.fullName);

    // MongoDB persistence: customer document exists, active, correctly named.
    const customerDoc = await Customer.findOne({ name: customer.fullName }).lean();
    expect(customerDoc, "Customer must be persisted to MongoDB").toBeTruthy();
    expect(customerDoc?.isActive).toBe(true);
    expect(customerDoc?.firstName).toBe(customer.firstName);
    expect(customerDoc?.lastName).toBe(customer.lastName);
  });

  test("Scenario 3 – Frame only + full Cash payment → Due 0, Outstanding 0", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("FrameFull");
    const frameAmount = 160;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, frameAmount, "Cash");

    await uiOpenClosePreview(page);
    await uiExpectClosePreviewTotals(page, {
      cash: frameAmount,
      gpay: 0,
      totalPaid: frameAmount,
      outstandingCreated: 0,
    });
    await uiCancelClosePreview(page);

    await uiCloseBusinessDay(page);

    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, 0);
    await uiExpectTimelineDue(page, 0);

    expect(await customerOutstandingBalance(customerId)).toBe(0);

    await page.getByRole("tab", { name: /All Activity/i }).click();
    await expect(page.getByText("Business Day Closed").first()).toBeVisible();
    await expect(page.getByText(/Paid in Full/i).first()).toBeVisible();
  });

  test("Scenario 4 – Frame + Cafe + full payment updates Business Summary", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("FrameCafe");
    const frameAmount = 160;
    const cafeAmount = 20;
    const bill = frameAmount + cafeAmount;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, frameAmount, "Cash");
    await uiAddCafeOrderWithWater(page, customer.fullName, {
      received: cafeAmount,
      paymentMode: "GPay",
    });

    await uiGoToBigSnooker(page);
    await uiOpenClosePreview(page);
    await uiExpectClosePreviewTotals(page, {
      cash: frameAmount,
      gpay: cafeAmount,
      totalPaid: bill,
      outstandingCreated: 0,
    });
    await uiCancelClosePreview(page);

    await uiCloseBusinessDay(page);
    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, 0);
    await uiExpectTimelineDue(page, 0);

    // MongoDB: Financial Summary Engine agrees with the UI — ₹0 Outstanding.
    expect(await customerOutstandingBalance(customerId)).toBe(0);

    await uiOpenBusinessDayHistoryFromTimeline(page);
    await uiExpectHistoryOutstandingCreated(page, 0);
    await expect(page.getByText(uiCurrency(bill)).first()).toBeVisible();
  });

  test("Scenario 5 – Partial payment creates Outstanding after Close", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("Partial");
    const frameAmount = 160;
    const received = 60;
    const due = frameAmount - received;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, received, "Cash");

    await uiOpenClosePreview(page);
    await uiExpectClosePreviewTotals(page, {
      cash: received,
      gpay: 0,
      totalPaid: received,
      outstandingCreated: due,
    });
    await uiCancelClosePreview(page);

    await uiCloseBusinessDay(page);

    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, due);
    await uiExpectTimelineDue(page, due);
    expect(await customerOutstandingBalance(customerId)).toBe(due);

    await uiOpenBusinessDayHistoryFromTimeline(page);
    await uiExpectHistoryOutstandingCreated(page, due);
  });

  test("Scenario 6 – No payment → Outstanding Created equals Bill", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("Unpaid");
    const frameAmount = 160;
    const cafeAmount = 20;
    const due = frameAmount + cafeAmount;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiAddCafeOrderWithWater(page, customer.fullName);

    await uiGoToBigSnooker(page);
    await uiCloseBusinessDay(page);

    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, due);
    expect(await customerOutstandingBalance(customerId)).toBe(due);

    await uiOpenBusinessDayHistoryFromTimeline(page);
    await uiExpectHistoryOutstandingCreated(page, due);
  });

  test("Scenario 9 – Cash + GPay multiple payments update Business Summary", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("SplitPay");
    const frameAmount = 160;
    const cash = 100;
    const gpay = 60;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFrameCashGpaySplit(
      page,
      customer.fullName,
      frameAmount,
      cash,
      gpay
    );

    await uiOpenClosePreview(page);
    await uiExpectClosePreviewTotals(page, {
      cash,
      gpay,
      totalPaid: frameAmount,
      outstandingCreated: 0,
    });
    await uiCancelClosePreview(page);

    await uiCloseBusinessDay(page);
    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, 0);
    expect(await customerOutstandingBalance(customerId)).toBe(0);

    await uiOpenBusinessDayHistoryFromTimeline(page);
    await expect(page.getByText(uiCurrency(cash)).first()).toBeVisible();
    await expect(page.getByText(uiCurrency(gpay)).first()).toBeVisible();

    // Business Summary (History detail) payment-method split matches allocation exactly.
    const href = page.url();
    const dayId = href.match(/\/business-day\/history\/([a-f0-9]+)/i)?.[1];
    expect(dayId).toBeTruthy();
    const history = await businessDayHistory(dayId!);
    expect(history?.summary.cashCollection).toBe(cash);
    expect(history?.summary.gpayCollection).toBe(gpay);
    expect(history?.summary.totalReceived).toBe(cash + gpay);
  });

  test("Scenario 10 – Edit active charges recalculates bill", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("EditVisit");
    const initialFrame = 160;
    const editedFrame = 200;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, initialFrame);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiAddCafeOrderWithWater(page, customer.fullName);

    // Frame amount change + cafe qty / add / remove (no separate Visit entity in CPOS).
    await uiEditFrameAmount(page, customer.fullName, editedFrame, 0);
    const cafeBill = await uiEditCafeOrderBill(page, customer.fullName, {
      increaseWaterBy: 1,
      addCigarette: true,
      removeLastItem: true,
    });
    // Water 10 → qty 2 = 20; + Cigarette 30 = 50; remove last (Cigarette) → 20
    expect(cafeBill).toBe(20);

    const expectedBill = editedFrame + cafeBill;
    await uiGoToBigSnooker(page);
    await uiOpenClosePreview(page);
    await uiExpectClosePreviewTotals(page, {
      cash: 0,
      gpay: 0,
      totalPaid: 0,
      outstandingCreated: expectedBill,
    });
    await uiCancelClosePreview(page);
  });

  test("Scenario 11 – Settled payment stays unchanged after re-open Edit", async ({
    page,
  }) => {
    // CPOS has no Finish Visit control. Visit = Business Day presence.
    // This scenario verifies payment save locks the recorded Amount/Received.
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("Settled");
    const frameAmount = 160;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, frameAmount, "Cash");

    const column = page
      .locator("div.rounded-xl.border.border-gray-200.bg-white")
      .filter({
        has: page.getByRole("heading", { name: "Table 1", exact: true }),
      });
    const row = column.locator("tr").filter({ hasText: customer.fullName }).first();
    await row.getByRole("button", { name: "Edit frame" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();
    await expect(dialog.locator('input[inputmode="numeric"]').first()).toHaveValue(
      String(frameAmount)
    );
    await expect(dialog.locator("#frame-received-0")).toHaveValue(
      String(frameAmount)
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await uiCloseBusinessDay(page);
    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, 0);
    await uiExpectTimelineDue(page, 0);

    // Financial values recorded at save time are unchanged by Close.
    expect(await customerOutstandingBalance(customerId)).toBe(0);
  });

  test("Scenario 12 – Close Business Day Financial Summary", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("CloseSum");
    const frameAmount = 160;
    const cafeAmount = 20;
    const cash = 100;
    const frameDue = frameAmount - cash;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, cash, "Cash");
    await uiAddCafeOrderWithWater(page, customer.fullName, {
      received: cafeAmount,
      paymentMode: "GPay",
    });

    await uiGoToBigSnooker(page);
    await uiOpenClosePreview(page);
    await uiExpectClosePreviewTotals(page, {
      cash,
      gpay: cafeAmount,
      totalPaid: cash + cafeAmount,
      outstandingCreated: frameDue,
    });
    await page.getByRole("button", { name: "Confirm Close" }).click();
    await expect(
      page.getByRole("heading", { name: "Business Day has not been started." })
    ).toBeVisible({ timeout: 60_000 });

    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, frameDue);
    expect(await customerOutstandingBalance(customerId)).toBe(frameDue);

    await uiOpenBusinessDayHistoryFromTimeline(page);
    await uiExpectHistoryOutstandingCreated(page, frameDue);
    await expect(
      page.getByRole("heading", { name: "Customer Settlement Summary" })
    ).toBeVisible();
    await expect(page.getByText(customer.fullName).first()).toBeVisible();

    // Business Summary totals: Revenue, Cash, GPay, Outstanding Created, Customer Count.
    const href = page.url();
    const dayId = href.match(/\/business-day\/history\/([a-f0-9]+)/i)?.[1];
    expect(dayId).toBeTruthy();
    const history = await businessDayHistory(dayId!);
    expect(history?.summary.todaysBill).toBe(frameAmount + cafeAmount);
    expect(history?.summary.cashCollection).toBe(cash);
    expect(history?.summary.gpayCollection).toBe(cafeAmount);
    expect(history?.summary.outstandingCreated).toBe(frameDue);
    expect(
      history?.settlements.some((row) => row.customerId === customerId)
    ).toBe(true);
  });

  test("Scenario 13 – Customer Timeline chronological Business Day events", async ({
    page,
  }) => {
    // Timeline shows Business Day Closed / Outstanding Collected — not per-frame
    // "Visit Created" / "Frame Added" cards (those kinds are not in the UI timeline).
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("Timeline");
    const frameAmount = 160;
    const cafeAmount = 20;
    const received = 50;
    const due = frameAmount + cafeAmount - received;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, received, "Cash");
    await uiAddCafeOrderWithWater(page, customer.fullName);

    await uiGoToBigSnooker(page);
    await uiCloseBusinessDay(page);

    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());

    await page.getByRole("tab", { name: /All Activity/i }).click();
    await expect(page.getByText("Business Day Closed").first()).toBeVisible();
    await expect(page.getByText(uiCurrency(frameAmount + cafeAmount)).first()).toBeVisible();
    await expect(page.getByText(uiCurrency(received)).first()).toBeVisible();
    await expect(page.getByText(uiCurrency(due)).first()).toBeVisible();
    await expect(page.getByText(/Games/i).first()).toBeVisible();
    await expect(page.getByText(/Cafe/i).first()).toBeVisible();

    const timeline = await customerTimeline(customerId);
    expect(timeline.length).toBeGreaterThan(0);
    const closed = timeline.find((item) => item.kind === "BUSINESS_DAY_SUMMARY");
    expect(closed).toBeTruthy();
  });

  test("Scenario 14 – Outstanding Collection reduces balance and updates Timeline", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("Collect");
    const frameAmount = 160;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiCloseBusinessDay(page);

    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiExpectOutstanding(page, frameAmount);

    await uiCollectOutstanding(page, frameAmount, "Cash");
    await uiExpectOutstanding(page, 0);
    expect(await customerOutstandingBalance(customerId)).toBe(0);

    await page.getByRole("tab", { name: /All Activity/i }).click();
    await expect(page.getByText("Outstanding Collected").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(uiCurrency(frameAmount)).first()).toBeVisible();

    const timeline = await customerTimeline(customerId);
    const collected = timeline.find(
      (item) =>
        item.kind === "OUTSTANDING_COLLECTED" ||
        item.kind === "OUTSTANDING_PARTIALLY_COLLECTED"
    );
    expect(collected).toBeTruthy();
  });

  test("Scenario 15 – Business Day History matches Close Summary", async ({
    page,
  }) => {
    await uiStartBusinessDayIfNeeded(page);
    const customer = uniqueCustomerName("History");
    const frameAmount = 160;
    const cash = 160;

    await uiCreateCustomerFromCounter(
      page,
      customer.firstName,
      customer.lastName
    );
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, cash, "Cash");

    await uiOpenClosePreview(page);
    await uiExpectClosePreviewTotals(page, {
      cash,
      gpay: 0,
      totalPaid: cash,
      outstandingCreated: 0,
    });
    await page.getByRole("button", { name: "Confirm Close" }).click();
    await expect(
      page.getByRole("heading", { name: "Business Day has not been started." })
    ).toBeVisible({ timeout: 60_000 });

    await uiOpenCustomerBySearch(page, customer.fullName);
    const customerId = customerIdFromUrl(page.url());
    await uiOpenBusinessDayHistoryFromTimeline(page);

    await expect(page.getByText(uiCurrency(cash)).first()).toBeVisible();
    await uiExpectHistoryOutstandingCreated(page, 0);
    await expect(page.getByText(customer.fullName).first()).toBeVisible();

    const href = page.url();
    const dayId = href.match(/\/business-day\/history\/([a-f0-9]+)/i)?.[1];
    expect(dayId).toBeTruthy();
    const history = await businessDayHistory(dayId!);
    expect(history).toBeTruthy();
    if (!history) return;
    expect(history.summary.todaysBill).toBe(cash);
    expect(history.summary.cashCollection).toBe(cash);
    expect(history.summary.gpayCollection).toBe(0);
    expect(history.summary.outstandingCreated).toBe(0);
    expect(
      history.settlements.some((row) => row.customerId === customerId)
    ).toBeTruthy();
  });
});
