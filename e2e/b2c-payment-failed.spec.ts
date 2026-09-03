import { test, expect } from "@playwright/test";
import { fillPassengerAndPay, loginCustomer, searchAndSelect } from "./helpers/journey";

const email = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
const password = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";

test("payment decline keeps PAYMENT_FAILED and retry available", async ({ page }) => {
  await loginCustomer(page, email, password);
  await searchAndSelect(page);
  await fillPassengerAndPay(page, { decline: true });
  await expect(page.getByTestId("booking-status")).toContainText(/Payment failed/i, { timeout: 30_000 });
  await expect(page.getByTestId("pay-now")).toBeVisible();
  await expect(page.getByTestId("pay-now")).toContainText(/Retry payment/i);
});
