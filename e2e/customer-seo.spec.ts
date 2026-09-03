import { expect, test } from "@playwright/test";

test("sitemap and robots list public routes and hide private ones", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("/offers");
  expect(sitemapBody).toContain("/destinations");
  expect(sitemapBody).not.toContain("/account");

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  const robotsBody = await robots.text();
  expect(robotsBody).toMatch(/disallow: \/account/i);
  expect(robotsBody).toMatch(/sitemap:/i);
});

test("content pages expose landmarks and titles", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveTitle(/onetrips/i);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.getByRole("link", { name: /skip to content/i })).toBeAttached();
});
