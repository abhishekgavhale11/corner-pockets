import { test, expect } from "@playwright/test";
import { uiLogin, uiStartBusinessDayIfNeeded } from "../helpers/ui-cashier";

/**
 * Debug-only: isolate Start Business Day hang / ECONNRESET.
 * Run: npx playwright test tests/ui/debug-start-bd.spec.ts --headed
 */
test("debug start business day", async ({ page }) => {
  test.setTimeout(180_000);

  page.on("requestfailed", (req) => {
    console.log("[requestfailed]", req.method(), req.url(), req.failure()?.errorText);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text());
  });
  page.on("response", async (res) => {
    if (res.url().includes("localhost:3001") && res.request().method() === "POST") {
      console.log("[POST]", res.status(), res.url().slice(0, 120));
    }
  });

  await uiLogin(page);
  console.log("[debug] logged in, url=", page.url());
  await uiStartBusinessDayIfNeeded(page);
  console.log("[debug] business day started, url=", page.url());
  await expect(page.getByRole("button", { name: "+ Add Frame" }).first()).toBeVisible();
});
