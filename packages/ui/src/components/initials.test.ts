import { describe, expect, it } from "vitest";
import { initialsFromName } from "./initials";

describe("initialsFromName", () => {
  it("uses first and last name letters", () => {
    expect(initialsFromName("E2E Traveler")).toBe("ET");
  });

  it("uses two letters from a single name", () => {
    expect(initialsFromName("Nadia")).toBe("NA");
  });

  it("falls back when empty", () => {
    expect(initialsFromName("   ")).toBe("OT");
  });
});
