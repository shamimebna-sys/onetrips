import { describe, expect, it } from "vitest";
import { ProviderRateLimitError, ProviderBookingError } from "@onetrips/shared";
import { isSafeToRetry, withRetry } from "./retry";

describe("retry policy", () => {
  it("retries only safe operations", () => {
    expect(isSafeToRetry("search")).toBe(true);
    expect(isSafeToRetry("getBookingStatus")).toBe(true);
    expect(isSafeToRetry("createBooking")).toBe(false);
    expect(isSafeToRetry("issueTicket")).toBe(false);
    expect(isSafeToRetry("cancelBooking")).toBe(false);
  });

  it("does not retry a booking failure", async () => {
    let calls = 0;
    await expect(
      withRetry("createBooking", async () => {
        calls += 1;
        throw new ProviderBookingError({ provider: "mock-gds", operation: "createBooking", correlationId: "c1" });
      }),
    ).rejects.toBeInstanceOf(ProviderBookingError);
    expect(calls).toBe(1);
  });

  it("retries a rate-limited search", async () => {
    let calls = 0;
    const result = await withRetry(
      "search",
      async () => {
        calls += 1;
        if (calls < 2) {
          throw new ProviderRateLimitError({ provider: "mock-gds", operation: "search", correlationId: "c1" });
        }
        return "ok";
      },
      { retries: 2, delayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });
});
