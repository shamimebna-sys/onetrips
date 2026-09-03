import { test, expect } from "@playwright/test";
import { assertBookingState, disconnectDb } from "./helpers/db";
import { fillPassengerAndPay, registerCustomer, searchAndSelect } from "./helpers/journey";

test.afterAll(async () => {
  await disconnectDb();
});

test("B2C happy path: register, search, pay, ticket, invoice", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e.journey.${suffix}@onetrips.test`;
  const phone = `018${suffix.padStart(8, "0").slice(-8)}`;

  await registerCustomer(page, email, phone);
  await searchAndSelect(page);
  await expect(page.getByTestId("booking-status")).toContainText(/Traveler details|Checking fare/i);
  await fillPassengerAndPay(page);
  await expect(page.getByTestId("booking-status")).toContainText(/Ticketed/i, { timeout: 60_000 });
  await expect(page.getByTestId("booking-pnr")).toContainText(/PNR /);
  await expect(page.getByTestId("ticket-pdf")).toBeVisible();
  await expect(page.getByTestId("invoice-pdf")).toBeVisible();

  const bookingRef = (await page.getByTestId("booking-ref").innerText()).replace(/^Booking\s+/i, "").trim();
  const ticket = await page.request.get((await page.getByTestId("ticket-pdf").getAttribute("href"))!);
  expect(ticket.ok()).toBeTruthy();
  expect(ticket.headers()["content-type"]).toContain("pdf");
  const invoice = await page.request.get((await page.getByTestId("invoice-pdf").getAttribute("href"))!);
  expect(invoice.ok()).toBeTruthy();
  expect(invoice.headers()["content-type"]).toContain("pdf");

  await page.goto("/account/trips");
  await expect(page.getByTestId("account-booking").filter({ hasText: bookingRef })).toBeVisible();

  const state = await assertBookingState(bookingRef, email);
  expect(["BOOKED", "TICKETED"]).toContain(state.status);
  expect(state.paymentStatus).toBe("SUCCESS");
  expect(state.tickets).toBeGreaterThan(0);
  expect(state.invoices).toBeGreaterThan(0);
  expect(state.pnr).toBeTruthy();
});
