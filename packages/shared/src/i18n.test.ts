import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, t } from "./i18n";

describe("i18n helpers", () => {
  it("formats BDT without a currency code prefix", () => {
    expect(formatMoney(1500, "BDT")).toContain("1,500");
  });

  it("returns English catalog copy by default", () => {
    expect(t("nav.flights")).toBe("Flights");
  });

  it("formats a calendar date", () => {
    expect(formatDate("2026-08-24")).toMatch(/24/);
  });
});
