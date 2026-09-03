import { describe, expect, it } from "vitest";
import { addCents, fromCents, toCents } from "./money";

describe("money helpers", () => {
  it("converts major units to cents without float error", () => {
    expect(toCents(10.1)).toBe(1010);
    expect(toCents("19.99")).toBe(1999);
    expect(fromCents(1999)).toBe(19.99);
  });

  it("adds integer cents", () => {
    expect(fromCents(addCents(toCents(10), toCents(0.2), toCents(-1.05)))).toBe(9.15);
  });
});
