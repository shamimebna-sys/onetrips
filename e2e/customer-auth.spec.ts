import { expect, test } from "@playwright/test";
import { loginCustomer, registerCustomer } from "./helpers/journey";

test("forgot and reset password returns the customer to login", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e.reset.${suffix}@onetrips.test`;
  const phone = `016${suffix.padStart(8, "0").slice(-8)}`;
  await registerCustomer(page, email, phone);
  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("menuitem", { name: /logout/i }).click();

  await page.goto("/forgot-password");
  await page.getByTestId("forgot-email").fill(email);
  await page.getByTestId("forgot-submit").click();
  await page.waitForURL(/\/reset-password/);
  await expect(page.getByTestId("dev-otp")).toBeVisible();
  const code = (await page.getByTestId("dev-otp").innerText()).replace(/\D/g, "").slice(-6);
  await page.getByTestId("reset-code").fill(code);
  await page.getByTestId("reset-password").fill("E2eReset#14D");
  await page.getByTestId("reset-confirm").fill("E2eReset#14D");
  await page.getByTestId("reset-submit").click();
  await page.waitForURL(/\/login\/customer/);
  await loginCustomer(page, email, "E2eReset#14D");
  await expect(page).toHaveURL(/\/account/);
});
