import { afterEach, describe, expect, it } from "vitest";
import { RateLimitError } from "@onetrips/shared";
import { consumeRateLimit } from "./rate-limit";
import { resetObservabilityRedisForTests } from "./redis";
import { assertProductionEnv, assertPostgresDatabaseUrl } from "./env";
import { publicErrorPayload } from "./http-error";

describe("rate limit", () => {
  it("allows requests under the limit and blocks after", async () => {
    resetObservabilityRedisForTests();
    delete process.env.REDIS_URL;
    const bucket = `test:${Date.now()}`;
    expect((await consumeRateLimit(bucket, 2, 60_000)).ok).toBe(true);
    expect((await consumeRateLimit(bucket, 2, 60_000)).ok).toBe(true);
    const blocked = await consumeRateLimit(bucket, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("production env", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("skips checks outside production", () => {
    process.env.NODE_ENV = "development";
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("rejects placeholder JWT secrets", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "replace-with-long-random-string-please";
    process.env.JWT_REFRESH_SECRET = "another-replace-with-long-random-string";
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    process.env.PAYMENT_WEBHOOK_SECRET = "a".repeat(32);
    process.env.DATABASE_URL = "postgresql://x";
    process.env.REDIS_URL = "redis://localhost";
    expect(() => assertProductionEnv()).toThrow(/placeholder/i);
  });

  it("rejects MySQL DATABASE_URL in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    process.env.PAYMENT_WEBHOOK_SECRET = "a".repeat(32);
    process.env.DATABASE_URL = "mysql://x";
    process.env.REDIS_URL = "redis://localhost";
    expect(() => assertProductionEnv()).toThrow("PostgreSQL is required for production.");
  });

  it("rejects mysql2:// DATABASE_URL in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    process.env.PAYMENT_WEBHOOK_SECRET = "a".repeat(32);
    process.env.DATABASE_URL = "mysql2://x";
    process.env.REDIS_URL = "redis://localhost";
    expect(() => assertProductionEnv()).toThrow("PostgreSQL is required for production.");
  });

  it("rejects MySQL DATABASE_URL even outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "mysql://127.0.0.1:3306/flight_app";
    expect(() => assertPostgresDatabaseUrl()).toThrow("PostgreSQL is required for production.");
  });

  it("accepts a PostgreSQL DATABASE_URL", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://onetrips@localhost:5432/onetrips";
    expect(() => assertPostgresDatabaseUrl()).not.toThrow();
  });

  it("rejects missing DATABASE_URL in production runtime", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    process.env.PAYMENT_WEBHOOK_SECRET = "a".repeat(32);
    process.env.REDIS_URL = "redis://localhost";
    delete process.env.DATABASE_URL;
    expect(() => assertPostgresDatabaseUrl()).toThrow("PostgreSQL is required for production.");
    expect(() => assertProductionEnv()).toThrow("DATABASE_URL must be set in production.");
  });
});

describe("public errors", () => {
  it("maps rate limits to 429 with Retry-After", () => {
    const payload = publicErrorPayload(new RateLimitError("slow down", 12));
    expect(payload.status).toBe(429);
    expect(payload.headers["Retry-After"]).toBe("12");
    expect(payload.body.code).toBe("RATE_LIMITED");
  });
});
