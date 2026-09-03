import { describe, expect, it } from "vitest";
import { quoteFromCatalog } from "./engine";

const emptyCatalog = { markups: [], fees: [], commissions: [] };

describe("quoteFromCatalog", () => {
  it("keeps discount at zero when omitted", () => {
    const quote = quoteFromCatalog(
      { audience: "B2C", currency: "BDT", supplierBase: 10000, supplierTaxes: 1200 },
      emptyCatalog,
    );
    expect(quote.discount).toBe(0);
    expect(quote.customerPrice).toBe(11200);
  });

  it("subtracts an explicit discount from the authoritative total", () => {
    const quote = quoteFromCatalog(
      { audience: "B2C", currency: "BDT", supplierBase: 10000, supplierTaxes: 1200, discount: 500 },
      emptyCatalog,
    );
    expect(quote.discount).toBe(500);
    expect(quote.customerPrice).toBe(10700);
  });

  it("never applies a negative discount", () => {
    const quote = quoteFromCatalog(
      { audience: "B2C", currency: "BDT", supplierBase: 800, supplierTaxes: 50, discount: -20 },
      emptyCatalog,
    );
    expect(quote.discount).toBe(0);
    expect(quote.customerPrice).toBe(850);
  });
});
