import { describe, expect, it } from "vitest";
import {
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  isUnknownProviderOutcome,
} from "./errors";

describe("provider error model", () => {
  it("exposes a safe public payload", () => {
    const error = new ProviderUnavailableError({
      provider: "mock-gds",
      operation: "search",
      correlationId: "corr-secret",
      providerErrorCode: "AMAD_401",
      providerReference: "PNR123",
    });
    const pub = error.toPublicJSON();
    expect(pub.message).not.toMatch(/AMAD|PNR|secret|TypeError|prisma/i);
    expect(JSON.stringify(pub)).not.toContain("AMAD_401");
    expect(JSON.stringify(pub)).not.toContain("corr-secret");
    const ops = error.toOpsJSON();
    expect(ops.providerErrorCode).toBe("AMAD_401");
    expect(ops.correlationId).toBe("corr-secret");
  });

  it("marks timeouts as unknown outcomes", () => {
    const error = new ProviderTimeoutError({
      provider: "mock-gds",
      operation: "createBooking",
      correlationId: "c1",
    });
    expect(isUnknownProviderOutcome(error)).toBe(true);
    expect(new ProviderRateLimitError({ provider: "mock-gds", operation: "search", correlationId: "c1" }).httpStatus).toBe(429);
  });
});
