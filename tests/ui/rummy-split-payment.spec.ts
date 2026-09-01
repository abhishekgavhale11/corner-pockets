import { test, expect, type Locator, type Page } from "@playwright/test";
import mongoose from "mongoose";
import NotebookEntry from "@/models/NotebookEntry";
import {
  dismissDevOverlays,
  uniqueCustomerName,
  uiCreateCustomerFromCounter,
  uiLogin,
  uiStartBusinessDayIfNeeded,
} from "../helpers/ui-cashier";

test.use({ channel: "chrome", video: "off", trace: "off" });

const REQUIRED_MODE_MESSAGE =
  "Please select Cash or GPay for the received amount.";

function table1(page: Page): Locator {
  return page
    .locator("div.rounded-xl.border.border-gray-200.bg-white")
    .filter({
      has: page.getByRole("heading", { name: "Table 1", exact: true }),
    });
}

function contributorCard(dialog: Locator, customerName: string): Locator {
  return dialog
    .locator("div.rounded-lg.border.border-gray-200")
    .filter({ hasText: customerName })
    .first();
}

async function fillContributorMoney(
  dialog: Locator,
  customerName: string,
  amount: number,
  received: number
): Promise<void> {
  const card = contributorCard(dialog, customerName);
  const amountInput = card.locator('input[inputmode="numeric"]').nth(0);
  const receivedInput = card.locator('input[inputmode="numeric"]').nth(1);
  await amountInput.fill(String(amount));
  await receivedInput.fill(String(received));
}

async function addSplitContributor(
  dialog: Locator,
  customerName: string
): Promise<void> {
  const search = dialog.getByPlaceholder("Search to add contributor");
  await search.fill(customerName);
  await expect(
    dialog.getByRole("button", { name: customerName }).first()
  ).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole("button", { name: customerName }).first().click();
  await expect(contributorCard(dialog, customerName)).toBeVisible();
}

async function connectAppDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
}

async function loadSplitByContributorName(customerName: string) {
  await connectAppDb();
  return NotebookEntry.findOne({
    type: "RUMMY",
    "contributors.customerName": customerName,
    status: { $in: ["PENDING", "PAID"] },
  })
    .sort({ createdAt: -1 })
    .lean();
}

test.describe("Rummy split payment mode", () => {
  test("A–E: unpaid stays null, received without mode is blocked, Cash/GPay only when selected", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const customerA = uniqueCustomerName("RummyA");
    const customerB = uniqueCustomerName("RummyB");

    await uiLogin(page);
    await page.goto("/counter/big-snooker", { waitUntil: "domcontentloaded" });
    const closeDay = page.getByRole("button", { name: "Close Business Day" });
    const startHeading = page.getByRole("heading", {
      name: "Business Day has not been started.",
    });
    await expect(closeDay.or(startHeading)).toBeVisible({ timeout: 30_000 });
    if (await startHeading.isVisible().catch(() => false)) {
      await uiStartBusinessDayIfNeeded(page);
    }
    await uiCreateCustomerFromCounter(
      page,
      customerA.firstName,
      customerA.lastName
    );
    await uiCreateCustomerFromCounter(
      page,
      customerB.firstName,
      customerB.lastName
    );

    const column = table1(page);
    await column.getByLabel("Type").selectOption({ label: "Rummy" });
    await column.getByRole("button", { name: "+ Add Frame" }).click();
    await expect(column.getByText("Unassigned").first()).toBeVisible({
      timeout: 20_000,
    });

    await dismissDevOverlays(page);
    await column.getByRole("button", { name: "Edit frame" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();

    await dialog.getByRole("radio", { name: "Split" }).click();
    await addSplitContributor(dialog, customerA.fullName);
    await addSplitContributor(dialog, customerB.fullName);
    await fillContributorMoney(dialog, customerA.fullName, 240, 0);
    await fillContributorMoney(dialog, customerB.fullName, 240, 0);

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const afterA = await loadSplitByContributorName(customerA.fullName);
    expect(afterA, "Case A must persist a Rummy split").toBeTruthy();
    const aRows = afterA!.contributors ?? [];
    const aA = aRows.find((row) => row.customerName === customerA.fullName);
    const aB = aRows.find((row) => row.customerName === customerB.fullName);
    expect(aA?.paidAmount ?? 0).toBe(0);
    expect(aA?.paymentMethod).toBeUndefined();
    expect(aA?.status).toBe("PENDING");
    expect(aB?.paidAmount ?? 0).toBe(0);
    expect(aB?.paymentMethod).toBeUndefined();
    expect(aB?.status).toBe("PENDING");

    await column.getByRole("button", { name: "Edit frame" }).first().click();
    await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();
    await fillContributorMoney(dialog, customerA.fullName, 240, 240);

    await expect(dialog.getByText(REQUIRED_MODE_MESSAGE)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();

    const afterB = await loadSplitByContributorName(customerA.fullName);
    const bA = afterB!.contributors?.find(
      (row) => row.customerName === customerA.fullName
    );
    expect(bA?.paidAmount ?? 0).toBe(0);
    expect(bA?.paymentMethod).toBeUndefined();

    await contributorCard(dialog, customerA.fullName)
      .getByRole("radio", { name: "Cash", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const afterC = await loadSplitByContributorName(customerA.fullName);
    const cA = afterC!.contributors?.find(
      (row) => row.customerName === customerA.fullName
    );
    const cB = afterC!.contributors?.find(
      (row) => row.customerName === customerB.fullName
    );
    expect(cA?.paidAmount).toBe(240);
    expect(cA?.paymentMethod).toBe("CASH");
    expect(cA?.status).toBe("PAID");
    expect(cB?.paidAmount ?? 0).toBe(0);
    expect(cB?.paymentMethod).toBeUndefined();
    expect(cB?.status).toBe("PENDING");

    await column.getByRole("button", { name: "Edit frame" }).first().click();
    await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();
    await fillContributorMoney(dialog, customerA.fullName, 240, 240);
    await contributorCard(dialog, customerA.fullName)
      .getByRole("radio", { name: "GPay", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const afterD = await loadSplitByContributorName(customerA.fullName);
    const dA = afterD!.contributors?.find(
      (row) => row.customerName === customerA.fullName
    );
    expect(dA?.paidAmount).toBe(240);
    expect(dA?.paymentMethod).toBe("GPAY");
    expect(dA?.status).toBe("PAID");

    await column.getByRole("button", { name: "Edit frame" }).first().click();
    await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();
    await fillContributorMoney(dialog, customerA.fullName, 240, 0);
    await fillContributorMoney(dialog, customerB.fullName, 240, 240);
    await contributorCard(dialog, customerB.fullName)
      .getByRole("radio", { name: "GPay", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const afterE = await loadSplitByContributorName(customerA.fullName);
    const eA = afterE!.contributors?.find(
      (row) => row.customerName === customerA.fullName
    );
    const eB = afterE!.contributors?.find(
      (row) => row.customerName === customerB.fullName
    );
    expect(eA?.paidAmount ?? 0).toBe(0);
    expect(eA?.paymentMethod).toBeUndefined();
    expect(eA?.status).toBe("PENDING");
    expect(eB?.paidAmount).toBe(240);
    expect(eB?.paymentMethod).toBe("GPAY");
    expect(eB?.status).toBe("PAID");
    expect(
      afterE!.contributors?.some((row) => row.paymentMethod === "CASH")
    ).toBe(false);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
