import { expect, test, type Page } from "@playwright/test";
import { loginCustomer } from "./helpers/journey";

async function selectAirport(page: Page, testId: string, query: string, iata: string) {
  const input = page.getByTestId(testId);
  await input.click();
  await input.fill(query);
  const option = page.getByRole("option", { name: new RegExp(iata) });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByTestId(`${testId}-list`)).toHaveCount(0);
  await expect(input).toHaveValue(iata);
}

async function expectAnchoredToField(page: Page, testId: string) {
  const input = page.getByTestId(testId);
  await input.fill("DAC");
  const list = page.getByTestId(`${testId}-list`);
  await expect(list).toBeVisible();
  const field = input.locator("xpath=ancestor::*[@data-airport-picker][1]");
  const fieldBox = await field.boundingBox();
  const listBox = await list.boundingBox();
  expect(fieldBox).toBeTruthy();
  expect(listBox).toBeTruthy();
  expect(Math.abs((listBox?.x ?? 0) - (fieldBox?.x ?? 0))).toBeLessThan(2);
  expect(Math.abs((listBox?.width ?? 0) - (fieldBox?.width ?? 0))).toBeLessThan(2);
  const gap = (listBox?.y ?? 0) - ((fieldBox?.y ?? 0) + (fieldBox?.height ?? 0));
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(8);
}

test("homepage origin and destination selection commits and closes", async ({ page }) => {
  await page.goto("/");
  await selectAirport(page, "search-origin", "DAC", "DAC");
  await selectAirport(page, "search-destination", "DXB", "DXB");
  await expect(page.getByTestId("search-origin")).toHaveValue("DAC");
  await expect(page.getByTestId("search-destination")).toHaveValue("DXB");
});

test("homepage picker selects city and country results including a typo", async ({ page }) => {
  await page.goto("/");
  await selectAirport(page, "search-origin", "Bangkok", "BKK");
  await selectAirport(page, "search-destination", "Tailand", "BKK");
  await page.getByTestId("search-origin").fill("Dhaka");
  await page.getByRole("option", { name: /DAC/ }).click();
  await expect(page.getByTestId("search-origin")).toHaveValue("DAC");
});

test("keyboard ArrowDown + Enter commits the highlighted airport", async ({ page }) => {
  await page.goto("/");
  const origin = page.getByTestId("search-origin");
  await origin.click();
  await origin.fill("DAC");
  await expect(page.getByRole("option", { name: /DAC/ })).toBeVisible();
  await origin.press("ArrowDown");
  await origin.press("Enter");
  await expect(origin).toHaveValue("DAC");
  await expect(page.getByTestId("search-origin-list")).toHaveCount(0);
});

test("dropdown is anchored to the origin field and stays above passenger controls", async ({ page }) => {
  await page.goto("/");
  await expectAnchoredToField(page, "search-origin");
  const list = page.getByTestId("search-origin-list");
  const passengers = page.locator("select").first();
  const listBox = await list.boundingBox();
  const passBox = await passengers.boundingBox();
  expect(listBox).toBeTruthy();
  expect(passBox).toBeTruthy();
  const stacked = await list.evaluate((node) => Number(getComputedStyle(node).zIndex));
  expect(stacked).toBeGreaterThanOrEqual(50);
});

test("/flights picker selection and destination alignment", async ({ page }) => {
  await page.goto("/flights");
  await selectAirport(page, "search-origin", "DAC", "DAC");
  await selectAirport(page, "search-destination", "Dubai", "DXB");
  await expectAnchoredToField(page, "search-destination");
});

test("account picker selection works for origin and destination", async ({ page }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
  const password = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";
  await loginCustomer(page, email, password);
  await expect(page.getByTestId("account-flight-search")).toBeVisible();
  await selectAirport(page, "search-origin", "BKK", "BKK");
  await selectAirport(page, "search-destination", "Thailand", "BKK");
});

test("multi-city segment pickers commit independently", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Multi-City" }).click();
  await expect(page.getByTestId("multi-city-segments")).toBeVisible();
  await selectAirport(page, "search-origin-1", "DAC", "DAC");
  await selectAirport(page, "search-dest-1", "DXB", "DXB");
  await selectAirport(page, "search-origin-2", "BKK", "BKK");
  await page.getByTestId("search-add-segment").click();
  await expect(page.getByTestId("search-origin-3")).toBeVisible();
  await selectAirport(page, "search-origin-3", "LHR", "LHR");
});

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test(`origin dropdown stays aligned at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expectAnchoredToField(page, "search-origin");
  });
}
