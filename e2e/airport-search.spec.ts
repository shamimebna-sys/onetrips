import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginCustomer } from "./helpers/journey";

async function airportCodes(request: APIRequestContext, q: string) {
  const res = await request.get(`/api/catalog/airports?q=${encodeURIComponent(q)}`);
  expect(res.ok()).toBeTruthy();
  const data = (await res.json()) as { airports?: Array<{ iataCode: string }> };
  return (data.airports ?? []).map((row) => row.iataCode);
}

async function expectPickerMatch(page: Page, testId: string, query: string, iata: string) {
  await page.getByTestId(testId).fill(query);
  await expect(page.getByRole("option", { name: new RegExp(iata) })).toBeVisible();
}

test("airport catalog search matches code, city, and country", async ({ request }) => {
  expect(await airportCodes(request, "BKK")).toContain("BKK");
  expect(await airportCodes(request, "Bangkok")).toContain("BKK");
  expect(await airportCodes(request, "Thailand")).toContain("BKK");
  expect(await airportCodes(request, "Thai")).toContain("BKK");
  expect(await airportCodes(request, "DAC")).toContain("DAC");
  expect(await airportCodes(request, "Dhaka")).toContain("DAC");
  expect(await airportCodes(request, "Bangladesh")).toContain("DAC");
  expect(await airportCodes(request, "DXB")).toContain("DXB");
  expect(await airportCodes(request, "Dubai")).toContain("DXB");

  const thailand = await airportCodes(request, "Thailand");
  expect(await airportCodes(request, "thailand")).toEqual(thailand);
  expect(await airportCodes(request, "THAILAND")).toEqual(thailand);
  expect(await airportCodes(request, " Thailand ")).toEqual(thailand);

  expect(await airportCodes(request, "bang")).toContain("BKK");
  expect(await airportCodes(request, "dub")).toContain("DXB");
  expect((await airportCodes(request, "BKK"))[0]).toBe("BKK");

  expect(await airportCodes(request, "France")).toContain("CDG");
  expect(await airportCodes(request, "Canada")).toContain("YYZ");
  expect(await airportCodes(request, "United Kingdom")).toContain("LHR");
  expect(await airportCodes(request, "Sri Lanka")).toContain("CMB");
  expect(await airportCodes(request, "Australia")).toContain("SYD");
  expect((await airportCodes(request, "FRA"))[0]).toBe("FRA");
  expect((await airportCodes(request, "CAN"))[0]).toBe("CAN");
});

test("homepage airport picker finds country and city names", async ({ page }) => {
  await page.goto("/");
  await expectPickerMatch(page, "search-origin", "Thailand", "BKK");
  await expectPickerMatch(page, "search-origin", "Bangkok", "BKK");
  await expectPickerMatch(page, "search-origin", "BKK", "BKK");
  await expectPickerMatch(page, "search-origin", "Dhaka", "DAC");
  await expectPickerMatch(page, "search-origin", "Dubai", "DXB");
  await expectPickerMatch(page, "search-origin", "France", "CDG");
  await expectPickerMatch(page, "search-origin", "Canada", "YYZ");
  await expectPickerMatch(page, "search-destination", "United Kingdom", "LHR");
  await expectPickerMatch(page, "search-destination", "Sri Lanka", "CMB");
});

test("flights page airport picker finds country names", async ({ page }) => {
  await page.goto("/flights");
  await expectPickerMatch(page, "search-origin", "Bangladesh", "DAC");
  await expectPickerMatch(page, "search-destination", "Australia", "SYD");
});

test("account airport picker finds country names", async ({ page }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
  const password = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";
  await loginCustomer(page, email, password);
  await expect(page.getByTestId("account-flight-search")).toBeVisible();
  await expectPickerMatch(page, "search-origin", "Thailand", "BKK");
  await expectPickerMatch(page, "search-origin", "France", "CDG");
  await expectPickerMatch(page, "search-destination", "Canada", "YYZ");
});
