import { expect, test, type Page } from "@playwright/test";
import { loginCustomer } from "./helpers/journey";

function isoDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const DATE_1 = isoDate(21);
const DATE_2 = isoDate(28);
const DATE_3 = isoDate(35);

async function selectTripType(page: Page, name: "One Way" | "Round Trip" | "Multi-City") {
  await page.getByRole("tab", { name }).click();
}

async function selectMultiCity(page: Page) {
  await selectTripType(page, "Multi-City");
}

async function fillThreeSegments(page: Page) {
  await expect(page.getByTestId("multi-city-segments")).toBeVisible();
  await page.getByTestId("search-add-segment").click();
  await expect(page.getByTestId("search-origin-3")).toBeVisible();

  await page.getByTestId("search-origin-1").fill("DAC");
  await page.getByTestId("search-dest-1").fill("DXB");
  await page.getByTestId("search-date-1").fill(DATE_1);

  await page.getByTestId("search-origin-2").fill("DXB");
  await page.getByTestId("search-dest-2").fill("LHR");
  await page.getByTestId("search-date-2").fill(DATE_2);

  await page.getByTestId("search-origin-3").fill("LHR");
  await page.getByTestId("search-dest-3").fill("SIN");
  await page.getByTestId("search-date-3").fill(DATE_3);

  await page.getByTestId("search-remove-segment-3").click();
  await expect(page.getByTestId("search-origin-3")).toHaveCount(0);
}

function expectMultiCityBody(body: { tripType: string; segments: Array<{ origin: string; destination: string; date: string }> }) {
  expect(body.tripType).toBe("multi-city");
  expect(body.segments).toEqual([
    { origin: "DAC", destination: "DXB", date: DATE_1 },
    { origin: "DXB", destination: "LHR", date: DATE_2 },
  ]);
}

test("homepage Multi-City search builds the canonical query and request", async ({ page }) => {
  await page.goto("/");
  await selectMultiCity(page);
  await fillThreeSegments(page);

  const queryNav = page.waitForRequest(
    (req) => req.method() === "GET" && req.url().includes("/flights?") && req.url().includes("type=multi-city"),
  );
  const searchRequest = page.waitForRequest(
    (req) => req.url().includes("/api/flights/search") && req.method() === "POST",
  );
  await page.getByRole("button", { name: "Search Flights" }).click();
  expect(decodeURIComponent((await queryNav).url())).toContain(`segments=DAC~DXB~${DATE_1},DXB~LHR~${DATE_2}`);
  expectMultiCityBody((await searchRequest).postDataJSON());

  await page.goBack();
  await expect(page.getByTestId("multi-city-segments")).toBeVisible();
  await expect(page.getByTestId("search-origin-1")).toHaveValue("DAC");
  await expect(page.getByTestId("search-dest-2")).toHaveValue("LHR");
  await expect(page.getByTestId("search-origin-3")).toHaveCount(0);
});

test("account Multi-City matches homepage search request", async ({ page }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
  const password = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";
  await loginCustomer(page, email, password);

  await expect(page.getByTestId("account-flight-search")).toBeVisible();
  await expect(page.getByRole("tab", { name: "One Way" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Round Trip" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Multi-City" })).toBeVisible();

  await page.getByRole("tab", { name: "Multi-City" }).click();
  await fillThreeSegments(page);

  const queryNav = page.waitForRequest(
    (req) => req.method() === "GET" && req.url().includes("/flights?") && req.url().includes("type=multi-city"),
  );
  const searchRequest = page.waitForRequest(
    (req) => req.url().includes("/api/flights/search") && req.method() === "POST",
  );
  await page.getByTestId("account-search-flights").click();
  expect(decodeURIComponent((await queryNav).url())).toContain(`segments=DAC~DXB~${DATE_1},DXB~LHR~${DATE_2}`);
  expectMultiCityBody((await searchRequest).postDataJSON());

  await expect(page.getByRole("tab", { name: "Multi-City" })).toBeVisible();
  await expect(page.getByTestId("multi-city-segments")).toBeVisible();
  await expect(page.getByTestId("search-origin-1")).toHaveValue("DAC");
  await expect(page.getByTestId("search-dest-2")).toHaveValue("LHR");

  await page.goto("/account");
  await expect(page.getByTestId("account-flight-search")).toBeVisible();
  await page.getByRole("tab", { name: "Multi-City" }).click();
  await expect(page.getByTestId("multi-city-segments")).toBeVisible();

  await page.getByRole("tab", { name: "One Way" }).click();
  await expect(page.getByTestId("multi-city-segments")).toHaveCount(0);
  await expect(page.getByTestId("account-search-flights")).toBeVisible();

  await page.getByRole("tab", { name: "Round Trip" }).click();
  await expect(page.getByTestId("search-return")).toBeVisible();
  const roundTripNav = page.waitForRequest(
    (req) => req.method() === "GET" && req.url().includes("/flights?") && req.url().includes("type=round-trip"),
  );
  await page.getByTestId("account-search-flights").click();
  expect((await roundTripNav).url()).toContain("type=round-trip");
});

test("/flights search entry includes Multi-City", async ({ page }) => {
  await page.goto("/flights");
  await expect(page.getByRole("tab", { name: "Multi-City" })).toBeVisible();
  await page.getByRole("tab", { name: "Multi-City" }).click();
  await fillThreeSegments(page);

  const searchRequest = page.waitForRequest(
    (req) => req.url().includes("/api/flights/search") && req.method() === "POST",
  );
  await page.getByRole("button", { name: "Search Flights" }).click();
  const request = await searchRequest;
  expectMultiCityBody(request.postDataJSON());
});

test("One Way and Round Trip still search from homepage", async ({ page }) => {
  await page.goto("/");
  await selectTripType(page, "One Way");
  await page.getByTestId("search-origin").fill("DAC");
  await page.getByTestId("search-destination").fill("DXB");
  await page.getByTestId("search-departure").fill(DATE_1);
  const oneWayNav = page.waitForRequest(
    (req) => req.method() === "GET" && req.url().includes("/flights?") && req.url().includes("type=one-way"),
  );
  await page.getByTestId("search-submit").click();
  const oneWayUrl = decodeURIComponent((await oneWayNav).url());
  expect(oneWayUrl).toContain("type=one-way");
  expect(oneWayUrl).toContain("from=DAC");
  expect(oneWayUrl).toContain("to=DXB");

  await page.goto("/");
  await selectTripType(page, "Round Trip");
  await page.getByTestId("search-origin").fill("DAC");
  await page.getByTestId("search-destination").fill("DXB");
  await page.getByTestId("search-departure").fill(DATE_1);
  await page.getByTestId("search-return").fill(DATE_2);
  const roundTripNav = page.waitForRequest(
    (req) => req.method() === "GET" && req.url().includes("/flights?") && req.url().includes("type=round-trip"),
  );
  await page.getByRole("button", { name: "Search Flights" }).click();
  const roundTripUrl = decodeURIComponent((await roundTripNav).url());
  expect(roundTripUrl).toContain("type=round-trip");
  expect(roundTripUrl).toContain(`return=${DATE_2}`);
});

test("Multi-City UI does not overflow on mobile", async ({ page }) => {
  const viewports = [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  const email = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
  const password = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";
  await loginCustomer(page, email, password);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/account");
    await expect(page.getByTestId("account-flight-search")).toBeVisible();
    await page.getByRole("tab", { name: "Round Trip" }).click();
    await expect(page.getByTestId("search-departure")).toBeVisible();
    await expect(page.getByTestId("search-return")).toBeVisible();
    const dateClipped = await page.getByTestId("search-departure").evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(dateClipped, `departure clipped @ ${viewport.width}`).toBeFalsy();
    await page.getByRole("tab", { name: "Multi-City" }).click();
    await expect(page.getByTestId("multi-city-segments")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `/account Multi-City @ ${viewport.width}`).toBeLessThanOrEqual(2);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await selectMultiCity(page);
  await expect(page.getByTestId("multi-city-segments")).toBeVisible();
  await page.goto("/flights");
  await page.getByRole("tab", { name: "Multi-City" }).click();
  await expect(page.getByTestId("multi-city-segments")).toBeVisible();
});
