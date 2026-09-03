import { afterEach, describe, expect, it } from "vitest";
import { requireJwtSecret } from "./tokens";

describe("JWT secrets", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("uses a development fallback outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_SECRET;
    expect(requireJwtSecret("JWT_ACCESS_SECRET", "dev-access-secret")).toBe("dev-access-secret");
  });

  it("refuses hardcoded secrets in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => requireJwtSecret("JWT_ACCESS_SECRET", "dev-access-secret")).toThrow(/production/);
  });

  it("refuses example placeholder secrets in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "replace-with-long-random-string";
    expect(() => requireJwtSecret("JWT_ACCESS_SECRET", "dev-access-secret")).toThrow(/placeholder/i);
  });
});
