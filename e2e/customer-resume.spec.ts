import { expect, test } from "@playwright/test";
import { fillPassengerAndPay, followTestIdHref, loginCustomer, registerCustomer, travelDate } from "./helpers/journey";

test("anonymous flight selection resumes after login", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e.resume.${suffix}@onetrips.test`;
  const phone = `017${suffix.padStart(8, "0").slice(-8)}`;
  await registerCustomer(page, email, phone);
  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("menuitem", { name: /logout/i }).click();

  await page.goto("/");
  await page.getByTestId("search-origin").fill("DAC");
  await page.getByTestId("search-destination").fill("DXB");
  await page.getByTestId("search-departure").fill(travelDate());
  await page.getByTestId("search-submit").click();
  await page.waitForURL(/\/flights/);
  await followTestIdHref(page, "select-fare", 60_000);
  await expect(page).toHaveURL(/\/flights\/review/);
  await followTestIdHref(page, "continue-booking");
  await page.waitForURL(/\/login\/customer/, { timeout: 30_000 });
  expect(page.url()).toMatch(/next=/);

  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill("E2eJourney#14D");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/booking\//, { timeout: 90_000 });
  await expect(page.getByTestId("booking-status")).toBeVisible({ timeout: 60_000 });
});

test("loginCustomer helper still reaches account", async ({ page }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
  const password = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";
  await loginCustomer(page, email, password);
  await expect(page).toHaveURL(/\/account/);
});
