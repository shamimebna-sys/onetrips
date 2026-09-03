import { describe, expect, it } from "vitest";
import { ProviderTimeoutError } from "@onetrips/shared";
import { withTimeout } from "./timeout";

describe("withTimeout", () => {
  it("returns the work result", async () => {
    await expect(withTimeout(Promise.resolve(7), 50, { provider: "mock-gds", operation: "search", correlationId: "c" })).resolves.toBe(7);
  });

  it("throws a provider timeout", async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 20, { provider: "mock-gds", operation: "search", correlationId: "c" }),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
  });
});
