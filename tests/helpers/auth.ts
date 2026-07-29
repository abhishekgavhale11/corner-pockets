import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const TEST_STAFF = {
  username: process.env.PLAYWRIGHT_USERNAME ?? "abhishek",
  password: process.env.PLAYWRIGHT_PASSWORD ?? "corner123",
} as const;

/**
 * Sign in via the login form and wait until the dashboard shell loads.
 * Prefer SUPER_MASTER (abhishek) so Business Day open/close is always allowed.
 */
export async function loginAsStaff(
  page: Page,
  credentials: { username: string; password: string } = TEST_STAFF
): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 45_000,
      waitUntil: "domcontentloaded",
    }),
    page.locator('button[type="submit"]').click(),
  ]);

  await expect(page.locator('input[name="username"]')).toHaveCount(0);
}

/** Currency text as rendered by formatCurrency (en-IN, INR, 0 fraction digits). */
export function currencyText(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
