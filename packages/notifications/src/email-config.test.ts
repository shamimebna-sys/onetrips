import { afterEach, describe, expect, it } from "vitest";
import { isEmailConfigured } from "./deliver";

describe("isEmailConfigured", () => {
  const original = process.env.SMTP_HOST;

  afterEach(() => {
    if (original === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = original;
  });

  it("is false when SMTP_HOST is unset", () => {
    delete process.env.SMTP_HOST;
    expect(isEmailConfigured()).toBe(false);
  });

  it("is false when SMTP_HOST is empty", () => {
    process.env.SMTP_HOST = "";
    expect(isEmailConfigured()).toBe(false);
  });

  it("is true when SMTP_HOST is set", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    expect(isEmailConfigured()).toBe(true);
  });
});
