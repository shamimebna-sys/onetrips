import { describe, expect, it } from "vitest";
import { maskPassport } from "./secret";

describe("passport masking", () => {
  it("never returns the full number", () => {
    expect(maskPassport("A12345678")).toBe("•••••5678");
    expect(maskPassport(null)).toBeNull();
  });
});
