import { describe, expect, it } from "vitest";
import { redact } from "./log";

describe("log redaction", () => {
  it("strips secrets and passport fields", () => {
    const out = redact({
      apiKey: "super-secret",
      authorization: "Bearer abc",
      passenger: { firstName: "Ada", passportNumber: "A1234567" },
      offerId: "mock-gds:ow:DACDXB:0",
    }) as Record<string, unknown>;
    expect(out.apiKey).toBe("[redacted]");
    expect(out.authorization).toBe("[redacted]");
    expect((out.passenger as Record<string, unknown>).passportNumber).toBe("[redacted]");
    expect(out.offerId).toBe("mock-gds:ow:DACDXB:0");
  });
});
