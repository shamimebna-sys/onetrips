import { afterEach, describe, expect, it, vi } from "vitest";

describe("database client module", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  it("can be imported without DATABASE_URL during production build evaluation", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PHASE = "phase-production-build";
    delete process.env.DATABASE_URL;

    const mod = await import("./index");
    expect(mod.prisma).toBeTruthy();
    expect(mod.assertApplicationDatabaseUrl).toEqual(expect.any(Function));
  });

  it("still rejects a missing DATABASE_URL when production runtime validation is invoked", async () => {
    process.env.NODE_ENV = "production";
    const { assertApplicationDatabaseUrl } = await import("./index");
    expect(() => assertApplicationDatabaseUrl(undefined, { required: true, production: true })).toThrow(
      "PostgreSQL is required for production.",
    );
  });
});
