import { expect, test } from "@playwright/test";

test("customer chrome and content pages have real links", async ({ page }) => {
  const mobile = test.info().project.name === "mobile";

  if (mobile) {
    await page.goto("/offers");
  } else {
    await page.goto("/");
    await page.getByRole("link", { name: "Offers" }).first().click();
  }
  await expect(page).toHaveURL(/\/offers/);
  await expect(page.getByRole("heading", { name: /offers/i })).toBeVisible();

  if (mobile) {
    await page.goto("/about");
  } else {
    await page.goto("/");
    await page.getByRole("link", { name: "About" }).click();
  }
  await expect(page).toHaveURL(/\/about/);
  await expect(page.getByRole("heading", { name: /about onetrips/i })).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /terms/i })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: /help/i })).toBeVisible();
  await page.goto("/destinations");
  await expect(page.getByRole("heading", { name: /destinations/i })).toBeVisible();
  await page.getByRole("heading", { name: "Dhaka" }).click();
  await expect(page).toHaveURL(/\/destination\/dhaka/);

  await page.goto("/flights");
  if (mobile) {
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  }
  await expect(page.getByRole("contentinfo")).toContainText(/Terms/i);
});
