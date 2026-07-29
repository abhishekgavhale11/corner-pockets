import "./tests/helpers/register-paths";
import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const envLocal = resolve(root, ".env.local");
if (existsSync(envLocal)) {
  loadDotenv({ path: envLocal, override: true });
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
process.env.AUTH_URL = baseURL;
process.env.AUTH_TRUST_HOST = "true";

/** Prefer URI written by tests/e2e-stack.mjs when present (set after webServer starts). */
function syncMongoUriFromFile(): void {
  const uriFile = resolve(root, "tests/.mongo-uri");
  if (existsSync(uriFile)) {
    const uri = readFileSync(uriFile, "utf8").trim();
    if (uri) process.env.MONGODB_URI = uri;
  }
}

syncMongoUriFromFile();

const forceHeadless =
  process.env.CI === "true" || process.env.PLAYWRIGHT_HEADLESS === "1";

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/unit/**"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 420_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    // Watchable cashier runs (override with PLAYWRIGHT_HEADLESS=1 / CI).
    headless: forceHeadless,
    trace: "on",
    screenshot: "on",
    video: "on",
    launchOptions: {
      slowMo: forceHeadless ? 0 : 250,
    },
    viewport: { width: 1400, height: 900 },
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Explicit so device presets cannot flip headed mode off.
        headless: forceHeadless,
        viewport: { width: 1400, height: 900 },
      },
    },
  ],
  webServer: {
    command: "node tests/e2e-stack.mjs",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
