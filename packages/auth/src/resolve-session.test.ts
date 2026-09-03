import { describe, expect, it } from "vitest";
import { resolveSession } from "./service";
import { signAccessToken } from "./tokens";

describe("resolveSession", () => {
  it("returns the access payload when the access token is valid", async () => {
    const accessToken = signAccessToken({
      sub: "user-1",
      email: "traveler@example.com",
      type: "CUSTOMER",
      permissions: [],
    });
    const resolved = await resolveSession({ accessToken });
    expect(resolved?.payload.sub).toBe("user-1");
    expect(resolved?.payload.type).toBe("CUSTOMER");
    expect(resolved?.setCookies).toBeUndefined();
  });

  it("returns null when no tokens are present", async () => {
    await expect(resolveSession({})).resolves.toBeNull();
  });

  it("returns null when the access token is invalid and there is no refresh token", async () => {
    await expect(resolveSession({ accessToken: "not-a-jwt" })).resolves.toBeNull();
  });
});
