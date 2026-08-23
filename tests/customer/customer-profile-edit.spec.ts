import "../helpers/env";
import { test, expect } from "@playwright/test";
import { resetE2eDatabase, disconnectTestDb, connectTestDb } from "../helpers/db";
import {
  bootstrapTestWorld,
  createFrameForCustomer,
  createTestCustomer,
  customerOutstandingBalance,
  openFreshBusinessDay,
  closeOpenBusinessDay,
  type TestCustomer,
} from "../helpers/financial-integrity";
import {
  customerIdFromUrl,
  uniqueCustomerName,
  uiLogin,
  uiOpenCustomerBySearch,
} from "../helpers/ui-cashier";
import Customer from "../../src/models/Customer";
import Outstanding from "../../src/models/Outstanding";

/**
 * Customer Details — edit name + mobile only.
 * Reuses updateCustomerDetails; asserts customerId and Outstanding stay linked.
 */

test.describe.configure({ mode: "serial" });

function nextUniquePhone(): string {
  const suffix = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`
    .padStart(9, "0")
    .slice(-9);
  return `8${suffix}`;
}

async function openCustomerDetails(page: import("@playwright/test").Page, customer: TestCustomer) {
  await page.goto(`/customers/${customer.id}`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Customer Details" })
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
}

async function startEdit(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Mobile Number")).toBeVisible();
  await expect(page.getByLabel("Card ID")).toHaveCount(0);
}

test.describe("Customer profile edit (name + mobile)", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(420_000);
    await resetE2eDatabase();
    await bootstrapTestWorld();
    await uiLogin(page);
  });

  test.afterAll(async () => {
    await disconnectTestDb().catch(() => undefined);
  });

  test("edits name successfully and keeps customer id", async ({ page }) => {
    const customer = await createTestCustomer("EditName");
    const originalId = customer.id;
    const next = uniqueCustomerName("Renamed");

    await openCustomerDetails(page, customer);
    await startEdit(page);

    await page.getByLabel("Name", { exact: true }).fill(next.firstName);
    await page.getByLabel("Surname", { exact: true }).fill(next.lastName);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("Customer details updated successfully.")
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(next.firstName, { exact: true })).toBeVisible();
    await expect(page.getByText(next.lastName, { exact: true })).toBeVisible();
    expect(page.url()).toContain(`/customers/${originalId}`);

    await connectTestDb();
    const saved = await Customer.findById(originalId).lean();
    expect(saved).toBeTruthy();
    expect(saved!._id.toString()).toBe(originalId);
    expect(saved!.firstName).toBe(next.firstName);
    expect(saved!.lastName).toBe(next.lastName);
    expect(saved!.name).toBe(next.fullName);
    expect(saved!.phone).toBe(customer.phone);
  });

  test("edits mobile number successfully and keeps customer id", async ({
    page,
  }) => {
    const customer = await createTestCustomer("EditPhone");
    const originalId = customer.id;
    const nextPhone = nextUniquePhone();

    await openCustomerDetails(page, customer);
    await startEdit(page);

    await page.getByLabel("Mobile Number").fill(nextPhone);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("Customer details updated successfully.")
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(nextPhone)).toBeVisible();
    expect(page.url()).toContain(`/customers/${originalId}`);

    await connectTestDb();
    const saved = await Customer.findById(originalId).lean();
    expect(saved).toBeTruthy();
    expect(saved!._id.toString()).toBe(originalId);
    expect(saved!.phone).toBe(nextPhone);
    expect(saved!.firstName).toBe(customer.firstName);
    expect(saved!.lastName).toBe(customer.lastName);
  });

  test("edits name and mobile together successfully", async ({ page }) => {
    const customer = await createTestCustomer("EditBoth");
    const originalId = customer.id;
    const next = uniqueCustomerName("Both");
    const nextPhone = nextUniquePhone();

    await openCustomerDetails(page, customer);
    await startEdit(page);

    await page.getByLabel("Name", { exact: true }).fill(next.firstName);
    await page.getByLabel("Surname", { exact: true }).fill(next.lastName);
    await page.getByLabel("Mobile Number").fill(nextPhone);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("Customer details updated successfully.")
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(next.firstName, { exact: true })).toBeVisible();
    await expect(page.getByText(next.lastName, { exact: true })).toBeVisible();
    await expect(page.getByText(nextPhone)).toBeVisible();

    await connectTestDb();
    const saved = await Customer.findById(originalId).lean();
    expect(saved!._id.toString()).toBe(originalId);
    expect(saved!.name).toBe(next.fullName);
    expect(saved!.phone).toBe(nextPhone);
  });

  test("cancel does not save changes", async ({ page }) => {
    const customer = await createTestCustomer("EditCancel");
    const originalId = customer.id;

    await openCustomerDetails(page, customer);
    await startEdit(page);

    await page.getByLabel("Name", { exact: true }).fill("ShouldNotSave");
    await page.getByLabel("Surname", { exact: true }).fill("Cancelled");
    await page.getByLabel("Mobile Number").fill("9000000001");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByText(customer.firstName, { exact: true })).toBeVisible();
    await expect(page.getByText(customer.lastName, { exact: true })).toBeVisible();
    await expect(page.getByText(customer.phone)).toBeVisible();
    await expect(page.getByText("ShouldNotSave")).toHaveCount(0);

    await connectTestDb();
    const saved = await Customer.findById(originalId).lean();
    expect(saved!.firstName).toBe(customer.firstName);
    expect(saved!.lastName).toBe(customer.lastName);
    expect(saved!.phone).toBe(customer.phone);
  });

  test("rejects invalid mobile number", async ({ page }) => {
    const customer = await createTestCustomer("EditBadPhone");

    await openCustomerDetails(page, customer);
    await startEdit(page);

    await page.getByLabel("Mobile Number").fill("123");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText(/Phone number must be at least 10 digits|Invalid/i)
    ).toBeVisible({ timeout: 20_000 });

    await connectTestDb();
    const saved = await Customer.findById(customer.id).lean();
    expect(saved!.phone).toBe(customer.phone);
  });

  test("rejects empty name", async ({ page }) => {
    const customer = await createTestCustomer("EditBadName");

    await openCustomerDetails(page, customer);
    await startEdit(page);

    await page.getByLabel("Name", { exact: true }).fill("   ");
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Browser required / zod Required — stay in edit mode with original persisted.
    await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();

    await connectTestDb();
    const saved = await Customer.findById(customer.id).lean();
    expect(saved!.firstName).toBe(customer.firstName);
  });

  test("after edit, outstanding and financial history stay on the same customer", async ({
    page,
  }) => {
    const staff = await bootstrapTestWorld();
    const customer = await createTestCustomer("EditKeepOS");
    const originalId = customer.id;
    const frameAmount = 200;

    await openFreshBusinessDay(staff);
    await createFrameForCustomer(staff, customer, {
      amount: frameAmount,
      received: 0,
    });
    const closed = await closeOpenBusinessDay(staff);
    expect(closed.status).toBe("SUCCESS");

    const outstandingBefore = await customerOutstandingBalance(originalId);
    expect(outstandingBefore).toBe(frameAmount);

    const next = uniqueCustomerName("KeepOS");
    const nextPhone = nextUniquePhone();

    await openCustomerDetails(page, customer);
    await expect(page.getByText("Outstanding")).toBeVisible({ timeout: 20_000 });

    await startEdit(page);
    await page.getByLabel("Name", { exact: true }).fill(next.firstName);
    await page.getByLabel("Surname", { exact: true }).fill(next.lastName);
    await page.getByLabel("Mobile Number").fill(nextPhone);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("Customer details updated successfully.")
    ).toBeVisible({ timeout: 30_000 });

    expect(page.url()).toContain(`/customers/${originalId}`);
    expect(await customerOutstandingBalance(originalId)).toBe(frameAmount);

    await connectTestDb();
    const outstandingRows = await Outstanding.find({
      customerId: originalId,
      status: "PENDING",
    }).lean();
    expect(outstandingRows.length).toBeGreaterThan(0);
    expect(
      outstandingRows.reduce((sum, row) => sum + (row.remainingAmount ?? 0), 0)
    ).toBe(frameAmount);

    const saved = await Customer.findById(originalId).lean();
    expect(saved!._id.toString()).toBe(originalId);
    expect(saved!.name).toBe(next.fullName);
    expect(saved!.phone).toBe(nextPhone);

    // Searchable under the new name; same details URL / id.
    await uiOpenCustomerBySearch(page, next.fullName);
    expect(customerIdFromUrl(page.url())).toBe(originalId);
  });
});
