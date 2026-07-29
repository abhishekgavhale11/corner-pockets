import { test, expect } from "@playwright/test";
import {
  uniqueCustomerName,
  uiAddCafeOrderWithWater,
  uiAddSinglesFrameOnTable1,
  uiAssignUnassignedFrameToCustomer,
  uiCloseBusinessDay,
  uiCreateCustomerFromCounter,
  uiCurrency,
  uiExpectBalanceHistoryShowsDue,
  uiExpectHistoryOutstandingCreated,
  uiExpectOutstanding,
  uiExpectTimelineDue,
  uiGoToBigSnooker,
  uiLogin,
  uiOpenBusinessDayHistoryFromTimeline,
  uiOpenCustomerBySearch,
  uiSetFramePayment,
  uiStartBusinessDayIfNeeded,
} from "../helpers/ui-cashier";

/**
 * Customer Financial Integrity — cashier UI suite.
 *
 * Drives the real browser exactly like a cashier:
 * login → start Business Day → create customer → frames / cafe → payments →
 * close Business Day → Customer page → verify Outstanding / Timeline /
 * Balance History / Business Day History.
 *
 * Does NOT call prepareOpenDay(), createTestCustomer(), closeBusinessDay(),
 * mongoose, or any server business-logic helpers.
 *
 * Run headed (watchable):
 *   npm run test:e2e:customer-fi-ui
 */
test.describe.configure({ mode: "serial" });

test.describe("Customer Financial Integrity (UI / Cashier)", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);

    // 1–2. Login page → real staff account
    await uiLogin(page);

    // 3. Start Business Day (Counter gate) when none is open
    await uiStartBusinessDayIfNeeded(page);
  });

  test("cashier: unpaid frame → Outstanding on Customer + History", async ({
    page,
  }) => {
    const customer = uniqueCustomerName("Unpaid");
    const frameAmount = 160;
    const expectedDue = 160;

    // 4. Create customer (Customers → Quick Customer)
    await uiCreateCustomerFromCounter(page, customer.firstName, customer.lastName);

    // 5. Add frame + assign customer
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    // 7. No payment — Received stays 0

    // 8. Close Business Day via UI
    await uiCloseBusinessDay(page);

    // 9–10. Customer page visual checks
    await uiOpenCustomerBySearch(page, customer.fullName);
    await uiExpectOutstanding(page, expectedDue);
    await uiExpectTimelineDue(page, expectedDue);
    await uiExpectBalanceHistoryShowsDue(page, expectedDue);

    await uiOpenBusinessDayHistoryFromTimeline(page);
    await uiExpectHistoryOutstandingCreated(page, expectedDue);
  });

  test("cashier: partial frame + unpaid cafe → correct Outstanding", async ({
    page,
  }) => {
    const customer = uniqueCustomerName("Partial");
    const frameAmount = 160;
    const frameReceived = 60;
    const cafeAmount = 20; // Water default unit price
    const cafeReceived = 0;
    const expectedDue =
      frameAmount - frameReceived + (cafeAmount - cafeReceived);

    await uiCreateCustomerFromCounter(page, customer.firstName, customer.lastName);

    // 5–7. Frame + partial Cash payment
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);
    await uiSetFramePayment(page, customer.fullName, frameReceived, "Cash");

    // 6–7. Cafe water, unpaid
    await uiAddCafeOrderWithWater(page, customer.fullName, {
      received: cafeReceived,
    });

    await uiGoToBigSnooker(page);
    await uiCloseBusinessDay(page);

    await uiOpenCustomerBySearch(page, customer.fullName);
    await uiExpectOutstanding(page, expectedDue);

    await page.getByRole("tab", { name: /All Activity/i }).click();
    await expect(page.getByText("Business Day Closed").first()).toBeVisible();
    await expect(page.getByText(uiCurrency(expectedDue)).first()).toBeVisible();

    await uiExpectBalanceHistoryShowsDue(page, expectedDue);

    await uiOpenBusinessDayHistoryFromTimeline(page);
    await uiExpectHistoryOutstandingCreated(page, expectedDue);
  });

  test("cashier: fully paid frame → Paid in Full and ₹0 Outstanding", async ({
    page,
  }) => {
    const customer = uniqueCustomerName("PaidFull");
    const frameAmount = 160;

    await uiCreateCustomerFromCounter(page, customer.firstName, customer.lastName);
    await uiAddSinglesFrameOnTable1(page, frameAmount);
    await uiAssignUnassignedFrameToCustomer(page, customer.fullName);

    // 7. Full GPay payment through Edit Frame UI
    await uiSetFramePayment(page, customer.fullName, frameAmount, "GPay");

    await uiCloseBusinessDay(page);

    await uiOpenCustomerBySearch(page, customer.fullName);
    await uiExpectOutstanding(page, 0);
    await uiExpectTimelineDue(page, 0);
    await uiExpectBalanceHistoryShowsDue(page, 0);

    await page.getByRole("tab", { name: /All Activity/i }).click();
    const historyLink = page
      .getByRole("link", { name: /View Business Day/i })
      .first();
    await expect(historyLink).toBeVisible();
    await historyLink.click();
    await expect(page).toHaveURL(/\/business-day\/history\//, {
      timeout: 30_000,
    });
    await expect(page.getByText(/Outstanding Created/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(uiCurrency(0)).first()).toBeVisible();
  });
});
