import { describe, expect, it } from "vitest";
import { computeDiscount } from "./service";

describe("computeDiscount", () => {
  it("applies percent with a cap", () => {
    expect(computeDiscount({ total: 10000, percentOff: 20, maxDiscount: 1500 })).toBe(1500);
  });

  it("applies a flat amount", () => {
    expect(computeDiscount({ total: 800, amountOff: 100 })).toBe(100);
  });

  it("never exceeds the booking total", () => {
    expect(computeDiscount({ total: 50, amountOff: 80 })).toBe(50);
  });

  it("returns zero when no discount is configured", () => {
    expect(computeDiscount({ total: 1000 })).toBe(0);
  });
});
