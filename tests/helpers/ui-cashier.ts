import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** en-IN currency as rendered by the app (₹ with no decimals). */
export function uiCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Next.js dev overlays show as role=alert and can steal pointer events. */
export async function dismissDevOverlays(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page
    .evaluate(() => {
      for (const sel of [
        "nextjs-portal",
        "#nextjs-portal",
        "[data-nextjs-dialog-overlay]",
        "[data-nextjs-toast]",
      ]) {
        document.querySelectorAll(sel).forEach((node) => node.remove());
      }
    })
    .catch(() => undefined);
}

export function uniqueCustomerName(prefix = "Cashier"): {
  firstName: string;
  lastName: string;
  fullName: string;
} {
  const token = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const firstName = prefix;
  const lastName = `UI_${token}`;
  return { firstName, lastName, fullName: `${firstName} ${lastName}` };
}

/**
 * Pure Playwright UI helpers for cashier flows.
 * No server actions, mongoose, or business-logic imports.
 */
export async function uiLogin(
  page: Page,
  username = process.env.PLAYWRIGHT_USERNAME ?? "abhishek",
  password = process.env.PLAYWRIGHT_PASSWORD ?? "corner123"
): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  // Session may already be valid (redirect away from /login).
  if (!page.url().includes("/login")) {
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({
      timeout: 30_000,
    });
    return;
  }

  await expect(page.getByRole("heading", { name: "Corner Pockets" })).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 90_000 });

  // Network may briefly interrupt (sleep / suspended IO) — reload once if needed.
  const signedIn = page.getByRole("button", { name: "Sign out" });
  if (!(await signedIn.isVisible().catch(() => false))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await expect(signedIn).toBeVisible({ timeout: 60_000 });
}

/** Opens the Business Day from the counter gate when no day is open. */
export async function uiStartBusinessDayIfNeeded(page: Page): Promise<void> {
  await page.goto("/counter/big-snooker", { waitUntil: "domcontentloaded" });

  const startHeading = page.getByRole("heading", {
    name: "Business Day has not been started.",
  });
  const counterReady = page.getByRole("button", { name: "+ Add Frame" }).first();

  if (await counterReady.isVisible().catch(() => false)) {
    return;
  }

  await expect(startHeading).toBeVisible({ timeout: 30_000 });
  await dismissDevOverlays(page);

  const dateInput = page.getByLabel("Business Date");
  await expect(dateInput).toBeVisible();
  // type=date always exposes ISO value via inputValue(); display may be locale-formatted.
  const current = await dateInput.inputValue();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(current)) {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await dateInput.fill(iso);
  }

  const startButton = page.getByRole("button", { name: "Start Business Day" });
  await expect(startButton).toBeEnabled();
  await dismissDevOverlays(page);
  await startButton.click({ force: true });

  // Wait for the pending state — proves the click invoked the handler.
  const startingButton = page.getByRole("button", { name: "Starting…" });
  await expect(startingButton)
    .toBeVisible({ timeout: 10_000 })
    .catch(() => undefined);

  // After success the screen hard-navigates; wait for Counter chrome.
  // Do NOT waitForURL(/big-snooker/) — we are already on that path at the gate.
  const errorBanner = page.getByRole("alert").filter({ hasText: /.+/ }).first();
  const opened = await counterReady
    .waitFor({ state: "visible", timeout: 90_000 })
    .then(() => true)
    .catch(() => false);

  if (opened) {
    return;
  }

  // Fallback: full navigation in case assign happened but RSC tree is stale.
  await page.goto("/counter/big-snooker", { waitUntil: "domcontentloaded" });
  if (await counterReady.isVisible({ timeout: 30_000 }).catch(() => false)) {
    return;
  }

  const errText = (await errorBanner.textContent().catch(() => null))?.trim();
  throw new Error(
    errText
      ? `Start Business Day failed in UI: ${errText}`
      : "Start Business Day did not open Counter (+ Add Frame still missing)"
  );
}

function tableColumn(page: Page, tableName: string): Locator {
  return page
    .locator("div.rounded-xl.border.border-gray-200.bg-white")
    .filter({
      has: page.getByRole("heading", { name: tableName, exact: true }),
    });
}

/**
 * Create a Quick Customer through the Customers page UI (cashier path).
 * Uses ?register=1 so the New Customer drawer opens reliably.
 */
export async function uiCreateCustomerFromCounter(
  page: Page,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<void> {
  await page.goto("/customers?register=1", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "New Customer" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Quick Customer" }).click();
  await page.getByLabel("Name", { exact: true }).fill(firstName);
  await page.getByLabel("Surname", { exact: true }).fill(lastName);
  if (phone) {
    await page.getByLabel("Phone (optional)").fill(phone);
  }
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: /Customer Timeline/i })
  ).toBeVisible({ timeout: 45_000 });

  await page.getByRole("link", { name: "Big Snooker" }).click();
  await expect(page.getByRole("button", { name: "+ Add Frame" }).first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function uiAddSinglesFrameOnTable1(
  page: Page,
  amount = 160
): Promise<void> {
  const column = tableColumn(page, "Table 1");
  await expect(column).toBeVisible();
  await column.locator("select").selectOption({ label: "Singles" });
  await column.locator('input[type="number"]').fill(String(amount));
  await column.getByRole("button", { name: "+ Add Frame" }).click();
  await expect(column.getByText("Unassigned").first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function uiAssignUnassignedFrameToCustomer(
  page: Page,
  customerName: string
): Promise<void> {
  const column = tableColumn(page, "Table 1");
  await column.getByText("Unassigned").first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Assign Customer" })).toBeVisible();
  await dialog.getByPlaceholder("Search name or phone…").fill(customerName);
  await expect(dialog.getByRole("button", { name: customerName }).first()).toBeVisible({
    timeout: 20_000,
  });
  await dialog.getByRole("button", { name: customerName }).first().click();
  await dialog.getByRole("button", { name: "Assign Customer" }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(column.getByText(customerName).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function uiSetFramePayment(
  page: Page,
  customerName: string,
  received: number,
  paymentMode?: "Cash" | "GPay",
  frameAmount = 160
): Promise<void> {
  await dismissDevOverlays(page);
  const column = tableColumn(page, "Table 1");
  const row = column.locator("tr").filter({ hasText: customerName }).first();
  await row.getByRole("button", { name: "Edit frame" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();

  const receivedInput = dialog.locator("#frame-received-0");
  await receivedInput.click();
  await receivedInput.fill("");
  await receivedInput.pressSequentially(String(received), { delay: 40 });
  await expect(receivedInput).toHaveValue(String(received));

  if (received > 0) {
    if (!paymentMode) {
      throw new Error("paymentMode is required when received > 0");
    }
    await dialog.getByRole("radio", { name: paymentMode, exact: true }).click();
  }

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  // Due column: remaining amount when money is still owed; payment mode
  // (Cash/GPay) or "Paid" when fully paid — never shows ₹0.
  const expectedDue = frameAmount - received;
  if (expectedDue > 0) {
    await expect(row.getByText(uiCurrency(expectedDue)).first()).toBeVisible({
      timeout: 20_000,
    });
  } else if (paymentMode) {
    await expect(row.getByText(paymentMode, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  } else {
    await expect(row.getByText("Paid", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  }
}

/** Navigate to Cafe via the Counter workspace link (cashier UI). */
export async function uiGoToCafe(page: Page): Promise<void> {
  await dismissDevOverlays(page);
  const nav = page.getByRole("navigation", { name: "Counter workspace" });
  const cafeLink = nav.getByRole("link", { name: "Cafe" });
  await expect(cafeLink).toBeVisible();

  await cafeLink.click();
  await expect(page).toHaveURL(/\/counter\/cafe/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Cafe Orders" })).toBeVisible({
    timeout: 20_000,
  });
}

export async function uiGoToBigSnooker(page: Page): Promise<void> {
  await dismissDevOverlays(page);
  const nav = page.getByRole("navigation", { name: "Counter workspace" });
  const link = nav.getByRole("link", { name: "Big Snooker" });
  await link.click();
  await expect(page).toHaveURL(/\/counter\/big-snooker/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "+ Add Frame" }).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function uiAddCafeOrderWithWater(
  page: Page,
  customerName: string,
  options: { received?: number; paymentMode?: "Cash" | "GPay" } = {}
): Promise<void> {
  const received = options.received ?? 0;

  await uiGoToCafe(page);

  await page.getByRole("button", { name: "+ New Cafe Order" }).click();
  await page.getByRole("button", { name: "Assign Customer" }).first().click();

  await expect(page.getByRole("heading", { name: "Assign Customer" })).toBeVisible();
  await page.getByPlaceholder("Search name, phone, card ID").fill(customerName);
  await expect(
    page.getByRole("button", { name: new RegExp(`^${customerName}`) }).first()
  ).toBeVisible({ timeout: 20_000 });
  await page
    .getByRole("button", { name: new RegExp(`^${customerName}`) })
    .first()
    .click();

  await page.getByRole("button", { name: "+ Add Item" }).click();
  await expect(page.getByRole("heading", { name: "Add Cafe Item" })).toBeVisible();
  await page.getByRole("button", { name: "Water", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add Cafe Item" })).toBeHidden({
    timeout: 15_000,
  });

  if (received > 0) {
    const receivedInput = page.getByLabel("Received Amount");
    await receivedInput.click();
    await receivedInput.fill("");
    await receivedInput.pressSequentially(String(received), { delay: 40 });
    if (!options.paymentMode) {
      throw new Error("paymentMode is required when cafe received > 0");
    }
    await page.getByRole("radio", { name: options.paymentMode, exact: true }).click();
  }

  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText(customerName).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function uiCloseBusinessDay(page: Page): Promise<void> {
  if (!page.url().includes("/counter")) {
    await page.goto("/counter/big-snooker", { waitUntil: "domcontentloaded" });
  }

  await page.getByRole("button", { name: "Close Business Day" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Close Business Day" })
  ).toBeVisible({ timeout: 30_000 });

  const confirm = page.getByRole("button", { name: "Confirm Close" });
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();

  await expect(
    page.getByRole("heading", { name: "Business Day has not been started." })
  ).toBeVisible({ timeout: 60_000 });
}

export async function uiOpenCustomerBySearch(
  page: Page,
  customerName: string
): Promise<void> {
  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page.getByLabel("Search customers")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("Search customers").fill(customerName);

  const openLink = page.getByRole("link", { name: `Open ${customerName}` });
  await expect(openLink).toBeVisible({ timeout: 20_000 });

  // Debounced search may replace URL with ?q= — wait for that to settle first.
  await expect
    .poll(async () => page.url(), { timeout: 10_000 })
    .toMatch(/[?&]q=/);

  await openLink.click();
  await expect(page).toHaveURL(/\/customers\/[a-f0-9]+/i, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: /Customer Timeline/i })
  ).toBeVisible({ timeout: 45_000 });
}

export async function uiExpectOutstanding(
  page: Page,
  amount: number
): Promise<void> {
  const row = page.locator("dt", { hasText: "Outstanding" }).locator("..");
  await expect(row.getByText(uiCurrency(amount), { exact: true })).toBeVisible();
}

export async function uiExpectTimelineDue(
  page: Page,
  due: number
): Promise<void> {
  await page.getByRole("tab", { name: /All Activity/i }).click();
  if (due === 0) {
    await expect(page.getByText(/Paid in Full/i).first()).toBeVisible({
      timeout: 20_000,
    });
    return;
  }
  await expect(page.getByText(uiCurrency(due)).first()).toBeVisible();
}

export async function uiExpectBalanceHistoryShowsDue(
  page: Page,
  due: number
): Promise<void> {
  await page.getByRole("tab", { name: /Balance History/i }).click();
  if (due === 0) {
    await expect(page.getByText("No balance changes yet.")).toBeVisible();
    return;
  }
  await expect(page.getByText(uiCurrency(due)).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function uiOpenBusinessDayHistoryFromTimeline(
  page: Page
): Promise<void> {
  await page.getByRole("tab", { name: /All Activity/i }).click();
  const historyLink = page.getByRole("link", { name: /View Business Day/i }).first();
  await expect(historyLink).toBeVisible({ timeout: 20_000 });
  await historyLink.scrollIntoViewIfNeeded();

  const href = await historyLink.getAttribute("href");
  if (!href) {
    throw new Error("View Business Day link has no href");
  }

  await historyLink.click();
  try {
    await expect(page).toHaveURL(/\/business-day\/history\/[a-f0-9]+/i, {
      timeout: 20_000,
    });
  } catch {
    // Soft navigation can stall under headed+slowMo — follow the same href the cashier link uses.
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/business-day\/history\/[a-f0-9]+/i, {
      timeout: 20_000,
    });
  }

  await expect(page.getByText(/Outstanding Created/i).first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function uiExpectHistoryOutstandingCreated(
  page: Page,
  amount: number
): Promise<void> {
  await expect(page.getByText(uiCurrency(amount)).first()).toBeVisible();
}

/** Assert Business Day page shows OPEN status (and Start is unavailable). */
export async function uiExpectBusinessDayOpen(page: Page): Promise<void> {
  await page.goto("/business-day", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("OPEN", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Close Business Day" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Business Day" })
  ).toHaveCount(0);
}

/** Customer list search shows the created customer. */
export async function uiExpectCustomerInList(
  page: Page,
  customerName: string
): Promise<void> {
  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Search customers").fill(customerName);
  await expect(
    page.getByRole("link", { name: `Open ${customerName}` })
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Counter assign dialog can find the customer (proves Counter visibility).
 * Leaves dialog closed without assigning.
 */
export async function uiExpectCustomerSearchableOnCounter(
  page: Page,
  customerName: string
): Promise<void> {
  await uiGoToBigSnooker(page);
  await uiAddSinglesFrameOnTable1(page, 160);
  const column = tableColumn(page, "Table 1");
  await column.getByText("Unassigned").first().click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Assign Customer" })
  ).toBeVisible();
  await dialog.getByPlaceholder("Search name or phone…").fill(customerName);
  await expect(
    dialog.getByRole("button", { name: customerName }).first()
  ).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

/** Open Close preview modal without confirming. */
export async function uiOpenClosePreview(page: Page): Promise<Locator> {
  if (!page.url().includes("/counter")) {
    await page.goto("/counter/big-snooker", { waitUntil: "domcontentloaded" });
  }
  await page.getByRole("button", { name: "Close Business Day" }).click();
  const dialog = page
    .locator("div")
    .filter({
      has: page.getByRole("heading", { name: "Confirm Close Business Day" }),
    })
    .last();
  await expect(
    page.getByRole("heading", { name: "Confirm Close Business Day" })
  ).toBeVisible({ timeout: 30_000 });
  return dialog;
}

/** Assert Cash / GPay / Total Collection / Outstanding Created on Close preview. */
export async function uiExpectClosePreviewTotals(
  page: Page,
  expected: {
    cash: number;
    gpay: number;
    totalPaid: number;
    outstandingCreated: number;
  }
): Promise<void> {
  const heading = page.getByRole("heading", {
    name: "Confirm Close Business Day",
  });
  await expect(heading).toBeVisible();

  const panel = page.locator("div").filter({ has: heading }).last();
  await expect(panel.getByText(uiCurrency(expected.cash)).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(panel.getByText(uiCurrency(expected.gpay)).first()).toBeVisible();
  await expect(
    panel.getByText(uiCurrency(expected.totalPaid)).first()
  ).toBeVisible();
  await expect(
    panel.getByText("Total Outstanding Created")
  ).toBeVisible();
  await expect(
    panel.getByText(uiCurrency(expected.outstandingCreated)).first()
  ).toBeVisible();
}

export async function uiCancelClosePreview(page: Page): Promise<void> {
  const cancel = page.getByRole("button", { name: "Cancel" }).last();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
  } else {
    await page.getByRole("button", { name: "Close", exact: true }).first().click();
  }
  await expect(
    page.getByRole("heading", { name: "Confirm Close Business Day" })
  ).toBeHidden({ timeout: 20_000 });
}

/**
 * Full payment split across Cash + GPay on Edit Frame
 * (requires Received = Amount; allocations must sum to frame amount).
 */
export async function uiSetFrameCashGpaySplit(
  page: Page,
  customerName: string,
  frameAmount: number,
  cashAmount: number,
  gpayAmount: number
): Promise<void> {
  if (cashAmount + gpayAmount !== frameAmount) {
    throw new Error("Cash + GPay must equal frame amount");
  }

  await dismissDevOverlays(page);
  const column = tableColumn(page, "Table 1");
  const row = column.locator("tr").filter({ hasText: customerName }).first();
  await row.getByRole("button", { name: "Edit frame" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();

  const received0 = dialog.locator("#frame-received-0");
  await received0.click();
  await received0.fill("");
  await received0.pressSequentially(String(cashAmount), { delay: 40 });
  await dialog.getByRole("radio", { name: "Cash", exact: true }).first().click();

  await dialog.getByRole("button", { name: "+ Add Payment Method" }).click();

  const received1 = dialog.locator("#frame-received-1");
  await expect(received1).toBeVisible({ timeout: 10_000 });
  await received1.click();
  await received1.fill("");
  await received1.pressSequentially(String(gpayAmount), { delay: 40 });
  await dialog.getByRole("radio", { name: "GPay", exact: true }).last().click();

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(row.getByText("Paid", { exact: true }).or(row.getByText("Cash")).or(row.getByText("GPay")).first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Collect Outstanding from Customer page. */
export async function uiCollectOutstanding(
  page: Page,
  amount: number,
  paymentMode: "Cash" | "GPay" = "Cash"
): Promise<void> {
  await page.getByRole("button", { name: "Collect Outstanding" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Collect Outstanding" })
  ).toBeVisible();

  const received = dialog.locator("#outstanding-collect-received-0");
  await received.click();
  await received.fill("");
  await received.pressSequentially(String(amount), { delay: 40 });
  await dialog.getByRole("radio", { name: paymentMode, exact: true }).click();
  await dialog.getByRole("button", { name: "Collect", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

/**
 * Edit an open cafe order: bump Water qty, optionally add Cigarette, remove one item.
 * Returns expected cafe bill after edits (Water ₹10, Cigarette ₹30).
 */
export async function uiEditCafeOrderBill(
  page: Page,
  customerName: string,
  options: {
    increaseWaterBy?: number;
    addCigarette?: boolean;
    removeLastItem?: boolean;
  } = {}
): Promise<number> {
  await uiGoToCafe(page);
  await page.getByText(customerName).first().click();

  // Order panel is open for this customer after click / existing save path.
  const increaseBy = options.increaseWaterBy ?? 0;
  for (let i = 0; i < increaseBy; i += 1) {
    await page.getByLabel("Increase quantity").first().click();
  }

  if (options.addCigarette) {
    await page.getByRole("button", { name: "+ Add Item" }).click();
    await expect(page.getByRole("heading", { name: "Add Cafe Item" })).toBeVisible();
    await page.getByRole("button", { name: "Cigarette", exact: true }).click();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Add Cafe Item" })).toBeHidden({
      timeout: 15_000,
    });
  }

  if (options.removeLastItem) {
    const deleteButtons = page.getByLabel("Delete item");
    const count = await deleteButtons.count();
    if (count > 0) {
      await deleteButtons.last().click();
      const confirm = page.getByRole("heading", { name: "Remove item?" });
      if (await confirm.isVisible().catch(() => false)) {
        await page.getByRole("button", { name: "Remove", exact: true }).click();
      }
    }
  }

  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText(customerName).first()).toBeVisible({
    timeout: 20_000,
  });

  // Baseline: helper starts from one Water (₹10). Qty increases add ₹10 each.
  // Cigarette adds ₹30. Removing last item subtracts that item's unit default.
  let bill = 10;
  bill += increaseBy * 10;
  if (options.addCigarette) bill += 30;
  if (options.removeLastItem) {
    bill = Math.max(0, bill - (options.addCigarette ? 30 : 10));
  }
  return bill;
}

/** Change frame Total Amount in Edit Frame and save (keeps current payment). */
export async function uiEditFrameAmount(
  page: Page,
  customerName: string,
  nextAmount: number,
  received: number,
  paymentMode?: "Cash" | "GPay"
): Promise<void> {
  await dismissDevOverlays(page);
  await uiGoToBigSnooker(page);
  const column = tableColumn(page, "Table 1");
  const row = column.locator("tr").filter({ hasText: customerName }).first();
  await row.getByRole("button", { name: "Edit frame" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit Frame" })).toBeVisible();

  const amountInput = dialog.locator('input[inputmode="numeric"]').first();
  await amountInput.click();
  await amountInput.fill("");
  await amountInput.pressSequentially(String(nextAmount), { delay: 40 });

  const receivedInput = dialog.locator("#frame-received-0");
  await receivedInput.click();
  await receivedInput.fill("");
  await receivedInput.pressSequentially(String(received), { delay: 40 });
  if (received > 0) {
    if (!paymentMode) {
      throw new Error("paymentMode required when received > 0");
    }
    await dialog.getByRole("radio", { name: paymentMode, exact: true }).first().click();
  }

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

/** Read customer id from /customers/:id URL after opening the profile. */
export function customerIdFromUrl(url: string): string {
  const match = url.match(/\/customers\/([a-f0-9]+)/i);
  if (!match?.[1]) {
    throw new Error(`Could not parse customer id from URL: ${url}`);
  }
  return match[1];
}
