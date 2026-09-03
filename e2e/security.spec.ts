import { test, expect } from "@playwright/test";

test("home page sends security headers", async ({ request }) => {
  const res = await request.get("/");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"] || "").toMatch(/default-src 'self'/);
});

test("health endpoint reports database and redis checks", async ({ request }) => {
  const res = await request.get("/api/health");
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  expect(body).toHaveProperty("ok");
  expect(body.app).toBe("web");
  expect(body.checks).toHaveProperty("database");
  expect(body.checks).toHaveProperty("redis");
  if (res.status() === 200) expect(body.ok).toBe(true);
});

test("cookie mutations reject a foreign Origin", async ({ request }) => {
  const res = await request.post("/api/auth/login", {
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    data: { email: "nobody@onetrips.test", password: "not-used" },
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.code).toBe("CSRF");
});
