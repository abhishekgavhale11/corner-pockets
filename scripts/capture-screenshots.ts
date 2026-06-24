/**
 * Capture UI screenshots for docs. Requires dev server on :3000 and MongoDB.
 * Usage: npx tsx scripts/capture-screenshots.ts
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.SCREENSHOT_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "screenshots");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', "rahul");
  await page.fill('input[name="password"]', "corner123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/counter/, { timeout: 15000 });

  const shots: { name: string; url: string; wait?: number }[] = [
    { name: "01-counter-big-snooker", url: "/counter/big-snooker" },
    { name: "02-counter-pool-mini", url: "/counter/pool-mini" },
    { name: "03-counter-cafe", url: "/counter/cafe" },
    { name: "04-checkout", url: "/checkout" },
    { name: "05-customers", url: "/customers" },
    { name: "06-customer-detail", url: "/customers" },
    { name: "07-admin", url: "/admin", wait: 500 },
  ];

  for (const shot of shots) {
    if (shot.name === "06-customer-detail") {
      await page.goto(`${BASE}/customers`);
      const firstLink = page.locator('a[href^="/customers/"]').first();
      if (await firstLink.count()) {
        await firstLink.click();
        await page.waitForURL(/\/customers\/.+/);
      }
      await page.screenshot({
        path: path.join(OUT, `${shot.name}.png`),
        fullPage: false,
      });
      console.log(`Saved ${shot.name}.png`);
      continue;
    }
    await page.goto(`${BASE}${shot.url}`);
    if (shot.wait) await page.waitForTimeout(shot.wait);
    await page.screenshot({
      path: path.join(OUT, `${shot.name}.png`),
      fullPage: false,
    });
    console.log(`Saved ${shot.name}.png`);
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
