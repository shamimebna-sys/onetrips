import { test, expect } from "@playwright/test";
import { continueToBooking, fillPassengerAndPay, followTestIdHref, loginCustomer, travelDate } from "./helpers/journey";

function checkOutDate() {
  const date = new Date();
  date.setDate(date.getDate() + 23);
  return date.toISOString().slice(0, 10);
}

test("home Hotels tab returns mock hotel results", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("product-hotels").click();
  await page.getByTestId("search-destination").fill("DAC");
  await page.getByTestId("search-check-in").fill(travelDate());
  await page.getByTestId("search-check-out").fill(checkOutDate());
  await page.getByTestId("search-hotel-submit").click();
  await page.waitForURL(/\/hotels/);
  await expect(page.getByTestId("select-hotel").first()).toBeVisible({ timeout: 30_000 });
});

test("hotel book to voucher", async ({ page }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
  const password = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";
  await loginCustomer(page, email, password);
  await page.goto("/");
  await page.getByTestId("product-hotels").click();
  await page.getByTestId("search-destination").fill("DAC");
  await page.getByTestId("search-check-in").fill(travelDate());
  await page.getByTestId("search-check-out").fill(checkOutDate());
  await page.getByTestId("search-hotel-submit").click();
  await followTestIdHref(page, "select-hotel", 60_000);
  await page.waitForURL(/\/hotels\//);
  await followTestIdHref(page, "select-room", 90_000);
  await expect(page).toHaveURL(/\/hotels\/review/);
  await continueToBooking(page);
  await fillPassengerAndPay(page);
  await expect(page.getByTestId("booking-status")).toContainText(/Ticketed|Voucher/i, { timeout: 60_000 });
});
