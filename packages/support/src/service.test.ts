import { describe, expect, it } from "vitest";
import { createSupportRequestSchema } from "./schemas";

describe("createSupportRequestSchema", () => {
  it("accepts a booking-linked ticket request", () => {
    const parsed = createSupportRequestSchema.parse({
      category: "ticket",
      subject: "Missing e-ticket PDF",
      message: "I paid but cannot download the PDF.",
      bookingId: "clxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(parsed.category).toBe("ticket");
  });

  it("rejects a short subject", () => {
    const result = createSupportRequestSchema.safeParse({
      category: "other",
      subject: "Hi",
      message: "This is long enough to send.",
    });
    expect(result.success).toBe(false);
  });
});
