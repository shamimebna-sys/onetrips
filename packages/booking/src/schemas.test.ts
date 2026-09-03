import { describe, expect, it } from "vitest";
import { createBookingSchema } from "./schemas";

describe("createBookingSchema", () => {
  it("never treats browser organizationId as an input field", () => {
    const parsed = createBookingSchema.parse({
      sessionId: "11111111-1111-1111-1111-111111111111",
      offerId: "offer-dac-dxb-1",
      organizationId: "org-from-browser",
    });
    expect(parsed.sessionId).toBe("11111111-1111-1111-1111-111111111111");
    expect(parsed.offerId).toBe("offer-dac-dxb-1");
    expect("organizationId" in parsed).toBe(false);
  });

  it("accepts hotel product without taking organizationId from the browser", () => {
    const parsed = createBookingSchema.parse({
      sessionId: "11111111-1111-1111-1111-111111111111",
      offerId: "htl-dac-1-std",
      product: "HOTEL",
      organizationId: "org-from-browser",
    });
    expect(parsed.product).toBe("HOTEL");
    expect("organizationId" in parsed).toBe(false);
  });
});
