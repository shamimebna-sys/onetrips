import { test, expect } from "@playwright/test";
import { fillPassengerAndPay, loginCustomer, searchAndSelect } from "./helpers/journey";

const emailA = process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test";
const passwordA = process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D";
const emailB = process.env.E2E_CUSTOMER_B_EMAIL || "e2e.customer.b@onetrips.test";
const passwordB = process.env.E2E_CUSTOMER_B_PASSWORD || "E2eCustomerB#14D";

test("customer B cannot open customer A booking, ticket, or invoice", async ({ page, browser }) => {
  await loginCustomer(page, emailA, passwordA);
  await searchAndSelect(page);
  await fillPassengerAndPay(page);
  await expect(page.getByTestId("booking-status")).toContainText(/Ticketed/i, { timeout: 60_000 });
  const id = page.url().split("/booking/")[1]?.split(/[?#]/)[0];
  expect(id).toBeTruthy();
  const ticketHref = await page.getByTestId("ticket-pdf").getAttribute("href");
  const invoiceHref = await page.getByTestId("invoice-pdf").getAttribute("href");

  const other = await browser.newContext();
  const pageB = await other.newPage();
  await loginCustomer(pageB, emailB, passwordB);
  expect((await pageB.request.get(`/api/bookings/${id}`)).status()).toBe(403);
  expect([401, 403, 404]).toContain((await pageB.request.get(ticketHref!)).status());
  expect([401, 403, 404]).toContain((await pageB.request.get(invoiceHref!)).status());
  await pageB.goto(`/booking/${id}`);
  await expect(pageB.locator("body")).toContainText(/cannot access this booking|Booking not found|Please sign in/i);

  const payments = await pageB.request.get("/api/account/payments");
  expect(payments.ok()).toBeTruthy();
  expect(JSON.stringify(await payments.json())).not.toContain(id!);
  const invoices = await pageB.request.get("/api/account/invoices");
  expect(invoices.ok()).toBeTruthy();
  expect(JSON.stringify(await invoices.json())).not.toContain(id!);
  const notes = await pageB.request.get("/api/account/notifications");
  expect(notes.ok()).toBeTruthy();
  const support = await pageB.request.post("/api/account/support", {
    data: { category: "ticket", subject: "Help with tickets", message: "Cannot see the PDF for this booking.", bookingId: id },
  });
  expect(support.status()).toBe(403);
  await other.close();
});
