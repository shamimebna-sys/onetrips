import { expect, type Page } from "@playwright/test";

export function travelDate() {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return date.toISOString().slice(0, 10);
}

export async function loginCustomer(page: Page, email: string, password: string) {
  await page.goto("/login/customer", { waitUntil: "domcontentloaded" });
  await page.getByTestId("login-submit").waitFor({ state: "visible" });
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/account/, { waitUntil: "domcontentloaded" });
}

export async function registerCustomer(page: Page, email: string, phone: string) {
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByTestId("signup-submit").waitFor({ state: "visible" });
  await page.getByTestId("signup-first").fill("E2E");
  await page.getByTestId("signup-last").fill("Traveler");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-phone").fill(phone);
  await page.getByTestId("signup-password").fill("E2eJourney#14D");
  await page.getByTestId("signup-confirm").fill("E2eJourney#14D");
  await page.getByTestId("signup-terms").check();
  await page.getByTestId("signup-privacy").check();
  await page.getByTestId("signup-submit").click();
  await page.waitForURL(/\/verify/, { timeout: 60_000 });
  await expect(page.getByTestId("dev-otp")).toBeVisible();
  const code = (await page.getByTestId("dev-otp").innerText()).replace(/\D/g, "").slice(-6);
  await page.getByTestId("otp-input").fill(code);
  await page.getByRole("button", { name: /verify email/i }).click();
  await page.waitForURL(/\/welcome/);
  await page.getByTestId("welcome-skip").click();
  await page.waitForURL(/\/account/);
}

export async function followTestIdHref(page: Page, testId: string, timeout = 90_000) {
  const target = page.getByTestId(testId).first();
  await expect(target).toBeVisible({ timeout });
  const href = await target.getAttribute("href");
  if (href) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
    return;
  }
  await target.click();
}

export async function continueToBooking(page: Page) {
  await followTestIdHref(page, "continue-booking");
  await page.waitForURL(/\/booking\//, { timeout: 90_000 });
}

export async function searchAndSelect(page: Page) {
  await page.goto("/");
  await page.getByTestId("search-origin").fill("DAC");
  await page.getByTestId("search-destination").fill("DXB");
  await page.getByTestId("search-departure").fill(travelDate());
  await page.getByTestId("search-submit").click();
  await page.waitForURL(/\/flights/);
  await followTestIdHref(page, "select-fare", 60_000);
  await expect(page).toHaveURL(/\/flights\/review/);
  await continueToBooking(page);
}

export async function fillPassengerAndPay(page: Page, opts?: { decline?: boolean }) {
  await expect(page.getByTestId("passenger-first-0")).toBeVisible({ timeout: 60_000 });
  for (let index = 0; await page.getByTestId(`passenger-first-${index}`).count(); index += 1) {
    await page.getByTestId(`passenger-first-${index}`).fill("E2E");
    await page.getByTestId(`passenger-last-${index}`).fill(index === 0 ? "Traveler" : `Guest${index}`);
    await page.getByTestId(`passenger-dob-${index}`).fill("1990-01-15");
    await expect(page.locator(`[data-testid="passenger-nationality-${index}"] option[value="BD"]`)).toHaveCount(1, { timeout: 20_000 });
    await page.getByTestId(`passenger-nationality-${index}`).selectOption("BD");
    await page.getByTestId(`passenger-passport-${index}`).fill(`E2E12345${index}`);
    await page.getByTestId(`passenger-passport-expiry-${index}`).fill("2030-12-31");
  }
  await expect(page.getByTestId("passenger-first-0")).toHaveValue("E2E");
  await page.getByTestId("continue-payment").click();
  await expect(page.getByTestId("pay-now")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("pay-now").click();
  await page.waitForURL(/\/pay\/sandbox/);
  if (opts?.decline) {
    await page.getByTestId("pay-decline").click();
  } else {
    await page.getByTestId("pay-success").click();
  }
}
