import { describe, expect, it } from "vitest";
import { DomainError } from "@onetrips/shared";
import { assertMutationOrigin, assertSameOrigin } from "./rate-limit";

describe("assertSameOrigin", () => {
  it("allows requests with no Origin header", () => {
    expect(() =>
      assertSameOrigin(new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { host: "localhost:3000" } })),
    ).not.toThrow();
  });

  it("rejects a mismatched Origin host", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { host: "localhost:3000", origin: "https://evil.example" },
        }),
      ),
    ).toThrow(DomainError);
  });
});

describe("assertMutationOrigin", () => {
  it("skips GET", () => {
    expect(() =>
      assertMutationOrigin(
        new Request("http://localhost:3000/api/account/bookings", {
          headers: { host: "localhost:3000", origin: "https://evil.example" },
        }),
      ),
    ).not.toThrow();
  });

  it("checks POST", () => {
    expect(() =>
      assertMutationOrigin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { host: "localhost:3000", origin: "https://evil.example" },
        }),
      ),
    ).toThrow(DomainError);
  });
});
