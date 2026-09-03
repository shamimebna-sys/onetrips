import type { SearchSessionRecord } from "./types";
import { getSharedRedis } from "./redis";

const SESSION_TTL_SECONDS = Number(process.env.FLIGHT_SEARCH_TTL_SECONDS ?? 20 * 60);
const globalForSearchCache = globalThis as unknown as {
  otFlightSearchMemory?: Map<string, { value: string; expiresAt: number }>;
};
const memory =
  globalForSearchCache.otFlightSearchMemory ??
  new Map<string, { value: string; expiresAt: number }>();
globalForSearchCache.otFlightSearchMemory = memory;

function keyFor(sessionId: string) {
  return `ot:search:${sessionId}`;
}

function memoryGet(key: string) {
  const row = memory.get(key);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return row.value;
}

export function sessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export async function saveSearchSession(record: SearchSessionRecord) {
  const payload = JSON.stringify(record);
  const key = keyFor(record.sessionId);
  const client = await getSharedRedis();
  if (client) {
    try {
      await client.setEx(key, SESSION_TTL_SECONDS, payload);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memory.set(key, { value: payload, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
}

function parseSession(raw: string | null): SearchSessionRecord | null {
  if (!raw) return null;
  return JSON.parse(raw) as SearchSessionRecord;
}

export async function loadSearchSession(sessionId: string): Promise<SearchSessionRecord | null> {
  const key = keyFor(sessionId);
  const client = await getSharedRedis();
  try {
    const raw = client ? await client.get(key) : memoryGet(key);
    return parseSession(raw) ?? parseSession(memoryGet(key));
  } catch {
    return parseSession(memoryGet(key));
  }
}
