import { test, expect, type Locator } from "@playwright/test";
import { dismissDevOverlays, uiLogin } from "../helpers/ui-cashier";

test.use({ channel: "chrome", video: "off", trace: "off" });

async function openAssignDialog(page: import("@playwright/test").Page) {
  await page.goto("/counter/big-snooker", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Close Business Day" })
  ).toBeVisible({ timeout: 30_000 });
  await dismissDevOverlays(page);

  const unassigned = page
    .getByRole("button", { name: "Unassigned" })
    .locator("visible=true")
    .first();
  await expect(unassigned).toBeVisible({ timeout: 20_000 });
  await unassigned.click({ force: true });

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Assign Customer" })
  ).toBeVisible();
  await expect(
    dialog.getByPlaceholder("Search name or phone…")
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Assign Customer" })
  ).toBeVisible();

  return dialog;
}

async function assertSingleResultsScroller(dialog: Locator) {
  const heading = dialog.getByRole("heading", { name: "Assign Customer" });
  const search = dialog.getByPlaceholder("Search name or phone…");
  const assign = dialog.getByRole("button", { name: "Assign Customer" });
  const results = dialog.locator("[data-assign-customer-results]");

  const metrics = await dialog.evaluate((root) => {
    const dialogEl = root as HTMLElement;
    const headingEl = dialogEl.querySelector("h2");
    const searchEl = dialogEl.querySelector(
      'input[placeholder="Search name or phone…"]'
    );
    const assignEl = [...dialogEl.querySelectorAll("button")].find(
      (btn) => btn.textContent?.trim() === "Assign Customer"
    );
    const resultsEl = dialogEl.querySelector(
      "[data-assign-customer-results]"
    ) as HTMLElement | null;

    const overflowOf = (el: Element | null) =>
      el ? getComputedStyle(el).overflowY : "missing";

    const scrollable = [...dialogEl.querySelectorAll("*")].filter((el) => {
      const style = getComputedStyle(el);
      const y = style.overflowY;
      if (y !== "auto" && y !== "scroll") return false;
      return (
        (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 1
      );
    });

    return {
      dialogOverflow: overflowOf(dialogEl),
      assignVisible: assignEl
        ? assignEl.getBoundingClientRect().bottom <=
          dialogEl.getBoundingClientRect().bottom + 1
        : false,
      headingVisible: headingEl
        ? headingEl.getBoundingClientRect().top >=
          dialogEl.getBoundingClientRect().top - 1
        : false,
      searchVisible: searchEl
        ? searchEl.getBoundingClientRect().top >=
          dialogEl.getBoundingClientRect().top - 1
        : false,
      resultsOverflow: overflowOf(resultsEl),
      resultsCanScroll: resultsEl
        ? resultsEl.scrollHeight > resultsEl.clientHeight + 1
        : false,
      scrollableCount: scrollable.length,
      scrollableClassNames: scrollable.map((el) =>
        (el as HTMLElement).className.toString().slice(0, 120)
      ),
    };
  });

  expect(metrics.dialogOverflow).toBe("hidden");
  expect(metrics.resultsOverflow).toBe("auto");
  expect(metrics.headingVisible).toBe(true);
  expect(metrics.searchVisible).toBe(true);
  expect(metrics.assignVisible).toBe(true);

  const headingBefore = await heading.boundingBox();
  const searchBefore = await search.boundingBox();
  const assignBefore = await assign.boundingBox();

  if (metrics.resultsCanScroll) {
    await results.evaluate((el) => {
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
    });
  }

  const headingAfter = await heading.boundingBox();
  const searchAfter = await search.boundingBox();
  const assignAfter = await assign.boundingBox();

  expect(headingAfter?.y).toBe(headingBefore?.y);
  expect(searchAfter?.y).toBe(searchBefore?.y);
  expect(assignAfter?.y).toBe(assignBefore?.y);

  expect(
    metrics.scrollableCount,
    `extra scrollers: ${metrics.scrollableClassNames.join(" | ")}`
  ).toBeLessThanOrEqual(1);
  if (metrics.resultsCanScroll) {
    expect(metrics.scrollableCount).toBe(1);
  }
}

test.describe("Assign Customer modal scroll", () => {
  test("only the customer results list scrolls on desktop and iPhone", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await uiLogin(page);
    const dialog = await openAssignDialog(page);
    await expect(dialog.getByText("Searching…")).toBeHidden({ timeout: 20_000 });

    await assertSingleResultsScroller(dialog);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      dialog.getByRole("heading", { name: "Assign Customer" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Assign Customer" })
    ).toBeVisible();
    await assertSingleResultsScroller(dialog);
  });
});
