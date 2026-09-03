import { describe, expect, it } from "vitest";
import { isSafeReturnPath, safeReturnPath } from "./urls";

describe("isSafeReturnPath", () => {
  it("accepts relative app paths", () => {
    expect(isSafeReturnPath("/booking/start?sid=a&offer=b")).toBe(true);
    expect(isSafeReturnPath("/account/trips")).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(isSafeReturnPath("https://evil.test")).toBe(false);
    expect(isSafeReturnPath("//evil.test")).toBe(false);
    expect(isSafeReturnPath("/\\evil.test")).toBe(false);
    expect(isSafeReturnPath(null)).toBe(false);
  });
});

describe("safeReturnPath", () => {
  it("falls back when unsafe", () => {
    expect(safeReturnPath("//evil.test", "/account")).toBe("/account");
  });
});
