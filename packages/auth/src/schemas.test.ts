import { describe, expect, it } from "vitest";
import { customerRegisterSchema, resetPasswordSchema } from "./schemas";

describe("customer auth schemas", () => {
  it("requires terms and privacy on registration", () => {
    const result = customerRegisterSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "01711111111",
      password: "Secret123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete registration payload", () => {
    const result = customerRegisterSchema.parse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "01711111111",
      password: "Secret123",
      acceptTerms: true,
      acceptPrivacy: true,
      marketingConsent: true,
    });
    expect(result.marketingConsent).toBe(true);
  });

  it("requires a 6-digit reset code", () => {
    const result = resetPasswordSchema.safeParse({
      email: "ada@example.com",
      code: "12",
      password: "Secret123",
    });
    expect(result.success).toBe(false);
  });
});
