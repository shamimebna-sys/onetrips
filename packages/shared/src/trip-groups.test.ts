import { describe, expect, it } from "vitest";
import { customerStatusLabel, tripGroupFor } from "./trip-groups";

describe("tripGroupFor", () => {
  it("keeps future ticketed trips upcoming", () => {
    expect(tripGroupFor({ status: "TICKETED", travelAt: "2099-01-01T00:00:00.000Z" })).toBe("upcoming");
  });

  it("moves past ticketed trips to completed", () => {
    expect(tripGroupFor({ status: "TICKETED", travelAt: "2020-01-01T00:00:00.000Z" })).toBe("completed");
  });

  it("maps refund and cancel states without inventing new ones", () => {
    expect(tripGroupFor({ status: "REFUNDED" })).toBe("refunds");
    expect(tripGroupFor({ status: "CANCELLED" })).toBe("cancelled");
    expect(tripGroupFor({ status: "PAYMENT_PENDING" })).toBe("upcoming");
  });
});

describe("customerStatusLabel", () => {
  it("maps machine states to customer copy", () => {
    expect(customerStatusLabel("PASSENGER_PENDING")).toBe("Traveler details");
    expect(customerStatusLabel("TICKETED")).toBe("Ticketed");
  });
});
