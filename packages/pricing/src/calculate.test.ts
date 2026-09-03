import { describe, expect, it } from "vitest";
import { calculateCustomerPrice } from "./calculate";

describe("calculateCustomerPrice", () => {
  it("adds markup and fee then subtracts discount", () => {
    const result = calculateCustomerPrice({
      supplierFare: 10000,
      supplierTaxes: 1200,
      markup: 400,
      serviceFee: 100,
      discount: 500,
    });
    expect(result.customerPrice).toBe(11200);
    expect(result.breakdown.discount).toBe(500);
  });

  it("keeps a zero-discount quote identical to gross", () => {
    const result = calculateCustomerPrice({
      supplierFare: 800,
      supplierTaxes: 50,
      markup: 0,
      serviceFee: 0,
      discount: 0,
    });
    expect(result.customerPrice).toBe(850);
  });
});
