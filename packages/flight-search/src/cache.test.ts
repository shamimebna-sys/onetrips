import { describe, expect, it } from "vitest";
import { loadSearchSession, saveSearchSession } from "./cache";
import type { SearchSessionRecord } from "./types";

describe("search cache", () => {
  it("falls back to memory when Redis is unavailable", async () => {
    delete process.env.REDIS_URL;
    const record: SearchSessionRecord = {
      version: 1,
      sessionId: "sess-redis-down",
      request: {
        tripType: "one-way",
        segments: [{ origin: "DAC", destination: "DXB", date: "2099-12-01" }],
        adults: 1,
        children: 0,
        infants: 0,
        cabin: "ECONOMY",
      },
      offers: [],
      errors: [],
      providerIds: ["mock-gds"],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    await saveSearchSession(record);
    const loaded = await loadSearchSession(record.sessionId);
    expect(loaded?.sessionId).toBe(record.sessionId);
    expect(loaded?.providerIds).toEqual(["mock-gds"]);
  });
});
