import { afterEach, describe, expect, it } from "vitest";
import { assertApplicationDatabaseUrl } from "./assert-url";

describe("assertApplicationDatabaseUrl", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("accepts postgresql:// URLs", () => {
    expect(() =>
      assertApplicationDatabaseUrl("postgresql://onetrips@localhost:5432/onetrips", {
        required: true,
        production: true,
      }),
    ).not.toThrow();
  });

  it("accepts postgres:// URLs", () => {
    expect(() =>
      assertApplicationDatabaseUrl("postgres://onetrips@localhost:5432/onetrips", {
        required: true,
        production: true,
      }),
    ).not.toThrow();
  });

  it("rejects mysql:// URLs", () => {
    expect(() =>
      assertApplicationDatabaseUrl("mysql://onetrips@localhost:3306/onetrips", {
        required: true,
        production: true,
      }),
    ).toThrow("PostgreSQL is required for production.");
  });

  it("rejects mysql2:// URLs", () => {
    expect(() =>
      assertApplicationDatabaseUrl("mysql2://onetrips@localhost:3306/onetrips", {
        required: true,
        production: true,
      }),
    ).toThrow("PostgreSQL is required for production.");
  });

  it("rejects MySQL even outside production", () => {
    expect(() =>
      assertApplicationDatabaseUrl("mysql://127.0.0.1:3306/flight_app", {
        required: false,
        production: false,
      }),
    ).toThrow("PostgreSQL is required for production.");
  });

  it("rejects invalid URLs in production", () => {
    expect(() =>
      assertApplicationDatabaseUrl("not-a-database-url", { required: true, production: true }),
    ).toThrow("PostgreSQL is required for production.");
  });

  it("rejects invalid URLs outside production", () => {
    expect(() =>
      assertApplicationDatabaseUrl("not-a-database-url", { required: true, production: false }),
    ).toThrow("DATABASE_URL is not a valid URL.");
  });

  it("rejects non-Postgres protocols", () => {
    expect(() =>
      assertApplicationDatabaseUrl("http://localhost:5432/onetrips", { required: true, production: true }),
    ).toThrow("PostgreSQL is required for production.");
  });

  it("rejects missing DATABASE_URL when required at production runtime", () => {
    expect(() => assertApplicationDatabaseUrl(undefined, { required: true, production: true })).toThrow(
      "PostgreSQL is required for production.",
    );
    expect(() => assertApplicationDatabaseUrl("   ", { required: true, production: true })).toThrow(
      "PostgreSQL is required for production.",
    );
  });

  it("does not throw for a missing DATABASE_URL during build-only evaluation", () => {
    expect(() =>
      assertApplicationDatabaseUrl(undefined, { required: false, production: true }),
    ).not.toThrow();
  });
});
