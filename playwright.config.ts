import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(".env"));
loadEnvFile(resolve("apps/web/.env"));

const port = process.env.PLAYWRIGHT_PORT || "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    actionTimeout: 60_000,
    navigationTimeout: 90_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] }, testMatch: /(customer-shell|hotel-search|customer-portal)\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_WEBSERVER || `npx next dev --port ${port}`,
    cwd: resolve("apps/web"),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      PORT: port,
      NEXT_PUBLIC_APP_URL: baseURL,
      FLIGHT_PROVIDER: "mock",
      MOCK_GDS_SCENARIO: "SUCCESS",
      HOTEL_PROVIDER: "mock",
      MOCK_HOTEL_SCENARIO: "SUCCESS",
      NOTIFY_INLINE: "1",
    },
  },
});
