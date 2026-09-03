import { describe, expect, it } from "vitest";
import { getHealth } from "./health";

describe("getHealth", () => {
  it("returns the requested app identity even when dependencies fail", async () => {
    const health = await getHealth("web");
    expect(health.app).toBe("web");
    expect(health).toHaveProperty("ok");
    expect(health).toHaveProperty("degraded");
    expect(health.checks).toHaveProperty("database");
    expect(health.checks).toHaveProperty("redis");
  });
});
