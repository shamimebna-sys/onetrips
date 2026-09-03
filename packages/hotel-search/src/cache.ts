import type { HotelSearchSessionRecord } from "./types";
import { getSharedRedis } from "./redis";

const SESSION_TTL_SECONDS = Number(process.env.HOTEL_SEARCH_TTL_SECONDS ?? 20 * 60);
const memory = new Map<string, { value: string; expiresAt: number }>();

function keyFor(sessionId: string) {
  return `ot:hotel:${sessionId}`;
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

export async function saveSearchSession(record: HotelSearchSessionRecord) {
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

function parseSession(raw: string | null): HotelSearchSessionRecord | null {
  if (!raw) return null;
  return JSON.parse(raw) as HotelSearchSessionRecord;
}

export async function loadSearchSession(sessionId: string): Promise<HotelSearchSessionRecord | null> {
  const key = keyFor(sessionId);
  const client = await getSharedRedis();
  try {
    const raw = client ? await client.get(key) : memoryGet(key);
    return parseSession(raw) ?? parseSession(memoryGet(key));
  } catch {
    return parseSession(memoryGet(key));
  }
}
