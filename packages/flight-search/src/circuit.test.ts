import { describe, expect, it, beforeEach } from "vitest";
import { assertCircuitClosed, recordCircuitFailure, recordCircuitSuccess, resetCircuitForTests } from "./circuit";

describe("circuit breaker", () => {
  beforeEach(() => {
    resetCircuitForTests();
  });

  it("opens after the failure threshold and recovers after cooldown", async () => {
    for (let i = 0; i < 5; i += 1) {
      await recordCircuitFailure("mock-gds", { threshold: 5, openMs: 20 });
    }
    expect(await assertCircuitClosed("mock-gds", { openMs: 20 })).toBe("OPEN");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await assertCircuitClosed("mock-gds", { openMs: 20 })).toBe("HALF_OPEN");
    await recordCircuitSuccess("mock-gds");
    expect(await assertCircuitClosed("mock-gds", { openMs: 20 })).toBe("CLOSED");
  });
});
