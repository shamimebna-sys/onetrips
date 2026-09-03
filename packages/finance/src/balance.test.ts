import { describe, expect, it } from "vitest";
import { deriveBalance } from "./balance";

describe("ledger balance", () => {
  it("treats debit as spend and deposit/credit/refund as funds in", () => {
    const balance = deriveBalance([
      { type: "DEPOSIT", amount: "1000" },
      { type: "DEBIT", amount: "250" },
      { type: "REFUND", amount: "50" },
      { type: "CREDIT", amount: "10" },
    ]);
    expect(balance).toBe(810);
  });
});
