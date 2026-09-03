import { expect, test } from "@playwright/test";
import { registerCustomer } from "./helpers/journey";

const ACCOUNT_ROUTES = [
  "/account",
  "/account/trips",
  "/account/travelers",
  "/account/profile",
  "/account/payments",
  "/account/invoices",
  "/account/notifications",
  "/account/preferences",
  "/account/security",
  "/account/support",
];

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, label).toBeLessThanOrEqual(2);
}

test("customer portal identity, booking search, trips, and navigation", async ({ page }) => {
  const mobile = test.info().project.name === "mobile";
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e.portal.${suffix}@onetrips.test`;
  const phone = `015${suffix.padStart(8, "0").slice(-8)}`;
  await registerCustomer(page, email, phone);

  await expect(page.getByText(/Good (morning|afternoon|evening), E2E\b/)).toBeVisible();
  await expect(page.getByTestId("account-flight-search")).toBeVisible();
  await expect(page.getByRole("link", { name: "Search Flights" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Search Hotels" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "My Trips" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Travelers" }).first()).toBeVisible();
  await expect(page.getByTestId("header-notifications")).toBeVisible();

  if (mobile) {
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
    await expect(page.getByTestId("mobile-trips")).toBeVisible();
    await expect(page.getByTestId("mobile-alerts")).toBeVisible();
    await expect(page.getByTestId("mobile-account")).toBeVisible();
    await page.getByTestId("mobile-book").click();
    await expect(page.getByRole("dialog", { name: "Book" })).toBeVisible();
    await expect(page.getByTestId("mobile-book-flights")).toBeVisible();
    await expect(page.getByTestId("mobile-book-hotels")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByTestId("mobile-alerts").click();
    await expect(page).toHaveURL(/\/account\/notifications/);
    await page.getByTestId("mobile-account").click();
    await expect(page).toHaveURL(/\/account\/?$/);
  } else {
    await expect(page.getByTestId("account-sidebar")).toBeVisible();
    const primary = page.getByRole("navigation", { name: "Primary" });
    await expect(primary.getByRole("link", { name: "Flights" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Hotels" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Offers" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "My Trips" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Help" }).first()).toBeVisible();
    await expect(page.getByTestId("account-sidebar").getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByTestId("account-sidebar").getByText("Travel", { exact: true })).toBeVisible();
    await expect(page.getByTestId("account-sidebar").getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByTestId("account-sidebar").getByRole("link", { name: "Support" })).toBeVisible();
  }

  await page.getByTestId("account-menu").click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "My Account" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "My Trips" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Travelers" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Payments" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Invoices" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Preferences" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Security" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Help & Support" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /logout/i })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("product-hotels").click();
  await expect(page.getByTestId("account-hotel-search")).toBeVisible();
  await page.getByTestId("product-flights").click();
  await page.getByTestId("account-search-flights").click();
  await expect(page).toHaveURL(/\/flights/);

  await page.goto("/account/trips");
  await expect(page.getByRole("link", { name: /Explore Flights/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore Hotels/i })).toBeVisible();

  const bookingsRes = await page.request.get("/api/account/bookings");
  expect(bookingsRes.ok()).toBeTruthy();
  const bookingsBody = await bookingsRes.json();
  expect(Array.isArray(bookingsBody.bookings)).toBeTruthy();
  for (const row of bookingsBody.bookings) {
    expect(row).toHaveProperty("airlineCode");
    expect(row).toHaveProperty("flightNumber");
    if (row.type !== "HOTEL" && row.airlineCode && row.airlineCode !== "HT") {
      await expect(page.getByTestId("trip-flight")).toContainText(row.airlineCode);
    }
  }

  await page.goto("/account/bookings");
  await expect(page).toHaveURL(/\/account\/trips/);
  await page.goto("/account/passengers");
  await expect(page).toHaveURL(/\/account\/travelers/);
  await page.goto("/account/settings");
  await expect(page).toHaveURL(/\/account\/security/);

  for (const route of ACCOUNT_ROUTES) {
    await page.goto(route);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  }

  if (!mobile) {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/account");
      await assertNoHorizontalOverflow(page, `/account @ ${viewport.width}`);
      await page.goto("/account/trips");
      await assertNoHorizontalOverflow(page, `/account/trips @ ${viewport.width}`);
    }
  }

  await page.setViewportSize(mobile ? { width: 393, height: 851 } : { width: 1280, height: 800 });
  await page.goto("/account");
  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("menuitem", { name: /logout/i }).click();
  await expect(page).toHaveURL(/\/$/);
});
